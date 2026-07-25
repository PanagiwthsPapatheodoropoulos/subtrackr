package app.subtrackr.service;

import app.subtrackr.dto.request.PriceTrackerRequest;
import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.dto.response.PricePointDto;
import app.subtrackr.dto.response.PriceTrackerResponse;
import app.subtrackr.entity.*;
import app.subtrackr.enums.NotificationType;
import app.subtrackr.enums.Plan;
import app.subtrackr.exception.FreemiumLimitException;
import app.subtrackr.exception.ResourceNotFoundException;
import app.subtrackr.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PriceTrackerService {

    private final PriceTrackerRepository trackerRepo;
    private final PriceHistoryRepository historyRepo;
    private final UserRepository userRepo;
    private final ScraperService scraperService;
    private final NotificationService notificationService;
    private final FirebaseService firebaseService;
    private final EmailService emailService;
    private final AffiliateService affiliateService;   // ← injected

    @Value("${app.freemium.max-trackers:2}")
    private int maxFreeTrackers;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional
    public PriceTrackerResponse create(PriceTrackerRequest req) {
        User user = getCurrentUser();

        if (Plan.FREE.equals(user.getPlan())) {
            int totalEver = user.getTotalTrackersCreated();
            if (totalEver >= maxFreeTrackers) {
                throw new FreemiumLimitException(
                        "Free plan allows creating up to " + maxFreeTrackers + " price trackers total. " +
                                "Upgrade to Premium for unlimited tracking!"
                );
            }
        }

        // ── Resolve affiliate URL ─────────────────────────────────────────────
        // Priority:
        //   1. If the user supplied their own affiliate URL in the request, use it.
        //   2. Otherwise, auto-inject our affiliate tag for known shops.
        //   3. If neither applies, affiliateUrl stays null — buyUrl falls back to url.
        String resolvedAffiliateUrl;
        if (req.getAffiliateUrl() != null && !req.getAffiliateUrl().isBlank()) {
            // User provided their own link (power-user / partner override)
            resolvedAffiliateUrl = req.getAffiliateUrl().trim();
            log.debug("Using user-supplied affiliate URL for {}", req.getUrl());
        } else {
            // Auto-inject SubTrackr's affiliate tag
            String tagged = affiliateService.buildAffiliateUrl(req.getUrl());
            resolvedAffiliateUrl = tagged.equals(req.getUrl()) ? null : tagged;
            if (resolvedAffiliateUrl != null) {
                log.info("Affiliate tag injected for URL: {}", req.getUrl());
            }
        }

        Optional<ScraperService.ScrapeResult> result = scraperService.scrape(req.getUrl());

        PriceTracker tracker = PriceTracker.builder()
                .user(user)
                .url(req.getUrl())
                .affiliateUrl(resolvedAffiliateUrl)          // ← auto-resolved
                .targetPrice(req.getTargetPrice())
                .productName(result.map(ScraperService.ScrapeResult::productName).orElse("Product"))
                .currentPrice(result.map(ScraperService.ScrapeResult::price).orElse(null))
                .lowestPrice(result.map(ScraperService.ScrapeResult::price).orElse(null))
                .highestPrice(result.map(ScraperService.ScrapeResult::price).orElse(null))
                .shopName(result.map(ScraperService.ScrapeResult::shopName).orElse("Shop"))
                .imageUrl(result.map(ScraperService.ScrapeResult::imageUrl).orElse(null))
                .lastChecked(LocalDateTime.now())
                .build();

        trackerRepo.save(tracker);

        if (tracker.getCurrentPrice() != null) {
            historyRepo.save(PriceHistory.builder()
                    .tracker(tracker)
                    .price(tracker.getCurrentPrice())
                    .build());
        }

        user.setTotalTrackersCreated(user.getTotalTrackersCreated() + 1);
        userRepo.save(user);

        return toResponse(tracker, List.of());
    }

    public PageResponse<PriceTrackerResponse> getPaged(int page, int size) {
        User user = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<PriceTracker> result = trackerRepo.findActiveByUserIdPaged(user.getId(), pageable);

        if (result.isEmpty()) return PageResponse.of(result.map(t -> toResponse(t, List.of())));

        List<Long> ids = result.getContent().stream().map(PriceTracker::getId).toList();
        List<PriceHistory> allHistory = historyRepo.findTop30ForTrackers(ids);
        Map<Long, List<PriceHistory>> historyMap = allHistory.stream()
                .collect(Collectors.groupingBy(h -> h.getTracker().getId()));

        return PageResponse.of(result.map(t -> toResponse(t, historyMap.getOrDefault(t.getId(), List.of()))));
    }

    @Transactional
    public void delete(Long id) {
        User user = getCurrentUser();
        PriceTracker tracker = trackerRepo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tracker not found"));
        tracker.setIsActive(false);
        trackerRepo.save(tracker);
    }

    // ── Called by PriceCheckJob scheduler ────────────────────────────────────
    @Transactional
    public void checkAndUpdatePrice(PriceTracker tracker) {
        Optional<ScraperService.ScrapeResult> result = scraperService.scrape(tracker.getUrl());
        if (result.isEmpty()) {
            log.warn("Could not scrape tracker id={} url={}", tracker.getId(), tracker.getUrl());
            return;
        }

        BigDecimal newPrice = result.get().price();
        BigDecimal oldPrice = tracker.getCurrentPrice();

        tracker.setCurrentPrice(newPrice);
        tracker.setLastChecked(LocalDateTime.now());

        if (tracker.getLowestPrice() == null || newPrice.compareTo(tracker.getLowestPrice()) < 0) {
            tracker.setLowestPrice(newPrice);
        }
        if (tracker.getHighestPrice() == null || newPrice.compareTo(tracker.getHighestPrice()) > 0) {
            tracker.setHighestPrice(newPrice);
        }

        trackerRepo.save(tracker);
        historyRepo.save(PriceHistory.builder().tracker(tracker).price(newPrice).build());

        boolean droppedBelowTarget   = newPrice.compareTo(tracker.getTargetPrice()) <= 0;
        boolean priceActuallyDropped = oldPrice != null && newPrice.compareTo(oldPrice) < 0;

        if (droppedBelowTarget && priceActuallyDropped) {
            // Resolve the buy URL: affiliate URL takes priority over the raw product URL
            String buyUrl = (tracker.getAffiliateUrl() != null && !tracker.getAffiliateUrl().isBlank())
                    ? tracker.getAffiliateUrl()
                    : tracker.getUrl();

            String title = "💰 Price Drop Alert!";
            String body  = String.format("%s dropped to %.2f! Your target was %.2f",
                    tracker.getProductName(), newPrice, tracker.getTargetPrice());

            notificationService.createInApp(tracker.getUser(), title, body, NotificationType.PRICE_DROP);

            boolean pushDelivered = false;

            if (tracker.getUser().getFcmToken() != null
                    && !tracker.getUser().getFcmToken().isBlank()) {
                firebaseService.sendPushNotification(tracker.getUser().getFcmToken(), title, body, NotificationType.PRICE_DROP);
                pushDelivered = true;
                log.debug("Price drop push sent: tracker={} user={} price={}",
                        tracker.getId(), tracker.getUser().getEmail(), newPrice);
            }

            if (!pushDelivered
                    && Boolean.TRUE.equals(tracker.getUser().getEmailNotifications())) {
                emailService.sendPriceDropEmail(
                        tracker.getUser(),
                        tracker.getProductName(),
                        oldPrice.doubleValue(),
                        newPrice.doubleValue(),
                        buyUrl
                );
                log.debug("Price drop email sent: tracker={} user={} price={}",
                        tracker.getId(), tracker.getUser().getEmail(), newPrice);
            }
        }
    }

    private PriceTrackerResponse toResponse(PriceTracker t, List<PriceHistory> history) {
        List<PricePointDto> historyDtos = history.stream()
                .map(h -> new PricePointDto(h.getPrice(), h.getRecordedAt()))
                .toList();

        BigDecimal savings = null;
        if (t.getHighestPrice() != null && t.getCurrentPrice() != null
                && t.getHighestPrice().compareTo(t.getCurrentPrice()) > 0) {
            savings = t.getHighestPrice().subtract(t.getCurrentPrice());
        }

        String buyUrl = (t.getAffiliateUrl() != null && !t.getAffiliateUrl().isBlank())
                ? t.getAffiliateUrl()
                : t.getUrl();

        return PriceTrackerResponse.builder()
                .id(t.getId())
                .url(t.getUrl())
                .affiliateUrl(t.getAffiliateUrl())
                .buyUrl(buyUrl)
                .productName(t.getProductName())
                .targetPrice(t.getTargetPrice())
                .currentPrice(t.getCurrentPrice())
                .lowestPrice(t.getLowestPrice())
                .highestPrice(t.getHighestPrice())
                .shopName(t.getShopName())
                .imageUrl(t.getImageUrl())
                .isActive(t.getIsActive())
                .lastChecked(t.getLastChecked())
                .history(historyDtos)
                .belowTarget(t.getCurrentPrice() != null
                        && t.getCurrentPrice().compareTo(t.getTargetPrice()) <= 0)
                .savingsFromHighest(savings)
                .build();
    }
}