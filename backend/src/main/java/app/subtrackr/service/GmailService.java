package app.subtrackr.service;

import app.subtrackr.dto.response.GmailAuthUrlResponse;
import app.subtrackr.dto.response.GmailDetectedSubscription;
import app.subtrackr.dto.response.GmailImportResponse;
import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GmailService {

    private final RestTemplate restTemplate;

    @Value("${google.oauth.client-id}")
    private String clientId;

    @Value("${google.oauth.client-secret}")
    private String clientSecret;

    @Value("${google.oauth.redirect-uri}")
    private String redirectUri;

    private static final String AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL  = "https://oauth2.googleapis.com/token";
    private static final String GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
    private static final String SCOPE      = "https://www.googleapis.com/auth/gmail.readonly";

    // ── Service catalogue ──────────────────────────────────────────────────────
    private record ServiceDef(String name, List<String> patterns,
                              String category, String color, String defaultCycle) {}

    private static final List<ServiceDef> SERVICES = List.of(
            new ServiceDef("Netflix",           List.of("netflix"),                                  "Streaming", "#EF4444", "MONTHLY"),
            new ServiceDef("Disney+",           List.of("disney+","disneyplus","disney plus"),       "Streaming", "#1D4ED8", "MONTHLY"),
            new ServiceDef("HBO Max",           List.of("hbo max","hbomax","max.com"),               "Streaming", "#7C3AED", "MONTHLY"),
            new ServiceDef("Apple TV+",         List.of("apple tv+","appletv","apple tv"),           "Streaming", "#374151", "MONTHLY"),
            new ServiceDef("Amazon Prime",      List.of("amazon prime","primevideo"),                "Streaming", "#F59E0B", "MONTHLY"),
            new ServiceDef("Hulu",              List.of("hulu"),                                     "Streaming", "#10B981", "MONTHLY"),
            new ServiceDef("Paramount+",        List.of("paramount+","paramount plus"),              "Streaming", "#1E40AF", "MONTHLY"),
            new ServiceDef("Crunchyroll",       List.of("crunchyroll"),                              "Streaming", "#F97316", "MONTHLY"),
            new ServiceDef("Spotify",           List.of("spotify"),                                  "Music",     "#10B981", "MONTHLY"),
            new ServiceDef("Apple Music",       List.of("apple music"),                              "Music",     "#EC4899", "MONTHLY"),
            new ServiceDef("YouTube Premium",   List.of("youtube premium","youtube music"),          "Music",     "#EF4444", "MONTHLY"),
            new ServiceDef("Tidal",             List.of("tidal"),                                    "Music",     "#0EA5E9", "MONTHLY"),
            new ServiceDef("Deezer",            List.of("deezer"),                                   "Music",     "#A855F7", "MONTHLY"),
            new ServiceDef("Amazon Music",      List.of("amazon music"),                             "Music",     "#F59E0B", "MONTHLY"),
            new ServiceDef("iCloud+",           List.of("icloud"),                                   "Cloud",     "#3B82F6", "MONTHLY"),
            new ServiceDef("Google One",        List.of("google one"),                               "Cloud",     "#10B981", "MONTHLY"),
            new ServiceDef("Dropbox",           List.of("dropbox"),                                  "Cloud",     "#3B82F6", "MONTHLY"),
            new ServiceDef("OneDrive",          List.of("onedrive","microsoft 365","office 365"),    "Cloud",     "#1D4ED8", "MONTHLY"),
            new ServiceDef("Xbox Game Pass",    List.of("game pass","xbox game pass"),               "Gaming",    "#10B981", "MONTHLY"),
            new ServiceDef("PlayStation Plus",  List.of("playstation plus","ps plus","playstation network"), "Gaming", "#1D4ED8", "MONTHLY"),
            new ServiceDef("Nintendo Online",   List.of("nintendo switch online","nintendo online"), "Gaming",    "#EF4444", "YEARLY"),
            new ServiceDef("EA Play",           List.of("ea play","origin access"),                  "Gaming",    "#F97316", "MONTHLY"),
            new ServiceDef("Adobe CC",          List.of("adobe creative cloud","adobe"),             "Software",  "#EF4444", "MONTHLY"),
            new ServiceDef("ChatGPT Plus",      List.of("chatgpt","openai"),                         "Software",  "#10B981", "MONTHLY"),
            new ServiceDef("NordVPN",           List.of("nordvpn"),                                  "Software",  "#3B82F6", "MONTHLY"),
            new ServiceDef("ExpressVPN",        List.of("expressvpn"),                               "Software",  "#EF4444", "MONTHLY"),
            new ServiceDef("Notion",            List.of("notion"),                                   "Software",  "#374151", "MONTHLY"),
            new ServiceDef("Canva",             List.of("canva"),                                    "Software",  "#8B5CF6", "MONTHLY"),
            new ServiceDef("GitHub",            List.of("github"),                                   "Software",  "#374151", "MONTHLY"),
            new ServiceDef("1Password",         List.of("1password"),                                "Software",  "#3B82F6", "MONTHLY"),
            new ServiceDef("LastPass",          List.of("lastpass"),                                 "Software",  "#EF4444", "MONTHLY"),
            new ServiceDef("Headspace",         List.of("headspace"),                                "Fitness",   "#F59E0B", "MONTHLY"),
            new ServiceDef("Calm",              List.of("calm"),                                     "Fitness",   "#6366F1", "MONTHLY"),
            new ServiceDef("Strava",            List.of("strava"),                                   "Fitness",   "#F97316", "MONTHLY"),
            new ServiceDef("Duolingo",          List.of("duolingo"),                                 "Education", "#10B981", "MONTHLY")
    );

    // ── Public API ──────────────────────────────────────────────────────────────

    public GmailAuthUrlResponse buildAuthUrl(String state) {
        String url = AUTH_URL
                + "?client_id="     + enc(clientId)
                + "&redirect_uri="  + enc(redirectUri)
                + "&response_type=code"
                + "&scope="         + enc(SCOPE)
                + "&access_type=offline"
                + "&prompt=consent"
                + "&state="         + enc(state);

        return GmailAuthUrlResponse.builder()
                .authUrl(url)
                .redirectUri(redirectUri)
                .build();
    }

    public GmailImportResponse importSubscriptions(String code) {
        String accessToken = exchangeCode(code);
        log.info("Gmail import: access token obtained, fetching message IDs");

        List<String> messageIds = fetchMessageIds(accessToken);
        log.info("Gmail import: found {} message IDs matching query", messageIds.size());

        if (messageIds.isEmpty()) {
            return GmailImportResponse.builder().detected(List.of()).emailsScanned(0).build();
        }

        List<EmailContent> emails = new ArrayList<>();
        int limit = Math.min(messageIds.size(), 30);
        for (int i = 0; i < limit; i++) {
            try {
                EmailContent content = fetchEmailContent(messageIds.get(i), accessToken);
                if (content != null) emails.add(content);
                if (i < limit - 1) Thread.sleep(100);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("Failed to fetch Gmail message {}: {}", messageIds.get(i), e.getMessage());
            }
        }

        List<GmailDetectedSubscription> detected = parseEmails(emails);
        log.info("Gmail import: scanned {} emails, detected {} subscriptions", emails.size(), detected.size());

        return GmailImportResponse.builder()
                .detected(detected)
                .emailsScanned(emails.size())
                .build();
    }

    // ── OAuth token exchange ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String exchangeCode(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code",          code);
        params.add("client_id",     clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri",  redirectUri);
        params.add("grant_type",    "authorization_code");

        ResponseEntity<Map> resp = restTemplate.postForEntity(
                TOKEN_URL, new HttpEntity<>(params, headers), Map.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new RuntimeException("Token exchange failed — check OAuth credentials");
        }

        String token = (String) resp.getBody().get("access_token");
        if (token == null || token.isBlank()) {
            throw new RuntimeException("No access_token in Google response");
        }
        return token;
    }

    // ── Gmail API calls ─────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<String> fetchMessageIds(String accessToken) {
        // ── FIX: URLEncoder encodes ":" → "%3A" and "(" → "%28", which makes
        //    Gmail search operators like newer_than:90d and subject:(...) invalid.
        //    Gmail API expects the q value encoded with %20 for spaces but with
        //    ":", "(", ")" left as-is inside the query string.
        //    We use the 5-arg URI constructor which percent-encodes only what
        //    RFC 3986 requires for the query component (spaces, #, etc.) while
        //    leaving ":", "(", ")" unencoded — exactly what Gmail needs. ────────
        String query = "subject:(receipt OR billing OR subscription OR renewal OR invoice OR charged OR payment) newer_than:90d";

        URI uri;
        try {
            // URI(scheme, host, path, query, fragment) — query is encoded by the JDK
            // preserving ":", "(", ")" which are legal query chars per RFC 3986.
            uri = new URI("https", "gmail.googleapis.com",
                    "/gmail/v1/users/me/messages",
                    "maxResults=30&q=" + query,
                    null);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build Gmail URI: " + e.getMessage(), e);
        }

        log.debug("Gmail search URI: {}", uri);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            log.debug("Gmail API response status: {}", resp.getStatusCode());

            if (resp.getBody() == null) {
                log.warn("Gmail API returned null body");
                return List.of();
            }

            // Log the full response for debugging
            log.debug("Gmail API response keys: {}", resp.getBody().keySet());

            Object resultSizeEstimate = resp.getBody().get("resultSizeEstimate");
            log.info("Gmail API resultSizeEstimate: {}", resultSizeEstimate);

            List<Map<String, String>> messages =
                    (List<Map<String, String>>) resp.getBody().get("messages");

            if (messages == null) {
                log.info("Gmail API returned no 'messages' field — inbox matched 0 emails for query");
                return List.of();
            }

            return messages.stream()
                    .map(m -> m.get("id"))
                    .filter(Objects::nonNull)
                    .toList();

        } catch (Exception e) {
            log.error("Gmail message list failed: {} — {}", e.getClass().getSimpleName(), e.getMessage());
            throw new RuntimeException("Failed to list Gmail messages: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private EmailContent fetchEmailContent(String messageId, String accessToken) {
        String url = GMAIL_BASE + "/messages/" + messageId + "?format=full";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        if (resp.getBody() == null) return null;

        Map<String, Object> payload = (Map<String, Object>) resp.getBody().get("payload");
        if (payload == null) return null;

        String from    = "";
        String subject = "";
        List<Map<String, String>> hdrs = (List<Map<String, String>>) payload.get("headers");
        if (hdrs != null) {
            for (Map<String, String> h : hdrs) {
                if ("From".equalsIgnoreCase(h.get("name")))    from    = h.getOrDefault("value", "");
                if ("Subject".equalsIgnoreCase(h.get("name"))) subject = h.getOrDefault("value", "");
            }
        }

        String body = extractBodyText(payload);
        log.debug("Fetched email — from: {} | subject: {} | bodyLength: {}", from, subject, body.length());
        return new EmailContent(from, subject, body + " " + subject);
    }

    // ── MIME body extraction ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String extractBodyText(Map<String, Object> payload) {
        String mimeType = (String) payload.getOrDefault("mimeType", "");

        if (mimeType.startsWith("text/")) {
            Map<String, Object> body = (Map<String, Object>) payload.get("body");
            if (body != null) {
                String data = (String) body.get("data");
                if (data != null && !data.isEmpty()) {
                    String decoded = decodeBase64Url(data);
                    return "text/html".equals(mimeType) ? stripHtml(decoded) : decoded;
                }
            }
            return "";
        }

        List<Map<String, Object>> parts = (List<Map<String, Object>>) payload.get("parts");
        if (parts == null) return "";

        String plainText = null;
        String htmlText  = null;

        for (Map<String, Object> part : parts) {
            String partMime = (String) part.getOrDefault("mimeType", "");
            if ("text/plain".equals(partMime) && plainText == null) {
                plainText = extractBodyText(part);
            } else if ("text/html".equals(partMime) && htmlText == null) {
                htmlText = extractBodyText(part);
            } else if (partMime.startsWith("multipart/") && plainText == null) {
                String nested = extractBodyText(part);
                if (!nested.isBlank()) plainText = nested;
            }
        }

        return plainText != null ? plainText : (htmlText != null ? htmlText : "");
    }

    private String decodeBase64Url(String data) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(data.replaceAll("\\s", ""));
            return new java.lang.String(decoded, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private String stripHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    // ── Subscription detection ──────────────────────────────────────────────────

    private List<GmailDetectedSubscription> parseEmails(List<EmailContent> emails) {
        Map<String, GmailDetectedSubscription> seen = new LinkedHashMap<>();

        for (EmailContent email : emails) {
            String combined = (email.from() + " " + email.subject() + " " + email.body()).toLowerCase();

            for (ServiceDef svc : SERVICES) {
                if (seen.containsKey(svc.name())) continue;

                boolean matches = svc.patterns().stream().anyMatch(combined::contains);
                if (!matches) continue;

                int pos = svc.patterns().stream()
                        .mapToInt(p -> combined.indexOf(p))
                        .filter(i -> i >= 0)
                        .min().orElse(-1);

                String searchWindow = pos >= 0
                        ? combined.substring(Math.max(0, pos - 400), Math.min(combined.length(), pos + 400))
                        : combined;

                Double       amount   = extractAmount(searchWindow);
                BillingCycle cycle    = detectCycle(searchWindow, svc.defaultCycle());
                Currency     currency = detectCurrency(searchWindow);
                String       conf     = amount != null ? "HIGH" : "LOW";
                String       nextBill = LocalDate.now().plusMonths(1).toString();

                log.info("Detected service: {} | amount: {} | cycle: {} | confidence: {}", svc.name(), amount, cycle, conf);

                seen.put(svc.name(), GmailDetectedSubscription.builder()
                        .name(svc.name())
                        .amount(amount)
                        .currency(currency)
                        .billingCycle(cycle)
                        .category(svc.category())
                        .color(svc.color())
                        .confidence(conf)
                        .fromEmail(email.from())
                        .subject(email.subject())
                        .nextBilling(nextBill)
                        .build());
            }
        }

        return new ArrayList<>(seen.values());
    }

    // ── Amount / cycle / currency helpers ───────────────────────────────────────

    private static final Pattern[] AMOUNT_PATTERNS = {
            Pattern.compile("(?:€|\\$|£|EUR\\s?)[\\s]*(\\d{1,4}[.,]\\d{2})"),
            Pattern.compile("(\\d{1,4}[.,]\\d{2})[\\s]*(?:€|\\$|£|EUR|USD|GBP)"),
            Pattern.compile("(?:total|amount|charge[d]?|billed?|cost|price)[:\\s]+(?:€|\\$|£)?[\\s]*(\\d{1,4}[.,]\\d{2})",
                    Pattern.CASE_INSENSITIVE),
    };

    private Double extractAmount(String text) {
        for (Pattern p : AMOUNT_PATTERNS) {
            Matcher m = p.matcher(text);
            if (m.find()) {
                try {
                    String raw = m.group(1).replace(",", ".");
                    double val = Double.parseDouble(raw);
                    if (val > 0.5 && val < 9_999) return val;
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }

    private static final Pattern YEARLY_PATTERN = Pattern.compile("annual|yearly|per\\s+year|/year|12\\s+month", Pattern.CASE_INSENSITIVE);
    private static final Pattern WEEKLY_PATTERN = Pattern.compile("weekly|per\\s+week|/week", Pattern.CASE_INSENSITIVE);

    private BillingCycle detectCycle(String text, String defaultCycle) {
        if (YEARLY_PATTERN.matcher(text).find()) return BillingCycle.YEARLY;
        if (WEEKLY_PATTERN.matcher(text).find()) return BillingCycle.WEEKLY;
        return BillingCycle.valueOf(defaultCycle);
    }

    private Currency detectCurrency(String text) {
        if (text.contains("$") && !text.contains("€")) return Currency.USD;
        if (text.contains("£")) return Currency.GBP;
        return Currency.EUR;
    }

    // ── Internal record ─────────────────────────────────────────────────────────

    private record EmailContent(String from, String subject, String body) {}

    // ── URL encoding helper ──────────────────────────────────────────────────────

    /** Standard percent-encoding for query-parameter values (spaces → %20). */
    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}