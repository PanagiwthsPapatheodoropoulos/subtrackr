package app.subtrackr.controller;

import app.subtrackr.dto.response.GmailAuthUrlResponse;
import app.subtrackr.dto.response.GmailImportResponse;
import app.subtrackr.service.GmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/gmail")
@RequiredArgsConstructor
@Slf4j
public class GmailController {

    private final GmailService gmailService;

    @GetMapping("/auth-url")
    public ResponseEntity<GmailAuthUrlResponse> getAuthUrl(@RequestParam("state") String state) {
        // Pass the state to the service so it can build the URL correctly
        return ResponseEntity.ok(gmailService.buildAuthUrl(state));
    }

    @PostMapping("/import")
    public ResponseEntity<GmailImportResponse> importSubscriptions(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        String state = body.get("state"); // Extract state from frontend

        if (code == null || code.isBlank()) {
            throw new RuntimeException("Authorization code is required");
        }

        // Log the state for auditing/debugging (Frontend already did the hard security check)
        log.info("Processing Gmail import for state: {}", state);

        try {
            return ResponseEntity.ok(gmailService.importSubscriptions(code));
        } catch (Exception e) {
            log.error("Gmail import error: {}", e.getMessage(), e);
            throw new RuntimeException("Gmail import failed: " + e.getMessage());
        }
    }
}