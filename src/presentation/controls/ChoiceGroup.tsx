import { useId } from "react";
import styles from "./controls.module.css";

export type ChoiceOption = Readonly<{
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
}>;

export type ChoiceGroupProps = Readonly<{
  mode: "single" | "multiple";
  legend: string;
  description?: string;
  options: readonly ChoiceOption[];
  disabled?: boolean;
  onChoice: (intent: Readonly<{ optionId: string; checked: boolean }>) => void;
}>;

export function ChoiceGroup({
  mode,
  legend,
  description,
  options,
  disabled = false,
  onChoice,
}: ChoiceGroupProps) {
  const id = useId();
  return (
    <fieldset
      className={styles.group}
      disabled={disabled}
      aria-describedby={description ? `${id}-description` : undefined}
    >
      <legend>{legend}</legend>
      {description && <p id={`${id}-description`}>{description}</p>}
      <div className={styles.choices}>
        {options.map((option) => (
          <label key={option.id} className={styles.choice}>
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={id}
              value={option.id}
              checked={option.checked}
              disabled={option.disabled}
              onChange={(event) =>
                onChoice({
                  optionId: option.id,
                  checked: event.currentTarget.checked,
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
