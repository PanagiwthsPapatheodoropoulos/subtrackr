package app.subtrackr.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


@Entity
@Table(name = "price_trackers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceTracker {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String url;

    //  Affiliate URL: when set, price-drop alerts link here instead of url 
    // This enables affiliate commission when users click to buy after a price drop
    @Column(columnDefinition = "TEXT")
    private String affiliateUrl;

    @Column(length = 500)
    private String productName;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal targetPrice;

    @Column(precision = 10, scale = 2)
    private BigDecimal currentPrice;

    @Column(precision = 10, scale = 2)
    private BigDecimal lowestPrice;

    @Column(precision = 10, scale = 2)
    private BigDecimal highestPrice;

    private String shopName;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime lastChecked;

    @OneToMany(mappedBy = "tracker", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<PriceHistory> priceHistory;

    @CreationTimestamp
    private LocalDateTime createdAt;
}