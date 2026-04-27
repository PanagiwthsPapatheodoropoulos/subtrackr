package app.subtrackr.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @AllArgsConstructor
public class PricePointDto {
    private BigDecimal price;
    private LocalDateTime date;
}