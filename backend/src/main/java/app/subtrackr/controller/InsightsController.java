package app.subtrackr.controller;

import app.subtrackr.dto.response.InsightsResponse;
import app.subtrackr.service.InsightsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightsController {

    private final InsightsService insightsService;

    /**
     * GET /api/insights
     *
     * Returns anonymous, aggregate platform statistics.
     * Endpoint is authenticated (JWT required) so casual scrapers cannot
     * pull competitor intelligence without an account.
     *
     * Data is entirely anonymous — no user-identifiable information is exposed.
     * Results are cached in InsightsService for 1 hour so the dashboard never
     * causes expensive queries on every page load.
     */
    @GetMapping
    public ResponseEntity<InsightsResponse> getInsights() {
        return ResponseEntity.ok(insightsService.getInsights());
    }
}