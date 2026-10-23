import { useId } from "react";
import { ActionButton } from "@/presentation/controls/public";
import type {
  SafeSupportText,
  SupportOrigin,
  SupportCloseRequest,
} from "./ReviewSurface";
import styles from "./support.module.css";

/** Only the caller's already-whitelisted exposed fields; never a provider record. */
export type SourceReviewContent = Readonly<{
  origin: SupportOrigin;
  sourceRecordId: string;
  providerCompetencyId: string;
  exposedFields: readonly SafeSupportText[];
}>;
export type SourceReviewSurfaceProps = Readonly<{
  sourceReview: SourceReviewContent;
  closeLabel: string;
  onClose: (request: SupportCloseRequest) => void;
}>;

export function SourceReviewSurface({
  sourceReview,
  closeLabel,
  onClose,
}: SourceReviewSurfaceProps) {
  const titleId = useId();
  return (
    <section className={styles.content} aria-labelledby={titleId}>
      <h2 id={titleId}>Source Review</h2>
      <dl className={styles.metadata}>
        <dt>Receiving activity</dt>
        <dd>{sourceReview.origin.receivingActivityId}</dd>
        <dt>Invoking phase</dt>
        <dd>{sourceReview.origin.invokingPhase}</dd>
        <dt>Return origin</dt>
        <dd>{sourceReview.origin.returnTo}</dd>
        <dt>Source record</dt>
        <dd>{sourceReview.sourceRecordId}</dd>
        <dt>Provider attribution</dt>
        <dd>{sourceReview.providerCompetencyId}</dd>
      </dl>
      <ul>
        {sourceReview.exposedFields.map(({ id, text }) => (
          <li key={id} data-field-id={id}>
            {text}
          </li>
        ))}
      </ul>
      <ActionButton
        label={closeLabel}
        onAction={() =>
          onClose({ mode: "SOURCE_REVIEW", origin: sourceReview.origin })
        }
      />
    </section>
  );
}
