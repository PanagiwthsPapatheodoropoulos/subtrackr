package app.subtrackr.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
@Slf4j
public class FirebaseConfig {

    @PostConstruct
    public void initialize() {
        if (!FirebaseApp.getApps().isEmpty()) return;

        try {
            InputStream credentialsStream = resolveCredentials();
            if (credentialsStream == null) {
                log.warn("Firebase credentials not found  push notifications disabled");
                return;
            }

            GoogleCredentials credentials =
                    GoogleCredentials.fromStream(credentialsStream);

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();

            FirebaseApp.initializeApp(options);
            log.info(" Firebase initialized successfully");

        } catch (IOException e) {
            log.warn("Firebase init failed: {}", e.getMessage());
        }
    }

    private InputStream resolveCredentials() throws IOException {
        // 1. Try environment variable (used on Railway)
        String envJson = System.getenv("FIREBASE_SERVICE_ACCOUNT");
        if (envJson != null && !envJson.isBlank()) {
            log.info("Loading Firebase credentials from environment variable");
            return new ByteArrayInputStream(
                    envJson.getBytes(StandardCharsets.UTF_8)
            );
        }

        // 2. Try classpath file (used locally)
        try {
            ClassPathResource resource =
                    new ClassPathResource("firebase-service-account.json");
            if (resource.exists()) {
                log.info("Loading Firebase credentials from classpath file");
                return resource.getInputStream();
            }
        } catch (Exception ignored) {}

        return null;
    }
}