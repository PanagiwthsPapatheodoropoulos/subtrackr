package app.subtrackr.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class InsightsResponse {

    /** Platform-wide average monthly spend per active user (EUR-normalised). */
    private BigDecimal avgMonthlySpend;

    /** Average number of active subscriptions per user. */
    private double avgSubscriptionsPerUser;

    /** Total number of registered users on the platform. */
    private long totalActiveUsers;

    /** Top 5 most-tracked service names with user counts. */
    private List<PopularService> popularServices;

    /** Pause-rate breakdown by subscription category. */
    private List<PauseRate> pauseRates;

    /** Total active price trackers across all users. */
    private long totalActiveTrackers;

    /**
     * Average % by which users set their target price below the current price.
     * e.g. 18.5 means users on average want a ~18.5 % discount before buying.
     */
    private double avgTargetPriceDrop;

    // ── Nested types ────────────────────────────────────────────────────────

    @Data
    @Builder
    public static class PopularService {
        private String name;
        private long   userCount;
        private double sharePercent;   // userCount / totalActiveUsers * 100
    }

    @Data
    @Builder
    public static class PauseRate {
        private String category;
        private long   total;
        private long   paused;
        private double pausePercent;
    }
}