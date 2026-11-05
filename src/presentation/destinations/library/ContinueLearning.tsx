import type { ActivityId, CompetencyId } from "@/core/public";
import type {
  CompetencySummary,
  LearnerContinuation,
} from "../../shell/public";
import { competencyStories } from "../content";
import { CompetencyArt } from "../art/CompetencyArt";
import { StampBadge, WaveRule } from "../art/Motifs";
import styles from "./library.module.css";

const journey = ["Prepare", "Explore and Learn", "Apply", "Check and Transfer"];

/** Re-entry point built only from the Session's read-only continuation view.
 * No invented history: resume needs a live unfinished activity; "up next"
 * needs a finish confirmed in this run; otherwise a first-visit invitation. */
export function ContinueLearning({
  competencies,
  continuation,
  blocked,
  onActivity,
  onCompetency,
}: Readonly<{
  competencies: readonly CompetencySummary[];
  continuation: LearnerContinuation | undefined;
  blocked: boolean;
  onActivity: (id: ActivityId) => void;
  onCompetency: (id: CompetencyId) => void;
}>) {
  const find = (ref: {
    competencyId: CompetencyId;
    activityId: ActivityId;
  }) => {
    const competency = competencies.find((c) => c.id === ref.competencyId);
    const activity = competency?.activities.find(
      (a) => a.id === ref.activityId,
    );
    return competency && activity ? { competency, activity } : null;
  };
  const resume = continuation?.resume ? find(continuation.resume) : null;
  const upNext =
    !resume && continuation?.upNext ? find(continuation.upNext) : null;
  const completed = continuation?.completedThisSession ?? [];
  const finishedId = completed[completed.length - 1];
  const finished = upNext
    ? upNext.competency.activities.find((a) => a.id === finishedId)
    : undefined;
  const first = competencies[0];
  const target = resume ?? upNext;
  const competencyId = target?.competency.id ?? first?.id;
  const theme =
    (competencyId && competencyStories[competencyId]?.theme) ?? "sage";
  const step = target ? journey.indexOf(target.activity.label) : -1;
  if (!target && !first) return null;
  return (
    <section
      className={styles.continue}
      aria-labelledby="continue-heading"
      data-theme={theme}
      data-state={resume ? "resume" : upNext ? "next" : "start"}
    >
      <div className={styles.continueCopy}>
        <p className={styles.kicker}>
          {resume
            ? "Continue learning"
            : upNext
              ? "Keep going"
              : "Start learning"}
        </p>
        <h2 id="continue-heading" className={styles.continueTitle}>
          {resume
            ? "Pick up where you left off."
            : upNext
              ? "Ready for the next step."
              : "Every journey starts somewhere."}
        </h2>
        <WaveRule className={styles.waveSmall} />
        {resume ? (
          <p className={styles.continueText}>
            <strong>{resume.activity.label}</strong> in{" "}
            <strong>{resume.competency.label}</strong> is still open. Return to
            it with your work just as you left it.
          </p>
        ) : upNext ? (
          <p className={styles.continueText}>
            {finished ? (
              <>
                You finished <strong>{finished.label}</strong> in{" "}
                <strong>{upNext.competency.label}</strong>.{" "}
              </>
            ) : null}
            Next in the journey: <strong>{upNext.activity.label}</strong>.
          </p>
        ) : (
          <p className={styles.continueText}>
            Choose any competency above, or begin with{" "}
            <strong>{first!.label}</strong>. If you leave an activity
            unfinished, P.A.I.D. offers to continue it the next time you open
            the app.
          </p>
        )}
        {target ? (
          <button
            type="button"
            data-paid-nav
            className={styles.continueAction}
            disabled={blocked || !target.activity.available}
            onClick={() => onActivity(target.activity.id)}
          >
            {resume ? "Resume" : "Start"} {target.activity.label}
          </button>
        ) : (
          <button
            type="button"
            data-paid-nav
            className={styles.continueAction}
            disabled={blocked || !first!.available}
            onClick={() => onCompetency(first!.id)}
          >
            Begin with {first!.label}
          </button>
        )}
      </div>
      <div className={styles.continueArt}>
        {competencyId && (
          <CompetencyArt id={competencyId} className={styles.continueSvg} />
        )}
      </div>
      <div className={styles.continueJourney}>
        <StampBadge
          className={styles.journeyStamp}
          glyph="check"
          text="PREPARE · EXPLORE · APPLY · CHECK · "
        />
        <ol className={styles.journey} aria-label="The four-step journey">
          {journey.map((name, i) => (
            <li
              key={name}
              aria-current={i === step ? "step" : undefined}
              className={styles.journeyStep}
            >
              <span className={styles.journeyDot} aria-hidden="true" />
              {name}
            </li>
          ))}
        </ol>
        {target && (
          <p className={styles.journeyNote}>
            {target.competency.label} · Activity {step + 1} of 4
          </p>
        )}
      </div>
    </section>
  );
}
