import { useId } from "react";
import { ActionButton } from "@/presentation/controls/public";
import styles from "./feedback.module.css";

export type InformationNeededContent = Readonly<{
  explanation: string;
  returnLabel: string;
  onReturn: () => void;
}>;

export type InformationNeededSurfaceProps = Readonly<{
  /** Null means unavailable or not authorized; no substitute prose is generated. */
  information: InformationNeededContent | null;
}>;

export function InformationNeededSurface({
  information,
}: InformationNeededSurfaceProps) {
  const titleId = useId();
  if (!information || !information.explanation.trim()) return null;
  return (
    <section
      className={`${styles.surface} ${styles.information}`}
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>Information Needed</h2>
      <p>{information.explanation}</p>
      <ActionButton
        label={information.returnLabel}
        onAction={() => information.onReturn()}
      />
    </section>
  );
}
