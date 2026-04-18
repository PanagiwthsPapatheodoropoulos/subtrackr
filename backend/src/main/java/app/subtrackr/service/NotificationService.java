package app.subtrackr.service;

import app.subtrackr.dto.response.PageResponse;
import app.subtrackr.entity.Notification;
import app.subtrackr.entity.User;
import app.subtrackr.enums.NotificationType;
import app.subtrackr.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepo;

    //  Standard in-app notification (push users or email-disabled users) 
    // digestPending stays false  no email will be sent for this notification.
    public Notification createInApp(User user, String title, String body, NotificationType type) {
        Notification n = buildNotification(user, title, body, type);
        n.setDigestPending(false);
        return notificationRepo.save(n);
    }

    //  Digest-queued in-app notification (web-only users with email on) 
    // digestPending = true signals DailyDigestJob to include this in the
    // next batch email, then clear the flag once the email is sent.
    public Notification createInAppForDigest(User user, String title, String body, NotificationType type) {
        Notification n = buildNotification(user, title, body, type);
        n.setDigestPending(true);
        return notificationRepo.save(n);
    }

    //  Paginated fetch 
    @Transactional(readOnly = true)
    public PageResponse<Notification> getPaged(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Notification> result = notificationRepo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return PageResponse.of(result);   //  was: new PageResponse<>(result)
    }

    //  Mark all read  returns count updated (single UPDATE, no N+1) 
    @Transactional
    public int markAllRead(Long userId) {                         //  was: void
        return notificationRepo.markAllReadByUserId(userId);
    }

    //  Unread count 
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepo.countByUserIdAndIsReadFalse(userId);
    }

    //  Shared builder 
    private Notification buildNotification(User user, String title, String body, NotificationType type) {
        Notification n = new Notification();
        n.setUser(user);
        n.setTitle(title);
        n.setBody(body);
        n.setType(type);
        n.setIsRead(false);
        n.setDigestPending(false);
        n.setCreatedAt(LocalDateTime.now());
        return n;
    }
}