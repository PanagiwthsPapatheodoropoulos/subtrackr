package app.subtrackr.repository;

import app.subtrackr.entity.Subscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {

    //  N+1 fix: JOIN FETCH user in one query 
    @Query("SELECT s FROM Subscription s JOIN FETCH s.user WHERE s.user.id = :userId AND s.isActive = true ORDER BY s.nextBilling ASC")
    List<Subscription> findActiveByUserId(@Param("userId") Long userId);

    //  Paginated version 
    @Query(value = "SELECT s FROM Subscription s WHERE s.user.id = :userId AND s.isActive = true",
            countQuery = "SELECT COUNT(s) FROM Subscription s WHERE s.user.id = :userId AND s.isActive = true")
    Page<Subscription> findActiveByUserIdPaged(@Param("userId") Long userId, Pageable pageable);

    //  Billing reminders: fetch with user in one query (no N+1 on user.fcmToken) 
    @Query("SELECT s FROM Subscription s JOIN FETCH s.user WHERE s.nextBilling = :date AND s.isActive = true")
    List<Subscription> findByNextBillingWithUser(@Param("date") LocalDate date);

    //  Ownership check (single query) 
    @Query("SELECT s FROM Subscription s WHERE s.id = :id AND s.user.id = :userId")
    Optional<Subscription> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    long countByUserIdAndIsActiveTrue(Long userId);

    @Query("SELECT COALESCE(SUM(CASE " +
            "  WHEN s.billingCycle = 'MONTHLY' THEN s.amount " +
            "  WHEN s.billingCycle = 'YEARLY'  THEN s.amount / 12 " +
            "  WHEN s.billingCycle = 'WEEKLY'  THEN s.amount * 4.33 " +
            "  ELSE 0 END), 0) " +
            "FROM Subscription s WHERE s.user.id = :userId AND s.isActive = true")
    Double sumNormalizedMonthly(@Param("userId") Long userId);

    @Query("SELECT s.category, COUNT(s), " +
            "SUM(CASE WHEN s.billingCycle = 'MONTHLY' THEN s.amount " +
            "         WHEN s.billingCycle = 'YEARLY'  THEN s.amount / 12 " +
            "         WHEN s.billingCycle = 'WEEKLY'  THEN s.amount * 4.33 " +
            "         ELSE 0 END) " +
            "FROM Subscription s WHERE s.user.id = :userId AND s.isActive = true GROUP BY s.category")
    List<Object[]> getCategoryBreakdown(@Param("userId") Long userId);

    //  For duplicate detection: fetch names only 
    @Query("SELECT s.name FROM Subscription s WHERE s.user.id = :userId AND s.isActive = true")
    List<String> findActiveNamesByUserId(@Param("userId") Long userId);


    // Uses a native sub-query because JPQL does not support subqueries in FROM.
    // Excludes paused subscriptions so dormant spend does not skew the average.
    @Query(value = """
        SELECT AVG(monthly_total)
        FROM (
            SELECT SUM(
                CASE billing_cycle
                    WHEN 'MONTHLY' THEN amount
                    WHEN 'YEARLY'  THEN amount / 12.0
                    WHEN 'WEEKLY'  THEN amount * 4.33
                    ELSE 0
                END
            ) AS monthly_total
            FROM subscriptions
            WHERE is_active = true
              AND is_paused = false
            GROUP BY user_id
        ) user_totals
        """, nativeQuery = true)
    Double findAvgMonthlySpendPerUser();

    // ── Insights: average active subscriptions per user ─────────────────────
    @Query(value = """
        SELECT AVG(sub_count)
        FROM (
            SELECT COUNT(*) AS sub_count
            FROM subscriptions
            WHERE is_active = true
            GROUP BY user_id
        ) counts
        """, nativeQuery = true)
    Double findAvgSubscriptionsPerUser();

    // ── Insights: top N service names by number of distinct users ───────────
    // LOWER() normalises "Netflix" / "netflix" / "NETFLIX" to the same bucket.
    // Returns Object[] rows: [name (String), userCount (Long)]
    @Query(value = """
        SELECT LOWER(name) AS name,
               COUNT(DISTINCT user_id) AS user_count
        FROM subscriptions
        WHERE is_active = true
        GROUP BY LOWER(name)
        ORDER BY user_count DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findTopServicesByUserCount(@Param("limit") int limit);

    // ── Insights: pause rates broken down by category ────────────────────────
    // Returns Object[] rows: [category (String), total (Long), paused (Long)]
    @Query("SELECT s.category, " +
            "COUNT(s), " +
            "SUM(CASE WHEN s.isPaused = true THEN 1L ELSE 0L END) " +
            "FROM Subscription s " +
            "WHERE s.isActive = true AND s.category IS NOT NULL " +
            "GROUP BY s.category " +
            "ORDER BY COUNT(s) DESC")
    List<Object[]> findPauseRatesByCategory();
}