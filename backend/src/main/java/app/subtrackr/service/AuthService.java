package app.subtrackr.service;

import app.subtrackr.dto.request.ChangePasswordRequest;
import app.subtrackr.dto.request.LoginRequest;
import app.subtrackr.dto.request.RefreshTokenRequest;
import app.subtrackr.dto.request.RegisterRequest;
import app.subtrackr.dto.response.AuthResponse;
import app.subtrackr.dto.response.UserProfileResponse;
import app.subtrackr.entity.RefreshToken;
import app.subtrackr.entity.User;
import app.subtrackr.enums.Plan;
import app.subtrackr.repository.PriceTrackerRepository;
import app.subtrackr.repository.RefreshTokenRepository;
import app.subtrackr.repository.SubscriptionRepository;
import app.subtrackr.repository.UserRepository;
import app.subtrackr.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authManager;
    private final EmailService emailService;
    private final RefreshTokenRepository refreshTokenRepo;
    private final SubscriptionRepository subscriptionRepository;
    private final PriceTrackerRepository priceTrackerRepository;

    @Value("${app.jwt.refresh-expiration-days:30}")
    private int refreshExpirationDays;

    // ── Register ──────────────────────────────────────────────────────────────
    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        User user = User.builder()
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getFullName())
                .plan(Plan.FREE)
                .emailNotifications(req.isEmailNotifications())
                .totalSubscriptionsCreated(0)
                .totalTrackersCreated(0)
                .build();
        userRepository.save(user);

        try {
            emailService.sendWelcomeEmail(user);
        } catch (Exception e) {
            log.warn("Welcome email failed for {}: {}", user.getEmail(), e.getMessage());
        }

        String accessToken  = tokenProvider.generateToken(user.getEmail());
        String refreshToken = createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .plan(user.getPlan())
                .build();
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    @Transactional
    public AuthResponse login(LoginRequest req) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword()));

        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (req.getFcmToken() != null) {
            user.setFcmToken(req.getFcmToken());
            userRepository.save(user);
        }

        String accessToken  = tokenProvider.generateToken(user.getEmail());
        String refreshToken = createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .plan(user.getPlan())
                .build();
    }

    // ── Refresh ───────────────────────────────────────────────────────────────
    @Transactional
    public AuthResponse refresh(RefreshTokenRequest req) {
        RefreshToken stored = refreshTokenRepo.findByToken(req.getRefreshToken())
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (stored.isExpired()) {
            refreshTokenRepo.delete(stored);
            throw new RuntimeException("Refresh token expired — please log in again");
        }

        User user = stored.getUser();
        refreshTokenRepo.delete(stored);
        String newRefreshToken = createRefreshToken(user);
        String newAccessToken  = tokenProvider.generateToken(user.getEmail());

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .plan(user.getPlan())
                .build();
    }

    // ── Logout ────────────────────────────────────────────────────────────────
    @Transactional
    public void logout(String email) {
        userRepository.findByEmail(email).ifPresent(user ->
                refreshTokenRepo.deleteAllByUserId(user.getId())
        );
    }

    // ── Profile ───────────────────────────────────────────────────────────────
    public UserProfileResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        int activeSubscriptionCount = (int) subscriptionRepository.countByUserIdAndIsActiveTrue(user.getId());
        int activeTrackerCount = (int) priceTrackerRepository.countByUserIdAndIsActiveTrue(user.getId());

        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .plan(user.getPlan())
                .emailNotifications(user.getEmailNotifications())
                .avatarUrl(user.getAvatarUrl())          // ← included in response
            .subscriptionCount(activeSubscriptionCount)
            .trackerCount(activeTrackerCount)
                .totalSubscriptionsCreated(user.getTotalSubscriptionsCreated())
                .totalTrackersCreated(user.getTotalTrackersCreated())
                .createdAt(user.getCreatedAt())
                .build();
    }

    // ── Change password ───────────────────────────────────────────────────────
    @Transactional
    public void changePassword(String email, ChangePasswordRequest req) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new BadCredentialsException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
        refreshTokenRepo.deleteAllByUserId(user.getId());
    }

    // ── Delete account ────────────────────────────────────────────────────────
    @Transactional
    public void deleteAccount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        userRepository.delete(user);
    }

    // ── FCM token ─────────────────────────────────────────────────────────────
    @Transactional
    public void updateFcmToken(String email, String fcmToken) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setFcmToken(fcmToken);
        userRepository.save(user);
    }

    // ── Email notifications ───────────────────────────────────────────────────
    @Transactional
    public void updateEmailNotifications(String email, boolean enabled) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setEmailNotifications(enabled);
        userRepository.save(user);
    }

    // ── Avatar ────────────────────────────────────────────────────────────────
    /**
     * Stores the base64 data-URL produced by the frontend canvas resize step.
     * Stored in a TEXT column so there's no length limit issue.
     * Returns the stored value so the controller can echo it back.
     */
    @Transactional
    public String updateAvatar(String email, String avatarBase64) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setAvatarUrl(avatarBase64);
        userRepository.save(user);
        log.info("Avatar updated for user {}", email);
        return avatarBase64;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String createRefreshToken(User user) {
        refreshTokenRepo.deleteAllByUserId(user.getId());
        RefreshToken token = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiresAt(LocalDateTime.now().plusDays(refreshExpirationDays))
                .build();
        return refreshTokenRepo.save(token).getToken();
    }
}