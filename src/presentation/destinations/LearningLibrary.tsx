import type { ActivityId, CompetencyId } from "@/core/public";
import type { CompetencySummary, LearnerContinuation } from "../shell/public";
import { HeroSlideshow } from "./library/HeroSlideshow";
import { CompetencyCollection } from "./library/CompetencyCollection";
import { ContinueLearning } from "./library/ContinueLearning";
import styles from "./library/library.module.css";

/** Discover → Choose → Continue. Only offered competencies are shown; the
 * catalog and its other destinations are untouched. */
export function LearningLibrary({
  competencies,
  continuation,
  blocked,
  onSelect,
  onActivity,
}: Readonly<{
  competencies: readonly CompetencySummary[];
  continuation?: LearnerContinuation | undefined;
  blocked: boolean;
  onSelect: (id: CompetencyId) => void;
  onActivity?: ((id: ActivityId) => void) | undefined;
}>) {
  const offered = competencies.filter((c) => c.offered !== false);
  return (
    <div className={styles.library}>
      <HeroSlideshow
        competencies={offered}
        blocked={blocked}
        onSelect={onSelect}
      />
      <CompetencyCollection
        competencies={offered}
        blocked={blocked}
        onSelect={onSelect}
      />
      <ContinueLearning
        competencies={offered}
        continuation={continuation}
        blocked={blocked}
        onActivity={onActivity ?? (() => undefined)}
        onCompetency={onSelect}
      />
    </div>
  );
}
