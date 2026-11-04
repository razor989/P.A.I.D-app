import type { ActivityId } from "@/core/public";
import type { CompetencySummary } from "../shell/public";
import styles from "./destinations.module.css";

export function CompetencyOverview({
  competency,
  blocked,
  onSelect,
  onReviewCompleted,
}: Readonly<{
  competency: CompetencySummary;
  blocked: boolean;
  onSelect: (id: ActivityId) => void;
  onReviewCompleted?: (() => void) | undefined;
}>) {
  return (
    <section aria-labelledby="activities-heading">
      <h2 id="activities-heading">Learning activities</h2>
      <p>
        Interactive explanatory learning precedes application and assessment.
        {competency.id === "C04"
          ? " Explore and Learn includes the integrated salary investigation."
          : competency.id === "C03"
            ? " Prepare introduces Nico’s overtime work record. Explore and Learn compares two overtime conditions. Apply puts your reasoning to work with James’s monthly overtime. Check and Transfer brings the ideas together with Mara’s regular-holiday overtime."
            : " This version provides the destination structure; instructional presentation is not yet available."}
      </p>
      <ol className={styles.list}>
        {competency.activities.map((a) => (
          <li key={a.id}>
            <h3>
              <button
                type="button"
                disabled={blocked || !a.available}
                aria-describedby={`${a.id}-availability`}
                onClick={() => onSelect(a.id)}
              >
                {a.label}
              </button>
            </h3>
            <p className={styles.identifier}>{a.id}</p>
            {((competency.id === "C04" && a.id === "C04-A02") ||
              (competency.id === "C03" && a.id === "C03-A01")) &&
              onReviewCompleted && (
                <div>
                  <button
                    id="review-completed-activity"
                    type="button"
                    disabled={blocked}
                    onClick={onReviewCompleted}
                    aria-describedby="completed-review-description"
                  >
                    Review completed activity
                  </button>
                  <p id="completed-review-description">
                    Review your retained completion without starting again.
                    Opening the activity above starts a fresh replay.
                  </p>
                </div>
              )}
            <p id={`${a.id}-availability`}>
              {a.available
                ? a.id === "C04-A02"
                  ? "Open the salary investigation and comparison."
                  : a.id === "C03-A01"
                    ? "Open Nico’s overtime work record and share your first thinking."
                    : a.id === "C03-A02"
                      ? "Investigate how the work condition changes overtime pay."
                      : a.id === "C03-A03"
                        ? "Use James’s monthly work record to calculate overtime pay."
                        : a.id === "C03-A04"
                          ? "Transfer your reasoning to a regular holiday, then bring the overtime-pay ideas together."
                          : "Activity host available; instructional presentation is not yet available."
                : "Not available in the current Session."}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
