import { useRef } from "react";
import type { RefObject } from "react";
import type { C03PreparePresentation } from "./public";
import { ExploreGlyph } from "./ExploreGlyph";
import { useWorkRecordMotion } from "./use-work-record-motion";
import base from "./work-record.module.css";
import styles from "./transfer.module.css";

export function TransferReference({
  projection,
  blocked,
  onCloseHelp,
  focusRef,
}: C03PreparePresentation & { focusRef: RefObject<HTMLDivElement | null> }) {
  const surface = useRef<HTMLElement>(null);
  useWorkRecordMotion(surface, "reference", blocked);
  return (
    <section ref={surface} className={styles.referenceSurface}>
      <div
        ref={focusRef}
        tabIndex={-1}
        className={styles.support}
        role="region"
        aria-label="Regular-holiday relationship reference"
      >
        <header data-motion="scene">
          <p className={base.eyebrow}>A rule to apply · Not a filled answer</p>
          <h3>
            The day establishes
            <br />
            <em>the multiplier.</em>
          </h3>
        </header>
        <div
          className={styles.referenceRule}
          data-reference-link
          data-motion="emphasis"
        >
          <div>
            <ExploreGlyph name="day" />
            <span>Established condition</span>
            <strong>Regular holiday</strong>
          </div>
          <ExploreGlyph name="next" />
          <div>
            <span>Approved overtime rule</span>
            <strong>× 2.60</strong>
          </div>
        </div>
        <div data-motion="scene">
          {projection.frame.review?.relationships.map((r) => (
            <p key={r.id} data-content-id={r.id}>
              {r.text}
            </p>
          ))}
          <p>
            Use the rule with Mara’s established hourly rate and her three extra
            hours. Your entries have not been changed or checked.
          </p>
        </div>
        <button
          className={base.primary}
          disabled={blocked}
          onClick={onCloseHelp}
        >
          Return to my reasoning
          <ExploreGlyph name="next" />
        </button>
      </div>
    </section>
  );
}
