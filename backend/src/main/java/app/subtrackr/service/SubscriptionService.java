package app.subtrackr.service;

import app.subtrackr.dto.request.SubscriptionRequest;
import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.dto.response.SubscriptionResponse;
import app.subtrackr.entity.Subscription;
import app.subtrackr.entity.User;
import app.subtrackr.enums.NotificationType;
import app.subtrackr.enums.Plan;
import app.subtrackr.exception.FreemiumLimitException;
import app.subtrackr.exception.ResourceNotFoundException;
import app.subtrackr.repository.SubscriptionRepository;
import app.subtrackr.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;

    @Value("${app.freemium.max-subscriptions:3}")
    private int maxFreeSubscriptions;

    //  Keywords for duplicate detection (expanded beyond streaming)
    private static final Map<String, List<String>> CATEGORY_KEYWORDS = Map.of(
            "streaming", List.of("netflix", "disney", "amazon prime", "apple tv",
                    "hbo", "paramount", "hulu", "peacock", "max", "crunchyroll",
                    "mubi", "curiosity stream"),
            "music",    List.of("spotify", "apple music", "youtube music", "tidal",
                    "deezer", "amazon music"),
            "cloud",    List.of("icloud", "google one", "dropbox", "onedrive",
                    "box", "mega"),
            "gaming",   List.of("xbox game pass", "playstation plus", "ps plus",
                    "nintendo switch online", "ea play", "ubisoft+")
    );

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional
    public SubscriptionResponse create(SubscriptionRequest req) {
        User user = getCurrentUser();

        if (Plan.FREE.equals(user.getPlan())) {
            int totalEver = user.getTotalSubscriptionsCreated();
            if (totalEver >= maxFreeSubscriptions) {
                throw new FreemiumLimitException(
                        "Free plan allows creating up to " + maxFreeSubscriptions + " subscriptions total. " +
                                "Upgrade to Premium for unlimited tracking!"
                );
            }
        }

        Subscription sub = Subscription.builder()
                .user(user)
                .name(req.getName())
                .description(req.getDescription())
                .amount(req.getAmount())
                .currency(req.getCurrency())
                .billingCycle(req.getBillingCycle())
                .nextBilling(req.getNextBilling())
                .category(req.getCategory())
                .color(req.getColor() != null ? req.getColor() : "#6366F1")
                .iconUrl(req.getIconUrl())
                .isPaused(false)
                .build();

        subscriptionRepo.save(sub);

        // Increment cumulative counter (never decremented)
        user.setTotalSubscriptionsCreated(user.getTotalSubscriptionsCreated() + 1);
        userRepo.save(user);

        checkDuplicateAlert(user, req.getName());
        return toResponse(sub);
    }

    public List<SubscriptionResponse> getAll() {
        User user = getCurrentUser();
        return subscriptionRepo.findActiveByUserId(user.getId())
                .stream().map(this::toResponse).toList();
    }

    public PageResponse<SubscriptionResponse> getPaged(int page, int size) {
        User user = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("nextBilling").ascending());
        Page<Subscription> result = subscriptionRepo.findActiveByUserIdPaged(user.getId(), pageable);
        return PageResponse.of(result.map(this::toResponse));
    }

    @Transactional
    public SubscriptionResponse update(Long id, SubscriptionRequest req) {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));

        sub.setName(req.getName());
        sub.setDescription(req.getDescription());
        sub.setAmount(req.getAmount());
        sub.setCurrency(req.getCurrency());
        sub.setBillingCycle(req.getBillingCycle());
        sub.setNextBilling(req.getNextBilling());
        sub.setCategory(req.getCategory());
        sub.setColor(req.getColor());
        sub.setIconUrl(req.getIconUrl());
        return toResponse(subscriptionRepo.save(sub));
    }

    @Transactional
    public void delete(Long id) {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));
        sub.setIsActive(false);
        subscriptionRepo.save(sub);
    }

    //  Pause: subscription stays visible but costs 0 / no billing reminders
    @Transactional
    public SubscriptionResponse pause(Long id) {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));

        if (Boolean.TRUE.equals(sub.getIsPaused())) {
            throw new RuntimeException("Subscription is already paused");
        }

        sub.setIsPaused(true);
        return toResponse(subscriptionRepo.save(sub));
    }

    //  Resume: re-activates a paused subscription
    @Transactional
    public SubscriptionResponse resume(Long id) {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));

        if (Boolean.FALSE.equals(sub.getIsPaused())) {
            throw new RuntimeException("Subscription is not paused");
        }

        sub.setIsPaused(false);
        return toResponse(subscriptionRepo.save(sub));
    }

    //  Expanded duplicate detection: checks streaming, music, cloud, gaming
    private void checkDuplicateAlert(User user, String newName) {
        List<String> existingNames = subscriptionRepo.findActiveNamesByUserId(user.getId());
        String nameLower = newName.toLowerCase();

        CATEGORY_KEYWORDS.forEach((category, keywords) -> {
            boolean newIsInCategory = keywords.stream()
                    .anyMatch(nameLower::contains);

            if (!newIsInCategory) return;

            long countInCategory = existingNames.stream()
                    .filter(name -> keywords.stream()
                            .anyMatch(k -> name.toLowerCase().contains(k)))
                    .count();

            if (countInCategory >= 2) {
                String emoji = switch (category) {
                    case "streaming" -> "📺";
                    case "music"     -> "🎧";
                    case "cloud"     -> "☁️";
                    case "gaming"    -> "🎮";
                    default          -> "⚠️";
                };
                notificationService.createInApp(
                        user,
                        emoji + " Duplicate " + capitalize(category) + " Alert",
                        "You have " + countInCategory + " " + category + " services active. " +
                                "Consider pausing one to save ~" +
                                estimateMonthlyCost(existingNames, keywords) + "/month!",
                        NotificationType.DUPLICATE_ALERT
                );
            }
        });
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String estimateMonthlyCost(List<String> names, List<String> keywords) {
        // Rough estimate based on typical prices
        long count = names.stream()
                .filter(name -> keywords.stream().anyMatch(k -> name.toLowerCase().contains(k)))
                .count();
        return String.format("%.0f", count * 9.99);
    }

    private SubscriptionResponse toResponse(Subscription s) {
        int days = (int) ChronoUnit.DAYS.between(LocalDate.now(), s.getNextBilling());
        return SubscriptionResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .description(s.getDescription())
                .amount(s.getAmount())
                .currency(s.getCurrency())
                .billingCycle(s.getBillingCycle())
                .nextBilling(s.getNextBilling())
                .category(s.getCategory())
                .color(s.getColor())
                .iconUrl(s.getIconUrl())
                .isActive(s.getIsActive())
                .isPaused(s.getIsPaused())
                .createdAt(s.getCreatedAt())
                .daysUntilBilling(days)
                .build();
    }

    public String generateIcs(Long subscriptionId, String userEmail) {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepo.findByIdAndUserId(subscriptionId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription not found"));

        String uid     = "subtrackr-" + sub.getId() + "@subtrackr.app";
        String dtStamp = java.time.LocalDateTime.now(java.time.ZoneOffset.UTC)
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
        String dtStart = sub.getNextBilling()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));

        String rrule = switch (sub.getBillingCycle()) {
            case WEEKLY  -> "RRULE:FREQ=WEEKLY";
            case MONTHLY -> "RRULE:FREQ=MONTHLY";
            case YEARLY  -> "RRULE:FREQ=YEARLY";
        };

        // Use plain ASCII dash — em dash breaks some parsers
        String summary = String.format("SubTrackr: %s - %.2f %s",
                sub.getName(), sub.getAmount(), sub.getCurrency());

        // Flat single-line description (no \n inside ICS property values unless escaped carefully)
        String description = String.format(
                "Recurring %s charge. Amount: %.2f %s. Next billing: %s. Manage at: https://app.subtrackr.io",
                sub.getBillingCycle().name().toLowerCase(),
                sub.getAmount(), sub.getCurrency(),
                sub.getNextBilling()
        );

        return "BEGIN:VCALENDAR\r\n" +
                "VERSION:2.0\r\n" +
                "PRODID:-//SubTrackr//Subscription Tracker//EN\r\n" +
                "CALSCALE:GREGORIAN\r\n" +
                "METHOD:PUBLISH\r\n" +
                "BEGIN:VEVENT\r\n" +
                "UID:" + uid + "\r\n" +
                "DTSTAMP:" + dtStamp + "\r\n" +
                "DTSTART;VALUE=DATE:" + dtStart + "\r\n" +
                rrule + "\r\n" +
                fold("SUMMARY:" + summary) + "\r\n" +
                fold("DESCRIPTION:" + description) + "\r\n" +
                "BEGIN:VALARM\r\n" +
                "ACTION:DISPLAY\r\n" +
                fold("DESCRIPTION:Upcoming charge: " + sub.getName()) + "\r\n" +
                "TRIGGER:-P2D\r\n" +
                "END:VALARM\r\n" +
                "END:VEVENT\r\n" +
                "END:VCALENDAR\r\n";
    }

    /** RFC 5545 line folding: max 75 octets per line, continuation lines start with a space. */
    private String fold(String line) {
        if (line.length() <= 75) return line;
        StringBuilder out = new StringBuilder();
        out.append(line, 0, 75);
        int i = 75;
        while (i < line.length()) {
            out.append("\r\n ");
            int end = Math.min(i + 74, line.length());
            out.append(line, i, end);
            i = end;
        }
        return out.toString();
    }
}