import { useEffect, useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { IdeaIllustration } from "./CommissionIllustrations";
import styles from "./commission.module.css";

/** Each illustrated choice records only the idea the learner actually selected. */
export function PrepareResponse({
  projection,
  blocked,
  onResponse,
  paced = true,
}: Pick<C06PreparePresentation, "projection" | "blocked" | "onResponse"> & {
  paced?: boolean;
}) {
  const [question, setQuestion] = useState(0);
  const heading = useRef<HTMLLegendElement>(null);
  const banks = projection.preparePrompts;
  const editable =
    !blocked &&
    projection.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  useEffect(() => {
    if (editable) heading.current?.focus({ preventScroll: true });
  }, [question, editable]);
  if (!banks) throw new TypeError("C06-A01 first-thinking contract required");
  const selected = (role: string) => {
    const response = parts.find((part) => part.key === role)?.response;
    return response?.kind === "SINGLE_SELECTION" ? response.selectionId : "";
  };
  return (
    <section
      className={styles.response}
      aria-label={editable ? "Your first thinking" : "Your recorded ideas"}
    >
      {banks.map((bank, index) => {
        if (editable && paced && index !== question) return null;
        const saved = selected(bank.role);
        return editable ? (
          <fieldset
            key={bank.role}
            className={styles.diagnosticBank}
            disabled={!editable}
          >
            <legend ref={heading} tabIndex={-1}>
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
                    name={bank.role}
                    checked={saved === option.id}
                    value={option.id}
                    onChange={() =>
                      onResponse({
                        kind: "COMPOSITE",
                        parts: [
                          ...parts.filter((part) => part.key !== bank.role),
                          {
                            key: bank.role,
                            response: {
                              kind: "SINGLE_SELECTION",
                              selectionId: option.id,
                            },
                          },
                        ],
                      })
                    }
                  />
                  <IdeaIllustration idea={option.id} />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div key={bank.role} className={styles.recordedIdea}>
            <IdeaIllustration idea={saved || "UNSURE"} />
            <h3>{bank.prompt}</h3>
            <p>
              {bank.options.find((option) => option.id === saved)?.text ??
                "Not yet recorded"}
            </p>
          </div>
        );
      })}
      {editable && paced && (
        <nav className={styles.actions} aria-label="Thinking questions">
          {question === 1 && (
            <button className={styles.secondary} onClick={() => setQuestion(0)}>
              ← Previous question
            </button>
          )}
          {question === 0 && (
            <button
              className={styles.primary}
              disabled={!selected("expectation")}
              onClick={() => setQuestion(1)}
            >
              Next question →
            </button>
          )}
        </nav>
      )}
    </section>
  );
}
