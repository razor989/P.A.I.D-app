import { useEffect, useId, useRef } from "react";
import { createWorkRecordInspection } from "./work-record-inspection";
import { InspectionDiagram } from "./InspectionDiagram";
import type { C03WorkRecordProjection } from "./public";
import styles from "./work-record.module.css";

/** Formatting only: retain exact source digits without floating point or rounding. */
export function pesos(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return `₱${whole}.${fraction.padEnd(2, "0")}`;
}

export function WorkEvidence({
  projection,
  moment = 2,
  cue = 2,
  compact = false,
  interactive = false,
  blocked = false,
  onInspection,
}: {
  projection: C03WorkRecordProjection;
  moment?: number;
  cue?: number;
  compact?: boolean;
  interactive?: boolean;
  blocked?: boolean;
  onInspection?: (open: boolean) => void;
}) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const latest = useRef({ blocked, onInspection });
  const { rate, hours, conditions } = projection.workEvidence;
  const facts = [
    {
      id: "regular",
      title: "Eight regular hours",
      copy: "Nico has finished his regular eight hours of work. The green tiles keep those hours visible.",
    },
    ...(moment >= 1
      ? [
          {
            id: "extra",
            title: "Two additional hours",
            copy: "The gold tiles represent two more hours after the regular eight. They do not replace any of the green hours.",
          },
        ]
      : []),
    {
      id: "rate",
      title: "His usual hourly pay",
      copy: `${pesos(rate.magnitude.toString())} per hour is Nico’s regular rate. What would you want to know about pay for the extra work?`,
    },
    {
      id: "context",
      title: "An ordinary working day",
      copy: "This record describes an ordinary working day. What would you wonder about if the same extra hours happened on another kind of day?",
    },
  ];
  const currentFacts = useRef(facts);
  const control = useRef<ReturnType<typeof createWorkRecordInspection> | null>(
    null,
  );
  useEffect(() => {
    latest.current = { blocked, onInspection };
    currentFacts.current = facts;
  });
  useEffect(() => {
    if (!interactive || !root.current) return;
    const inspection = createWorkRecordInspection(root.current, {
      blocked: () => latest.current.blocked,
      opened: (open) => latest.current.onInspection?.(open),
      facts: () => currentFacts.current,
    });
    control.current = inspection;
    return () => {
      inspection.dispose();
      control.current = null;
    };
  }, [interactive]);
  useEffect(() => {
    control.current?.close();
  }, [blocked, moment]);
  const target = (part: string, label: string) =>
    interactive
      ? {
          "data-explore": part,
          role: "button",
          tabIndex: blocked ? -1 : 0,
          "aria-label": label,
          "aria-controls": `${id}-inspection`,
          "aria-expanded": false,
          "aria-disabled": blocked,
          className: styles.modelTarget,
        }
      : {};
  return (
    <section
      ref={root}
      className={`${styles.record} ${compact ? styles.compactRecord : ""}`}
      aria-labelledby={id}
    >
      <div className={styles.recordHeading}>
        <span className={styles.eyebrow}>Nico’s Work Record</span>
        <span className={styles.recordNumber}>01 / NICO</span>
      </div>
      <h3 id={id}>
        One workday. <em>Two parts.</em>
      </h3>
      <div data-inspection-model>
        <dl className={styles.facts}>
          <div
            {...target("rate", "His usual hourly pay")}
            hidden={moment === 0 && cue < 2}
          >
            <dt>Regular hourly rate</dt>
            <dd>
              {pesos(rate.magnitude.toString())}
              <small>per hour</small>
            </dd>
          </div>
          <div {...target("context", "An ordinary working day")}>
            <dt>Work context</dt>
            <dd className={styles.context}>{conditions?.[0]}</dd>
          </div>
        </dl>
        <figure className={styles.timeRecord}>
          <svg
            viewBox="0 0 600 280"
            role={interactive ? "group" : "img"}
            aria-label="Eight regular hours followed by additional overtime hours"
          >
            <g {...target("regular", "Eight regular hours")}>
              <rect
                x="16"
                y="42"
                width="340"
                height="156"
                fill="transparent"
                pointerEvents="all"
              />
              <text x="20" y="30" className={styles.svgLabel}>
                REGULAR WORK
              </text>
              <text x="420" y="30" className={styles.svgLabel}>
                ADDITIONAL WORK
              </text>
              {Array.from({ length: 8 }, (_, index) => (
                <g
                  key={index}
                  transform={`translate(${20 + (index % 4) * 86} ${50 + Math.floor(index / 4) * 72})`}
                >
                  <g data-motion="hour" data-order={index}>
                    <rect
                      width="74"
                      height="60"
                      rx="7"
                      className={styles.regularBlock}
                    />
                    <path d="M12 43h50" className={styles.hourMark} />
                    <text
                      x="37"
                      y="31"
                      textAnchor="middle"
                      className={styles.hourNumber}
                    >
                      {index + 1}
                    </text>
                  </g>
                </g>
              ))}
              <path d="M388 45v151" className={styles.boundary} />
            </g>
            {moment >= 1 && (
              <g {...target("extra", "Two additional hours")}>
                <rect
                  x="416"
                  y="82"
                  width="168"
                  height="68"
                  fill="transparent"
                  pointerEvents="all"
                />
                {Array.from({ length: 2 }, (_, index) => (
                  <g
                    key={index}
                    transform={`translate(${420 + index * 86} 86)`}
                  >
                    <g data-motion="hour" data-order={index}>
                      <rect
                        width="74"
                        height="60"
                        rx="7"
                        className={styles.overtimeBlock}
                      />
                      <path d="M12 43h50" className={styles.hourMark} />
                      <text
                        x="37"
                        y="31"
                        textAnchor="middle"
                        className={styles.hourNumber}
                      >
                        +1
                      </text>
                    </g>
                  </g>
                ))}
              </g>
            )}
            <path d="M20 200v8h332v-8" className={styles.brace} />
            <text
              x="186"
              y="246"
              textAnchor="middle"
              className={styles.svgQuantity}
            >
              8 hours
            </text>
            {moment >= 1 && (
              <g data-motion="emphasis">
                <path d="M420 200v8h160v-8" className={styles.brace} />
                <text
                  x="500"
                  y="246"
                  textAnchor="middle"
                  className={styles.svgQuantity}
                >
                  +{hours.magnitude.toString()} hours
                </text>
              </g>
            )}
          </svg>
          <figcaption className={styles.timeLabels}>
            <span>
              <strong>First 8 hours</strong>
              <small>Regular work completed</small>
            </span>
            {moment >= 1 && (
              <span>
                <strong>+{hours.magnitude.toString()} hours</strong>
                <small>Additional overtime</small>
              </span>
            )}
          </figcaption>
        </figure>
      </div>
      {interactive && (
        <div className={styles.inspection}>
          <p className={styles.evidenceNote}>
            Hover, focus or tap the hours, rate or kind of day to look closer.
          </p>
          <div
            id={`${id}-inspection`}
            className={styles.inspectionPopover}
            role="region"
            aria-label="Work Record inspection"
            data-inspection-panel
            hidden
          >
            <h4 />
            <InspectionDiagram rate={pesos(rate.magnitude.toString())} />
            <p data-inspection-copy />
            <button className={styles.textButton} data-inspection-replay>
              <span aria-hidden="true">↺</span> Replay detail
            </button>
            <button className={styles.textButton} data-inspection-close>
              Close detail
            </button>
          </div>
        </div>
      )}
      <p className={styles.evidenceNote}>Each tile represents one hour.</p>
    </section>
  );
}
