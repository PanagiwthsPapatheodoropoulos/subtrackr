package app.subtrackr.dto.request;

import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SubscriptionRequest {
    @NotBlank
    private String name;

    private String description;

    @NotNull @DecimalMin("0.01")
    private BigDecimal amount;

    private Currency currency = Currency.EUR;

    private BillingCycle billingCycle = BillingCycle.MONTHLY;

    @NotNull
    private LocalDate nextBilling;

    private String category;
    private String color;
    private String iconUrl;
}