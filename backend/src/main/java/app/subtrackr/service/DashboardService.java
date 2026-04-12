package app.subtrackr.service;

import app.subtrackr.dto.response.DashboardResponse;
import app.subtrackr.dto.response.MonthlySpendDto;
import app.subtrackr.dto.response.SubscriptionResponse;
import app.subtrackr.entity.SpendingSnapshot;
import app.subtrackr.entity.User;
import app.subtrackr.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final UserRepository userRepo;
    private final SubscriptionRepository subscriptionRepo;
    private final PriceTrackerRepository trackerRepo;
    private final NotificationService notificationService;
    private final SubscriptionService subscriptionService;
    private final SpendingSnapshotRepository snapshotRepo;

    //  No longer reads from SecurityContextHolder.
    //    The caller (DashboardController) owns the authentication context
    //    and passes the resolved email in, exactly like every other service.
    @Transactional
    public DashboardResponse getDashboard(String email) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Long userId = user.getId();

        // All in separate optimised queries  no N+1
        Double monthlyRaw  = subscriptionRepo.sumNormalizedMonthly(userId);
        BigDecimal monthly = monthlyRaw != null
                ? BigDecimal.valueOf(monthlyRaw).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal yearly  = monthly.multiply(BigDecimal.valueOf(12)).setScale(2, RoundingMode.HALF_UP);

        long activeSubs     = subscriptionRepo.countByUserIdAndIsActiveTrue(userId);
        long activeTrackers = trackerRepo.countByUserIdAndIsActiveTrue(userId);
        long unread         = notificationService.getUnreadCount(userId);

        Double savingsRaw  = trackerRepo.sumSavingsByUserId(userId);
        BigDecimal savings = savingsRaw != null
                ? BigDecimal.valueOf(savingsRaw).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Category breakdown
        List<Object[]> rawBreakdown = subscriptionRepo.getCategoryBreakdown(userId);
        List<Map<String, Object>> breakdown = rawBreakdown.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", row[0] != null ? row[0].toString() : "Other");
            m.put("count",    ((Number) row[1]).longValue());
            m.put("total",    row[2] != null
                    ? BigDecimal.valueOf(((Number) row[2]).doubleValue()).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO);
            return m;
        }).toList();

        // Upcoming billings (next 7 days)
        List<SubscriptionResponse> upcoming = subscriptionService.getAll().stream()
                .filter(s -> s.getDaysUntilBilling() >= 0 && s.getDaysUntilBilling() <= 7)
                .sorted(Comparator.comparingInt(SubscriptionResponse::getDaysUntilBilling))
                .limit(5)
                .toList();

        // Real 6-month trend: save/update today's snapshot, then fetch last 6
        updateCurrentMonthSnapshot(user, monthly);
        List<MonthlySpendDto> trend = buildMonthlyTrend(userId, monthly);

        return DashboardResponse.builder()
                .monthlyTotal(monthly)
                .yearlyTotal(yearly)
                .activeSubscriptions((int) activeSubs)
                .activeTrackers((int) activeTrackers)
                .unreadNotifications(unread)
                .totalSavings(savings)
                .categoryBreakdown(breakdown)
                .upcomingBillings(upcoming)
                .monthlyTrend(trend)
                .build();
    }

    //  Upsert current month's spend snapshot 
    @Transactional
    public void updateCurrentMonthSnapshot(User user, BigDecimal amount) {
        int year  = LocalDateTime.now().getYear();
        int month = LocalDateTime.now().getMonthValue();

        snapshotRepo.findByUserIdAndYearAndMonth(user.getId(), year, month)
                .ifPresentOrElse(
                        snap -> { snap.setTotalAmount(amount); snapshotRepo.save(snap); },
                        () -> snapshotRepo.save(SpendingSnapshot.builder()
                                .user(user).year(year).month(month).totalAmount(amount).build())
                );
    }

    private List<MonthlySpendDto> buildMonthlyTrend(Long userId, BigDecimal currentMonthTotal) {
        var snapshots = snapshotRepo.findLast6ByUserId(
                userId, org.springframework.data.domain.PageRequest.of(0, 6));

        Map<String, BigDecimal> byKey = new LinkedHashMap<>();
        for (SpendingSnapshot s : snapshots) {
            byKey.put(s.getYear() + "-" + s.getMonth(), s.getTotalAmount());
        }

        List<MonthlySpendDto> result = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        for (int i = 5; i >= 0; i--) {
            LocalDateTime m = now.minusMonths(i);
            String key   = m.getYear() + "-" + m.getMonthValue();
            String label = Month.of(m.getMonthValue()).getDisplayName(TextStyle.SHORT, java.util.Locale.ENGLISH);
            BigDecimal total = i == 0
                    ? currentMonthTotal
                    : byKey.getOrDefault(key, BigDecimal.ZERO);

            result.add(new MonthlySpendDto(m.getYear(), m.getMonthValue(), label, total));
        }
        return result;
    }
}