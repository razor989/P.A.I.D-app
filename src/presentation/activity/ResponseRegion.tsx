import {
  ActionButton,
  ChoiceGroup,
  ExactDecimalInput,
} from "../controls/public";
import type {
  ActionButtonProps,
  ChoiceGroupProps,
  ExactDecimalInputProps,
} from "../controls/public";
import styles from "./response.module.css";

export type ResponseControl =
  | Readonly<{ id: string; kind: "action"; props: ActionButtonProps }>
  | Readonly<{ id: string; kind: "choice"; props: ChoiceGroupProps }>
  | Readonly<{ id: string; kind: "decimal"; props: ExactDecimalInputProps }>;

export type ResponseRegionProps = Readonly<{
  legend: string;
  description?: string;
  controls: readonly ResponseControl[];
}>;

export function ResponseRegion({
  legend,
  description,
  controls,
}: ResponseRegionProps) {
  return (
    <fieldset className={styles.region}>
      <legend>{legend}</legend>
      {description && <p>{description}</p>}
      {controls.map((control) => {
        switch (control.kind) {
          case "action":
            return <ActionButton key={control.id} {...control.props} />;
          case "choice":
            return <ChoiceGroup key={control.id} {...control.props} />;
          case "decimal":
            return <ExactDecimalInput key={control.id} {...control.props} />;
        }
      })}
    </fieldset>
  );
}
