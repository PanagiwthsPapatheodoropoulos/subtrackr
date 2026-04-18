package app.subtrackr.repository;

import app.subtrackr.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    //  Paginated (replaces findAll which loads everything) 
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUserIdAndIsReadFalse(Long userId);

    //  N+1 fix: single UPDATE instead of load-all + save-each 
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllReadByUserId(@Param("userId") Long userId);

    //  Delete old read notifications (called by MaintenanceJob) 
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.isRead = true AND n.createdAt < :cutoff")
    void deleteOldReadNotifications(@Param("cutoff") LocalDateTime cutoff);

    //  Digest: find all pending notifications for a specific user 
    // Used by DailyDigestJob to build the per-user digest email.
    // Ordered oldest-first so the email reads chronologically.
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.digestPending = true ORDER BY n.createdAt ASC")
    List<Notification> findPendingDigestByUserId(@Param("userId") Long userId);

    //  Digest: find all distinct user IDs that have pending digest rows 
    // Avoids loading full notification objects just to get the user list.
    @Query("SELECT DISTINCT n.user.id FROM Notification n WHERE n.digestPending = true")
    List<Long> findUserIdsWithPendingDigest();

    //  Digest: clear the flag for a user after digest email is sent 
    // Single UPDATE  avoids loading + saving each row individually.
    @Modifying
    @Query("UPDATE Notification n SET n.digestPending = false WHERE n.user.id = :userId AND n.digestPending = true")
    void clearDigestPendingByUserId(@Param("userId") Long userId);
}