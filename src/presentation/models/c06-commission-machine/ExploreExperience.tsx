import { useEffect, useId, useRef } from "react";
import type { C06PreparePresentation } from "./public";
import { SalesComparisonIllustration, ExploreComparison } from "./ExploreModel";
import { ExploreStory } from "./ExploreStory";
import { ExploreResponse } from "./ExploreResponse";
import { ExploreGuidance, ExploreHelp } from "./ExploreGuidance";
import { ExploreRecap } from "./ExploreRecap";
import { exploreChapters } from "./explore-story";
import styles from "./commission.module.css";
import e from "./explore.module.css";

export function ExploreExperience(props: C06PreparePresentation) {
  const { onPresented } = props;
  const { frame } = props.projection;
  const title = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const invoker = useRef<HTMLButtonElement>(null);
  const state = frame.stateId;
  const explaining = state.startsWith("EXP-");
  const stage = explaining ? Number(state.slice(4)) - 1 : -1;
  const support = Boolean(frame.review);
  const disabled = props.blocked || support;
  const complete = state === "COMPLETE";
  const entry = state === "ENTRY";
  const checked = Boolean(frame.feedbackState);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "start" });
  }, [state]);
  useEffect(() => {
    if (support && help.current && !help.current.open) help.current.showModal();
    if (!support && help.current?.open) {
      help.current.close();
      invoker.current?.focus();
    }
  }, [support]);
  useEffect(() => {
    if (!disabled && frame.feedbackState && feedback.current)
      onPresented("feedback", feedback.current);
  }, [disabled, frame.feedbackState, onPresented]);
  if (frame.activityId !== "C06-A02")
    throw new TypeError("ExploreExperience requires C06-A02");
  const allowed = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((item) => item === intent);
  const action = (
    intent: Parameters<typeof props.onAction>[0],
    label: string,
    primary = false,
  ) =>
    allowed(intent) && (
      <button
        className={primary ? styles.primary : styles.secondary}
        onClick={() => props.onAction(intent)}
      >
        {label}
      </button>
    );
  return (
    <article
      className={`${styles.workshop} ${e.workshop}`}
      aria-labelledby={title}
      data-c06-track="C06-A02"
    >
      <header className={styles.masthead}>
        <span className={styles.brand}>p.a.i.d.</span>
        <span className={styles.mastLabel}>The money &amp; math workshop</span>
        <span className={styles.edition}>Grade 11</span>
      </header>
      <div className={styles.sheet}>
        <h2 className={e.srOnly} ref={heading} tabIndex={-1} id={title}>
          {entry
            ? "The agreement stays. What changes?"
            : complete
              ? "You traced the changing pay."
              : explaining
                ? exploreChapters[stage]!.title
                : checked
                  ? "Does your explanation follow the agreement?"
                  : "Explain what caused the difference."}
        </h2>
        {entry ? (
          <section className={e.landing}>
            <SalesComparisonIllustration />
            <div>
              <p className={styles.eyebrow}>
                Same base and rate · different sales
              </p>
              <h3 className={e.landingTitle}>
                One agreement.
                <br />
                <em>Two different pay stories?</em>
              </h3>
              <p>
                A monthly salary is a promise. Commission is linked to sales.
                Explore the difference before deciding what changes.
              </p>
              <p>
                Watch or step through the explanation, inspect a quantity, then
                make a reasoned comparison.
              </p>
              <div className={styles.actions}>
                {action("CONTINUE", "Investigate the two situations →", true)}
              </div>
            </div>
          </section>
        ) : complete ? (
          <ExploreRecap {...props} />
        ) : (
          <>
            {explaining ? (
              <ExploreStory key={state} {...props} stage={stage} />
            ) : checked ? (
              <section className={e.feedbackSurface}>
                <div
                  ref={feedback}
                  className={styles.feedback}
                  data-presentation="feedback"
                >
                  <h3>
                    {frame.feedbackState?.outcome === "CONFIRMED"
                      ? "Your reasoning connects the two situations."
                      : "Investigate the relationship, then revise."}
                  </h3>
                  <p>{frame.feedbackState?.content.text}</p>
                </div>
                {frame.feedbackState?.outcome === "CONFIRMED" ? (
                  <ExploreComparison projection={props.projection} />
                ) : (
                  <ExploreGuidance key={state} projection={props.projection} />
                )}
                <ExploreResponse {...props} blocked />
              </section>
            ) : (
              <ExploreResponse {...props} blocked={disabled} />
            )}
            <footer className={styles.actions} aria-label="Lesson actions">
              {action("PREVIOUS", "← Previous idea")}
              {explaining && frame.reviewAvailability && (
                <button
                  ref={invoker}
                  className={styles.textButton}
                  disabled={disabled}
                  onClick={props.onHelp}
                >
                  Explain this pay relationship
                </button>
              )}
              {action(
                "CONTINUE",
                state === "EXP-06" ? "Explain my comparison →" : "Next idea →",
                true,
              )}
              {action("REVISE", "Revise my comparison", true)}
              {action("FINISH_ACTIVITY", "Finish Explore and Learn", true)}
            </footer>
          </>
        )}
      </div>
      <dialog
        ref={help}
        className={styles.help}
        aria-label="Explain this pay relationship"
        onCancel={(event) => {
          event.preventDefault();
          props.onCloseHelp();
        }}
      >
        {support && <ExploreHelp key={state} projection={props.projection} />}
        <button className={styles.primary} onClick={props.onCloseHelp}>
          Return to this explanation
        </button>
      </dialog>
    </article>
  );
}
