import { useEffect, useId, useRef, useState } from "react";
import type { C03PrepareAction, C03PreparePresentation } from "./public";
import { PrepareResponse } from "./PrepareResponse";
import { WorkEvidence } from "./WorkEvidence";
import { Observation } from "./Observation";
import { NicoIllustration } from "./NicoIllustration";
import { useWorkRecordMotion } from "./use-work-record-motion";
import styles from "./work-record.module.css";

export function PrepareWorkRecord(props: C03PreparePresentation) {
  const { projection, blocked, onAction, onFeedbackPresented } = props;
  const { frame } = projection;
  const title = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const [observing, setObserving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const entry = frame.stateId === "ENTRY";
  const complete = frame.stateId === "COMPLETE";
  const recorded = frame.stateId === "CONFIRMATION";
  const story = (entry && observing) || reviewing;
  const identity = `${frame.stateId}/${observing}/${reviewing}`;
  const reduced = useWorkRecordMotion(surface, identity, blocked);
  const allowed = (intent: string) =>
    !blocked && frame.allowedLearnerIntents.some((item) => item === intent);
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c03/S01/${role}`)?.text;
  useEffect(() => {
    if (!blocked) heading.current?.focus({ preventScroll: true });
  }, [identity, blocked]);
  useEffect(() => {
    const element = feedback.current;
    if (
      !blocked &&
      !story &&
      recorded &&
      frame.feedbackState &&
      element?.isConnected &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
      getComputedStyle(element).display !== "none" &&
      getComputedStyle(element).visibility !== "hidden"
    ) {
      onFeedbackPresented?.(element);
    }
  }, [blocked, story, recorded, frame.feedbackState, onFeedbackPresented]);
  if (
    frame.activityId !== "C03-A01" ||
    projection.diagnosticPrompts?.id !== "C03-A01-elicit-engage-v2"
  )
    throw new TypeError(
      "Neutral A01 renderer requires authenticated v2 projection",
    );
  const action = (intent: C03PrepareAction, label: string, primary = false) =>
    allowed(intent) && (
      <button
        type="button"
        className={primary ? styles.primary : styles.secondary}
        onClick={() => onAction(intent)}
      >
        {label}
      </button>
    );
  return (
    <article
      ref={surface}
      className={styles.workshop}
      aria-labelledby={title}
      data-c03-track="C03-A01"
    >
      <header className={styles.masthead}>
        <span className={styles.brand}>p.a.i.d.</span>
        <span className={styles.mastLabel}>The money &amp; math workshop</span>
        <span className={styles.edition}>Grade 11</span>
      </header>
      {props.libraryNavigation && (
        <nav className={styles.lessonDestination} aria-label="Leave the lesson">
          <span>
            Lesson Back revisits an idea. Leave here to return to your
            activities.
          </span>
          <button
            type="button"
            disabled={
              blocked ||
              (complete && props.sessionContinuation
                ? !props.sessionContinuation.available
                : !props.libraryNavigation.available)
            }
            onClick={
              complete && props.sessionContinuation
                ? props.sessionContinuation.onContinue
                : props.libraryNavigation.onReturn
            }
          >
            {complete && props.sessionContinuation
              ? "Leave lesson for Overtime Pay"
              : "Leave lesson for Learning Library"}
          </button>
        </nav>
      )}
      <div className={styles.sheet}>
        {entry && !observing ? (
          <>
            <section className={styles.landing} data-motion="scene">
              <div className={styles.entryCopy}>
                <p className={styles.eyebrow}>Prepare · Notice and wonder</p>
                <h2 id={title} ref={heading} tabIndex={-1}>
                  Eight hours.
                  <br />
                  <em>What about the next two?</em>
                </h2>
                <p className={styles.lead}>
                  Nico’s regular workday is over. But his work isn’t. How do you
                  imagine those extra hours might be paid?
                </p>
                <p className={styles.scenario}>
                  Let’s look at his work record, then share a starting idea and
                  a question. No score. No calculation needed.
                </p>
                <button
                  className={styles.primary}
                  disabled={blocked}
                  onClick={() => setObserving(true)}
                >
                  Start with Nico <span aria-hidden="true">→</span>
                </button>
              </div>
              <NicoIllustration />
            </section>
            <div className={styles.entryBottom}>
              <span aria-hidden="true">?</span>
              <p>
                <strong>Begin with what you notice.</strong>
                <br />
                What can a work record tell you—and what would you still want to
                find out?
              </p>
            </div>
          </>
        ) : story ? (
          <>
            <p className={styles.eyebrow}>Prepare · Notice and wonder</p>
            <h2 id={title} ref={heading} tabIndex={-1}>
              One workday.
              <br />
              <em>What catches your attention?</em>
            </h2>
            <Observation
              projection={projection}
              onRespond={() => {
                if (reviewing) setReviewing(false);
                else onAction("CONTINUE");
              }}
              blocked={blocked}
              reduced={reduced}
              returning={reviewing}
              returnLabel={
                complete ? "Return to recap" : "Return to your thinking"
              }
            />
          </>
        ) : complete ? (
          <section
            className={styles.dedicatedRecap}
            aria-label="Activity completion"
            data-motion="conclusion"
          >
            <div className={styles.recapHero}>
              <div>
                <span className={styles.completionSeal} aria-hidden="true">
                  ✓
                </span>
                <p className={styles.eyebrow}>Your starting point</p>
                <h2 id={title} ref={heading} tabIndex={-1}>
                  A starting point.
                  <br />
                  <em>A new question.</em>
                </h2>
                <p>Your first ideas. Your next questions.</p>
              </div>
            </div>
            <div className={styles.recapIdeas}>
              <PrepareResponse {...props} />
            </div>
            <div className={styles.recapBridge}>
              <h3>
                Same extra hours.
                <br />
                <em>A different kind of day?</em>
              </h3>
              <p>{copy("completion")}</p>
              <p className={styles.evidenceNote}>
                {props.sessionContinuation
                  ? "Prepare is complete. Return to Overtime Pay to review your progress."
                  : "Prepare ends here in this isolated preview. No next activity or application navigation is connected."}
              </p>
              {props.sessionContinuation && (
                <button
                  className={styles.primary}
                  disabled={blocked || !props.sessionContinuation.available}
                  onClick={props.sessionContinuation.onContinue}
                >
                  Return to Overtime Pay
                </button>
              )}
              <button
                className={styles.secondary}
                disabled={blocked}
                onClick={() => setReviewing(true)}
              >
                Review Nico’s story
              </button>
            </div>
          </section>
        ) : (
          <>
            <p className={styles.eyebrow}>
              {recorded
                ? "Prepare · Your ideas are recorded"
                : "Prepare · Your first thinking"}
            </p>
            <h2 id={title} ref={heading} tabIndex={-1} data-motion="text">
              {recorded ? (
                <>
                  Your ideas belong
                  <br />
                  <em>in the conversation.</em>
                </>
              ) : (
                <>
                  What do <em>you think?</em>
                </>
              )}
            </h2>
            {!recorded && !complete && (
              <p className={styles.task}>{copy("task")}</p>
            )}
            {recorded && (
              <div
                ref={feedback}
                className={styles.neutralAcknowledgment}
                tabIndex={-1}
                aria-label="Thinking recorded"
                data-motion="text"
              >
                <p>{frame.feedbackState?.content.text}</p>
              </div>
            )}
            <div
              className={recorded ? styles.reflection : styles.workbench}
              data-motion="scene"
            >
              <div>
                <PrepareResponse
                  key={recorded ? "recorded" : "editing"}
                  {...props}
                />
              </div>
              <aside
                className={styles.evidenceAside}
                aria-label="Nico’s evidence"
              >
                {recorded ? (
                  <NicoIllustration />
                ) : (
                  <WorkEvidence projection={projection} compact />
                )}
                <details className={styles.sourceDetails}>
                  <summary>Read Nico’s full work record</summary>
                  <p>{copy("scenario")}</p>
                </details>
                <button
                  className={styles.textButton}
                  disabled={blocked}
                  onClick={() => setReviewing(true)}
                >
                  Review Nico’s story
                </button>
              </aside>
            </div>
            {recorded && (
              <footer className={styles.actions}>
                {action("REVISE", "Change my thinking")}
                {action("FINISH_ACTIVITY", "Finish Prepare", true)}
              </footer>
            )}
          </>
        )}
      </div>
    </article>
  );
}
