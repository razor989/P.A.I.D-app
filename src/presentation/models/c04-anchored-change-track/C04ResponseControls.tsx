import { useState } from "react";
import {
  ChoiceGroup,
  ExactDecimalInput,
  assessDecimalDraft,
} from "@/presentation/controls/public";
import type { C04Presentation } from "./public";
import styles from "./c04-response-controls.module.css";

const descriptions = {
  valid: "Number entered.",
  empty: "Enter a number.",
  incomplete: "Complete the number.",
  malformed: "Enter a valid number without units or separators.",
  composing: "Finish entering the number.",
};
export function C04ResponseControls({
  fields = [],
  blocked,
  onDraft,
  onIntent,
  frame,
}: C04Presentation) {
  const [draft, setDraft] = useState<Readonly<Record<string, string>>>({});
  const [composing, setComposing] = useState(false);
  function update(role: string, value: string, pending = false) {
    const next = { ...draft, [role]: value };
    setDraft(next);
    setComposing(pending);
    if (!pending) onDraft?.(next);
  }
  const valid =
    !composing &&
    fields.every((field) => {
      const value = draft[field.role] ?? "";
      return !value
        ? !field.required
        : field.options
          ? field.options.some((option) => option.id === value)
          : value === "UNDEFINED"
            ? field.acceptedKinds.includes("SEMANTIC_BOUNDARY")
            : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) &&
              assessDecimalDraft(value).state === "valid";
    });
  const intents = frame.allowedLearnerIntents;
  return (
    <section className={styles.responses} aria-label="Your response">
      {fields.map((field) =>
        field.options ? (
          <ChoiceGroup
            key={field.role}
            mode="single"
            legend={field.role}
            disabled={blocked}
            options={field.options.map((option) => ({
              id: option.id,
              label: option.text,
              checked: draft[field.role] === option.id,
            }))}
            onChoice={({ optionId }) => update(field.role, optionId)}
          />
        ) : (
          <div key={field.role}>
            <ExactDecimalInput
              label={`${field.role}${field.required ? "" : " (optional)"}${field.unit ? ` — ${field.unit}` : ""}`}
              draft={
                draft[field.role] === "UNDEFINED"
                  ? ""
                  : (draft[field.role] ?? "")
              }
              required={field.required && draft[field.role] !== "UNDEFINED"}
              disabled={blocked || draft[field.role] === "UNDEFINED"}
              descriptions={descriptions}
              onDraftChange={(value) =>
                update(field.role, value.draft, value.state === "composing")
              }
            />
            {field.acceptedKinds.includes("SEMANTIC_BOUNDARY") && (
              <label>
                <input
                  type="checkbox"
                  checked={draft[field.role] === "UNDEFINED"}
                  disabled={blocked}
                  onChange={(event) =>
                    update(
                      field.role,
                      event.currentTarget.checked ? "UNDEFINED" : "",
                    )
                  }
                />
                {field.role}: UNDEFINED
              </label>
            )}
          </div>
        ),
      )}
      {fields.length > 0 && (
        <div className={styles.actions}>
          {frame.responseStage === "PRIMARY" ? (
            <button
              type="button"
              disabled={
                blocked ||
                !valid ||
                !intents.includes("COMMIT_PRIMARY_RESPONSE")
              }
              onClick={() => onIntent("COMMIT_PRIMARY_RESPONSE")}
            >
              Commit primary response
            </button>
          ) : (
            <button
              type="button"
              disabled={
                blocked ||
                !valid ||
                !(
                  intents.includes("CHECK_RESPONSE") ||
                  intents.includes("CHECK_AGAIN")
                )
              }
              onClick={() =>
                onIntent(
                  intents.includes("CHECK_AGAIN")
                    ? "CHECK_AGAIN"
                    : "CHECK_RESPONSE",
                )
              }
            >
              Check
            </button>
          )}
          {intents.includes("RETURN_TO_PRIMARY") && (
            <button
              type="button"
              disabled={blocked}
              onClick={() => onIntent("RETURN_TO_PRIMARY")}
            >
              Return to primary
            </button>
          )}
        </div>
      )}
    </section>
  );
}
