package app.subtrackr.controller;

import app.subtrackr.dto.request.EmailDraftRequest;
import app.subtrackr.dto.response.EmailDraftResponse;
import app.subtrackr.service.EmailDrafterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/email-drafter")
@RequiredArgsConstructor
public class EmailDrafterController {

    private final EmailDrafterService emailDrafterService;

    /**
     * POST /api/email-drafter
     *
     * Generates a professionally worded email draft for the given subscription
     * and intent. Endpoint is authenticated (JWT required).
     *
     * Body fields (all optional except emailType):
     * subscriptionName  – service name shown in copy (e.g. "Netflix")
     * billingCycle      – MONTHLY | YEARLY | WEEKLY
     * amount            – numeric amount
     * currency          – EUR | USD | GBP
     * category          – Streaming | Music | etc.
     * emailType         – CANCEL | NEGOTIATE | PAUSE | COMPLAINT | RETENTION (Enum mapped)
     * context           – free-text reason / extra detail from the user
     * monthsSubscribed  – optional; used for loyalty angle in NEGOTIATE
     */
    @PostMapping
    public ResponseEntity<EmailDraftResponse> draft(@RequestBody EmailDraftRequest req) {
        return ResponseEntity.ok(emailDrafterService.generateDraft(req));
    }
}