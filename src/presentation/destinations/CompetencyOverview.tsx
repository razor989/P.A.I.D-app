import type { ActivityId } from "@/core/public";
import type { CompetencySummary } from "../shell/public";
import styles from "./destinations.module.css";

export function CompetencyOverview({
  competency,
  blocked,
  onSelect,
}: Readonly<{
  competency: CompetencySummary;
  blocked: boolean;
  onSelect: (id: ActivityId) => void;
}>) {
  return (
    <section aria-labelledby="activities-heading">
      <h2 id="activities-heading">Learning activities</h2>
      <p>
        Interactive explanatory learning precedes application and assessment.
        This version provides the destination structure; instructional
        presentation is not yet available.
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
            <p id={`${a.id}-availability`}>
              {a.available
                ? "Activity host available; instructional presentation is not yet available."
                : "Not available in the current Session."}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
