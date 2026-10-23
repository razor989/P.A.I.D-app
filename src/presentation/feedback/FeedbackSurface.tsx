import { useId } from "react";
import styles from "./feedback.module.css";

/** Already-authorized current feedback. Currency belongs to the caller. */
export type CurrentFeedback = Readonly<{
  outcome: "CONFIRMED" | "RECONSIDERATION";
  content: string;
}>;

export type FeedbackSurfaceProps = Readonly<{
  feedback: CurrentFeedback | null;
}>;

export function FeedbackSurface({ feedback }: FeedbackSurfaceProps) {
  const titleId = useId();
  if (!feedback || !feedback.content.trim()) return null;
  const confirmed = feedback.outcome === "CONFIRMED";
  return (
    <section
      className={`${styles.surface} ${confirmed ? styles.confirmation : styles.reconsideration}`}
      aria-labelledby={titleId}
      role="status"
    >
      <h2 id={titleId}>{confirmed ? "Confirmation" : "Reconsideration"}</h2>
      <p>{feedback.content}</p>
    </section>
  );
}
