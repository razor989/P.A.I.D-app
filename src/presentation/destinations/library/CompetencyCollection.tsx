import type { CompetencyId } from "@/core/public";
import type { CompetencySummary } from "../../shell/public";
import { competencyStories } from "../content";
import { CompetencyArt } from "../art/CompetencyArt";
import { WaveRule } from "../art/Motifs";
import styles from "./library.module.css";

/** The complete offered collection: an independent route to each competency. */
export function CompetencyCollection({
  competencies,
  blocked,
  onSelect,
}: Readonly<{
  competencies: readonly CompetencySummary[];
  blocked: boolean;
  onSelect: (id: CompetencyId) => void;
}>) {
  return (
    <section className={styles.collection} aria-labelledby="collection-heading">
      <div className={styles.collectionIntro}>
        <p className={styles.kicker}>The collection</p>
        <h2 id="collection-heading" className={styles.sectionTitle}>
          Three ways money moves.
        </h2>
        <WaveRule className={styles.waveSmall} />
        <p className={styles.sectionLead}>
          Each competency is a four-step journey: prepare, explore, apply, then
          check and transfer what you’ve learned.
        </p>
      </div>
      <ul className={styles.cards} aria-label="Competencies">
        {competencies.map((c) => {
          const story = competencyStories[c.id];
          return (
            <li
              key={c.id}
              className={styles.card}
              data-theme={story?.theme ?? "sage"}
            >
              <div className={styles.cardArt}>
                <CompetencyArt id={c.id} className={styles.cardSvg} />
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardCode}>
                  <span>{c.id}</span>
                </p>
                <h3 className={styles.cardTitle}>
                  <button
                    type="button"
                    data-paid-nav
                    className={styles.cardButton}
                    disabled={blocked || !c.available}
                    aria-describedby={`${c.id}-blurb`}
                    onClick={() => onSelect(c.id)}
                  >
                    {c.label}
                  </button>
                </h3>
                <p id={`${c.id}-blurb`} className={styles.cardBlurb}>
                  {story?.blurb ?? "Four learning activities."}
                </p>
                <p className={styles.cardMeta} aria-hidden="true">
                  <span>{story?.focus ?? ""}</span>
                  <span className={styles.cardGo}>
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M5 12h13M13 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
