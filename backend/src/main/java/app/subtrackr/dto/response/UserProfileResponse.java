package app.subtrackr.dto.response;

import app.subtrackr.enums.Plan;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private Long id;
    private String email;
    private String fullName;
    private Plan plan;
    private Boolean emailNotifications;
    private int subscriptionCount;
    private int trackerCount;
    private String avatarUrl;
    // Anti-abuse counters exposed to frontend so it can show correct limits
    private int totalSubscriptionsCreated;
    private int totalTrackersCreated;
    private LocalDateTime createdAt;
}