import { useEffect, useId, useRef } from "react";
import type { C06PreparePresentation } from "./public";
import { ApplyEvidence, PropertySaleIllustration } from "./ApplyEvidence";
import { ApplyResponse } from "./ApplyResponse";
import { ApplyRecord } from "./ApplyRecord";
import { ApplyGuidance } from "./ApplyGuidance";
import { ApplySynthesis } from "./ApplySynthesis";
import { ApplyRecap } from "./ApplyRecap";
import styles from "./commission.module.css";
import a from "./apply.module.css";

/** Production Actor owns responses, feedback, completion and recoverable work. */
export function ApplyExperience(props: C06PreparePresentation) {
  const { frame } = props.projection;
  const title = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const support = Boolean(frame.review);
  const disabled = props.blocked || support;
  const entry = frame.stateId === "ENTRY";
  const complete = frame.stateId === "COMPLETE";
  const confirmed = frame.feedbackState?.outcome === "CONFIRMED";
  const { onPresented } = props;
  useEffect(() => {
    if (props.blocked) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "start" });
  }, [frame.stateId, props.blocked]);
  useEffect(() => {
    if (support && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!support && dialog.current?.open) {
      dialog.current.close();
      helpButton.current?.focus();
    }
  }, [support]);
  useEffect(() => {
    if (!disabled && frame.feedbackState && feedback.current)
      onPresented("feedback", feedback.current);
  }, [disabled, frame.feedbackState, onPresented]);
  if (frame.activityId !== "C06-A03")
    throw new TypeError("ApplyExperience requires C06-A03");
  const allowed = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((item) => item === intent);
  const diagnostic = props.projection.applyDiagnostic;
  return (
    <article
      className={`${styles.workshop} ${a.workshop}`}
      aria-labelledby={title}
      data-c06-track="C06-A03"
    >
      <header className={styles.masthead}>
        <span className={styles.brand}>p.a.i.d.</span>
        <span>Commission workshop · Apply</span>
      </header>
      <div className={`${styles.sheet} ${a.sheet}`}>
        {entry ? (
          <section className={a.opening}>
            <div>
              <p className={styles.eyebrow}>03 / Apply · Commission</p>
              <h2 id={title} ref={heading} tabIndex={-1}>
                A sale closes.
                <br />
                <em>What is earned?</em>
              </h2>
              <p className={a.lead}>
                The property has a price. The agent has a promise.
              </p>
              <p>
                {
                  frame.contentReferences.find((item) =>
                    item.id.endsWith("/scenario"),
                  )?.text
                }
              </p>
              <p className={a.entryTask}>
                Build a commission claim: choose the pay structure, calculate
                the payment, and explain what it means.
              </p>
              <button
                className={styles.primary}
                disabled={!allowed("CONTINUE")}
                onClick={() => props.onAction("CONTINUE")}
              >
                Work out the agent’s commission →
              </button>
              <div className={a.entryMeta}>
                <span>Your own reasoning</span>
                <span>One sale to investigate</span>
              </div>
            </div>
            <div className={a.entryArt}>
              <PropertySaleIllustration />
              <div className={a.documentCaptions}>
                <span>
                  Closed sale
                  <br />
                  <strong>₱2,000,000</strong>
                </span>
                <span>
                  Commission agreement
                  <br />
                  <strong>5% of sales</strong>
                </span>
              </div>
              <p>
                The record tells you what sold.
                <br />
                The agreement tells you how pay follows.
              </p>
            </div>
          </section>
        ) : (
          <>
            <header key={frame.stateId} className={a.heading}>
              <p className={styles.eyebrow}>
                03 / Apply ·{" "}
                {complete
                  ? "Your recap"
                  : confirmed
                    ? "Bring it together"
                    : "Your commission claim"}
              </p>
              <h2 id={title} ref={heading} tabIndex={-1}>
                {complete
                  ? "The sale became a commission."
                  : confirmed
                    ? "From sale to payment."
                    : "What belongs to the agent?"}
              </h2>
            </header>
            {frame.feedbackState && (
              <div
                ref={feedback}
                className={`${styles.feedback} ${a.feedback}`}
                role="status"
                data-presentation="feedback"
              >
                <h3>
                  {confirmed
                    ? "Your commission claim holds together."
                    : "Let’s trace the link that needs attention."}
                </h3>
                <p>{frame.feedbackState.content.text}</p>
              </div>
            )}
            {complete ? (
              <ApplyRecap {...props} />
            ) : confirmed ? (
              <ApplySynthesis {...props} blocked={disabled} />
            ) : frame.feedbackState ? (
              <>
                <div className={a.workspace}>
                  <ApplyEvidence
                    projection={props.projection}
                    focus={
                      diagnostic === "ARRANGEMENT" || diagnostic === "RATE"
                        ? "agreement"
                        : diagnostic === "SALES_BASE"
                          ? "sale"
                          : "payment"
                    }
                  />
                  <ApplyGuidance
                    key={`${frame.stateId}-${diagnostic}`}
                    projection={props.projection}
                  />
                </div>
                <ApplyRecord projection={props.projection} />
                <footer className={a.panelNav}>
                  <p>
                    Your original claim stays visible. Revise it yourself after
                    following the relationship.
                  </p>
                  <button
                    className={styles.primary}
                    disabled={!allowed("REVISE")}
                    onClick={() => props.onAction("REVISE")}
                  >
                    Revise my commission claim →
                  </button>
                </footer>
              </>
            ) : (
              <ApplyResponse {...props} blocked={disabled} />
            )}
            {!complete && !confirmed && (
              <footer className={a.supportNav}>
                <button
                  ref={helpButton}
                  className={styles.textButton}
                  disabled={!allowed("OPEN_SUPPORT")}
                  onClick={props.onHelp}
                >
                  Walk me through the relationship
                </button>
                <span>Agreement → sales base → commission</span>
              </footer>
            )}
          </>
        )}
      </div>
      <footer className={a.siteFooter}>
        <span>Apply · Straight commission</span>
        <span>The sale is the reference. Commission is the payment.</span>
      </footer>
      <dialog
        ref={dialog}
        className={`${styles.help} ${a.help}`}
        aria-label="Help with straight commission"
        onCancel={(event) => {
          event.preventDefault();
          props.onCloseHelp();
        }}
      >
        <p className={styles.eyebrow}>
          A closer look · Your work stays in place
        </p>
        <h3>Follow the promise to the payment.</h3>
        {support && <ApplyGuidance projection={props.projection} help />}
        <button className={styles.primary} onClick={props.onCloseHelp}>
          Return to my commission claim
        </button>
      </dialog>
    </article>
  );
}
