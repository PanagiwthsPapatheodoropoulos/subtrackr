package app.subtrackr.controller;

import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.entity.Notification;
import app.subtrackr.entity.User;
import app.subtrackr.repository.UserRepository;
import app.subtrackr.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepo;

    private Long getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    //  GET /api/notifications?page=0&size=20 
    @GetMapping
    public ResponseEntity<PageResponse<Notification>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(notificationService.getPaged(getCurrentUserId(), page, size));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, Integer>> markAllRead() {
        int updated = notificationService.markAllRead(getCurrentUserId());
        return ResponseEntity.ok(Map.of("updated", updated));
    }
}