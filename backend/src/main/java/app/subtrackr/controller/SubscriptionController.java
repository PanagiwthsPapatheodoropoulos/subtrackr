package app.subtrackr.controller;

import app.subtrackr.dto.request.SubscriptionRequest;
import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.dto.response.SubscriptionResponse;
import app.subtrackr.service.SubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService service;

    @PostMapping
    public ResponseEntity<SubscriptionResponse> create(@Valid @RequestBody SubscriptionRequest req) {
        return ResponseEntity.ok(service.create(req));
    }

    //  Paginated: GET /api/subscriptions?page=0&size=20 
    @GetMapping
    public ResponseEntity<PageResponse<SubscriptionResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.getPaged(page, size));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SubscriptionResponse> update(@PathVariable Long id,
                                                       @Valid @RequestBody SubscriptionRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    //  Pause: keeps subscription visible but excludes it from totals & reminders 
    @PatchMapping("/{id}/pause")
    public ResponseEntity<SubscriptionResponse> pause(@PathVariable Long id) {
        return ResponseEntity.ok(service.pause(id));
    }

    //  Resume: re-activates a paused subscription 
    @PatchMapping("/{id}/resume")
    public ResponseEntity<SubscriptionResponse> resume(@PathVariable Long id) {
        return ResponseEntity.ok(service.resume(id));
    }

    @GetMapping(value = "/{id}/calendar",
            produces = "text/calendar; charset=UTF-8")
    public ResponseEntity<String> exportCalendar(
            @PathVariable Long id,
            Authentication auth) {

        String icsContent = service.generateIcs(id, auth.getName());

        return ResponseEntity.ok()
                .header("Content-Disposition",
                        "attachment; filename=\"subtrackr-subscription.ics\"")
                .header("Content-Type", "text/calendar; charset=UTF-8")
                .body(icsContent);
    }
}