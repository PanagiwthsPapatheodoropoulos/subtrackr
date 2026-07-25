package app.subtrackr.service;

import app.subtrackr.entity.Notification;
import app.subtrackr.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final RestTemplate restTemplate;

    @Value("${app.mail.enabled}")
    private boolean mailEnabled;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.brevo.api-key}")
    private String brevoApiKey;

    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm");

    //  Welcome email 
    @Async
    public void sendWelcomeEmail(User user) {
        if (!mailEnabled) return;
        String subject = "Welcome to SubTrackr ";
        String html = """
                <h2>Hey %s, welcome aboard!</h2>
                <p>SubTrackr is your personal wallet guardian. Track subscriptions,
                monitor prices, and never overpay again.</p>
                <p>Get started by adding your first subscription on the dashboard.</p>
                <p style="color:#6366f1;font-weight:bold;">Stop overpaying. Start tracking.</p>
                """.formatted(user.getFullName());
        send(user.getEmail(), user.getFullName(), subject, html);
    }

    //  Billing reminder (immediate  for push users, kept for manual triggers) 
    @Async
    public void sendBillingReminderEmail(User user, String subscriptionName, double amount, String date) {
        if (!mailEnabled) return;
        String subject = " Upcoming charge: " + subscriptionName;
        String html = """
                <h2>Billing Reminder</h2>
                <p>Hi %s,</p>
                <p><strong>%s</strong> will charge <strong>%.2f</strong> on <strong>%s</strong>.</p>
                <p>Log in to SubTrackr to manage your subscriptions.</p>
                """.formatted(user.getFullName(), subscriptionName, amount, date);
        send(user.getEmail(), user.getFullName(), subject, html);
    }

    //  Price drop alert (always immediate  time-sensitive) 
    @Async
    public void sendPriceDropEmail(User user, String productName, double oldPrice, double newPrice, String buyUrl) {
        if (!mailEnabled) return;
        double saving = oldPrice - newPrice;
        String subject = " Price drop: " + productName;
        String html = """
                <h2>Price Drop Alert</h2>
                <p>Hi %s,</p>
                <p><strong>%s</strong> dropped from <strong>%.2f</strong>
                to <strong>%.2f</strong>  saving you <strong>%.2f</strong>!</p>
                %s
                """.formatted(user.getFullName(), productName, oldPrice, newPrice, saving,
                buyUrl != null ? "<a href=\"" + buyUrl + "\" style=\"background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;\">Buy Now</a>" : "");
        send(user.getEmail(), user.getFullName(), subject, html);
    }

    //  Generic single notification email 
    @Async
    public void sendNotificationEmail(User user, String title, String body) {
        if (!mailEnabled) return;
        String html = "<h2>%s</h2><p>%s</p>".formatted(title, body);
        send(user.getEmail(), user.getFullName(), title, html);
    }

    //  Premium upgrade confirmation 
    @Async
    public void sendPremiumUpgradeEmail(User user) {
        if (!mailEnabled) return;
        String subject = " You're now a SubTrackr Premium member!";
        String html = """
                <h2>Welcome to Premium, %s!</h2>
                <p>You now have:</p>
                <ul>
                    <li>Unlimited subscriptions &amp; price trackers</li>
                    <li>Real-time push notifications</li>
                    <li>Priority price checks (every hour)</li>
                </ul>
                <p>Thank you for supporting SubTrackr </p>
                """.formatted(user.getFullName());
        send(user.getEmail(), user.getFullName(), subject, html);
    }

    //  Daily digest (batched billing reminders for web-only users) 
    // Called synchronously by DailyDigestJob so it can detect failures and
    // avoid clearing the digestPending flag if the send throws.
    // NOT @Async  the job needs to know if this fails.
    public void sendDailyDigestEmail(User user, List<Notification> notifications) {
        if (!mailEnabled) return;
        if (notifications == null || notifications.isEmpty()) return;

        String subject = " Your SubTrackr daily summary (" + notifications.size()
                + (notifications.size() == 1 ? " reminder)" : " reminders)");

        StringBuilder rows = new StringBuilder();
        for (Notification n : notifications) {
            rows.append("""
                    <tr>
                        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
                            <strong>%s</strong><br>
                            <span style="color:#6b7280;font-size:14px;">%s</span>
                        </td>
                        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap;">
                            %s
                        </td>
                    </tr>
                    """.formatted(
                    escapeHtml(n.getTitle()),
                    escapeHtml(n.getBody()),
                    n.getCreatedAt() != null ? n.getCreatedAt().format(DATE_FMT) : ""));
        }

        String html = """
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#6366f1;"> Your Daily SubTrackr Summary</h2>
                    <p>Hi %s, here's what's coming up:</p>
                    <table style="width:100%%;border-collapse:collapse;">
                        %s
                    </table>
                    <p style="margin-top:24px;font-size:13px;color:#9ca3af;">
                        You're receiving this because you have email notifications enabled.
                        You can turn them off in your SubTrackr profile settings.
                    </p>
                </div>
                """.formatted(escapeHtml(user.getFullName()), rows);

        send(user.getEmail(), user.getFullName(), subject, html);
    }

    //  Shared Brevo HTTP send 
    private void send(String toEmail, String toName, String subject, String htmlContent) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", brevoApiKey);

            Map<String, Object> body = Map.of(
                    "sender",  Map.of("name", "SubTrackr", "email", fromEmail),
                    "to",      List.of(Map.of("email", toEmail, "name", toName)),
                    "subject", subject,
                    "htmlContent", htmlContent
            );

            ResponseEntity<String> response = restTemplate.exchange(
                    BREVO_URL, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Brevo send failed: status={} to={}", response.getStatusCode(), toEmail);
            }
        } catch (Exception e) {
            log.error("Email send error to {}: {}", toEmail, e.getMessage(), e);
            throw e; // Re-throw so DailyDigestJob can detect failures
        }
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}