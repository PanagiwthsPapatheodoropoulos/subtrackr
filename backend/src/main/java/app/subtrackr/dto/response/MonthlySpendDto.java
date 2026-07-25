package app.subtrackr.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.math.BigDecimal;

@Data @AllArgsConstructor
public class MonthlySpendDto {
    private int year;
    private int month;
    private String label;   // "Jan", "Feb" etc.
    private BigDecimal total;
}