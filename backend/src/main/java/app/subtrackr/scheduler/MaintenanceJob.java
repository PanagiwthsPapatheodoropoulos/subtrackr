package app.subtrackr.scheduler;

import app.subtrackr.repository.NotificationRepository;
import app.subtrackr.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class MaintenanceJob {

    private final NotificationRepository notificationRepo;
    private final RefreshTokenRepository refreshTokenRepo;

    // Runs every Sunday at 03:00
    @Scheduled(cron = "0 0 4 * * SUN")
    @Transactional
    public void cleanupOldNotifications() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        notificationRepo.deleteOldReadNotifications(cutoff);
        log.info("Maintenance: cleaned old read notifications (cutoff={})", cutoff);
    }

    @Scheduled(cron = "0 0 4 * * SUN")
    @Transactional
    public void cleanupExpiredRefreshTokens() {
        refreshTokenRepo.deleteAllExpired(LocalDateTime.now());
        log.info("Maintenance: cleaned expired refresh tokens");
    }
}