package app.subtrackr.service;

import app.subtrackr.dto.request.EmailDraftRequest;
import app.subtrackr.dto.response.EmailDraftResponse;
import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import app.subtrackr.enums.EmailType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Generates subscription-management email drafts using the Groq API
 * (llama-3.3-70b-versatile). Groq is completely free — no billing required.
 *
 * Sign up & get a free key at: https://console.groq.com
 * Add to application.properties:  groq.api-key=gsk_...
 *
 * Falls back to template-based generation if Groq is unavailable or the key
 * is not configured, so the feature is never broken in development.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailDrafterService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
    private static final String GROQ_MODEL = "llama-3.3-70b-versatile";

    // ── Public entry-point ────────────────────────────────────────────────────

    public EmailDraftResponse generateDraft(EmailDraftRequest req) {
        EmailType type = req.getEmailType() == null ? EmailType.CANCEL : req.getEmailType();

        if (groqApiKey != null && !groqApiKey.isBlank()) {
            try {
                return generateWithGroq(req, type);
            } catch (Exception e) {
                log.warn("Groq generation failed ({}), falling back to template", e.getMessage());
            }
        }

        // Fallback: local templates (always works, no API key needed)
        return generateFromTemplate(req, type);
    }

    // ── Groq AI generation ────────────────────────────────────────────────────

    private EmailDraftResponse generateWithGroq(EmailDraftRequest req, EmailType type) {
        String systemPrompt = buildSystemPrompt();
        String userPrompt   = buildUserPrompt(req, type);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> body = Map.of(
                "model",       GROQ_MODEL,
                "temperature", 0.7,
                "max_tokens",  1024,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user",   "content", userPrompt)
                )
        );

        ResponseEntity<String> response = restTemplate.exchange(
                GROQ_URL, HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Groq API returned " + response.getStatusCode());
        }

        return parseGroqResponse(response.getBody(), type, req);
    }

    // ── Prompt construction ───────────────────────────────────────────────────

    private String buildSystemPrompt() {
        return """
            You are an expert at writing professional, persuasive customer-service emails
            for consumers managing their subscriptions. Your emails are:
            
            - Natural and human — never robotic or overly formal
            - Firm and confident, but always polite and respectful
            - Specific with numbers and dates, never vague
            - Concise — every sentence has a purpose
            - Ready to send — the reader only needs to fill in [bracketed placeholders]
            
            IMPORTANT FORMATTING RULES:
            1. Output ONLY a valid JSON object with exactly these keys:
               { "subject": "...", "body": "...", "tip": "..." }
            2. The "body" must use \\n for line breaks (not actual newlines in the JSON).
            3. Use [Your Full Name], [Your Account Email], and [Today's Date: %s] as the
               only placeholders — nothing else should need changing.
            4. The "tip" is a single practical tactic the user can use when sending this email
               (max 120 chars). Start it with a lightbulb emoji 💡.
            5. Do NOT include markdown, code fences, or any text outside the JSON object.
            """.formatted(today());
    }

    private String buildUserPrompt(EmailDraftRequest req, EmailType type) {
        String sym     = sym(req.getCurrency());
        double yearly  = annualCost(req);
        int    months  = req.getMonthsSubscribed() != null ? req.getMonthsSubscribed() : 0;
        String cycle   = req.getBillingCycle() != null
                ? req.getBillingCycle().name().toLowerCase() : "monthly";

        String goal = switch (type) {
            case CANCEL    -> "cancel the subscription immediately and get written confirmation";
            case NEGOTIATE -> "negotiate a lower price or loyalty discount without cancelling";
            case PAUSE     -> "temporarily pause billing for 1–3 months without losing the account";
            case COMPLAINT -> "formally complain about a service issue and request compensation";
            case RETENTION -> "counter a weak retention offer and ask for a better deal";
        };

        StringBuilder sb = new StringBuilder();
        sb.append("Write a ").append(type.name().toLowerCase()).append(" email for a ").append(req.getSubscriptionName()).append(" subscription.\n\n");
        sb.append("SUBSCRIPTION DETAILS:\n");
        sb.append("- Service: ").append(req.getSubscriptionName()).append("\n");
        sb.append("- Amount: ").append(sym).append(String.format("%.2f", req.getAmount() != null ? req.getAmount() : 0)).append(" ").append(req.getCurrency()).append(" per ").append(cycle).append("\n");
        sb.append("- Annual cost: ").append(sym).append(String.format("%.2f", yearly)).append("\n");
        if (req.getCategory() != null) sb.append("- Category: ").append(req.getCategory()).append("\n");
        if (months > 0) sb.append("- Customer for: ").append(months).append(" months\n");

        sb.append("\nGOAL: ").append(goal).append("\n");

        if (req.getContext() != null && !req.getContext().isBlank()) {
            sb.append("\nUSER'S CONTEXT / REASON:\n").append(req.getContext().trim()).append("\n");
        }

        sb.append("\nToday's date: ").append(today()).append("\n");
        sb.append("\nNow write the email. Output ONLY the JSON object.");

        return sb.toString();
    }

    // ── Parse Groq JSON response ───────────────────────────────────────────────

    private EmailDraftResponse parseGroqResponse(String raw, EmailType type, EmailDraftRequest req) {
        try {
            JsonNode root    = objectMapper.readTree(raw);
            String   content = root.path("choices").get(0).path("message").path("content").asText();

            // Strip any accidental markdown code fences
            content = content.trim();
            if (content.startsWith("```")) {
                content = content.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }

            JsonNode parsed  = objectMapper.readTree(content);
            String   subject = parsed.path("subject").asText("Email Request — " + req.getSubscriptionName());
            String   body    = parsed.path("body").asText("");
            String   tip     = parsed.path("tip").asText("💡 Keep a copy of the reply for your records.");

            // Ensure \n sequences in body are real newlines
            body = body.replace("\\n", "\n");

            return EmailDraftResponse.builder()
                    .subject(subject)
                    .body(body)
                    .tip(tip)
                    .emailType(type)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse Groq response: {}", e.getMessage());
            throw new RuntimeException("Could not parse AI response", e);
        }
    }

    // ── Template fallback (no API key) ─────────────────────────────────────────

    private EmailDraftResponse generateFromTemplate(EmailDraftRequest req, EmailType type) {
        return switch (type) {
            case CANCEL    -> buildCancelEmail(req);
            case NEGOTIATE -> buildNegotiateEmail(req);
            case PAUSE     -> buildPauseEmail(req);
            case COMPLAINT -> buildComplaintEmail(req);
            case RETENTION -> buildRetentionEmail(req);
        };
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────

    private EmailDraftResponse buildCancelEmail(EmailDraftRequest req) {
        String sym    = sym(req.getCurrency());
        double yearly = annualCost(req);
        String ctx    = ctx(req.getContext(), "Reason for cancelling");

        String body = """
            Dear %s Support Team,
            
            I am writing to formally request the cancellation of my %s subscription, effective immediately.
            %s
            I have valued the service; however, I need to reduce my monthly outgoings. At %s%.2f per billing cycle — approximately %s%.2f per year — this subscription no longer fits my budget.
            
            Please confirm the following once processed:
            
            1. The cancellation has been completed and my account closed.
            2. No further charges will be applied to my payment method.
            3. Any prorated refund (if applicable under your policy) will be issued.
            
            I would appreciate a confirmation email to the address on my account. If there is a self-service cancellation option, please direct me to it.
            
            Thank you for your time.
            
            Kind regards,
            [Your Full Name]
            [Your Account Email]
            [Today's Date: %s]
            """.formatted(
                req.getSubscriptionName(), req.getSubscriptionName(), ctx,
                sym, req.getAmount() != null ? req.getAmount() : 0,
                sym, yearly, today()
        );

        return EmailDraftResponse.builder()
                .subject("Cancellation Request — " + req.getSubscriptionName() + " Subscription")
                .body(body)
                .emailType(EmailType.CANCEL)
                .tip("💡 Many agents can offer 1–3 months free to prevent cancellations. Be ready to say 'no thanks' once.")
                .build();
    }

    // ── NEGOTIATE ─────────────────────────────────────────────────────────────

    private EmailDraftResponse buildNegotiateEmail(EmailDraftRequest req) {
        String sym    = sym(req.getCurrency());
        double yearly = annualCost(req);
        int months    = req.getMonthsSubscribed() != null ? req.getMonthsSubscribed() : 6;
        String ctx    = ctx(req.getContext(), "Additional context");

        String body = """
            Dear %s Support Team,
            
            I hope this message finds you well. I'm reaching out about the pricing on my %s subscription.
            %s
            I've been a subscriber for %d months and genuinely enjoy the service. However, at %s%.2f per billing cycle (around %s%.2f per year), I'm finding it difficult to justify the cost — especially as I've seen competitors offering comparable plans at lower prices.
            
            Before I consider cancelling, I wanted to check whether you're able to offer:
            
            1. A loyalty discount or promotional rate for long-term customers.
            2. A lower-tier plan that still meets my core needs.
            3. A reduced rate for switching to annual billing.
            
            I'd genuinely like to stay — I just need the price to make sense for my budget. I look forward to hearing what you can do.
            
            Kind regards,
            [Your Full Name]
            [Your Account Email]
            [Today's Date: %s]
            """.formatted(
                req.getSubscriptionName(), req.getSubscriptionName(), ctx,
                months, sym, req.getAmount() != null ? req.getAmount() : 0,
                sym, yearly, today()
        );

        return EmailDraftResponse.builder()
                .subject("Pricing Review Request — " + req.getSubscriptionName())
                .body(body)
                .emailType(EmailType.NEGOTIATE)
                .tip("💡 Name a specific competitor price — agents respond faster to concrete numbers than vague complaints.")
                .build();
    }

    // ── PAUSE ─────────────────────────────────────────────────────────────────

    private EmailDraftResponse buildPauseEmail(EmailDraftRequest req) {
        String sym = sym(req.getCurrency());
        String ctx = ctx(req.getContext(), "Reason for pause");

        String body = """
            Dear %s Support Team,
            
            I'm writing to ask whether it's possible to temporarily pause my %s subscription for 1–3 months.
            %s
            I'd prefer to pause rather than cancel, as I intend to return and don't want to lose my account history and settings. I'm currently paying %s%.2f per billing cycle and I'd rather not lose my data by cancelling outright.
            
            Could you please let me know:
            
            1. Whether a pause option exists on my current plan.
            2. The maximum pause duration available.
            3. Whether any charges apply during the pause.
            4. How to reactivate when I'm ready to return.
            
            If pausing isn't possible, I'd appreciate information on any reduced-cost alternatives.
            
            Thank you,
            [Your Full Name]
            [Your Account Email]
            [Today's Date: %s]
            """.formatted(
                req.getSubscriptionName(), req.getSubscriptionName(), ctx,
                sym, req.getAmount() != null ? req.getAmount() : 0, today()
        );

        return EmailDraftResponse.builder()
                .subject("Subscription Pause Request — " + req.getSubscriptionName())
                .body(body)
                .emailType(EmailType.PAUSE)
                .tip("💡 Many services don't advertise pausing — it's worth asking directly. Netflix, Spotify, and most SaaS tools offer it.")
                .build();
    }

    // ── COMPLAINT ─────────────────────────────────────────────────────────────

    private EmailDraftResponse buildComplaintEmail(EmailDraftRequest req) {
        String sym = sym(req.getCurrency());
        String ctx = ctx(req.getContext(), "Issue description");

        String body = """
            Dear %s Support Team,
            
            I'm a paying %s subscriber (%s%.2f per billing cycle) and I'm writing to formally raise a complaint.
            %s
            This issue has affected my ability to use the service I'm paying for, and I believe it warrants a prompt and clear response.
            
            I'm requesting:
            
            1. Acknowledgement of this complaint within 2 business days.
            2. A clear explanation of what caused the problem.
            3. Confirmation of steps being taken to prevent recurrence.
            4. Appropriate compensation — such as account credit, an extended billing period, or a partial refund.
            
            I'd like to resolve this without escalating further and remain a satisfied customer. If this isn't addressed to a reasonable standard, I will reconsider my subscription.
            
            Please reply to this email address at your earliest convenience.
            
            Kind regards,
            [Your Full Name]
            [Your Account Email]
            [Today's Date: %s]
            """.formatted(
                req.getSubscriptionName(), req.getSubscriptionName(),
                sym, req.getAmount() != null ? req.getAmount() : 0,
                ctx, today()
        );

        return EmailDraftResponse.builder()
                .subject("Formal Complaint — " + req.getSubscriptionName() + " Service Issue")
                .body(body)
                .emailType(EmailType.COMPLAINT)
                .tip("💡 State the exact resolution you want upfront — agents close tickets faster when success is clearly defined.")
                .build();
    }

    // ── RETENTION ─────────────────────────────────────────────────────────────

    private EmailDraftResponse buildRetentionEmail(EmailDraftRequest req) {
        String sym    = sym(req.getCurrency());
        double yearly = annualCost(req);
        String ctx    = ctx(req.getContext(), "The offer received");

        String body = """
            Dear %s Support Team,
            
            Thank you for the retention offer regarding my %s subscription — I appreciate the gesture.
            
            However, the offer as presented doesn't quite meet the value I need to confidently commit to continuing at %s%.2f per billing cycle (%s%.2f/year).
            %s
            To stay as a subscriber, I would need one of the following:
            
            1. A minimum 30%% discount on my current plan for the next 6–12 months.
            2. An upgrade to the next plan tier at my current price.
            3. [Or describe your preferred outcome here.]
            
            I want to be transparent: I've identified a comparable alternative at a lower price point. I'd genuinely prefer to stay with %s, but only if the offer reflects my value as a long-term customer.
            
            Could you please escalate this to a retention specialist if needed? I'm happy to discuss further.
            
            Kind regards,
            [Your Full Name]
            [Your Account Email]
            [Today's Date: %s]
            """.formatted(
                req.getSubscriptionName(), req.getSubscriptionName(),
                sym, req.getAmount() != null ? req.getAmount() : 0,
                sym, yearly, ctx,
                req.getSubscriptionName(), today()
        );

        return EmailDraftResponse.builder()
                .subject("Re: Retention Offer — Counter-Proposal for " + req.getSubscriptionName())
                .body(body)
                .emailType(EmailType.RETENTION)
                .tip("💡 A counter-offer with a specific number (e.g. '30% off') works far better than a vague 'I want a better deal'.")
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String sym(Currency currency) {
        if (currency == null) return "€";
        return switch (currency) {
            case USD -> "$";
            case GBP -> "£";
            default  -> "€";
        };
    }

    private double annualCost(EmailDraftRequest req) {
        if (req.getAmount() == null) return 0;
        BillingCycle cycle = req.getBillingCycle() != null ? req.getBillingCycle() : BillingCycle.MONTHLY;
        return switch (cycle) {
            case YEARLY -> req.getAmount();
            case WEEKLY -> req.getAmount() * 52;
            default     -> req.getAmount() * 12;
        };
    }

    private String ctx(String input, String label) {
        if (input == null || input.isBlank()) return "\n";
        return "\n" + label + ": " + input.trim() + "\n\n";
    }

    private String today() {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH));
    }
}