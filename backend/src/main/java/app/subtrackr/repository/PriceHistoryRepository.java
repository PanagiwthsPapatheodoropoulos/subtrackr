package app.subtrackr.repository;

import app.subtrackr.entity.PriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface PriceHistoryRepository extends JpaRepository<PriceHistory, Long> {

    List<PriceHistory> findByTrackerIdOrderByRecordedAtAsc(Long trackerId);

    //  N+1 fix: load history for ALL trackers in ONE query 
    // Returns last 30 entries per tracker using a window function
    @Query(value = """
        SELECT ph.* FROM price_history ph
        INNER JOIN (
            SELECT id, tracker_id,
                   ROW_NUMBER() OVER (PARTITION BY tracker_id ORDER BY recorded_at DESC) as rn
            FROM price_history
            WHERE tracker_id IN (:trackerIds)
        ) ranked ON ph.id = ranked.id
        WHERE ranked.rn <= 30
        ORDER BY ph.tracker_id, ph.recorded_at ASC
        """, nativeQuery = true)
    List<PriceHistory> findTop30ForTrackers(@Param("trackerIds") List<Long> trackerIds);

    //  For the 6-month trend (real data from price changes) 
    @Query(value = """
        SELECT EXTRACT(YEAR FROM recorded_at) as year,
               EXTRACT(MONTH FROM recorded_at) as month,
               AVG(price) as avg_price
        FROM price_history
        WHERE tracker_id IN (
            SELECT id FROM price_trackers WHERE user_id = :userId AND is_active = true
        )
        AND recorded_at >= NOW() - INTERVAL '6 months'
        GROUP BY year, month
        ORDER BY year, month
        """, nativeQuery = true)
    List<Object[]> getMonthlyAvgPriceForUser(@Param("userId") Long userId);
}