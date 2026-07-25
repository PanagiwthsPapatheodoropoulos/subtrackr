package app.subtrackr.controller;

import app.subtrackr.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create-checkout-session")
    public ResponseEntity<Map<String, String>> createCheckout(Authentication auth) {
        try {
            String url = paymentService.createCheckoutSession(auth.getName());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Checkout error: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Payment service unavailable"));
        }
    }

    // Lemon Squeezy sends X-Signature (not Stripe-Signature)
    @PostMapping(value = "/webhook", consumes = "application/json", produces = "application/json")
    public ResponseEntity<Map<String, String>> webhook(
            @RequestBody String payload,
            @RequestHeader("X-Signature") String sigHeader) {      // ← changed
        try {
            paymentService.handleWebhook(payload, sigHeader);
            return ResponseEntity.ok(Map.of("received", "true"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Webhook error: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Webhook processing failed"));
        }
    }
}