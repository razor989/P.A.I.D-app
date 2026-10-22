import { useId, useState } from "react";
import { ExactDecimal } from "@/core/public";
import styles from "./controls.module.css";

export type DecimalDraft =
  | Readonly<{ state: "valid"; draft: string; candidate: ExactDecimal }>
  | Readonly<{
      state: "empty" | "incomplete" | "malformed" | "composing";
      draft: string;
      candidate: null;
    }>;

/** Draft classification is usability only, never answer evaluation. */
export function assessDecimalDraft(draft: string): DecimalDraft {
  if (draft === "") return { state: "empty", draft, candidate: null };
  if (/^[+-]?$/.test(draft) || /^[+-]?\d*\.$/.test(draft)) {
    return { state: "incomplete", draft, candidate: null };
  }
  try {
    return { state: "valid", draft, candidate: ExactDecimal.from(draft) };
  } catch {
    return { state: "malformed", draft, candidate: null };
  }
}

export type ExactDecimalInputProps = Readonly<{
  label: string;
  draft: string;
  descriptions: Readonly<Record<DecimalDraft["state"], string>>;
  required?: boolean;
  disabled?: boolean;
  onDraftChange: (draft: DecimalDraft) => void;
}>;

export function ExactDecimalInput({
  label,
  draft,
  descriptions,
  required = false,
  disabled = false,
  onDraftChange,
}: ExactDecimalInputProps) {
  const id = useId();
  const [composing, setComposing] = useState(false);
  const assessment: DecimalDraft = composing
    ? { state: "composing", draft, candidate: null }
    : assessDecimalDraft(draft);
  const invalid =
    !composing &&
    (assessment.state === "malformed" ||
      assessment.state === "incomplete" ||
      (assessment.state === "empty" && required));
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.decimal}
        type="text"
        inputMode="decimal"
        value={draft}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-description`}
        onCompositionStart={() => {
          setComposing(true);
          onDraftChange({ state: "composing", draft, candidate: null });
        }}
        onCompositionEnd={(event) => {
          setComposing(false);
          onDraftChange(assessDecimalDraft(event.currentTarget.value));
        }}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onDraftChange(
            composing
              ? { state: "composing", draft: next, candidate: null }
              : assessDecimalDraft(next),
          );
        }}
      />
      <p id={`${id}-description`}>{descriptions[assessment.state]}</p>
    </div>
  );
}
