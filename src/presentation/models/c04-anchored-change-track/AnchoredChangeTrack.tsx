import { useEffect, useId, useMemo, useRef } from "react";
import { FeedbackSurface } from "@/presentation/feedback/public";
import { ModalSurface, ReviewSurface } from "@/presentation/support/public";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import type { C04Presentation } from "./public";
import { TrackDiagram } from "./TrackDiagram";
import { C04ResponseControls } from "./C04ResponseControls";
import styles from "./anchored-change-track.module.css";

export function AnchoredChangeTrack(props: C04Presentation) {
  const { frame, blocked, onIntent, onSelect, onPresented } = props;
  const heading = useId();
  const values = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedValueRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const reviewInvoker = useRef<HTMLButtonElement>(null);
  const supportOpen = Boolean(frame.review || frame.sourceReview);
  const previousSupport = useRef(false);
  useEffect(() => {
    const closing = previousSupport.current && !supportOpen;
    previousSupport.current = supportOpen;
    if (!closing || blocked) return;
    // The native dialog's close/focus restoration may finish after effect cleanup.
    // Restore the persistent invoking control only once the modal is gone.
    const request = requestAnimationFrame(() => {
      const invoker = reviewInvoker.current;
      if (
        invoker?.isConnected &&
        !invoker.disabled &&
        !document.querySelector("dialog[open]")
      )
        invoker.focus();
    });
    return () => cancelAnimationFrame(request);
  }, [supportOpen, blocked]);
  useEffect(() => {
    if (blocked || supportOpen) return;
    const feedback = feedbackRef.current;
    if (frame.feedbackState && feedback?.isConnected)
      onPresented?.("feedback", feedback);
    const terminal = terminalRef.current;
    if (
      frame.stateId === "POST_CONFIRMATION_EXPLANATION" &&
      terminal?.isConnected
    )
      onPresented?.("terminal", terminal);
  }, [blocked, supportOpen, frame, onPresented]);
  const selectedValue = frame.exposedModelFacts.find((fact) =>
    fact.id.endsWith("/selected-track/newValue"),
  );
  const selection = frame.modelSelectionControl;
  const announcement = useMemo(
    () =>
      selection && selectedValue
        ? {
            identity: `${frame.activityId}/${frame.stateId}/${selection.revision}`,
            text: selectedValue.text,
            visibleSource: selectedValueRef,
          }
        : null,
    [selection, selectedValue, frame.activityId, frame.stateId],
  );
  // Original/New geometry is scenario-established, not a calculated answer.
  const scene =
    frame.activityId === "C04-A01"
      ? "equal"
      : frame.activityId === "C04-A02"
        ? "increase"
        : frame.activityId === "C04-A03"
          ? "decrease"
          : frame.activityId === "C04-A04"
            ? "increase"
            : "withheld";
  return (
    <section
      className={styles.workspace}
      aria-labelledby={heading}
      data-c04-track={frame.activityId}
    >
      <h2 id={heading} ref={headingRef} tabIndex={-1}>
        Anchored Change Track
      </h2>
      <p className={styles.phase}>Stage: {frame.stateId}</p>
      {frame.contentReferences
        .filter(
          (content) =>
            frame.stateId !== "POST_CONFIRMATION_EXPLANATION" ||
            !content.id.endsWith("/undefined-result"),
        )
        .map((content) => (
          <p key={content.id} data-content-id={content.id}>
            {content.text}
          </p>
        ))}
      <figure className={styles.figure}>
        <TrackDiagram
          scene={scene}
          showChange={frame.exposedDerivedFacts.some((fact) =>
            fact.id.endsWith("/difference"),
          )}
          showRelative={
            frame.exposedDerivedFacts.some((fact) =>
              fact.id.endsWith("/percentage"),
            ) ||
            frame.contentReferences.some((content) =>
              content.id.endsWith("/undefined-result"),
            )
          }
        />
        <figcaption>
          Relational view — not to scale. Read the values below.
        </figcaption>
      </figure>
      <h3 id={values}>Track values</h3>
      <dl className={styles.facts} aria-labelledby={values}>
        {frame.exposedModelFacts.map((fact) => (
          <div key={fact.id} data-fact-id={fact.id}>
            <dt>
              {fact.id.endsWith("/original")
                ? "Original — Reference Basis"
                : "New — Comparison Value"}
            </dt>
            <dd ref={fact === selectedValue ? selectedValueRef : undefined}>
              {fact.text}
            </dd>
          </div>
        ))}
        {frame.exposedDerivedFacts.map((fact) => (
          <div key={fact.id} data-fact-id={fact.id}>
            <dt>
              {fact.id.endsWith("/difference")
                ? "Absolute change"
                : "Percentage change — relative to Original"}
            </dt>
            <dd>{fact.text}</dd>
          </div>
        ))}
      </dl>
      {frame.feedbackState && (
        <div
          ref={feedbackRef}
          data-feedback
          data-presentation-identity={props.presentationIdentity}
          data-content-id={frame.feedbackState.content.id}
        >
          <FeedbackSurface
            feedback={{
              outcome: frame.feedbackState.outcome,
              content: frame.feedbackState.content.text,
            }}
          />
        </div>
      )}
      {frame.stateId === "POST_CONFIRMATION_EXPLANATION" && (
        <div
          ref={terminalRef}
          data-terminal
          data-presentation-identity={props.presentationIdentity}
        >
          {frame.contentReferences
            .filter((content) => content.id.endsWith("/undefined-result"))
            .map((content) => (
              <p key={content.id} data-content-id={content.id}>
                {content.text}
              </p>
            ))}
        </div>
      )}
      {props.fields && (
        <C04ResponseControls
          key={props.draftIdentity}
          {...props}
          blocked={blocked || supportOpen}
        />
      )}
      <div className={styles.controls}>
        {frame.allowedLearnerIntents.includes("REVISE") && (
          <button
            type="button"
            disabled={blocked || supportOpen}
            onClick={() => onIntent("REVISE")}
          >
            Revise response
          </button>
        )}
        {frame.allowedLearnerIntents.includes("FINISH_ACTIVITY") && (
          <button
            type="button"
            disabled={blocked || supportOpen}
            onClick={() => onIntent("FINISH_ACTIVITY")}
          >
            Finish activity
          </button>
        )}
        {props.canContinueSession && (
          <button
            type="button"
            disabled={blocked}
            onClick={props.onContinueSession}
          >
            Next activity
          </button>
        )}
        {(frame.allowedLearnerIntents.includes("OPEN_SUPPORT") ||
          supportOpen) && (
          <button
            key="review-invoker"
            ref={reviewInvoker}
            type="button"
            disabled={blocked}
            onClick={() => props.onSupport?.("REVIEW")}
          >
            Review
          </button>
        )}
      </div>
      <ModalSurface
        open={supportOpen}
        title="Review"
        description="Activity relationship review"
        closeLabel="Close review"
        invokingControlRef={reviewInvoker}
        onClose={() => props.onSupport?.("CLOSE")}
      >
        {frame.review && (
          <ReviewSurface
            review={{
              origin: frame.review,
              relationships: frame.review.relationships,
            }}
            closeLabel="Return to activity"
            onClose={() => props.onSupport?.("CLOSE")}
          />
        )}
      </ModalSurface>
      {selection &&
        frame.allowedLearnerIntents.includes("SELECT_MODEL_CHILD") && (
          <fieldset className={styles.controls} disabled={blocked}>
            <legend>New — fixed scenario selection</legend>
            {selection.options.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={selection.selectedId === option.id}
                onClick={() => onSelect(option.id)}
              >
                {option.text}
              </button>
            ))}
          </fieldset>
        )}
      <div className={styles.controls}>
        {frame.allowedLearnerIntents.includes("PREVIOUS") && (
          <button
            type="button"
            disabled={blocked}
            onClick={() => onIntent("PREVIOUS")}
          >
            Previous
          </button>
        )}
        {frame.allowedLearnerIntents.includes("CONTINUE") && (
          <button
            type="button"
            disabled={blocked}
            onClick={() => onIntent("CONTINUE")}
          >
            Continue
          </button>
        )}
      </div>
      <AccessibilityCoordinator
        blocked={blocked}
        event={{
          kind: "major-step",
          identity: `${frame.activityId}/${frame.stateId}/${frame.responseStage ?? "RESPONSE"}`,
          target: headingRef,
        }}
        announcement={announcement}
      />
    </section>
  );
}
