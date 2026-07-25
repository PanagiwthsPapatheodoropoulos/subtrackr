package app.subtrackr.dto.response;

import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class SubscriptionResponse {
    private Long id;
    private String name;
    private String description;
    private BigDecimal amount;
    private Currency currency;
    private BillingCycle billingCycle;
    private LocalDate nextBilling;
    private String category;
    private String color;
    private String iconUrl;
    private Boolean isActive;
    private Boolean isPaused;
    private LocalDateTime createdAt;
    private int daysUntilBilling;
}