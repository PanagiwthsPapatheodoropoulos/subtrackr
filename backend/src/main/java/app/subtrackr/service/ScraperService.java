package app.subtrackr.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ScraperService {

    @Value("${app.scraper.timeout:12000}")
    private int timeout;

    public record ScrapeResult(
            BigDecimal price,
            String productName,
            String imageUrl,
            String shopName
    ) {}

    //  User-Agent pool (rotate per retry) 
    private static final List<String> USER_AGENTS = List.of(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
    );

    //  Site-specific CSS selectors (tried in order, after JSON-LD) 
    private static final Map<String, String[]> SITE_SELECTORS;

    //  Sites where we should pick the LARGEST price found (classifieds,
    //    car listings, real-estate) rather than the first/smallest 
    private static final Set<String> PREFER_LARGEST_PRICE_SITES = Set.of(
            "car.gr", "cardom.gr", "autovio.gr", "bazaraki.com",
            "xe.gr", "spitogatos.gr", "plot.gr"
    );

    static {
        SITE_SELECTORS = new LinkedHashMap<>();
        //  Greek classifieds / cars 
        SITE_SELECTORS.put("car.gr", new String[]{
                // Specific price containers on car.gr listing pages
                ".listing-price",
                "[class*='listing-price']",
                "[class*='ListingPrice']",
                "[class*='car-price']",
                "[class*='vehicle-price']",
                // Generic price with currency nearby  handled by text extraction
                ".price-tag",
                ".price-value",
                // Fallback: any element with  in text and large number
                "[class*='price']",
        });
        SITE_SELECTORS.put("autovio.gr", new String[]{
                ".price", "[class*='price']", ".vehicle-price"
        });
        SITE_SELECTORS.put("cardom.gr", new String[]{
                ".car-price", ".vehicle-price", ".price-value",
                "[class*='price']", ".listing-price"
        });
        //  Greek e-shops 
        SITE_SELECTORS.put("public.gr", new String[]{
                ".price-value", ".product-price-final", ".price .value",
                "[data-qa='product-price']", ".js-product-price", ".sku-price .price",
                "[class*='productPrice']", "[class*='product-price']",
                ".product-buy-section .price", ".price-box .price"
        });
        SITE_SELECTORS.put("skroutz.gr", new String[]{
                ".sku-buy-section .main-price", ".buy-section .main-price",
                "[data-sku-buy-section] .price", ".price-container .price",
                ".js-sku-price", ".sku-price"
        });
        SITE_SELECTORS.put("kotsovolos.gr", new String[]{
                ".price-tag .price", ".product-price .price",
                "[class*='price-tag']", "[data-price]",
                ".price-value", ".current-price"
        });
        SITE_SELECTORS.put("e-shop.gr", new String[]{
                ".price-tag", ".price .current", ".offer-price",
                "[class*='sale-price']", ".final-price"
        });
        SITE_SELECTORS.put("germanos.gr", new String[]{
                ".price", ".product-price", ".current-price",
                "[data-price]", ".price-box"
        });
        SITE_SELECTORS.put("mediamarkt.gr", new String[]{
                "[data-testid='product-price']", ".price-box",
                "span[class*='Price']", "[class*='StyledPriceTagTypography']"
        });
        SITE_SELECTORS.put("plaisio.gr", new String[]{
                ".price .value", ".product-price", ".final-price",
                "[class*='price-value']"
        });
        //  International 
        SITE_SELECTORS.put("amazon", new String[]{
                ".a-price-whole", "#priceblock_ourprice",
                "#priceblock_dealprice", ".a-offscreen",
                "[data-a-size='xl'] .a-offscreen"
        });
        SITE_SELECTORS.put("ebay", new String[]{
                ".x-price-primary", "#prcIsum", ".u-price"
        });
    }

    //  Sites that need cookie pre-fetching (homepage visit first) 
    private static final Set<String> COOKIE_REQUIRED_SITES = Set.of(
            "skroutz.gr", "public.gr", "mediamarkt.gr"
    );

    //  Main scrape method with retry 
    public Optional<ScrapeResult> scrape(String url) {
        int maxAttempts = 3;

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                String ua = USER_AGENTS.get(attempt % USER_AGENTS.size());
                Document doc = fetchDocument(url, ua, attempt);

                BigDecimal price = extractPrice(doc, url);
                String name  = extractProductName(doc);
                String image = extractImage(doc);
                String shop  = extractShopName(url);

                if (price == null) {
                    log.warn("Attempt {}/{}: Could not extract price from URL: {}", attempt + 1, maxAttempts, url);
                    if (attempt < maxAttempts - 1) {
                        Thread.sleep(1500L * (attempt + 1));
                        continue;
                    }
                    return Optional.empty();
                }

                log.info("Scraped [attempt={}] URL: {} | Name: {} | Price: {} | Shop: {}", attempt + 1, url, name, price, shop);
                return Optional.of(new ScrapeResult(price, name, image, shop));

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return Optional.empty();
            } catch (Exception e) {
                log.warn("Scraping attempt {}/{} failed for URL: {} | {}", attempt + 1, maxAttempts, url, e.getMessage());
                if (attempt < maxAttempts - 1) {
                    try { Thread.sleep(1500L * (attempt + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }

        log.error("All {} scraping attempts failed for URL: {}", maxAttempts, url);
        return Optional.empty();
    }

    //  Fetch document with optional cookie pre-fetch 
    private Document fetchDocument(String url, String userAgent, int attempt) throws Exception {
        String domain = extractDomain(url);
        Map<String, String> cookies = new HashMap<>();

        // For sites that require cookies, pre-fetch the homepage
        boolean needsCookies = COOKIE_REQUIRED_SITES.stream().anyMatch(domain::contains);
        if (needsCookies && attempt == 0) {
            try {
                String homepageUrl = "https://" + domain + "/";
                Connection.Response homepageResp = buildConnection(homepageUrl, userAgent)
                        .method(Connection.Method.GET)
                        .execute();
                cookies.putAll(homepageResp.cookies());
                log.debug("Got {} cookies from homepage: {}", cookies.size(), domain);
                Thread.sleep(500); // brief delay to appear more human
            } catch (Exception e) {
                log.debug("Could not pre-fetch cookies from {}: {}", domain, e.getMessage());
            }
        }

        Connection conn = buildConnection(url, userAgent);
        if (!cookies.isEmpty()) conn = conn.cookies(cookies);

        return conn.get();
    }

    //  Build a realistic browser connection 
    private Connection buildConnection(String url, String userAgent) {
        return Jsoup.connect(url)
                .userAgent(userAgent)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
                .header("Accept-Language", "el-GR,el;q=0.9,en-US;q=0.8,en;q=0.7")
                .header("Accept-Encoding", "gzip, deflate, br")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .header("Sec-Fetch-Dest", "document")
                .header("Sec-Fetch-Mode", "navigate")
                .header("Sec-Fetch-Site", "none")
                .header("Sec-Fetch-User", "?1")
                .header("Upgrade-Insecure-Requests", "1")
                .header("sec-ch-ua", "\"Chromium\";v=\"122\", \"Not(A:Brand\";v=\"24\", \"Google Chrome\";v=\"122\"")
                .header("sec-ch-ua-mobile", "?0")
                .header("sec-ch-ua-platform", "\"Windows\"")
                .referrer("https://www.google.com/")
                .timeout(timeout)
                .followRedirects(true)
                .ignoreHttpErrors(true)   // don't throw on 4xx/5xx, let us inspect
                .ignoreContentType(false);
    }

    //  Extract domain 
    private String extractDomain(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null ? (host.startsWith("www.") ? host.substring(4) : host) : "";
        } catch (Exception e) { return ""; }
    }

    // 
    // Price extraction  priority order
    // 
    private BigDecimal extractPrice(Document doc, String url) {
        String domain = extractDomain(url);
        boolean preferLargest = PREFER_LARGEST_PRICE_SITES.stream().anyMatch(domain::contains);

        // 1. Site-specific selectors FIRST for known classified/car sites
        //    (their JSON-LD is unreliable  has ratings, counts, etc.)
        if (preferLargest) {
            for (Map.Entry<String, String[]> entry : SITE_SELECTORS.entrySet()) {
                if (domain.contains(entry.getKey())) {
                    for (String sel : entry.getValue()) {
                        BigDecimal p = trySelectorPreferLargest(doc, sel);
                        if (p != null) {
                            log.debug("car/classifieds selector '{}' found price: {}", sel, p);
                            return p;
                        }
                    }
                    break;
                }
            }
            // Also try full-page text for car sites  "17.000 " pattern
            if (doc.body() != null) {
                BigDecimal p = extractCarPriceFromText(doc.body().text());
                if (p != null) {
                    log.debug("car text extraction found price: {}", p);
                    return p;
                }
            }
        }

        // 2. JSON-LD structured data  with strict @type filtering
        BigDecimal jsonLdPrice = extractFromJsonLd(doc);
        if (jsonLdPrice != null) return jsonLdPrice;

        // 3. Open Graph meta
        Element ogPrice = doc.selectFirst("meta[property='product:price:amount']");
        if (ogPrice != null) {
            BigDecimal p = parsePrice(ogPrice.attr("content"));
            if (p != null) return p;
        }

        // 4. itemprop="price"
        Element priceItemprop = doc.selectFirst("[itemprop='price']");
        if (priceItemprop != null) {
            String content = priceItemprop.attr("content");
            BigDecimal p = parsePrice(content.isEmpty() ? priceItemprop.text() : content);
            if (p != null) return p;
        }

        // 5. Site-specific selectors (non-classified sites)
        for (Map.Entry<String, String[]> entry : SITE_SELECTORS.entrySet()) {
            if (domain.contains(entry.getKey())) {
                for (String sel : entry.getValue()) {
                    BigDecimal p = trySelector(doc, sel);
                    if (p != null) return p;
                }
                break;
            }
        }

        // 6. Amazon-specific
        if (domain.contains("amazon")) {
            BigDecimal p = extractAmazonPrice(doc);
            if (p != null) return p;
        }

        // 7. Extract from inline JavaScript state (SPAs like React/Next.js)
        BigDecimal jsPrice = extractFromJsState(doc);
        if (jsPrice != null) return jsPrice;

        // 8. data-* attributes
        BigDecimal dataPrice = extractFromDataAttributes(doc);
        if (dataPrice != null) return dataPrice;

        // 9. Common CSS selectors
        String[] fallbackSelectors = {
                "[data-price]", "[data-final-price]", "[data-special-price]",
                ".product-price .current", ".product-price .sale",
                ".offer-price", ".sale-price", ".final-price", ".current-price",
                ".price-current", ".price__current", ".price--sale",
                "[class*='salePrice']", "[class*='sale-price']",
                "[class*='finalPrice']", "[class*='currentPrice']",
                "[class*='ProductPrice']", "[class*='product-price']",
                ".main-price", ".js-price", ".price",
        };
        for (String sel : fallbackSelectors) {
            BigDecimal p = trySelector(doc, sel);
            if (p != null) return p;
        }

        // 10. Full-page text fallback
        if (doc.body() != null) {
            return extractBestPriceFromText(doc.body().text());
        }
        return null;
    }

    //  JSON-LD extraction  strict: only from Product/Offer/Car/Vehicle types 
    private BigDecimal extractFromJsonLd(Document doc) {
        // Types whose "price" field is an actual purchase price
        Set<String> PRICE_TYPES = Set.of(
                "product", "offer", "aggregateoffer",
                "car", "vehicle", "automobiledealer",
                "book", "softwareapplication", "event"
        );

        for (Element script : doc.select("script[type='application/ld+json']")) {
            String json = script.html().trim();
            if (json.isEmpty()) continue;

            // Normalise to lowercase for type checking only
            String jsonLower = json.toLowerCase();

            // Skip JSON-LD blocks that are clearly not product/price related
            boolean hasRelevantType = PRICE_TYPES.stream()
                    .anyMatch(t -> jsonLower.contains("\"@type\"") && jsonLower.contains("\"" + t + "\""));
            if (!hasRelevantType) continue;

            // Must have a price key
            if (!json.contains("\"price\"") && !json.contains("\"lowPrice\"")) continue;

            //  Extract price from Offer block specifically 
            // Look for "offers": { ... "price": VALUE ... }  or "@type":"Offer"
            BigDecimal offerPrice = extractOfferPrice(json);
            if (offerPrice != null) return offerPrice;

            //  Fallback: direct "price" on the top-level object 
            Pattern p = Pattern.compile(
                    "\"(?:price|lowPrice)\"\\s*:\\s*\"?([\\d][\\d.,]*)\"?",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher m = p.matcher(json);
            BigDecimal best = null;
            while (m.find()) {
                BigDecimal val = parsePrice(m.group(1));
                // Ignore unrealistically small values (ratings, counts, etc.)
                if (val != null && val.compareTo(BigDecimal.valueOf(5)) > 0
                        && val.compareTo(BigDecimal.valueOf(9_999_999)) < 0) {
                    // Pick the FIRST credible price (not the minimum  avoids picking
                    // secondary "price" fields like ratings encoded as price)
                    if (best == null) best = val;
                }
            }
            if (best != null) return best;
        }
        return null;
    }

    //  Extract price from "offers": { "price": X } block 
    private BigDecimal extractOfferPrice(String json) {
        // Find the "offers" section
        int offersIdx = json.indexOf("\"offers\"");
        if (offersIdx == -1) offersIdx = json.indexOf("\"Offers\"");
        if (offersIdx == -1) return null;

        // Get the substring starting from offers
        String offersSection = json.substring(offersIdx);
        // Limit to ~500 chars to stay within the offers object
        if (offersSection.length() > 500) offersSection = offersSection.substring(0, 500);

        Pattern p = Pattern.compile("\"price\"\\s*:\\s*\"?([\\d][\\d.,]*)\"?");
        Matcher m = p.matcher(offersSection);
        if (m.find()) {
            BigDecimal val = parsePrice(m.group(1));
            if (val != null && val.compareTo(BigDecimal.valueOf(5)) > 0) return val;
        }
        return null;
    }

    //  Car/classifieds: selector that returns the LARGEST credible price 
    private BigDecimal trySelectorPreferLargest(Document doc, String selector) {
        try {
            BigDecimal best = null;
            for (Element el : doc.select(selector)) {
                String text = el.ownText().trim(); // ownText = no children
                if (text.isEmpty()) text = el.text().trim();
                if (text.isEmpty()) continue;
                BigDecimal p = parsePrice(text);
                // For car sites, prices are  500 
                if (p != null && p.compareTo(BigDecimal.valueOf(500)) > 0) {
                    if (best == null || p.compareTo(best) > 0) best = p;
                }
            }
            return best;
        } catch (Exception ignored) { return null; }
    }

    //  Car price from page text  "17.000 " or " 17.000" pattern 
    private BigDecimal extractCarPriceFromText(String text) {
        // Pattern: number with Greek thousands dot, followed by  (or vice-versa)
        // Matches: "17.000 ", "17.000", "17.000", "17000 ", etc.
        Pattern pattern = Pattern.compile(
                "(?:\\s*)?(\\d{1,3}(?:\\.\\d{3})+)(?:\\s*)?|" +   // European: 17.000 
                        "(?:\\s*)?(\\d{4,7})(?:\\s*)?"                     // Plain: 17000 
        );
        Matcher m = pattern.matcher(text);
        BigDecimal best = null;
        while (m.find()) {
            String raw = m.group(1) != null ? m.group(1) : m.group(2);
            if (raw == null) continue;
            BigDecimal val = parsePrice(raw);
            // Car prices: 500  2.000.000
            if (val == null) continue;
            if (val.compareTo(BigDecimal.valueOf(500)) < 0) continue;
            if (val.compareTo(BigDecimal.valueOf(2_000_000)) > 0) continue;
            if (best == null || val.compareTo(best) > 0) best = val;
        }
        return best;
    }

    //  JavaScript state extraction (Next.js / React hydration data) 
    private BigDecimal extractFromJsState(Document doc) {
        // Common SPA patterns
        String[] jsPatterns = {
                "__NEXT_DATA__", "__INITIAL_STATE__", "__APP_STATE__",
                "window.__STATE__", "window.pageData", "window.productData"
        };

        for (Element script : doc.select("script:not([src])")) {
            String content = script.html();
            if (content.length() > 5_000_000) continue; // skip huge scripts

            boolean isState = false;
            for (String pat : jsPatterns) {
                if (content.contains(pat)) { isState = true; break; }
            }
            // Also check for inline objects with price keys
            if (!isState && (content.contains("\"price\"") || content.contains("\"finalPrice\""))) {
                isState = true;
            }

            if (isState) {
                Pattern p = Pattern.compile(
                        "\"(?:price|finalPrice|salePrice|currentPrice|sellPrice|offerPrice)\"\\s*:\\s*[\"']?([\\d.,]+)[\"']?",
                        Pattern.CASE_INSENSITIVE
                );
                Matcher m = p.matcher(content);
                BigDecimal best = null;
                while (m.find()) {
                    BigDecimal val = parsePrice(m.group(1));
                    if (val != null && val.compareTo(BigDecimal.valueOf(0.5)) > 0
                            && val.compareTo(BigDecimal.valueOf(9_999_999)) < 0) {
                        if (best == null) best = val;
                    }
                }
                if (best != null) return best;
            }
        }
        return null;
    }

    //  data-* attribute extraction 
    private BigDecimal extractFromDataAttributes(Document doc) {
        String[] attrs = {"data-price", "data-final-price", "data-special-price",
                "data-product-price", "data-sale-price", "data-offer-price"};
        for (String attr : attrs) {
            for (Element el : doc.select("[" + attr + "]")) {
                BigDecimal p = parsePrice(el.attr(attr));
                if (p != null && p.compareTo(BigDecimal.valueOf(0.5)) > 0) return p;
            }
        }
        return null;
    }

    //  Amazon-specific extraction 
    private BigDecimal extractAmazonPrice(Document doc) {
        Element whole = doc.selectFirst(".a-price-whole, #priceblock_ourprice, #priceblock_dealprice");
        if (whole != null) {
            Element fraction = doc.selectFirst(".a-price-fraction");
            String priceStr = whole.text().replaceAll("[^\\d]", "")
                    + "." + (fraction != null ? fraction.text().replaceAll("[^\\d]", "") : "00");
            return parsePrice(priceStr);
        }
        // Try the newer Amazon price format
        Element offscreen = doc.selectFirst(".a-offscreen");
        if (offscreen != null) {
            return parsePrice(offscreen.text());
        }
        return null;
    }

    //  Try a single CSS selector 
    private BigDecimal trySelector(Document doc, String selector) {
        try {
            for (Element el : doc.select(selector)) {
                String dataPrice = el.attr("data-price");
                if (!dataPrice.isEmpty()) {
                    BigDecimal p = parsePrice(dataPrice);
                    if (p != null && p.compareTo(BigDecimal.valueOf(0.5)) > 0) return p;
                }
                String text = el.text().trim();
                if (!text.isEmpty()) {
                    BigDecimal p = parsePrice(text);
                    if (p != null && p.compareTo(BigDecimal.valueOf(0.5)) > 0) return p;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    //  Full-page text fallback  pick the largest reasonable price 
    private BigDecimal extractBestPriceFromText(String text) {
        Pattern pattern = Pattern.compile(
                "(?:|\\$||EUR\\s*)?\\s*(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?)\\s*(?:|\\$||EUR)?" +
                        "|(?:|\\$|)\\s*(\\d+[.,]?\\d*)"
        );
        Matcher m = pattern.matcher(text);
        BigDecimal best = null;
        while (m.find()) {
            String raw = m.group(1) != null ? m.group(1) : m.group(2);
            if (raw == null) continue;
            BigDecimal val = parsePrice(raw);
            if (val == null) continue;
            if (val.compareTo(BigDecimal.valueOf(0.5)) < 0) continue;
            if (val.compareTo(BigDecimal.valueOf(9_999_999)) > 0) continue;
            if (best == null || val.compareTo(best) > 0) best = val;
        }
        return best;
    }

    // 
    // Price string parser  handles European / Greek / US formats
    // 
    BigDecimal parsePrice(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            String s = raw.replaceAll("[$\\s\\u00A0]", "").trim(); // also strip NBSP
            if (s.isEmpty()) return null;

            // Case A: European "1.234,56" or "11.100,00"
            if (s.matches("\\d{1,3}(\\.\\d{3})+(,\\d{1,2})?")) {
                s = s.replace(".", "").replace(",", ".");
            }
            // Case B: Greek/Spanish "1.100" or "11.100" (thousands only)
            else if (s.matches("\\d{1,3}(\\.\\d{3})+")) {
                s = s.replace(".", "");
            }
            // Case C: Comma decimal "123,45" or "9,99"
            else if (s.matches("\\d+,\\d{1,2}")) {
                s = s.replace(",", ".");
            }
            // Case D: US thousands "1,234.56"
            else if (s.matches("\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?")) {
                s = s.replace(",", "");
            }
            // Case E: plain dot-decimal "123.45"
            else if (s.matches("\\d+\\.\\d{1,2}")) {
                // already correct
            }
            else {
                s = s.replaceAll("[^\\d.]", "");
            }

            if (s.isEmpty()) return null;
            BigDecimal val = new BigDecimal(s);
            if (val.compareTo(BigDecimal.valueOf(0.01)) < 0) return null;
            if (val.compareTo(BigDecimal.valueOf(9_999_999)) > 0) return null;
            return val;

        } catch (Exception e) { return null; }
    }

    //  Product name extraction 
    private String extractProductName(Document doc) {
        // 1. itemprop="name" is most specific
        Element nameEl = doc.selectFirst("[itemprop='name']");
        if (nameEl != null && !nameEl.text().isBlank() && nameEl.text().length() > 3) {
            return cleanTitle(nameEl.text().trim());
        }

        // 2. h1  use .text() which includes child element text
        Element h1 = doc.selectFirst("h1");
        if (h1 != null) {
            String h1text = h1.text().trim();
            if (!h1text.isBlank() && h1text.length() > 3) {
                return cleanTitle(h1text);
            }
        }

        // 3. og:title
        Element og = doc.selectFirst("meta[property='og:title']");
        if (og != null && !og.attr("content").isEmpty()) {
            return cleanTitle(og.attr("content").trim());
        }

        // 4. Page title
        String title = doc.title().trim();
        if (!title.isEmpty() && !title.equalsIgnoreCase("unknown")) {
            return cleanTitle(title);
        }

        return "Unknown Product";
    }

    private String cleanTitle(String t) {
        if (t == null || t.isBlank()) return "Unknown Product";
        // Remove trailing site name suffixes
        String[] suffixes = {" - ", " | ", "  ", "  ", "  "};
        for (String sep : suffixes) {
            int idx = t.lastIndexOf(sep);
            if (idx > 10) { // keep at least some meaningful content
                t = t.substring(0, idx).trim();
            }
        }
        return t.length() > 200 ? t.substring(0, 200) : t;
    }

    //  Image extraction 
    private String extractImage(Document doc) {
        Element og = doc.selectFirst("meta[property='og:image']");
        if (og != null && !og.attr("content").isEmpty()) return og.attr("content");
        Element img = doc.selectFirst("[itemprop='image']");
        if (img != null) return img.attr("src").isEmpty() ? img.attr("content") : img.attr("src");
        return null;
    }

    //  Shop name extraction 
    private String extractShopName(String url) {
        try {
            String domain = extractDomain(url);
            String[] parts = domain.split("\\.");
            String name = parts[0];
            return Character.toUpperCase(name.charAt(0)) + name.substring(1);
        } catch (Exception e) { return "Unknown"; }
    }
}