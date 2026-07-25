package app.subtrackr.service;

import app.subtrackr.entity.User;
import app.subtrackr.enums.Plan;
import app.subtrackr.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final UserRepository userRepository;
    private final EmailService   emailService;
    private final RestTemplate   restTemplate;
    private final ObjectMapper   objectMapper;

    @Value("${lemonsqueezy.api-key}")
    private String apiKey;

    @Value("${lemonsqueezy.store-id}")
    private String storeId;

    @Value("${lemonsqueezy.variant-id}")
    private String variantId;

    @Value("${lemonsqueezy.webhook-secret}")
    private String webhookSecret;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private static final String LS_API = "https://api.lemonsqueezy.com/v1";

    // ── Create Checkout ────────────────────────────────────────────────────────
    public String createCheckoutSession(String userEmail) {
        userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Build JSON:API checkout body
        String body = """
            {
              "data": {
                "type": "checkouts",
                "attributes": {
                  "checkout_data": {
                    "email": "%s",
                    "custom": { "user_email": "%s" }
                  },
                  "product_options": {
                    "redirect_url": "%s/payment-success"
                  }
                },
                "relationships": {
                  "store":   { "data": { "type": "stores",   "id": "%s" } },
                  "variant": { "data": { "type": "variants", "id": "%s" } }
                }
              }
            }
            """.formatted(userEmail, userEmail, frontendUrl, storeId, variantId);

        HttpHeaders headers = lsHeaders();
        ResponseEntity<String> resp = restTemplate.exchange(
                LS_API + "/checkouts",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new RuntimeException("Lemon Squeezy checkout creation failed: " + resp.getStatusCode());
        }

        try {
            JsonNode root = objectMapper.readTree(resp.getBody());
            String url = root.path("data").path("attributes").path("url").asText();
            if (url.isBlank()) throw new RuntimeException("No checkout URL in response");
            log.info("Created LS checkout for {}", userEmail);
            return url;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse checkout response: " + e.getMessage());
        }
    }

    // ── Handle Webhook ─────────────────────────────────────────────────────────
    @Transactional
    public void handleWebhook(String payload, String signatureHeader) {
        verifySignature(payload, signatureHeader);

        try {
            JsonNode root      = objectMapper.readTree(payload);
            String   eventName = root.path("meta").path("event_name").asText();
            log.info("Lemon Squeezy webhook: {}", eventName);

            switch (eventName) {
                case "order_created"           -> handleOrderCreated(root);
                case "subscription_created"    -> handleSubscriptionCreated(root);
                case "subscription_cancelled",
                        "subscription_expired"    -> handleSubscriptionEnded(root);
                default -> log.debug("Unhandled LS event: {}", eventName);
            }
        } catch (Exception e) {
            log.error("Webhook processing error: {}", e.getMessage(), e);
            throw new RuntimeException("Webhook processing failed: " + e.getMessage());
        }
    }

    // ── Event handlers ─────────────────────────────────────────────────────────

    private void handleOrderCreated(JsonNode root) {
        // Only act on paid orders
        String status = root.path("data").path("attributes").path("status").asText();
        if (!"paid".equalsIgnoreCase(status)) {
            log.debug("Ignoring order_created with status={}", status);
            return;
        }
        String email      = resolveEmail(root);
        String customerId = root.path("data").path("attributes")
                .path("customer_id").asText(null);
        upgradeToPremium(email, customerId);
    }

    private void handleSubscriptionCreated(JsonNode root) {
        String email      = resolveEmail(root);
        String customerId = root.path("data").path("attributes")
                .path("customer_id").asText(null);
        upgradeToPremium(email, customerId);
    }

    private void handleSubscriptionEnded(JsonNode root) {
        // Try custom_data first, then attributes.user_email
        String email = resolveEmail(root);
        if (email == null || email.isBlank()) {
            log.warn("subscription_cancelled: could not resolve email");
            return;
        }
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setPlan(Plan.FREE);
            userRepository.save(user);
            log.info("Downgraded {} to Free (subscription ended)", email);
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Email resolution priority:
     *   1. meta.custom_data.user_email  (what we pass at checkout)
     *   2. data.attributes.user_email   (LemonSqueezy fills this from the order)
     */
    private String resolveEmail(JsonNode root) {
        String fromCustom = root.path("meta").path("custom_data")
                .path("user_email").asText(null);
        if (fromCustom != null && !fromCustom.isBlank()) return fromCustom;

        return root.path("data").path("attributes")
                .path("user_email").asText(null);
    }

    private void upgradeToPremium(String email, String customerId) {
        if (email == null || email.isBlank()) {
            log.error("upgradeToPremium: email is blank");
            return;
        }
        Optional<User> opt = userRepository.findByEmail(email);
        if (opt.isEmpty()) {
            log.error("Webhook: user not found for email {}", email);
            return;
        }
        User user = opt.get();
        if (Plan.PREMIUM.equals(user.getPlan())) {
            log.debug("User {} is already Premium, skipping", email);
            return;
        }
        user.setPlan(Plan.PREMIUM);
        if (customerId != null) user.setStripeCustomerId(customerId); // reuse column for LS customer ID
        userRepository.save(user);
        log.info("Upgraded {} to Premium (Lemon Squeezy)", email);

        try { emailService.sendPremiumUpgradeEmail(user); }
        catch (Exception e) { log.warn("Premium upgrade email failed: {}", e.getMessage()); }
    }

    private void verifySignature(String payload, String signatureHeader) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            String expected = hex.toString();

            if (!expected.equals(signatureHeader)) {
                log.error("Webhook signature mismatch. Expected={} Got={}",
                        expected, signatureHeader);
                throw new RuntimeException("Invalid webhook signature");
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("Signature verification error: " + e.getMessage());
        }
    }

    private HttpHeaders lsHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.valueOf("application/vnd.api+json"));
        h.setAccept(java.util.List.of(MediaType.valueOf("application/vnd.api+json")));
        h.setBearerAuth(apiKey);
        return h;
    }
}