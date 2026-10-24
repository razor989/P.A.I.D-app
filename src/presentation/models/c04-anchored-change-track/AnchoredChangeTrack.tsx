import { useId, useMemo, useRef } from "react";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import type { C04Presentation } from "./public";
import { TrackDiagram } from "./TrackDiagram";
import styles from "./anchored-change-track.module.css";

export function AnchoredChangeTrack({
  frame,
  blocked,
  onIntent,
  onSelect,
}: C04Presentation) {
  const heading = useId();
  const values = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedValueRef = useRef<HTMLElement>(null);
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
      {frame.contentReferences.map((content) => (
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
        <p data-feedback>{frame.feedbackState.content.text}</p>
      )}
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
          identity: `${frame.activityId}/${frame.stateId}`,
          target: headingRef,
        }}
        announcement={announcement}
      />
    </section>
  );
}
