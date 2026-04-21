package app.subtrackr.scheduler;

import app.subtrackr.entity.Notification;
import app.subtrackr.entity.User;
import app.subtrackr.repository.NotificationRepository;
import app.subtrackr.repository.UserRepository;
import app.subtrackr.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyDigestJob {

    private final NotificationRepository notificationRepo;
    private final UserRepository userRepo;
    private final EmailService emailService;

    /**
     * Runs every day at 18:00  after BillingReminderJob (09:00) has had
     * the chance to queue up the day's batch of digest notifications.
     *
     * For each user with pending digest rows:
     *   1. Load the notifications (already created in-app by BillingReminderJob).
     *   2. Send one consolidated email listing all of them.
     *   3. Clear the digestPending flag so they're not re-sent tomorrow.
     *
     * Price-drop alerts are NOT batched  they remain immediate because
     * time-sensitivity matters for price decisions.
     */
    @Scheduled(cron = "0 0 18 * * *")
    @Transactional
    public void sendDailyDigests() {
        List<Long> userIds = notificationRepo.findUserIdsWithPendingDigest();

        if (userIds.isEmpty()) {
            log.info("Daily digest: no pending notifications, nothing to send");
            return;
        }

        int sent   = 0;
        int failed = 0;

        for (Long userId : userIds) {
            try {
                User user = userRepo.findById(userId).orElse(null);
                if (user == null) {
                    log.warn("Daily digest: user {} not found, clearing orphan rows", userId);
                    notificationRepo.clearDigestPendingByUserId(userId);
                    continue;
                }

                // Double-check: respect email preferences (user may have opted out
                // after BillingReminderJob already queued the notifications today).
                if (!Boolean.TRUE.equals(user.getEmailNotifications())) {
                    log.debug("Daily digest: user {} opted out of email, skipping", userId);
                    notificationRepo.clearDigestPendingByUserId(userId);
                    continue;
                }

                List<Notification> pending = notificationRepo.findPendingDigestByUserId(userId);
                if (pending.isEmpty()) {
                    // Race condition guard  already cleared by another thread
                    continue;
                }

                emailService.sendDailyDigestEmail(user, pending);

                // Clear the flag only after the email call returns (no exception)
                notificationRepo.clearDigestPendingByUserId(userId);
                sent++;
                log.debug("Daily digest sent: userId={} notifications={}", userId, pending.size());

            } catch (Exception e) {
                // Log and continue  one failed user should not block the rest
                log.error("Daily digest failed for userId={}: {}", userId, e.getMessage(), e);
                failed++;
            }
        }

        log.info("Daily digest complete: {} sent, {} failed", sent, failed);
    }
}