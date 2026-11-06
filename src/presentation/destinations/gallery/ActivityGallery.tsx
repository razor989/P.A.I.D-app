import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ActivityId } from "@/core/public";
import type {
  ActivitySummary,
  CompetencySummary,
  LearnerContinuation,
} from "../../shell/public";
import { activityStory, competencyStories } from "../content";
import { initialFeatured } from "./featured";
import { ActivityCoverArt } from "../art/ActivityCoverArt";
import { WaveRule } from "../art/Motifs";
import styles from "./gallery.module.css";

type Status = "in-progress" | "finished" | "suggested" | "unavailable" | null;

/** Curated activity gallery. The featured cover is presentation state only:
 * selecting it never opens, completes or persists anything. Opening always
 * goes through the Session's existing activity selection. */
export function ActivityGallery({
  competency,
  continuation,
  blocked,
  onSelect,
  onReviewCompleted,
}: Readonly<{
  competency: CompetencySummary;
  continuation?: LearnerContinuation | undefined;
  blocked: boolean;
  onSelect: (id: ActivityId) => void;
  onReviewCompleted?: (() => void) | undefined;
}>) {
  const [selected, setSelected] = useState(() =>
    initialFeatured(competency, continuation),
  );
  const base = useId();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const activities = competency.activities;
  const count = activities.length;
  const index = Math.min(selected, count - 1);
  // When the shelf scrolls (narrow screens), keep the featured cover centred
  // within it. Horizontal strip scroll only — the page never moves.
  useEffect(() => {
    const shelf = strip.current;
    const cover = radios.current[index];
    if (!shelf || !cover || shelf.scrollWidth <= shelf.clientWidth) return;
    // The shelf is the covers' offsetParent (position: relative).
    const left = cover.offsetLeft - (shelf.clientWidth - cover.offsetWidth) / 2;
    const reduce =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof shelf.scrollTo === "function")
      shelf.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [index]);
  const featured = activities[index];
  const story = competencyStories[competency.id];
  if (!featured) return null;

  const statusOf = (a: ActivitySummary): Status =>
    !a.available
      ? "unavailable"
      : continuation?.resume?.activityId === a.id
        ? "in-progress"
        : continuation?.completedThisSession.includes(a.id)
          ? "finished"
          : continuation?.upNext?.activityId === a.id
            ? "suggested"
            : null;
  const featuredStory = activityStory(featured.id, featured.label);
  const featuredStatus = statusOf(featured);
  const otherInProgress =
    continuation?.resume &&
    continuation.resume.activityId !== featured.id &&
    continuation.resume.competencyId === competency.id
      ? activities.find((a) => a.id === continuation.resume!.activityId)
      : undefined;
  const select = (i: number, focus: boolean) => {
    const next = (i + count) % count;
    setSelected(next);
    if (focus) radios.current[next]?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? i + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? i - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    select(target, true);
  };
  const number = (i: number) => String(i + 1).padStart(2, "0");
  const action =
    featuredStatus === "in-progress"
      ? `Resume ${featured.label}`
      : featuredStatus === "finished"
        ? `Start ${featured.label} again`
        : `Start ${featured.label}`;

  return (
    <section
      className={styles.gallery}
      aria-labelledby={`${base}-heading`}
      data-step={featuredStory.step}
    >
      <div className={styles.intro}>
        <p className={styles.kicker}>
          {story ? `Competency ${story.number}` : competency.id} · Four
          activities
        </p>
        <h2 id={`${base}-heading`} className={styles.introTitle}>
          Choose your activity
        </h2>
        <WaveRule className={styles.wave} />
        <p className={styles.introText}>
          {story?.intro ??
            "Work through the four activities in order, or choose where to begin."}
        </p>
      </div>

      <div
        className={styles.panel}
        aria-labelledby={`${base}-panel-title`}
        role="group"
      >
        <div className={styles.panelHead}>
          <p className={styles.panelCount}>
            Activity {index + 1} of {count}
          </p>
          <div className={styles.panelNav}>
            <button
              type="button"
              data-paid-nav
              className={styles.roundButton}
              aria-label="Previous activity"
              disabled={blocked}
              onClick={() => select(index - 1, false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M19 12H5M11 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              data-paid-nav
              className={styles.roundButton}
              aria-label="Next activity"
              disabled={blocked}
              onClick={() => select(index + 1, false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.panelBody} key={featured.id}>
          <p className={styles.panelKicker}>{featuredStory.kicker}</p>
          <h3 id={`${base}-panel-title`} className={styles.panelTitle}>
            {featured.label}
          </h3>
          {featuredStatus && (
            <p className={styles.status} data-status={featuredStatus}>
              <span aria-hidden="true" className={styles.statusDot} />
              {featuredStatus === "in-progress"
                ? "In progress: your work is waiting"
                : featuredStatus === "finished"
                  ? "Finished this session"
                  : featuredStatus === "suggested"
                    ? "Suggested next"
                    : "Not available right now"}
            </p>
          )}
          <p className={styles.panelText}>{featuredStory.description}</p>
        </div>
        <button
          type="button"
          data-paid-nav
          data-gallery-open={featured.id}
          className={styles.open}
          disabled={blocked || !featured.available}
          onClick={() => onSelect(featured.id)}
        >
          <span>{action}</span>
          <svg viewBox="0 0 28 12" aria-hidden="true" focusable="false">
            <path
              d="M1 6h24M20 1l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {otherInProgress && (
          <p className={styles.note}>
            {otherInProgress.label} is still in progress. Opening a different
            activity will first ask what to do with it.
          </p>
        )}
        {onReviewCompleted && (
          <div className={styles.review}>
            <button
              id="review-completed-activity"
              type="button"
              data-paid-nav
              className={styles.reviewButton}
              disabled={blocked}
              onClick={onReviewCompleted}
              aria-describedby="completed-review-description"
            >
              Review completed activity
            </button>
            <p id="completed-review-description" className={styles.note}>
              Look back at the activity you just finished without starting
              again. Opening it from the gallery starts a fresh replay.
            </p>
          </div>
        )}
      </div>

      <div
        ref={strip}
        role="radiogroup"
        aria-label="Choose an activity"
        className={styles.covers}
        data-featured={index}
        data-count={count}
      >
        {activities.map((a, i) => {
          const s = activityStory(a.id, a.label);
          const status = statusOf(a);
          const checked = i === index;
          return (
            <button
              key={a.id}
              ref={(node) => {
                radios.current[i] = node;
              }}
              type="button"
              role="radio"
              data-paid-nav
              aria-checked={checked}
              aria-labelledby={`${base}-cover-${i}`}
              aria-describedby={`${base}-cover-${i}-meta`}
              tabIndex={checked ? 0 : -1}
              disabled={blocked}
              className={styles.cover}
              data-step={s.step}
              onClick={() => select(i, false)}
              onKeyDown={(event) => onKey(event, i)}
            >
              <span className={styles.coverFrame}>
                <ActivityCoverArt
                  competency={competency.id}
                  step={s.step}
                  number={number(i)}
                  title={a.label}
                  className={styles.coverArt}
                />
                {status && status !== "unavailable" && (
                  <span
                    className={styles.coverBadge}
                    data-status={status}
                    aria-hidden="true"
                  >
                    {status === "in-progress"
                      ? "In progress"
                      : status === "finished"
                        ? "Finished"
                        : "Next"}
                  </span>
                )}
              </span>
              <span className={styles.caption}>
                <span id={`${base}-cover-${i}`} className={styles.captionTitle}>
                  {a.label}
                </span>
                <span
                  id={`${base}-cover-${i}-meta`}
                  className={styles.captionMeta}
                >
                  {number(i)} · {s.kicker}
                  {status === "in-progress"
                    ? " · in progress"
                    : status === "finished"
                      ? " · finished this session"
                      : status === "suggested"
                        ? " · suggested next"
                        : status === "unavailable"
                          ? " · not available"
                          : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <p className={styles.tip}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M10 9v5M10 6.2v.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Choose a cover to see what the activity is about, then open it when
          you’re ready.
        </p>
        <p className={styles.counter} aria-hidden="true">
          <span>{number(index)}</span> / {number(count - 1)} activities
        </p>
      </div>
    </section>
  );
}
