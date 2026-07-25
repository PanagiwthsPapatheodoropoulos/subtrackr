package app.subtrackr.repository;

import app.subtrackr.entity.SpendingSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface SpendingSnapshotRepository extends JpaRepository<SpendingSnapshot, Long> {

    @Query("SELECT s FROM SpendingSnapshot s WHERE s.user.id = :userId ORDER BY s.year DESC, s.month DESC")
    List<SpendingSnapshot> findLast6ByUserId(@Param("userId") Long userId,
                                             org.springframework.data.domain.Pageable pageable);

    Optional<SpendingSnapshot> findByUserIdAndYearAndMonth(Long userId, int year, int month);
}