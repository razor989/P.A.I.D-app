import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import { ModalSurface } from "./ModalSurface";
import { ReviewSurface } from "./ReviewSurface";
import type { ReviewContent, SupportCloseRequest } from "./ReviewSurface";
import { SourceReviewSurface } from "./SourceReviewSurface";
import type { SourceReviewContent } from "./SourceReviewSurface";
import styles from "./support.module.css";

export type SupportContent =
  | Readonly<{ mode: "REVIEW"; content: ReviewContent }>
  | Readonly<{ mode: "SOURCE_REVIEW"; content: SourceReviewContent }>;
export type SupportRegionProps = Readonly<{
  presentation: "compact" | "expanded";
  support: SupportContent | null;
  title: string;
  description: string;
  closeLabel: string;
  onClose: (request: SupportCloseRequest) => void;
  invokingControlRef?: RefObject<HTMLElement | null>;
}>;

export function SupportRegion({
  presentation,
  support,
  title,
  description,
  closeLabel,
  onClose,
  invokingControlRef,
}: SupportRegionProps) {
  const id = useId();
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
  }, [support]);
  if (!support) return null;
  const request = () => {
    if (closed.current) return;
    closed.current = true;
    onClose({ mode: support.mode, origin: support.content.origin });
  };
  const content =
    support.mode === "REVIEW" ? (
      <ReviewSurface
        review={support.content}
        closeLabel={closeLabel}
        onClose={request}
      />
    ) : (
      <SourceReviewSurface
        sourceReview={support.content}
        closeLabel={closeLabel}
        onClose={request}
      />
    );
  if (presentation === "compact")
    return (
      <ModalSurface
        open
        title={title}
        description={description}
        closeLabel={closeLabel}
        onClose={request}
        {...(invokingControlRef ? { invokingControlRef } : {})}
      >
        {content}
      </ModalSurface>
    );
  return (
    <aside className={styles.region} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
      {content}
    </aside>
  );
}
