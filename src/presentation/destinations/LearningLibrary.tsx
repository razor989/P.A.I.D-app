import type { CompetencyId } from "@/core/public";
import type { CompetencySummary } from "../shell/public";
import styles from "./destinations.module.css";

export function LearningLibrary({
  competencies,
  blocked,
  onSelect,
}: Readonly<{
  competencies: readonly CompetencySummary[];
  blocked: boolean;
  onSelect: (id: CompetencyId) => void;
}>) {
  return (
    <section aria-label="Competencies">
      <p>Choose a competency to explore its learning activities.</p>
      <ul className={styles.list}>
        {competencies.map((c) => (
          <li key={c.id}>
            <h2>
              <button
                type="button"
                disabled={blocked || !c.available}
                onClick={() => onSelect(c.id)}
              >
                {c.label}
              </button>
            </h2>
            <p className={styles.identifier}>{c.id}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
