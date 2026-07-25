package app.subtrackr.dto.response;

import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmailDetectedSubscription {
    private String name;
    private Double amount;
    private Currency currency;       // EUR | USD | GBP
    private BillingCycle billingCycle;   // MONTHLY | YEARLY | WEEKLY
    private String category;
    private String color;
    private String confidence;     // HIGH | LOW
    private String fromEmail;
    private String subject;
    private String nextBilling;    // ISO date string: today + 1 month
}