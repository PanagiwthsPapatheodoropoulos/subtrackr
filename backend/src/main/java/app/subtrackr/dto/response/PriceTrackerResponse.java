package app.subtrackr.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder
public class PriceTrackerResponse {
    private Long id;
    private String url;
    private String affiliateUrl;          // null  frontend falls back to url
    private String buyUrl;                 // resolved: affiliateUrl ?? url
    private String productName;
    private BigDecimal targetPrice;
    private BigDecimal currentPrice;
    private BigDecimal lowestPrice;
    private BigDecimal highestPrice;
    private String shopName;
    private String imageUrl;
    private Boolean isActive;
    private LocalDateTime lastChecked;
    private List<PricePointDto> history;
    private boolean belowTarget;
    private BigDecimal savingsFromHighest;
}