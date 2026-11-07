import { useEffect, useId, useRef, useState } from "react";
import type { C03PreparePresentation } from "./public";
import { TransferModel, MaraIllustration } from "./TransferModel";
import { TransferResponse } from "./TransferResponse";
import { TransferGuidance } from "./TransferGuidance";
import { TransferReference } from "./TransferReference";
import { TransferCompletion } from "./TransferCompletion";
import { ExploreGlyph } from "./ExploreGlyph";
import { useWorkRecordMotion } from "./use-work-record-motion";
import base from "./work-record.module.css";
import styles from "./transfer.module.css";
import { LessonMasthead } from "../../navigation/public";
import { revealFeedback, revealHeading } from "./reveal";

export function TransferWorkRecord(props: C03PreparePresentation) {
  const { projection, blocked, onFeedbackPresented } = props;
  const { frame } = projection;
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const support = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const previousSupport = useRef(false);
  const previousState = useRef("");
  const id = useId();
  const supporting = Boolean(frame.review);
  const disabled = blocked || supporting;
  const reduced = useWorkRecordMotion(surface, frame.stateId, disabled);
  useEffect(() => {
    if (blocked) return;
    if (supporting) {
      previousSupport.current = true;
      support.current?.focus();
      support.current?.scrollIntoView({ block: "start" });
      return;
    }
    if (previousSupport.current) {
      previousSupport.current = false;
      help.current?.focus();
      return;
    }
    if (previousState.current !== frame.stateId) {
      // The first state keeps the shell’s own entry placement; REVISION is
      // placed by the response, and an outcome by its feedback (below).
      const first = previousState.current === "";
      previousState.current = frame.stateId;
      if (frame.stateId === "REVISION") return;
      if (first) heading.current?.focus({ preventScroll: true });
      else if (frame.stateId === "COMPLETE" || !frame.feedbackState)
        revealHeading(heading.current, reduced);
    }
  }, [blocked, supporting, frame.stateId, frame.feedbackState, reduced]);
  // A new outcome opens at its feedback, never scrolled past it (§K4.1–4.2).
  const shownFeedback = frame.feedbackState
    ? frame.feedbackState.outcome + "/" + frame.feedbackState.content.id
    : "";
  const revealedFeedback = useRef("");
  useEffect(() => {
    if (disabled || shownFeedback === revealedFeedback.current) return;
    revealedFeedback.current = shownFeedback;
    if (shownFeedback) revealFeedback(feedback.current, reduced, "outcome");
  }, [shownFeedback, disabled, reduced]);
  useEffect(() => {
    const node = feedback.current;
    if (
      !disabled &&
      frame.feedbackState &&
      node?.isConnected &&
      !node.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      onFeedbackPresented?.(node);
  }, [disabled, frame.feedbackState, onFeedbackPresented]);
  if (frame.activityId !== "C03-A04")
    throw new TypeError("Transfer requires the C03-A04 projection");
  const can = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((i) => i === intent);
  const text = (role: string) =>
    frame.contentReferences.find((r) => r.id === `c03/S04/${role}`)?.text;
  const reconsidering = frame.feedbackState?.outcome === "RECONSIDERATION";
  return (
    <article
      ref={surface}
      className={`${base.workshop} ${styles.workshop}`}
      data-c03-track="C03-A04"
      aria-labelledby={id}
    >
      <LessonMasthead>
        <header className={base.masthead}>
          <span className={base.brand}>p.a.i.d.</span>
          <span className={base.mastLabel}>The money &amp; math workshop</span>
          <span className={base.edition}>Grade 11</span>
        </header>
      </LessonMasthead>
      <div className={`${base.sheet} ${styles.sheet}`}>
        <div
          hidden={supporting}
          inert={supporting}
          aria-hidden={supporting || undefined}
        >
          {frame.stateId === "ENTRY" ? (
            <>
              <section className={styles.landing} data-motion="scene">
                <div className={base.entryCopy}>
                  <p className={base.eyebrow}>04 / Check and Transfer</p>
                  <h2 ref={heading} id={id} tabIndex={-1}>
                    A different day.
                    <br />
                    <em>The same careful thinking.</em>
                  </h2>
                  <p className={base.lead}>
                    You’ve followed extra hours through different records. Now
                    take the reasoning somewhere new.
                  </p>
                  <p
                    className={base.scenario}
                    data-content-id="c03/S04/scenario"
                  >
                    {text("scenario")}
                  </p>
                  <button
                    className={base.primary}
                    disabled={!can("CONTINUE")}
                    onClick={() => props.onAction("CONTINUE")}
                  >
                    Open Mara’s work record <ExploreGlyph name="next" />
                  </button>
                </div>
                <MaraIllustration />
              </section>
              <div className={base.entryBottom}>
                <span aria-hidden="true">
                  <ExploreGlyph name="next" />
                </span>
                <p>
                  <strong>
                    Read the day. Follow its rule. Explain the pay.
                  </strong>
                  <br />A relationship reference is available. Your job is to
                  apply it to Mara’s record.
                </p>
              </div>
            </>
          ) : frame.stateId === "COMPLETE" ? (
            <TransferCompletion {...props} titleId={id} />
          ) : (
            <>
              <header className={styles.lessonHeading}>
                <p className={base.eyebrow}>Mara · Regular-holiday overtime</p>
                <h2 ref={heading} id={id} tabIndex={-1}>
                  Put the reasoning <em>to the test.</em>
                </h2>
                <p data-content-id="c03/S04/task">{text("task")}</p>
              </header>
              <div className={styles.workspace} hidden={reconsidering}>
                <TransferModel
                  projection={projection}
                  blocked={disabled}
                  focus={step < 2 ? "condition" : "calculation"}
                />
                <TransferResponse
                  {...props}
                  blocked={disabled}
                  step={step}
                  onStep={setStep}
                  onHelp={() => {
                    help.current?.focus();
                    props.onHelp();
                  }}
                />
              </div>
              {frame.feedbackState && (
                <div
                  ref={feedback}
                  role="status"
                  className={`${base.feedback} ${styles.feedback}`}
                  data-outcome={frame.feedbackState.outcome}
                >
                  <h3>
                    {frame.feedbackState.outcome === "CONFIRMED"
                      ? "Your reasoning holds together."
                      : "Take another look at the record."}
                  </h3>
                  <p data-content-id={frame.feedbackState.content.id}>
                    {frame.feedbackState.content.text}
                  </p>
                </div>
              )}
              {reconsidering && (
                <TransferGuidance
                  {...props}
                  blocked={disabled}
                  onHelp={() => {
                    help.current?.focus();
                    props.onHelp();
                  }}
                  onRevise={(target) => {
                    setStep(target);
                    props.onAction("REVISE");
                  }}
                />
              )}
              <footer className={base.actions}>
                <div className={base.actionGroup}>
                  {can("REVISE") && !reconsidering && (
                    <button
                      className={base.secondary}
                      onClick={() => props.onAction("REVISE")}
                    >
                      Revise my reasoning
                    </button>
                  )}
                  {can("OPEN_SUPPORT") && (
                    <button
                      ref={help}
                      className={base.textButton}
                      onClick={props.onHelp}
                    >
                      Review the relationship
                    </button>
                  )}
                </div>
                {can("FINISH_ACTIVITY") && (
                  <button
                    className={base.primary}
                    onClick={() => props.onAction("FINISH_ACTIVITY")}
                  >
                    See my worked recap <ExploreGlyph name="next" />
                  </button>
                )}
              </footer>
            </>
          )}
        </div>
        {frame.review && <TransferReference {...props} focusRef={support} />}
      </div>
    </article>
  );
}
