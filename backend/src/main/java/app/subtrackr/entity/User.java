package app.subtrackr.entity;

import app.subtrackr.enums.Plan;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String fullName;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Plan plan = Plan.FREE;

    @Column(length = 500)
    private String fcmToken;

    //  Email notifications preference (default: true) 
    @Builder.Default
    @Column(nullable = false)
    private Boolean emailNotifications = false;

    //  Anti-abuse: cumulative creation counters 
    // These NEVER decrement. Deleting a subscription/tracker does not reduce
    // these counters. Free users cannot endlessly cycle items to bypass limits.
    @Builder.Default
    @Column(nullable = false)
    private Integer totalSubscriptionsCreated = 0;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    @Builder.Default
    @Column(nullable = false)
    private Integer totalTrackersCreated = 0;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Subscription> subscriptions;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<PriceTracker> priceTrackers;

    @Column(length = 255)
    private String stripeCustomerId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}