package app.subtrackr.repository;

import app.subtrackr.entity.PriceTracker;
import app.subtrackr.enums.Plan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PriceTrackerRepository extends JpaRepository<PriceTracker, Long> {

    // "" N+1 fix: fetch user eagerly ""
    @Query("SELECT t FROM PriceTracker t JOIN FETCH t.user WHERE t.user.id = :userId AND t.isActive = true")
    List<PriceTracker> findActiveByUserId(@Param("userId") Long userId);

    // "" Paginated ""
    @Query(value = "SELECT t FROM PriceTracker t WHERE t.user.id = :userId AND t.isActive = true",
            countQuery = "SELECT COUNT(t) FROM PriceTracker t WHERE t.user.id = :userId AND t.isActive = true")
    Page<PriceTracker> findActiveByUserIdPaged(@Param("userId") Long userId, Pageable pageable);

    // "" Scheduler: ALL active trackers with user (used by free-tier twice-daily job) ""
    @Query("SELECT t FROM PriceTracker t JOIN FETCH t.user WHERE t.isActive = true")
    List<PriceTracker> findAllActiveWithUser();

    // "" Scheduler: active trackers filtered by user plan """""""""""""""""""""""
    // Used by PriceCheckJob to run hourly for PREMIUM users only and
    // twice-daily for FREE users only " avoids hammering sites on behalf of
    // free accounts while still delivering near-real-time alerts for paying users.
    @Query("SELECT t FROM PriceTracker t JOIN FETCH t.user WHERE t.isActive = true AND t.user.plan = :plan")
    List<PriceTracker> findAllActiveWithUserByPlan(@Param("plan") Plan plan);

    @Query("SELECT t FROM PriceTracker t WHERE t.id = :id AND t.user.id = :userId")
    Optional<PriceTracker> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    long countByUserIdAndIsActiveTrue(Long userId);

    // "" Total potential savings for dashboard ""
    @Query("SELECT COALESCE(SUM(t.highestPrice - t.currentPrice), 0) " +
            "FROM PriceTracker t WHERE t.user.id = :userId " +
            "AND t.isActive = true AND t.highestPrice IS NOT NULL AND t.currentPrice IS NOT NULL " +
            "AND t.highestPrice > t.currentPrice")
    Double sumSavingsByUserId(@Param("userId") Long userId);

    // ── Insights: total active trackers platform-wide ────────────────────────
    // Used instead of JpaRepository.count() so we filter isActive = true only.
    @Query("SELECT COUNT(t) FROM PriceTracker t WHERE t.isActive = true")
    long countAllActive();

    // ── Insights: average % below current price that users set as target ─────
    // Only considers trackers where current > target (user still waiting for
    // the price to fall) so we capture genuine "wishlist" behaviour.
    // Returns null when no qualifying trackers exist.
    @Query(value = """
        SELECT AVG((current_price - target_price) / current_price * 100.0)
        FROM price_trackers
        WHERE is_active    = true
          AND current_price IS NOT NULL
          AND current_price  > target_price
          AND current_price  > 0
        """, nativeQuery = true)
    Double findAvgTargetPriceDrop();
}