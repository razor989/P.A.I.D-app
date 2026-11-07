import { useEffect, useId, useRef, useState } from "react";
import type { C03PrepareAction, C03PreparePresentation } from "./public";
import { ExploreResponse } from "./ExploreResponse";
import { ExploreIllustration } from "./ExploreIllustration";
import { ExploreModel } from "./ExploreModel";
import { ExploreGlyph } from "./ExploreGlyph";
import { ExploreStory } from "./ExploreStory";
import { exploreStages } from "./explore-story";
import { useWorkRecordMotion } from "./use-work-record-motion";
import styles from "./work-record.module.css";
import explore from "./explore.module.css";
import { LessonMasthead } from "../../navigation/public";
import { revealFeedback, revealHeading } from "./reveal";

export function ExploreWorkRecord(props: C03PreparePresentation) {
  const { projection, blocked, onFeedbackPresented } = props;
  const { frame } = projection;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const support = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const focused = useRef("");
  const wasSupporting = useRef(false);
  const [replay, setReplay] = useState(0);
  const supporting = Boolean(frame.review);
  const complete = frame.stateId === "COMPLETE";
  const entry = frame.stateId === "ENTRY";
  const explaining = frame.stateId.startsWith("EXP-");
  const stage = explaining ? Number(frame.stateId.slice(4)) - 1 : -1;
  const disabled = blocked || supporting;
  const reduced = useWorkRecordMotion(surface, frame.stateId, disabled);
  const allowed = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((item) => item === intent);
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c03/S02/${role}`)?.text;
  useEffect(() => {
    if (blocked) return;
    if (supporting) {
      wasSupporting.current = true;
      support.current?.focus();
      return;
    }
    if (wasSupporting.current) {
      wasSupporting.current = false;
      help.current?.focus();
      return;
    }
    if (focused.current !== frame.stateId) {
      // The first state keeps the shell’s own entry placement.
      const first = focused.current === "";
      focused.current = frame.stateId;
      if (first) heading.current?.focus({ preventScroll: true });
      else revealHeading(heading.current, reduced);
    }
  }, [frame.stateId, blocked, supporting, reduced]);
  useEffect(() => {
    const element = feedback.current;
    if (
      !disabled &&
      frame.feedbackState &&
      element?.isConnected &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      onFeedbackPresented?.(element);
  }, [disabled, frame.feedbackState, onFeedbackPresented]);
  const shownFeedback = frame.feedbackState
    ? `${frame.feedbackState.outcome}/${frame.feedbackState.content.id}`
    : "";
  const revealedFeedback = useRef("");
  useEffect(() => {
    // Only a newly shown outcome moves the view; re-renders do not.
    if (disabled || shownFeedback === revealedFeedback.current) return;
    revealedFeedback.current = shownFeedback;
    if (shownFeedback) revealFeedback(feedback.current, reduced, "outcome");
  }, [shownFeedback, disabled, reduced]);
  if (frame.activityId !== "C03-A02")
    throw new TypeError("Explore requires the canonical C03-A02 projection");
  const action = (intent: C03PrepareAction, label: string, primary = false) =>
    allowed(intent) && (
      <button
        key={intent}
        className={primary ? styles.primary : styles.secondary}
        onClick={() => props.onAction(intent)}
      >
        {label}
      </button>
    );
  return (
    <article
      ref={surface}
      className={`${styles.workshop} ${explore.workshop}`}
      data-c03-track="C03-A02"
      aria-labelledby={id}
    >
      <LessonMasthead>
        <header className={styles.masthead}>
          <span className={styles.brand}>p.a.i.d.</span>
          <span className={styles.mastLabel}>
            The money &amp; math workshop
          </span>
          <span className={styles.edition}>Grade 11</span>
        </header>
      </LessonMasthead>
      <div className={styles.sheet}>
        <div inert={supporting}>
          {entry ? (
            <>
              <section className={styles.landing} data-motion="scene">
                <div className={styles.entryCopy}>
                  <p className={styles.eyebrow}>
                    02 / Explore and Learn · Overtime pay
                  </p>
                  <h2 id={id} ref={heading} tabIndex={-1}>
                    Same hours.
                    <br />
                    <em>A different kind of day?</em>
                  </h2>
                  <p className={styles.lead}>
                    Nico’s question takes us further. If the rate and extra
                    hours stay the same, what could make overtime pay different?
                  </p>
                  <p className={styles.scenario}>{copy("scenario")}</p>
                  {action("CONTINUE", "Start the investigation →", true)}
                </div>
                <ExploreIllustration projection={projection} />
              </section>
              <div className={styles.entryBottom}>
                <span aria-hidden="true">↗</span>
                <p>
                  <strong>Follow the condition—not just the numbers.</strong>
                  <br />
                  {copy("task")} Play, pause and inspect the work records at
                  your own pace.
                </p>
              </div>
            </>
          ) : complete ? (
            <>
              <header className={explore.recapHero} data-motion="conclusion">
                <span className={styles.completionSeal} aria-hidden="true">
                  <ExploreGlyph name="check" />
                </span>
                <p className={styles.eyebrow}>
                  Explore and Learn · Bring the ideas together
                </p>
                <h2 id={id} ref={heading} tabIndex={-1}>
                  Same two hours.
                  <br />
                  <em>A different day, a different payment.</em>
                </h2>
                <p className={styles.lead}>
                  ₱250 on an ordinary day.
                  <br />
                  ₱338 on a rest day.
                  <br />
                  <strong>₱88 more—not two more hours.</strong>
                </p>
              </header>
              <ExploreModel key={replay} projection={projection} compact />
              <section className={explore.takeaway}>
                <h3>Start with the day. Then calculate.</h3>
                <ol>
                  <li>
                    <span>01</span>
                    <strong>Which kind of day?</strong>
                    <p>Ordinary working day or rest day?</p>
                  </li>
                  <li>
                    <span>02</span>
                    <strong>Which multiplier?</strong>
                    <p>1.25 or 1.69 for these two records.</p>
                  </li>
                  <li>
                    <span>03</span>
                    <strong>How much overtime pay?</strong>
                    <p>Hourly rate × multiplier × overtime hours.</p>
                  </li>
                </ol>
                <p>
                  The regular rate and hours stayed the same. Identifying the
                  day was what changed the calculation.
                </p>
              </section>
              <footer className={styles.actions}>
                <button
                  className={styles.secondary}
                  disabled={disabled}
                  onClick={() => setReplay((value) => value + 1)}
                >
                  <ExploreGlyph name="replay" /> Replay the visual comparison
                </button>
                {props.sessionContinuation && (
                  <button
                    className={styles.primary}
                    disabled={disabled || !props.sessionContinuation.available}
                    onClick={props.sessionContinuation.onContinue}
                  >
                    Return to Overtime Pay
                  </button>
                )}
              </footer>
            </>
          ) : (
            <>
              <header className={explore.lessonHeading}>
                <p className={styles.eyebrow}>
                  Explore and Learn ·{" "}
                  {explaining ? `${stage + 1} of 5` : "Your comparison"}
                </p>
                <h2 id={id} ref={heading} tabIndex={-1}>
                  {explaining ? exploreStages[stage] : "Try the two records"}
                </h2>
              </header>
              {explaining ? (
                <>
                  <ol
                    className={explore.stageNav}
                    aria-label="Investigation progress"
                  >
                    {[
                      "The evidence",
                      "Ordinary day",
                      "Rest day",
                      "Compare",
                      "The relationship",
                    ].map((label, index) => (
                      <li
                        key={label}
                        aria-current={stage === index ? "step" : undefined}
                      >
                        <span>{index < stage ? "✓" : `0${index + 1}`}</span>
                        {label}
                      </li>
                    ))}
                  </ol>
                  <ExploreStory
                    key={frame.stateId}
                    projection={projection}
                    stage={stage}
                    blocked={disabled}
                    reduced={reduced}
                    onSelectCondition={props.onSelectCondition}
                  />
                </>
              ) : (
                <ExploreResponse {...props} blocked={disabled} />
              )}
              {frame.feedbackState && (
                <div
                  ref={feedback}
                  className={`${styles.feedback} ${explore.feedback}`}
                  tabIndex={-1}
                  role="status"
                >
                  <h3>
                    {frame.feedbackState.outcome === "CONFIRMED"
                      ? "The relationship is clear."
                      : "Take another look."}
                  </h3>
                  <p>{frame.feedbackState.content.text}</p>
                </div>
              )}
              <footer className={styles.actions}>
                <div className={styles.actionGroup}>
                  {action("PREVIOUS", "← Previous idea")}
                  {action("REVISE", "Revise my comparison")}
                  {allowed("OPEN_SUPPORT") && (
                    <button
                      ref={help}
                      className={styles.textButton}
                      onClick={props.onHelp}
                    >
                      Review the relationship
                    </button>
                  )}
                </div>
                <div className={styles.actionGroup}>
                  {action(
                    "CONTINUE",
                    stage === 4 ? "Try the comparison →" : "Continue →",
                    true,
                  )}
                  {action("FINISH_ACTIVITY", "Finish Explore and Learn", true)}
                </div>
              </footer>
            </>
          )}
        </div>
        {frame.review && (
          <div
            ref={support}
            tabIndex={-1}
            className={explore.support}
            role="region"
            aria-label="Review the relationship"
          >
            <p className={styles.eyebrow}>REVISIT THE REASONING</p>
            <h3>Condition before calculation</h3>
            {frame.review.relationships.map((item) => (
              <p key={item.id}>{item.text}</p>
            ))}
            <ExploreModel
              projection={projection}
              stage={projection.comparison ? 3 : Math.max(0, stage)}
              blocked={blocked}
            />
            <button
              className={styles.primary}
              disabled={blocked}
              onClick={props.onCloseHelp}
            >
              Return to the investigation
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
