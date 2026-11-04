import type { LearnerResponse } from "@/core/public";
import { useEffect, useRef, useState } from "react";
import type { C03PreparePresentation } from "./public";
import { ThinkingIllustration } from "./ThinkingIllustration";
import styles from "./work-record.module.css";

export function PrepareResponse({
  projection,
  blocked,
  onResponse,
  onAction,
}: C03PreparePresentation) {
  const [question, setQuestion] = useState(0);
  const legend = useRef<HTMLLegendElement>(null);
  useEffect(() => {
    if (!blocked) legend.current?.focus({ preventScroll: true });
  }, [question, blocked]);
  const contract = projection.diagnosticPrompts;
  if (!contract) throw new TypeError("Neutral A01 source contract required");
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const editable =
    !blocked &&
    projection.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const selection = (role: string) => {
    const response = parts.find((part) => part.key === role)?.response;
    return response?.kind === "SINGLE_SELECTION" ? response.selectionId : "";
  };
  function publish(role: string, selectionId: string) {
    const response: LearnerResponse = {
      kind: "COMPOSITE",
      parts: [
        ...parts.filter((part) => part.key !== role),
        { key: role, response: { kind: "SINGLE_SELECTION", selectionId } },
      ],
    };
    onResponse(response);
  }
  return (
    <section
      className={styles.response}
      aria-label={editable ? "Your first thinking" : "Your recorded ideas"}
    >
      {(["expectation", "investigation"] as const).map((role, index) => {
        const bank = contract[role];
        const saved = selection(role);
        if (editable && index !== question) return null;
        return editable ? (
          <fieldset
            key={role}
            className={styles.diagnosticBank}
            disabled={!editable}
          >
            <legend ref={legend} tabIndex={-1}>
              <span className={styles.eyebrow}>
                Your first thinking · {index + 1} of 2
              </span>
              {bank.prompt}
            </legend>
            <div className={styles.diagnosticChoices}>
              {bank.options.map((option) => (
                <label
                  key={option.id}
                  className={styles.diagnosticChoice}
                  data-selected={saved === option.id}
                >
                  <input
                    type="radio"
                    name={role}
                    value={option.id}
                    checked={saved === option.id}
                    onChange={() => publish(role, option.id)}
                  />
                  <ThinkingIllustration idea={option.id} />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div key={role} className={styles.recordedIdea}>
            <ThinkingIllustration idea={saved} />
            <p className={styles.eyebrow}>
              {index === 0
                ? "Your starting idea"
                : "What you want to investigate"}
            </p>
            <h3>{bank.prompt}</h3>
            <p>
              {bank.options.find((option) => option.id === saved)?.text ??
                "Not yet recorded"}
            </p>
          </div>
        );
      })}
      {editable && (
        <footer className={styles.actions}>
          {question === 1 && (
            <button
              className={styles.secondary}
              disabled={blocked}
              onClick={() => setQuestion(0)}
            >
              ← Previous question
            </button>
          )}
          {question === 0 ? (
            <button
              className={styles.primary}
              disabled={blocked || !selection("expectation")}
              onClick={() => setQuestion(1)}
            >
              Next question →
            </button>
          ) : (
            (["CHECK_RESPONSE", "CHECK_AGAIN"] as const).map(
              (intent) =>
                projection.frame.allowedLearnerIntents.includes(intent) && (
                  <button
                    key={intent}
                    className={styles.primary}
                    disabled={blocked}
                    onClick={() => onAction(intent)}
                  >
                    Record my thinking
                  </button>
                ),
            )
          )}
        </footer>
      )}
    </section>
  );
}
