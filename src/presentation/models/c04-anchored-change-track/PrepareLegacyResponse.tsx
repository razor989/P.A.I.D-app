import type { C04Presentation } from "./public";
import { AnchoredChangeTrack } from "./AnchoredChangeTrack";
import { useState } from "react";

/** No evidence conversion: resumed numeric work keeps its original interaction. */
export function PrepareLegacyResponse(props: C04Presentation) {
  const [draft, setDraft] = useState(() => props.prepareLegacyDraft ?? {});
  const disabled =
    props.blocked || Boolean(props.frame.review || props.frame.sourceReview);
  const fields = props.fields ?? [];
  const editable =
    props.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const valid = fields.every((field) => {
    const value = draft[field.role];
    return !value
      ? !field.required
      : field.options
        ? field.options.some((option) => option.id === value)
        : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value);
  });
  function update(role: string, value: string) {
    const next = { ...draft, [role]: value };
    setDraft(next);
    props.onDraft?.(next);
  }
  return (
    <section aria-label="Saved Prepare activity">
      <p>
        <strong>Resuming your saved activity.</strong> This attempt uses the
        original numeric response. Your saved evidence has not been converted
        into guided choices.
      </p>
      <AnchoredChangeTrack {...props} fields={[]} />
      {editable && (
        <section aria-label="Saved numeric response">
          {fields.map((field) =>
            field.options ? (
              <fieldset key={field.role} disabled={disabled}>
                <legend>{field.role}</legend>
                {field.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={`legacy-${field.role}`}
                      checked={draft[field.role] === option.id}
                      onChange={() => update(field.role, option.id)}
                    />
                    {option.text}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label key={field.role}>
                {field.role}
                {field.required ? "" : " (optional)"}
                {field.unit ? ` — ${field.unit}` : ""}
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft[field.role] ?? ""}
                  required={field.required}
                  disabled={disabled}
                  onChange={(event) =>
                    update(field.role, event.currentTarget.value)
                  }
                />
              </label>
            ),
          )}
          <button
            disabled={
              disabled ||
              !valid ||
              !props.frame.allowedLearnerIntents.some(
                (intent) =>
                  intent === "CHECK_RESPONSE" || intent === "CHECK_AGAIN",
              )
            }
            onClick={() =>
              props.onIntent(
                props.frame.allowedLearnerIntents.includes("CHECK_AGAIN")
                  ? "CHECK_AGAIN"
                  : "CHECK_RESPONSE",
              )
            }
          >
            Check
          </button>
        </section>
      )}
    </section>
  );
}
