import { useId } from "react";
import type { ActivityId } from "@/core/public";
import { ActionButton } from "@/presentation/controls/public";
import styles from "./support.module.css";

/** Presentation does not interpret phase strings or decide return eligibility. */
export type SupportOrigin = Readonly<{
  receivingActivityId: ActivityId;
  invokingPhase: string;
  returnTo: string;
}>;
export type SafeSupportText = Readonly<{ id: string; text: string }>;
export type ReviewContent = Readonly<{
  origin: SupportOrigin;
  relationships: readonly SafeSupportText[];
}>;
export type SupportCloseRequest = Readonly<{
  mode: "REVIEW" | "SOURCE_REVIEW";
  origin: SupportOrigin;
}>;
export type ReviewSurfaceProps = Readonly<{
  review: ReviewContent;
  closeLabel: string;
  onClose: (request: SupportCloseRequest) => void;
}>;

export function ReviewSurface({
  review,
  closeLabel,
  onClose,
}: ReviewSurfaceProps) {
  const titleId = useId();
  return (
    <section className={styles.content} aria-labelledby={titleId}>
      <h2 id={titleId}>Review</h2>
      <dl className={styles.metadata}>
        <dt>Receiving activity</dt>
        <dd>{review.origin.receivingActivityId}</dd>
        <dt>Invoking phase</dt>
        <dd>{review.origin.invokingPhase}</dd>
        <dt>Return origin</dt>
        <dd>{review.origin.returnTo}</dd>
      </dl>
      <ul>
        {review.relationships.map(({ id, text }) => (
          <li key={id} data-field-id={id}>
            {text}
          </li>
        ))}
      </ul>
      <ActionButton
        label={closeLabel}
        onAction={() => onClose({ mode: "REVIEW", origin: review.origin })}
      />
    </section>
  );
}
