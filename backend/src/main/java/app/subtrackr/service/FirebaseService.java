package app.subtrackr.service;

import app.subtrackr.enums.NotificationType;
import com.google.firebase.messaging.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class FirebaseService {

    public void sendPushNotification(String fcmToken, String title, String body, NotificationType type) {
        try {
            Message message = Message.builder()
                    .setToken(fcmToken)
                    .setNotification(com.google.firebase.messaging.Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .putData("type", type.name())
                    .build();
            String response = FirebaseMessaging.getInstance().send(message);
            log.info("FCM sent: {}", response);
        } catch (FirebaseMessagingException e) {
            log.error("FCM error: {}", e.getMessage());
        }
    }
}