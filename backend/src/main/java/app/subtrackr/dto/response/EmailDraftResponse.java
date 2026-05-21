package app.subtrackr.dto.response;

import app.subtrackr.enums.EmailType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EmailDraftResponse {
    private String subject;
    private String body;
    private EmailType emailType;
    private String tip;          // Actionable tip shown beneath the draft
}