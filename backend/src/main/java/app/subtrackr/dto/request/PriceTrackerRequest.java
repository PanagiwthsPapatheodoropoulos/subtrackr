package app.subtrackr.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class PriceTrackerRequest {
    @NotBlank
    private String url;

    @NotNull @DecimalMin("0.01")
    private BigDecimal targetPrice;

    // Optional: affiliate URL to use when sending price-drop notifications
    // If null, the original product URL is used
    private String affiliateUrl;
}