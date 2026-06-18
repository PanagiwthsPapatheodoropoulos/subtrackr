package app.subtrackr.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Injects your affiliate tracking tag into product URLs before they are stored.
 *
 * How it works:
 *   1. User pastes a raw product URL (e.g. https://www.amazon.de/dp/B0CX7...)
 *   2. We detect the shop by domain and append/replace the affiliate parameter.
 *   3. The rewritten URL is stored as affiliateUrl on the PriceTracker entity.
 *   4. When a price-drop alert fires, buyUrl resolves to affiliateUrl ?? url,
 *      so every "Buy Now" click earns commission at no cost to the user.
 *
 * Registration links (all free):
 *   Amazon Associates  → https://affiliate-program.amazon.com          (global)
 *   Amazon.de          → https://partnernet.amazon.de                  (DE/AT/CH)
 *   Amazon.co.uk       → https://affiliate-program.amazon.co.uk
 *   Awin               → https://www.awin.com/gb/affiliates            (Skroutz, eBay, many more)
 *   Skroutz            → https://www.skroutz.gr/partner                (GR market)
 *   Commission Junction→ https://www.cj.com/join/publisher             (international)
 *   eBay Partner Net   → https://partnernetwork.ebay.com
 */
@Service
@Slf4j
public class AffiliateService {

    // ── Inject your IDs via application.properties / Railway env vars ────────
    // Set empty string to disable a specific network without touching code.

    @Value("${affiliate.amazon.tag:}")
    private String amazonTag;           // e.g. subtrackr-21   (Amazon Associates tag)

    @Value("${affiliate.awin.id:}")
    private String awinId;              // e.g. 123456          (your Awin publisher ID)

    @Value("${affiliate.skroutz.id:}")
    private String skroutzId;           // e.g. subtrackr       (Skroutz partner ID)

    @Value("${affiliate.ebay.campid:}")
    private String ebayCampaignId;      // e.g. 5338722946      (eBay Partner Network campaign)

    // ── Domain → handler map ─────────────────────────────────────────────────
    //   Keys are substring-matched against the extracted hostname, so
    //   "amazon" matches amazon.com, amazon.de, amazon.co.uk, etc.
    //   Order matters: more specific entries should come first if needed.

    /**
     * Given a raw product URL submitted by the user, returns the affiliate-
     * tagged version.  Returns the original URL unchanged if:
     *   - the domain is not in our supported list, or
     *   - the relevant affiliate ID is not configured.
     */
    public String buildAffiliateUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) return rawUrl;

        String domain = extractDomain(rawUrl);
        if (domain == null) return rawUrl;

        try {
            if (domain.contains("amazon") && isConfigured(amazonTag)) {
                return injectAmazonTag(rawUrl, amazonTag);
            }
            if (domain.contains("ebay") && isConfigured(ebayCampaignId)) {
                return injectEbayTag(rawUrl, ebayCampaignId);
            }
            if (domain.contains("skroutz.gr") && isConfigured(skroutzId)) {
                return injectQueryParam(rawUrl, "ref", skroutzId);
            }
            // Awin-network shops (add domains as you join them)
            if (isAwinShop(domain) && isConfigured(awinId)) {
                return buildAwinUrl(rawUrl, awinId, domain);
            }
        } catch (Exception e) {
            log.warn("Affiliate URL injection failed for {}: {}", rawUrl, e.getMessage());
        }

        // No matching affiliate programme — return raw URL unmodified
        return rawUrl;
    }

    // ── Amazon ────────────────────────────────────────────────────────────────
    // Amazon Associates tag is added as ?tag=YOUR_TAG or &tag=YOUR_TAG.
    // We always strip any existing tag first so we don't double-tag.
    private String injectAmazonTag(String url, String tag) throws Exception {
        // Remove any existing tag param to avoid conflicts
        String cleaned = url.replaceAll("[?&]tag=[^&]*", "");
        char sep = cleaned.contains("?") ? '&' : '?';
        return cleaned + sep + "tag=" + URLEncoder.encode(tag, StandardCharsets.UTF_8);
    }

    // ── eBay Partner Network ──────────────────────────────────────────────────
    // EPN wraps the destination URL inside their tracking URL.
    private String injectEbayTag(String url, String campaignId) {
        String encoded = URLEncoder.encode(url, StandardCharsets.UTF_8);
        return "https://rover.ebay.com/rover/1/" + campaignId + "/1?mpre=" + encoded;
    }

    // ── Awin (generic deep-link format) ──────────────────────────────────────
    // Awin's standard deep-link: https://www.awin1.com/cread.php?awinmid=MERCHANT_ID&awinaffid=PUBLISHER_ID&ued=DESTINATION
    // You need the MERCHANT_ID per shop — add them to the map below as you join each programme.
    private static final Map<String, String> AWIN_MERCHANT_IDS = Map.of(
            // Add entries as you join each programme on awin.com
            // "shop.domain.com", "12345",
            // Example (replace with your real IDs after joining):
            "booking.com",  "0"   // placeholder — set real ID after joining
    );

    private boolean isAwinShop(String domain) {
        return AWIN_MERCHANT_IDS.keySet().stream().anyMatch(domain::contains);
    }

    private String buildAwinUrl(String url, String publisherId, String domain) {
        String merchantId = AWIN_MERCHANT_IDS.entrySet().stream()
                .filter(e -> domain.contains(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);

        if (merchantId == null || merchantId.equals("0")) return url;

        String encoded = URLEncoder.encode(url, StandardCharsets.UTF_8);
        return "https://www.awin1.com/cread.php"
                + "?awinmid=" + merchantId
                + "&awinaffid=" + publisherId
                + "&ued=" + encoded;
    }

    // ── Generic query-param injection (Skroutz, others) ─────────────────────
    private String injectQueryParam(String url, String key, String value) {
        char sep = url.contains("?") ? '&' : '?';
        return url + sep + URLEncoder.encode(key, StandardCharsets.UTF_8)
                + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String extractDomain(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null ? host.toLowerCase() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isConfigured(String value) {
        return value != null && !value.isBlank();
    }
}