package app.subtrackr.service;

import app.subtrackr.dto.response.InsightsResponse;
import app.subtrackr.repository.PriceTrackerRepository;
import app.subtrackr.repository.SubscriptionRepository;
import app.subtrackr.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InsightsService {

    private final UserRepository            userRepo;
    private final SubscriptionRepository    subscriptionRepo;
    private final PriceTrackerRepository    trackerRepo;

    // ── Simple in-memory cache (avoids a heavy Redis dependency) ────────────
    // Insights are refreshed at most once per hour.  Fine for a stats widget
    // that does not need real-time accuracy.
    private volatile InsightsResponse cachedInsights = null;
    private volatile LocalDateTime    cacheExpiry    = LocalDateTime.MIN;

    @Transactional(readOnly = true)
    public InsightsResponse getInsights() {
        if (cachedInsights != null && LocalDateTime.now().isBefore(cacheExpiry)) {
            log.debug("Returning cached insights (expires {})", cacheExpiry);
            return cachedInsights;
        }

        log.info("Refreshing platform insights cache");
        InsightsResponse fresh = buildInsights();

        cachedInsights = fresh;
        cacheExpiry    = LocalDateTime.now().plusHours(1);
        return fresh;
    }

    // ── Private builder ──────────────────────────────────────────────────────

    private InsightsResponse buildInsights() {

        // 1. Total registered users
        long totalUsers = userRepo.count();

        // 2. Platform-wide average monthly spend per user
        Double rawAvgSpend = subscriptionRepo.findAvgMonthlySpendPerUser();
        BigDecimal avgMonthlySpend = rawAvgSpend != null
                ? BigDecimal.valueOf(rawAvgSpend).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 3. Average active subscriptions per user
        Double rawAvgSubs = subscriptionRepo.findAvgSubscriptionsPerUser();
        double avgSubscriptionsPerUser = rawAvgSubs != null
                ? Math.round(rawAvgSubs * 10.0) / 10.0
                : 0.0;

        // 4. Popular services — top 5 service names by distinct-user count
        List<Object[]> rawPopular = subscriptionRepo
                .findTopServicesByUserCount(5);

        List<InsightsResponse.PopularService> popularServices = rawPopular.stream()
                .map(row -> {
                    String name      = capitalise(String.valueOf(row[0]));
                    long   userCount = ((Number) row[1]).longValue();
                    double sharePct  = totalUsers > 0
                            ? Math.min(100.0, (userCount * 100.0) / totalUsers)
                            : 0.0;
                    return InsightsResponse.PopularService.builder()
                            .name(name)
                            .userCount(userCount)
                            .sharePercent(Math.round(sharePct * 10.0) / 10.0)
                            .build();
                })
                .collect(Collectors.toList());

        // 5. Pause rates by category
        List<Object[]> rawPause = subscriptionRepo.findPauseRatesByCategory();

        List<InsightsResponse.PauseRate> pauseRates = rawPause.stream()
                .map(row -> {
                    String category   = row[0] != null ? String.valueOf(row[0]) : "Other";
                    long   total      = ((Number) row[1]).longValue();
                    long   paused     = ((Number) row[2]).longValue();
                    double pausePct   = total > 0
                            ? Math.round((paused * 100.0 / total) * 10.0) / 10.0
                            : 0.0;
                    return InsightsResponse.PauseRate.builder()
                            .category(category)
                            .total(total)
                            .paused(paused)
                            .pausePercent(pausePct)
                            .build();
                })
                .filter(r -> r.getTotal() >= 3)   // hide categories with very few data points
                .sorted((a, b) -> Long.compare(b.getTotal(), a.getTotal()))
                .limit(6)
                .collect(Collectors.toList());

        // 6. Total active price trackers
        long totalActiveTrackers = trackerRepo.countAllActive();

        // 7. Average target-price-drop percentage
        Double rawAvgDrop = trackerRepo.findAvgTargetPriceDrop();
        double avgTargetPriceDrop = rawAvgDrop != null
                ? Math.round(rawAvgDrop * 10.0) / 10.0
                : 0.0;

        return InsightsResponse.builder()
                .avgMonthlySpend(avgMonthlySpend)
                .avgSubscriptionsPerUser(avgSubscriptionsPerUser)
                .totalActiveUsers(totalUsers)
                .popularServices(popularServices)
                .pauseRates(pauseRates)
                .totalActiveTrackers(totalActiveTrackers)
                .avgTargetPriceDrop(avgTargetPriceDrop)
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** "netflix" → "Netflix",  "amazon prime" → "Amazon Prime" */
    private String capitalise(String input) {
        if (input == null || input.isBlank()) return "Unknown";
        String[] words = input.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(word.charAt(0)))
                    .append(word.substring(1).toLowerCase());
        }
        return sb.toString();
    }
}