import { useEffect, useId, useRef } from "react";

import type { C04Presentation } from "./public";
import { ApplyResponse } from "./ApplyResponse";
import { ApplyOffer } from "./ApplyOffer";
import { ApplyComparison } from "./ApplyComparison";
import { ApplyRecap } from "./ApplyRecap";
import "../c04-reference/styles.css";
import "../c04-reference/atmosphere.css";
import "../c04-reference/refinement.css";
import "../c04-reference/instructional-enhancement.css";
import styles from "./apply.module.css";
import { LessonMasthead } from "../../navigation/public";

export function ApplyExperience(props: C04Presentation) {
  const { frame, blocked, onIntent, onPresented } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);

  const surface = useRef<HTMLDivElement>(null);

  const title = useId();
  const entry = frame.stateId === "ENTRY",
    complete = frame.stateId === "COMPLETE";
  const disabled = blocked;
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c04/S03/${role}`);
  const can = (intent: Parameters<typeof onIntent>[0]) =>
    !disabled && frame.allowedLearnerIntents.includes(intent);
  useEffect(() => {
    if (disabled) return;
    heading.current?.focus({ preventScroll: true });
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (media?.matches) return;
    const animation = surface.current?.animate?.(
      [{ transform: "translateY(8px)" }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const stop = () => animation?.cancel();
    media?.addEventListener("change", stop);
    return () => {
      stop();
      media?.removeEventListener("change", stop);
    };
  }, [frame.stateId, disabled]);
  useEffect(() => {
    if (!disabled && frame.feedbackState && feedback.current?.isConnected)
      onPresented?.("feedback", feedback.current);
  }, [disabled, frame.feedbackState, onPresented]);
  return (
    <section
      className={`c04-reference ${styles.workshop}`}
      data-c04-track="C04-A03"
      aria-label={complete ? "Apply recap" : undefined}
      aria-labelledby={complete ? undefined : title}
    >
      <LessonMasthead>
        <header className="masthead">
          <span className="brand">p.a.i.d.</span>
          <span className="mast-label">The money &amp; math workshop</span>
          <span className="edition">Grade 11</span>
        </header>
      </LessonMasthead>
      <div className="reference-main" ref={surface}>
        {entry ? (
          <div className="entry">
            <div className="entry-copy">
              <span className="eyebrow">
                <span className="green-dot" />
                03 / APPLY · PERCENTAGE CHANGE
              </span>
              <h2 id={title} ref={heading} tabIndex={-1}>
                An offer,
                <br />
                <em>revised.</em>
              </h2>
              <p className="lead">
                The position is the same. The salary offer isn’t.
              </p>
              {copy("scenario") && (
                <p
                  className="entry-description"
                  data-content-id={copy("scenario")!.id}
                >
                  {copy("scenario")!.text}
                </p>
              )}
              {copy("task") && (
                <p
                  className={styles.entryTask}
                  data-content-id={copy("task")!.id}
                >
                  {copy("task")!.text}
                </p>
              )}
              <button
                className="primary"
                disabled={!can("CONTINUE")}
                onClick={() => onIntent("CONTINUE")}
              >
                Work on the offer →
              </button>
              <div className="entry-meta">
                <span>Your own calculation</span>
                <span>One offer to investigate</span>
              </div>
            </div>
            <div className={`entry-art ${styles.entryArt}`}>
              <ApplyOffer {...props} />
            </div>
          </div>
        ) : complete ? (
          <ApplyRecap {...props} blocked={disabled} />
        ) : (
          <>
            <header className={`lesson-heading ${styles.heading}`}>
              <div>
                <span className="eyebrow">03 / APPLY · PERCENTAGE CHANGE</span>
                <h2 id={title} ref={heading} tabIndex={-1}>
                  What changed in the offer?
                </h2>
              </div>
            </header>
            <ApplyResponse
              key={props.draftIdentity}
              {...props}
              blocked={disabled}
            />
            {frame.feedbackState && (
              <div
                ref={feedback}
                className={`feedback ${frame.feedbackState.outcome === "CONFIRMED" ? "correct" : "retry"} ${styles.feedback}`}
                data-feedback
                data-presentation-identity={props.presentationIdentity}
                data-content-id={frame.feedbackState.content.id}
                role="status"
              >
                <h3>
                  {frame.feedbackState.outcome === "CONFIRMED"
                    ? "Your answer holds"
                    : "Look again"}
                </h3>
                <p>{frame.feedbackState.content.text}</p>
              </div>
            )}
            <ApplyComparison {...props} blocked={disabled} />
            <div className="lesson-nav">
              {can("REVISE") && (
                <button
                  className="text-button"
                  onClick={() => onIntent("REVISE")}
                >
                  Revise response
                </button>
              )}
              {can("FINISH_ACTIVITY") && (
                <button
                  className="primary"
                  onClick={() => onIntent("FINISH_ACTIVITY")}
                >
                  See your recap →
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="site-footer">
        <span>Apply · Percentage change</span>
        <span>The original is your reference.</span>
      </footer>
    </section>
  );
}
