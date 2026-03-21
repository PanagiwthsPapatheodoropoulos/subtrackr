package app.subtrackr.controller;

import app.subtrackr.dto.request.*;
import app.subtrackr.dto.response.AuthResponse;
import app.subtrackr.dto.response.UserProfileResponse;
import app.subtrackr.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest req) {
        return ResponseEntity.ok(authService.refresh(req));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(Authentication auth) {
        if (auth != null) authService.logout(auth.getName());
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(Authentication auth) {
        return ResponseEntity.ok(authService.getCurrentUser(auth.getName()));
    }

    @PutMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            Authentication auth, @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(auth.getName(), req);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }

    @DeleteMapping("/account")
    public ResponseEntity<Map<String, String>> deleteAccount(Authentication auth) {
        authService.deleteAccount(auth.getName());
        return ResponseEntity.ok(Map.of("message", "Account deleted successfully"));
    }

    @PutMapping("/update-fcm-token")
    public ResponseEntity<Map<String, String>> updateFcmToken(
            Authentication auth, @Valid @RequestBody FcmTokenRequest req) {
        authService.updateFcmToken(auth.getName(), req.getFcmToken());
        return ResponseEntity.ok(Map.of("message", "FCM token updated"));
    }

    @PutMapping("/email-notifications")
    public ResponseEntity<Map<String, String>> updateEmailNotifications(
            Authentication auth, @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        authService.updateEmailNotifications(auth.getName(), enabled);
        return ResponseEntity.ok(Map.of("message",
                "Email notifications " + (enabled ? "enabled" : "disabled")));
    }

    // ── Avatar ────────────────────────────────────────────────────────────────
    @PutMapping("/avatar")
    public ResponseEntity<?> updateAvatar(
            Authentication auth,
            @RequestBody Map<String, String> body) {

        String avatarBase64 = body.get("avatarBase64");
        if (avatarBase64 == null || avatarBase64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "avatarBase64 is required"));
        }
        // ~400 KB limit — a 256 px JPEG is typically 20–80 KB
        if (avatarBase64.length() > 400_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Image too large. Please use a smaller photo."));
        }

        String url = authService.updateAvatar(auth.getName(), avatarBase64);
        return ResponseEntity.ok(Map.of("avatarUrl", url));
    }
}