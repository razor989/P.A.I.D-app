import styles from "./controls.module.css";

export type ActionButtonProps = Readonly<{
  label: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onAction: () => void;
}>;

export function ActionButton({
  label,
  type = "button",
  disabled = false,
  onAction,
}: ActionButtonProps) {
  return (
    <button
      className={styles.action}
      type={type}
      disabled={disabled}
      onClick={onAction}
    >
      {label}
    </button>
  );
}
