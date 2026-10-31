import { useEffect, useRef, useState } from "react";
import type { C04Presentation } from "./public";
import { ApplyComparison } from "./ApplyComparison";
import { ApplyResponse } from "./ApplyResponse";
import styles from "./apply.module.css";

/** Completion is owned by the activity; this is its recorded, non-editable recap. */
export function ApplyRecap(props: C04Presentation) {
  const heading = useRef<HTMLHeadingElement>(null);
  const recap = useRef<HTMLDivElement>(null);
  const [revisiting, setRevisiting] = useState(false);
  useEffect(() => {
    if (!props.blocked) heading.current?.focus();
  }, [props.blocked, revisiting]);
  const completion = props.frame.contentReferences.find(
    (item) => item.id === "c04/S03/completion",
  );
  if (revisiting)
    return (
      <div className={styles.relationshipView}>
        <header className="lesson-heading">
          <span className="eyebrow">YOUR OFFER · A CLOSER LOOK</span>
          <h2 ref={heading} tabIndex={-1}>
            Keep the original
            <br />
            <em>in view.</em>
          </h2>
        </header>
        <ApplyComparison {...props} />
        <div className="lesson-nav">
          <button
            className="primary"
            disabled={props.blocked}
            onClick={() => setRevisiting(false)}
          >
            ← Back to recap
          </button>
        </div>
      </div>
    );
  return (
    <div
      ref={recap}
      className={`completion recap-summary ${styles.recap}`}
      data-recap
    >
      <header className="recap-hero">
        <div className="completion-seal" aria-hidden="true">
          ✓
        </div>
        <p className="recap-eyebrow">Apply finished</p>
        <h2 ref={heading} tabIndex={-1}>
          The offer,
          <br />
          <em>in perspective.</em>
        </h2>
        <p className="recap-takeaway">
          Read the change.
          <br />
          <strong>Keep the original as your reference.</strong>
        </p>
      </header>
      <ApplyResponse {...props} />
      <ApplyComparison {...props} />
      <section className="recap-transfer">
        <h3>Take the reasoning with you</h3>
        <ol className="recap-steps">
          <li>
            <span>01</span>
            <strong>Find the change</strong>
            <p>New − Original</p>
          </li>
          <li>
            <span>02</span>
            <strong>Use the reference</strong>
            <p>Divide by the nonzero original.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Read the result</strong>
            <p>Multiply by 100 and interpret the sign.</p>
          </li>
        </ol>
        {completion && <p data-content-id={completion.id}>{completion.text}</p>}
      </section>
      <div className="completion-actions">
        {props.canContinueSession && (
          <button
            className="primary"
            disabled={props.blocked}
            onClick={props.onContinueSession}
          >
            Next activity →
          </button>
        )}
        <button
          className="text-button"
          disabled={props.blocked}
          onClick={() => setRevisiting(true)}
        >
          Revisit the relationship →
        </button>
        <button
          className="text-button"
          disabled={props.blocked}
          onClick={props.onReturnToLibrary}
        >
          Return to the Learning Library
        </button>
      </div>
    </div>
  );
}
