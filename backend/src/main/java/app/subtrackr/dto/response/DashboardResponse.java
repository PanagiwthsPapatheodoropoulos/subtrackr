package app.subtrackr.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data @Builder
public class DashboardResponse {
    private BigDecimal monthlyTotal;
    private BigDecimal yearlyTotal;
    private int activeSubscriptions;
    private int activeTrackers;
    private long unreadNotifications;
    private BigDecimal totalSavings;          // real: sum(highest - current) across trackers
    private List<Map<String, Object>> categoryBreakdown;
    private List<SubscriptionResponse> upcomingBillings;
    private List<MonthlySpendDto> monthlyTrend;  // real 6-month data
}