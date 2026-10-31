import { ExactDecimalInput } from "@/presentation/controls/public";
import type { C04Field } from "./public";
import styles from "./apply.module.css";
import { normalizeApplyNumber } from "./apply-draft";

/** Quantity representation is a learner choice, not a correctness decision. */
export function ApplyQuantity({
  field,
  label,
  unit,
  value,
  disabled,
  onChange,
}: {
  field: C04Field;
  label: string;
  unit: string;
  value: string;
  disabled: boolean;
  onChange: (value: string, composing?: boolean) => void;
}) {
  const boundary = value === "UNDEFINED";
  return (
    <div className={styles.quantity}>
      <span className={styles.unitMark} aria-hidden="true">
        {unit}
      </span>
      <ExactDecimalInput
        label={label}
        accessibleLabel={`${field.role === "original" ? "Original salary" : field.role === "new" ? "New salary" : label} — ${unit === "%" ? "%" : "PHP per month"}`}
        normalize={normalizeApplyNumber}
        draft={boundary ? "" : value}
        required={field.required && !boundary}
        disabled={disabled || boundary}
        descriptions={{
          empty: "",
          valid: "",
          incomplete: "Complete the number, including any minus sign.",
          malformed: assessDecimalMessage(value),
          composing: "Finish entering the number.",
        }}
        onDraftChange={(next) =>
          onChange(next.draft, next.state === "composing")
        }
      />
      {field.acceptedKinds.includes("SEMANTIC_BOUNDARY") && (
        <details className={styles.alternative} open={boundary || undefined}>
          <summary>Not a numerical value?</summary>
          <label>
            Response for {label.toLowerCase()}
            <select
              aria-label={`Response type for ${label.toLowerCase()}`}
              value={boundary ? "UNDEFINED" : "NUMBER"}
              disabled={disabled}
              onChange={(event) =>
                onChange(event.target.value === "UNDEFINED" ? "UNDEFINED" : "")
              }
            >
              <option value="NUMBER">Enter a number</option>
              <option value="UNDEFINED">Undefined</option>
            </select>
          </label>
          <p>
            Choose undefined only if you think this quantity has no defined
            value.
          </p>
        </details>
      )}
    </div>
  );
}

function assessDecimalMessage(value: string) {
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalizeApplyNumber(value))
    ? ""
    : "Enter a number; use commas only to group thousands.";
}
