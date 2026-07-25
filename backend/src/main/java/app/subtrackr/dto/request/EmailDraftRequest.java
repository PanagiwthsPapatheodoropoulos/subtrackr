package app.subtrackr.dto.request;

import app.subtrackr.enums.BillingCycle;
import app.subtrackr.enums.Currency;
import app.subtrackr.enums.EmailType;
import lombok.Data;

@Data
public class EmailDraftRequest {
    private String subscriptionName;   // e.g. "Netflix"
    private BillingCycle billingCycle;       // MONTHLY / YEARLY / WEEKLY
    private Double amount;             // e.g. 15.99
    private Currency currency;           // EUR / USD / GBP
    private String category;           // Streaming / Music / etc.
    private EmailType emailType;       // CANCEL | NEGOTIATE | PAUSE | COMPLAINT | RETENTION
    private String context;            // Optional user-supplied reason / extra detail
    private Integer monthsSubscribed;  // Optional – used for loyalty angle
}