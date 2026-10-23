import { useId } from "react";
import { ActionButton } from "@/presentation/controls/public";
import styles from "./support.module.css";

export type SystemAction = Readonly<{
  id: string;
  label: string;
  onAction: () => void;
  disabled?: boolean;
}>;
export type SystemRecoverySurfaceProps = Readonly<{
  title: string;
  status: string;
  explanation: string;
  actions: readonly SystemAction[];
}>;

export function SystemRecoverySurface({
  title,
  status,
  explanation,
  actions,
}: SystemRecoverySurfaceProps) {
  const id = useId();
  return (
    <section className={styles.system} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p role="status">{status}</p>
      <p>{explanation}</p>
      <div className={styles.actions}>
        {actions.map(({ id: actionId, label, onAction, disabled }) => (
          <ActionButton
            key={actionId}
            label={label}
            onAction={onAction}
            {...(disabled === undefined ? {} : { disabled })}
          />
        ))}
      </div>
    </section>
  );
}
