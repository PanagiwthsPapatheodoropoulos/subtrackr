package app.subtrackr.controller;

import app.subtrackr.dto.request.PriceTrackerRequest;
import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.dto.response.PriceTrackerResponse;
import app.subtrackr.service.PriceTrackerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trackers")
@RequiredArgsConstructor
public class PriceTrackerController {

    private final PriceTrackerService service;

    @PostMapping
    public ResponseEntity<PriceTrackerResponse> create(@Valid @RequestBody PriceTrackerRequest req) {
        return ResponseEntity.ok(service.create(req));
    }

    //  Paginated: GET /api/trackers?page=0&size=10 
    @GetMapping
    public ResponseEntity<PageResponse<PriceTrackerResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(service.getPaged(page, size));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}