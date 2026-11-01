import { useState } from "react";
import { assessDecimalDraft } from "@/presentation/controls/public";
import type { C04Presentation } from "./public";
import { ApplyQuantity } from "./ApplyQuantity";
import { normalizeApplyNumber } from "./apply-draft";
import styles from "./transfer.module.css";

/** Two source-owned commitments. No consistency inference or local correctness check. */
export function TransferResponse(props: C04Presentation) {
  const { frame, fields = [], blocked, onIntent } = props;
  const [draft, setDraft] = useState<Readonly<Record<string, string>>>(
    props.responseDraft ?? {},
  );
  const [pending, setPending] = useState<Readonly<Record<string, boolean>>>({});
  const primary = frame.responseStage === "PRIMARY";
  function normalized(values: Readonly<Record<string, string>>) {
    return Object.fromEntries(
      Object.entries(values).map(([role, value]) => [
        role,
        role === "explanation" ? value : normalizeApplyNumber(value),
      ]),
    );
  }
  function update(role: string, value: string, composing = false) {
    const next = { ...draft, [role]: value },
      busy = { ...pending, [role]: composing };
    setDraft(next);
    setPending(busy);
    if (!Object.values(busy).some(Boolean)) props.onDraft?.(normalized(next));
  }
  const valid =
    fields.length > 0 &&
    fields.every((field) => {
      const value = normalized(draft)[field.role] ?? "";
      return (
        !pending[field.role] &&
        (field.options
          ? field.options.some((option) => option.id === value)
          : value === "UNDEFINED"
            ? field.acceptedKinds.includes("SEMANTIC_BOUNDARY")
            : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) &&
              assessDecimalDraft(value).state === "valid")
      );
    });
  const reason = fields.find((field) => field.role === "explanation");
  const commit = primary
    ? "COMMIT_PRIMARY_RESPONSE"
    : frame.allowedLearnerIntents.includes("CHECK_AGAIN")
      ? "CHECK_AGAIN"
      : "CHECK_RESPONSE";
  return (
    <section
      className={styles.response}
      aria-label={primary ? "Your calculation" : "Your reasoning"}
    >
      <p className={styles.commitment}>
        {primary
          ? "First, record your calculation."
          : "Your calculation is committed. Now choose your reasoning."}
      </p>
      <h3>
        {primary ? (
          <>
            What change would <em>you report?</em>
          </>
        ) : (
          <>
            What supports <em>your conclusion?</em>
          </>
        )}
      </h3>
      {primary ? (
        <>
          <p className={styles.direction}>
            How much more money is there now? Work that out first, then decide
            what you would report for the percentage change. Next, you’ll
            explain your thinking. We’ll check both parts together.
          </p>
          <div className={styles.quantities}>
            {fields
              .filter((f) => f.role === "difference" || f.role === "percentage")
              .map((field) => (
                <ApplyQuantity
                  key={field.role}
                  field={field}
                  label={
                    field.role === "difference"
                      ? "Change in allowance"
                      : "Percentage change"
                  }
                  unit={field.role === "difference" ? "₱" : "%"}
                  value={draft[field.role] ?? ""}
                  disabled={blocked}
                  onChange={(value, composing) =>
                    update(field.role, value, composing)
                  }
                />
              ))}
          </div>
        </>
      ) : (
        <>
          <dl className={styles.record} aria-label="Your committed calculation">
            <div>
              <dt>Change in allowance</dt>
              <dd>
                {props.responseDraft?.difference === "UNDEFINED"
                  ? "Undefined"
                  : `₱${props.responseDraft?.difference ?? "—"}`}
              </dd>
            </div>
            <div>
              <dt>Percentage change</dt>
              <dd>
                {props.responseDraft?.percentage === "UNDEFINED"
                  ? "Undefined"
                  : `${props.responseDraft?.percentage ?? "—"}%`}
              </dd>
            </div>
          </dl>
          <fieldset className={styles.reasons} disabled={blocked}>
            <legend>Which statement best explains your thinking?</legend>
            {reason?.options?.map((option, index) => (
              <label
                className={`choice ${draft.explanation === option.id ? "selected" : ""}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name="transfer-explanation"
                  value={option.id}
                  checked={draft.explanation === option.id}
                  onChange={() => update("explanation", option.id)}
                />
                <span className={styles.letter} aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      <div className="lesson-nav">
        {frame.allowedLearnerIntents.includes("RETURN_TO_PRIMARY") && (
          <button
            className="text-button"
            disabled={blocked}
            onClick={() => onIntent("RETURN_TO_PRIMARY")}
          >
            ← Change my calculation
          </button>
        )}
        <button
          className="primary"
          disabled={
            blocked || !valid || !frame.allowedLearnerIntents.includes(commit)
          }
          onClick={() => {
            onIntent(commit);
          }}
        >
          {primary ? "Commit my calculation →" : "Check my response"}
        </button>
      </div>
      <p className={styles.note}>
        {primary
          ? "Your calculation will be saved, but not checked yet. You can still come back and change it before checking both parts."
          : "Want to change your calculation? You can go back. After saving it again, you’ll need to choose your explanation once more."}
      </p>
    </section>
  );
}
