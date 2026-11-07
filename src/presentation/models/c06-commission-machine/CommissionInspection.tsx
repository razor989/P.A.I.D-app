import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createWorkRecordInspection } from "./commission-inspection";
import { RelationshipDiagram } from "./CommissionIllustrations";
import { useInspectionSound } from "../../audio/public";
import styles from "./commission.module.css";

type Fact = { id: string; title: string; copy: string };
export function CommissionInspection({
  facts,
  blocked = false,
  onInspection,
  diagram,
  children,
}: {
  facts: readonly Fact[];
  blocked?: boolean;
  onInspection?: ((open: boolean) => void) | undefined;
  diagram?: (id: string) => ReactNode;
  children: (
    target: (id: string) => {
      "data-explore": string;
      "aria-controls": string;
      "aria-expanded": false;
      disabled: boolean;
    },
  ) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const sound = useInspectionSound();
  const latest = useRef({ facts, blocked, onInspection, sound });
  useEffect(() => {
    latest.current = { facts, blocked, onInspection, sound };
  });
  useEffect(() => {
    if (!root.current) return;
    const control = createWorkRecordInspection(root.current, {
      blocked: () => latest.current.blocked,
      opened: (open) => latest.current.onInspection?.(open),
      facts: () => latest.current.facts,
      sound: (event, detail) => latest.current.sound(event, detail),
    });
    return () => control.dispose();
  }, []);
  return (
    <div ref={root}>
      <div data-inspection-model>
        {children((key) => ({
          "data-explore": key,
          "aria-controls": id,
          "aria-expanded": false,
          disabled: blocked,
        }))}
      </div>
      <div
        id={id}
        className={styles.inspectionPopover}
        data-inspection-panel
        role="region"
        aria-label="Look closer"
        hidden
      >
        <h4 />
        <div data-inspection-diagram>
          {facts.map((fact) => (
            <div key={fact.id} data-diagram={fact.id}>
              {diagram ? (
                diagram(fact.id)
              ) : (
                <RelationshipDiagram kind={fact.id} />
              )}
            </div>
          ))}
        </div>
        <p data-inspection-copy />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.textButton}
            data-inspection-replay
          >
            ↺ Replay
          </button>
          <button
            type="button"
            className={styles.secondary}
            data-inspection-close
          >
            Close detail
          </button>
        </div>
      </div>
    </div>
  );
}
