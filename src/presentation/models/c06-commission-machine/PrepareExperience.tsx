import { useEffect, useId, useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { CommissionMachine } from "./CommissionMachine";
import { PrepareResponse } from "./PrepareResponse";
import { CommissionEvidence } from "./CommissionEvidence";
import { CommissionObservation } from "./CommissionObservation";
import {
  RelationshipDiagram,
  SalesIllustration,
} from "./CommissionIllustrations";
import { useWorkRecordMotion } from "./use-commission-motion";
import styles from "./commission.module.css";
import { LessonExit, LessonMasthead } from "../../navigation/public";

/** A01: the Actor retains response, feedback, teaching and completion authority. */
export function PrepareExperience(props: C06PreparePresentation) {
  const { projection, blocked, onAction, onPresented } = props;
  const { frame } = projection;
  const title = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const passage = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const helpInvoker = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLElement>(null);
  const [reading, setReading] = useState(false);
  const support = Boolean(frame.review);
  const entry = frame.stateId === "ENTRY";
  const complete = frame.stateId === "COMPLETE";
  const teaching = frame.stateId === "POST_CONFIRMATION_EXPLANATION";
  const checked = Boolean(frame.feedbackState);
  const reduced = useWorkRecordMotion(
    surface,
    `${frame.stateId}/${reading}`,
    blocked || support,
  );
  const copy = (role: string) =>
    frame.contentReferences.find((r) => r.id === `c06/S01/${role}`)?.text;
  const allowed = (intent: string) =>
    !blocked &&
    !support &&
    frame.allowedLearnerIntents.some((item) => item === intent);
  useEffect(() => {
    if (!blocked && !support) heading.current?.focus({ preventScroll: true });
  }, [frame.stateId, blocked, support, reading]);
  useEffect(() => {
    const dialog = help.current;
    if (!dialog) return;
    if (support && !dialog.open) dialog.showModal();
    if (!support && dialog.open) {
      dialog.close();
      helpInvoker.current?.focus();
    }
  }, [support]);
  useEffect(() => {
    const element = passage.current;
    if (
      blocked ||
      support ||
      reading ||
      !element?.isConnected ||
      (!checked && !teaching)
    )
      return;
    if (
      element.closest('[hidden], [inert], [aria-hidden="true"]') ||
      getComputedStyle(element).display === "none" ||
      getComputedStyle(element).visibility === "hidden"
    )
      return;
    onPresented(teaching ? "teaching" : "feedback", element);
  }, [blocked, support, reading, checked, teaching, frame, onPresented]);
  if (frame.activityId !== "C06-A01")
    throw new TypeError("PrepareExperience requires C06-A01");
  const action = (
    intent: Parameters<typeof onAction>[0],
    label: string,
    primary = false,
  ) =>
    allowed(intent) && (
      <button
        type="button"
        className={primary ? styles.primary : styles.secondary}
        onClick={() => onAction(intent)}
      >
        {label}
      </button>
    );
  const reviewStory = () => setReading(true);
  return (
    <article
      ref={surface}
      className={styles.workshop}
      aria-labelledby={title}
      data-c06-track="C06-A01"
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
      {props.libraryNavigation && (
        <LessonExit
          className={styles.lessonDestination}
          hint="Commission · Prepare"
        >
          <button
            disabled={blocked || !props.libraryNavigation.available}
            onClick={props.libraryNavigation.onReturn}
          >
            Leave lesson for Learning Library
          </button>
        </LessonExit>
      )}
      <div className={styles.sheet}>
        <p className={styles.eyebrow}>Prepare · Notice and wonder</p>
        <h2 id={title} ref={heading} tabIndex={-1}>
          {reading ? (
            <>
              Same sales.
              <br />
              <em>What else matters?</em>
            </>
          ) : entry ? (
            <>
              Same sales.
              <br />
              <em>Same pay?</em>
            </>
          ) : complete ? (
            <>
              A first idea.
              <br />
              <em>A closer look.</em>
            </>
          ) : teaching ? (
            <>
              Follow the promises.
              <br />
              <em>Where do they lead?</em>
            </>
          ) : checked ? (
            <>
              Your idea.
              <br />
              <em>Let’s look together.</em>
            </>
          ) : (
            <>
              What do <em>you think?</em>
            </>
          )}
        </h2>
        {reading ? (
          <CommissionObservation
            projection={projection}
            blocked={blocked || support}
            reduced={reduced}
            returning={!entry}
            onBack={entry ? () => setReading(false) : undefined}
            onRespond={() => {
              setReading(false);
              if (entry) onAction("CONTINUE");
            }}
          />
        ) : entry ? (
          <>
            <section className={styles.landing}>
              <div className={styles.entryCopy} data-motion="arrive">
                <p className={styles.lead}>
                  Two workers finish a month of selling. Their sales records
                  match—but what will each take home?
                </p>
                <p>
                  Let’s meet them, look at their agreements, and see what you
                  notice. You don’t need a formula to begin.
                </p>
                <button
                  className={styles.primary}
                  disabled={blocked}
                  onClick={reviewStory}
                >
                  Meet the workers <span aria-hidden="true">→</span>
                </button>
              </div>
              <SalesIllustration />
            </section>
            <div className={styles.entryBottom}>
              <span aria-hidden="true">?</span>
              <p>
                <strong>Begin with what you notice.</strong>
                <br />
                What might a sales record tell you—and what would you still want
                to find out?
              </p>
            </div>
          </>
        ) : complete ? (
          <section
            className={styles.dedicatedRecap}
            aria-label="Activity completion"
          >
            <div className={styles.recapHero}>
              <div>
                <span className={styles.completionSeal} aria-hidden="true">
                  ✓
                </span>
                <h3>Your first ideas belong in the story.</h3>
                <p>
                  You looked at two workers’ sales and agreements, shared a
                  starting idea, and followed both pay stories. Here’s what you
                  brought to the comparison.
                </p>
              </div>
              <SalesIllustration compact />
            </div>
            <div className={styles.recapIdeas}>
              <PrepareResponse {...props} blocked />
            </div>
            <div className={styles.recapBridge}>
              <h3>
                Before asking “How much?”
                <br />
                <em>Ask “What was promised?”</em>
              </h3>
              <p>{copy("completion")}</p>
              <RelationshipDiagram kind="terms" />
              <p>
                Next time you see pay linked to sales, what would you want to
                know about the agreement?
              </p>
            </div>
            <footer className={styles.actions}>
              <button
                className={styles.secondary}
                disabled={blocked}
                onClick={reviewStory}
              >
                Review the workers’ story
              </button>
              {props.sessionContinuation && (
                <button
                  className={styles.primary}
                  disabled={blocked || !props.sessionContinuation.available}
                  onClick={props.sessionContinuation.onContinue}
                >
                  Back to Commission activities →
                </button>
              )}
            </footer>
          </section>
        ) : teaching ? (
          <>
            <div
              ref={passage}
              className={styles.teaching}
              data-presentation="teaching"
            >
              <p className={styles.lead}>
                The sales and the rate match, so the commission matches too. Now
                follow what each agreement promises after that.
              </p>
              <div className={styles.comparison}>
                {projection.comparison?.map((model, index) => (
                  <CommissionMachine
                    key={index}
                    model={model}
                    worker={index === 0 ? "Worker A" : "Worker B"}
                  />
                ))}
              </div>
              <p
                className={styles.comparisonSummary}
                data-content-id="c06/S01/accessibility-summary"
              >
                {copy("accessibility-summary")}
              </p>
            </div>
            <section
              className={styles.reflection}
              aria-label="Return to your starting idea"
            >
              <div>
                <h3>Look back at your first idea.</h3>
                <p>
                  Did the agreement reveal something you hadn’t considered? Your
                  starting idea stays here so you can compare it with what
                  you’ve just seen.
                </p>
              </div>
              <PrepareResponse {...props} blocked />
            </section>
            <footer className={styles.actions}>
              {action("FINISH_ACTIVITY", "Finish Prepare", true)}
            </footer>
          </>
        ) : (
          <>
            {!checked && <p className={styles.task}>{copy("task")}</p>}
            {checked && (
              <div
                ref={passage}
                className={styles.feedback}
                data-presentation="feedback"
              >
                <h3>
                  {frame.feedbackState?.outcome === "CONFIRMED"
                    ? "There’s more than sales to consider."
                    : "Let’s follow that idea a little further."}
                </h3>
                <p>{frame.feedbackState?.content.text}</p>
                <p className={styles.guidance}>
                  {projection.prepareGuidance?.text}
                </p>
              </div>
            )}
            <div className={styles.workbench}>
              <div>
                <PrepareResponse
                  key={checked ? "recorded" : "editing"}
                  {...props}
                />
              </div>
              <aside
                className={styles.evidenceAside}
                aria-label="Return to the evidence"
              >
                <CommissionEvidence
                  projection={projection}
                  blocked={blocked || support}
                />
                <button
                  className={styles.textButton}
                  disabled={blocked}
                  onClick={reviewStory}
                >
                  Review the workers’ story ↗
                </button>
              </aside>
            </div>
            <footer className={styles.actions} aria-label="Lesson actions">
              {checked ? (
                <>
                  {action("REVISE", "Change my thinking")}
                  {action("CONTINUE", "Follow both pay stories →", true)}
                </>
              ) : (
                <>
                  {frame.reviewAvailability && (
                    <button
                      ref={helpInvoker}
                      className={styles.secondary}
                      disabled={blocked}
                      onClick={props.onHelp}
                    >
                      Look at it with me
                    </button>
                  )}
                  {action("CHECK_RESPONSE", "Record my thinking", true)}
                  {action("CHECK_AGAIN", "Record my thinking", true)}
                </>
              )}
            </footer>
          </>
        )}
      </div>
      <dialog
        ref={help}
        className={styles.help}
        aria-label="Look at it with me"
        onCancel={(event) => {
          event.preventDefault();
          props.onCloseHelp();
        }}
      >
        <h2>Start with the promise.</h2>
        <RelationshipDiagram kind="terms" />
        {frame.review?.relationships.map((item) => (
          <p key={item.id}>{item.text}</p>
        ))}
        <button
          type="button"
          className={styles.primary}
          onClick={props.onCloseHelp}
        >
          Return to my thinking
        </button>
      </dialog>
    </article>
  );
}
