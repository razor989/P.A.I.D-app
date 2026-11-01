import { useEffect, useRef, useState } from "react";
import type { C04Presentation } from "./public";
import { TransferModel } from "./TransferModel";
import { TransferSynthesis } from "./TransferSynthesis";
import { TransferStory } from "./TransferStory";
import styles from "./transfer.module.css";

/** Presentation-only views of genuine COMPLETE; no new progression events. */
export function TransferCompletion(
  props: C04Presentation & { titleId: string },
) {
  const [conclusion, setConclusion] = useState(false);
  const [story, setStory] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const record = props.transferRecord;
  useEffect(() => {
    if (props.blocked) return;
    heading.current?.focus({ preventScroll: true });
    surface.current?.scrollIntoView?.({ block: "start" });
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (media?.matches) return;
    if (story) return; // The dedicated story owns its graphic opening choreography.
    const animation = surface.current?.animate?.(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const stop = () => animation?.cancel();
    media?.addEventListener("change", stop);
    return () => {
      stop();
      media?.removeEventListener("change", stop);
    };
  }, [conclusion, story, props.blocked]);
  const response = (role: string, unit: string) => {
    const value = record?.primary[role];
    return value === "UNDEFINED"
      ? "Undefined"
      : value === undefined
        ? "Not available in this record"
        : unit === "₱"
          ? `₱${value}`
          : `${value}%`;
  };
  if (story)
    return (
      <div
        ref={surface}
        className={styles.storyScreen}
        data-transfer-completion="story"
        data-blocked={props.blocked || undefined}
      >
        <div className={styles.storyScreenTransition} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 id={props.titleId} className={styles.storyScreenTitle}>
          Percentage change · Beyond the numbers
        </h2>
        <TransferStory blocked={props.blocked} startOpen />
        <div className={styles.storyScreenActions}>
          <button
            className="text-button"
            disabled={props.blocked}
            onClick={() => setStory(false)}
          >
            ← Back to ideas together
          </button>
          <button
            className="text-button"
            disabled={props.blocked}
            onClick={props.onReturnToLibrary}
          >
            Return to the Learning Library →
          </button>
        </div>
      </div>
    );
  return (
    <div
      ref={surface}
      className={`completion recap-summary ${styles.completion}`}
      data-transfer-completion={conclusion ? "conclusion" : "recap"}
    >
      <header className="recap-hero">
        <p className="recap-eyebrow">
          {conclusion
            ? "Percentage change · Ideas together"
            : "Check and Transfer · Recap"}
        </p>
        <h2 id={props.titleId} ref={heading} tabIndex={-1}>
          {conclusion ? (
            <>
              The change tells a story.
              <br />
              <em>The original gives it meaning.</em>
            </>
          ) : (
            <>
              A new allowance.
              <br />
              <em>A different kind of answer.</em>
            </>
          )}
        </h2>
        <p className="recap-takeaway">
          {conclusion ? (
            <>
              Find the change.
              <br />
              <strong>Know what you are comparing it with.</strong>
            </>
          ) : (
            <>
              The allowance grew from ₱0 to ₱1,500.
              <br />
              <strong>
                An amount can increase without a defined percentage change.
              </strong>
            </>
          )}
        </p>
      </header>
      {conclusion ? (
        props.transfer?.explained && record ? (
          <TransferSynthesis blocked={props.blocked} />
        ) : (
          <p>The explained comparison is unavailable in this view.</p>
        )
      ) : (
        <>
          <div className={styles.recapGrid}>
            <div className={styles.recapModel}>
              <div className="recap-section-heading">
                <span>01</span>
                <div>
                  <h3>The allowance, in view</h3>
                  <p>Let’s look again at where we started and what changed.</p>
                </div>
              </div>
              <TransferModel
                transfer={props.transfer}
                blocked={props.blocked}
              />
            </div>
            <section
              className={styles.checked}
              aria-label="Your recorded response"
            >
              <div className="recap-section-heading">
                <span>02</span>
                <div>
                  <h3>Your recorded response</h3>
                  <p>Here’s what you worked out and how you explained it.</p>
                </div>
              </div>
              <dl className={styles.record}>
                <div>
                  <dt>Change in allowance</dt>
                  <dd>{response("difference", "₱")}</dd>
                </div>
                <div>
                  <dt>Percentage change</dt>
                  <dd>{response("percentage", "%")}</dd>
                </div>
              </dl>
              <h4>Your explanation</h4>
              <p className={styles.recordedReason}>
                {record?.reasoning ??
                  "Recorded reasoning is unavailable in this view."}
              </p>
              {record ? (
                <div
                  className={`feedback ${record.outcome === "CONFIRMED" ? "correct" : "retry"} ${styles.feedback}`}
                  data-content-id={record.feedback.id}
                >
                  <h3>
                    {record.outcome === "CONFIRMED"
                      ? "Confirmation"
                      : "Reconsideration"}
                  </h3>
                  <p>{record.feedback.text}</p>
                </div>
              ) : (
                <p>
                  Feedback is unavailable in this view. No result has been
                  inferred.
                </p>
              )}
            </section>
          </div>
          {props.transfer?.explained && (
            <section
              className={`recap-transfer ${styles.recapInsight}`}
              aria-label="What the relationship showed"
            >
              <div className="recap-section-heading">
                <span>03</span>
                <div>
                  <h3>How does your explanation compare?</h3>
                  <p>
                    Look back at your answer and the reason you chose. Where
                    does the original amount fit into your thinking?
                  </p>
                </div>
              </div>
              <div className={styles.contrast}>
                <div>
                  <span className="eyebrow">THE AMOUNT</span>
                  <strong>+₱1,500</strong>
                  <p>We went from nothing to ₱1,500, so the gain is ₱1,500.</p>
                </div>
                <div>
                  <span className="eyebrow">THE PERCENTAGE</span>
                  <strong>Undefined</strong>
                  <p>
                    We’d have to divide by the original ₱0 to find a percentage.
                    Since we can’t divide by zero, there’s no defined percentage
                    change.
                  </p>
                </div>
              </div>
              <p className={styles.reflection}>
                So we can put the two ideas together:{" "}
                <strong>
                  the allowance increased by ₱1,500; its percentage change from
                  zero is undefined.
                </strong>{" "}
                How does that compare with what you wrote? Think about the
                explanation as well as the answer. Is there anything you’d
                explain differently now?
              </p>
            </section>
          )}
        </>
      )}
      {conclusion && props.transfer?.explained && record && (
        <section
          className={styles.storyInvitationPanel}
          aria-label="Continue to the cinematic conclusion"
        >
          <span className="eyebrow">BEYOND THE ALLOWANCE</span>
          <h3>
            Let’s take this idea <em>somewhere else.</em>
          </h3>
          <p>Beyond the numbers, there’s a way of seeing.</p>
          <button
            className="secondary"
            disabled={props.blocked}
            onClick={() => setStory(true)}
          >
            See it in everyday life →
          </button>
        </section>
      )}
      <div className="completion-actions">
        <button
          className="primary"
          disabled={props.blocked}
          onClick={
            conclusion ? props.onReturnToLibrary : () => setConclusion(true)
          }
        >
          {conclusion
            ? "Return to the Learning Library →"
            : "Percentage Change Ideas Together →"}
        </button>
        {conclusion && (
          <button
            className="text-button"
            disabled={props.blocked}
            onClick={() => setConclusion(false)}
          >
            ← Back to your recap
          </button>
        )}
      </div>
    </div>
  );
}
