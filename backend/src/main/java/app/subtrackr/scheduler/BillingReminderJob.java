package app.subtrackr.scheduler;

import app.subtrackr.entity.Subscription;
import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.NotificationType;
import app.subtrackr.repository.SubscriptionRepository;
import app.subtrackr.service.EmailService;
import app.subtrackr.service.FirebaseService;
import app.subtrackr.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class BillingReminderJob {

    private final SubscriptionRepository subscriptionRepo;
    private final NotificationService notificationService;
    private final FirebaseService firebaseService;
    private final EmailService emailService;

    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void sendBillingReminders() {
        LocalDate twoDaysLater = LocalDate.now().plusDays(2);
        List<Subscription> upcoming = subscriptionRepo.findByNextBillingWithUser(twoDaysLater);

        int sent = 0;
        int paused = 0;

        for (Subscription sub : upcoming) {
            //  Skip paused subscriptions 
            if (Boolean.TRUE.equals(sub.getIsPaused())) {
                log.debug("Skipping paused subscription id={} name={}", sub.getId(), sub.getName());
                // Still advance the billing date so it stays accurate
                sub.setNextBilling(advanceBillingDate(sub.getNextBilling(), sub.getBillingCycle()));
                subscriptionRepo.save(sub);
                paused++;
                continue;
            }

            String title = " Upcoming Billing: " + sub.getName();
            String body  = String.format("%.2f will be charged in 2 days (%s)",
                    sub.getAmount(), sub.getNextBilling());

            //  Always create in-app notification 
            notificationService.createInApp(sub.getUser(), title, body, NotificationType.BILLING_REMINDER);

            boolean pushDelivered = false;

            //  Push-first: only send push if user has FCM token 
            // Active app users get push only  no inbox spam
            if (sub.getUser().getFcmToken() != null && !sub.getUser().getFcmToken().isBlank()) {
                firebaseService.sendPushNotification(sub.getUser().getFcmToken(), title, body,NotificationType.BILLING_REMINDER);
                pushDelivered = true;
                log.debug("Billing reminder push sent for sub={} user={}", sub.getId(), sub.getUser().getEmail());
            }

            //  Email fallback: only if no push was delivered 
            // This covers web users and users who haven't installed the app.
            // If they have the app (FCM token present), push is sufficient.
            if (!pushDelivered
                    && Boolean.TRUE.equals(sub.getUser().getEmailNotifications())) {
                emailService.sendBillingReminderEmail(
                        sub.getUser(),
                        sub.getName(),
                        sub.getAmount().doubleValue(),
                        sub.getNextBilling().toString()
                );
                log.debug("Billing reminder email sent for sub={} user={}", sub.getId(), sub.getUser().getEmail());
            }

            //  Advance billing date 
            sub.setNextBilling(advanceBillingDate(sub.getNextBilling(), sub.getBillingCycle()));
            subscriptionRepo.save(sub);
            sent++;
        }

        log.info("Billing reminders: {} sent ({} push-only, {} email-fallback), {} paused skipped",
                sent,
                upcoming.stream().filter(s ->
                        !Boolean.TRUE.equals(s.getIsPaused()) &&
                                s.getUser().getFcmToken() != null).count(),
                upcoming.stream().filter(s ->
                        !Boolean.TRUE.equals(s.getIsPaused()) &&
                                s.getUser().getFcmToken() == null &&
                                Boolean.TRUE.equals(s.getUser().getEmailNotifications())).count(),
                paused);
    }

    private LocalDate advanceBillingDate(LocalDate current, BillingCycle cycle) {
        return switch (cycle) {
            case WEEKLY  -> current.plusWeeks(1);
            case MONTHLY -> current.plusMonths(1);
            case YEARLY  -> current.plusYears(1);
        };
    }
}