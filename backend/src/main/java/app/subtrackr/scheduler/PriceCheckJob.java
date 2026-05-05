package app.subtrackr.scheduler;

import app.subtrackr.entity.PriceTracker;
import app.subtrackr.enums.Plan;
import app.subtrackr.repository.PriceTrackerRepository;
import app.subtrackr.service.PriceTrackerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class PriceCheckJob {

    private final PriceTrackerRepository trackerRepo;
    private final PriceTrackerService trackerService;

    // PREMIUM: runs every hour on the hour
    // Only premium-plan trackers are checked here.
    // This is the key differentiator advertised on the pricing page.
    @Scheduled(cron = "0 0 * * * *")
    public void checkPricesPremium() {
        List<PriceTracker> trackers = trackerRepo.findAllActiveWithUserByPlan(Plan.PREMIUM);
        if (trackers.isEmpty()) return;

        log.info("Premium price check: starting for {} trackers", trackers.size());
        runChecks(trackers, "premium");
        log.info("Premium price check complete.");
    }

    // FREE: runs twice a day at 08:00 and 20:00
    // Free-tier users still get meaningful price tracking " just less frequent.
    // Running at 08:00 and 20:00 catches morning deal-hunters and evening shoppers.
    @Scheduled(cron = "0 0 8,20 * * *")
    public void checkPricesFree() {
        List<PriceTracker> trackers = trackerRepo.findAllActiveWithUserByPlan(Plan.FREE);
        if (trackers.isEmpty()) return;

        log.info("Free price check: starting for {} trackers", trackers.size());
        runChecks(trackers, "free");
        log.info("Free price check complete.");
    }

    // Shared check loop
    // 2-second courtesy delay between requests so we don't hammer shops.
    // This is kept identical for both tiers " the only difference is frequency.
    private void runChecks(List<PriceTracker> trackers, String tier) {
        for (PriceTracker tracker : trackers) {
            try {
                trackerService.checkAndUpdatePrice(tracker);
                Thread.sleep(2_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("{} price check interrupted after {} trackers", tier, trackers.indexOf(tracker));
                break;
            } catch (Exception e) {
                log.error("[{}] Error checking tracker id={}: {}", tier, tracker.getId(), e.getMessage());
            }
        }
    }
}