import { useEffect, useId, useRef } from "react";
import { createSalaryExploration } from "../c04-reference/employee-exploration";
import { useInspectionSound } from "../../audio/public";
import type { C04Presentation } from "./public";
import { offerMoney } from "./ApplyOffer";
import styles from "./apply.module.css";

/** The accepted exploration controller owns popup placement, pinning, replay and dismissal. */
export function ApplyComparison({ frame, apply, blocked }: C04Presentation) {
  const root = useRef<HTMLDivElement>(null),
    live = useRef(blocked),
    id = useId();
  live.current = blocked;
  const inspectionSound = useInspectionSound();
  const voice = useRef(inspectionSound);
  voice.current = inspectionSound;
  const difference = frame.exposedDerivedFacts.find(
    (f) => f.id === "c04/S03/checked/difference",
  );
  const percentage = frame.exposedDerivedFacts.find(
    (f) => f.id === "c04/S03/checked/percentage",
  );
  const authorized = Boolean(
    percentage &&
    difference &&
    apply?.comparisonScale != null &&
    apply.original != null &&
    apply.next != null &&
    frame.exposedModelFacts.some(
      (f) => f.id === "c04/S03/selected-track/original",
    ) &&
    frame.exposedModelFacts.some(
      (f) => f.id === "c04/S03/selected-track/newValue",
    ),
  );
  const exploration = useRef<ReturnType<typeof createSalaryExploration> | null>(
    null,
  );
  useEffect(() => {
    if (!authorized || !root.current) return;
    const original = offerMoney(apply!.original!),
      next = offerMoney(apply!.next!),
      change = offerMoney(apply!.difference!).replace("-", "−"),
      percent = `${apply!.percentage!.replace("-", "−")}%`;
    const controller = createSalaryExploration(root.current, {
      pause: () => {},
      blocked: () => live.current,
      reduced: () =>
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true,
      announce: (text) => {
        const node = root.current?.querySelector("[data-announce]");
        if (node) node.textContent = text;
      },
      copyDistance: 0,
      sound: (event, detail) => voice.current(event, detail),
      lessons: {
        original: {
          title: "The original is your reference whole.",
          copy: "Keep the advertised offer intact as the reference. The change is measured against this original, not against the revised offer.",
          equation: `${original} = 100%`,
          labels: [
            "The original remains the reference",
            "Ten equal parts · one whole",
          ],
        },
        addition: {
          title: "One tenth of the offer was removed.",
          copy: "The outlined portion is the amount removed from the original offer. Its size is one tenth of that original. The negative sign records a decrease.",
          equation: `${change} ÷ ${original} × 100 = ${percent}`,
          labels: [
            "Compare the removed part with the whole",
            "One tenth removed · 10% decrease",
          ],
        },
        total: {
          title: "The revised offer is what remains.",
          copy: "Nine of the original ten parts remain. The revised amount is 90% of the original; that is not a 90% decrease.",
          equation: `${original} − ${offerMoney(String(Math.abs(Number(apply!.difference))))} = ${next}`,
          labels: [
            "Same original · nine parts remain",
            "90% remains · 10% removed",
          ],
        },
      },
    });
    exploration.current = controller;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const refresh = () => controller.refresh();
    media?.addEventListener("change", refresh);
    return () => {
      controller.dispose();
      exploration.current = null;
      media?.removeEventListener("change", refresh);
    };
  }, [authorized, apply, apply?.next, apply?.difference, apply?.percentage]);
  useEffect(() => exploration.current?.refresh(), [blocked]);
  if (!difference && !percentage) return null;
  const w = 540 * Number(apply?.comparisonScale ?? 0);
  const trigger = (part: "original" | "addition" | "total", label: string) => ({
    "data-explore": part,
    role: "button",
    tabIndex: blocked ? -1 : 0,
    "aria-label": label,
    "aria-disabled": blocked,
    "aria-controls": id,
    "aria-expanded": false,
  });
  return (
    <section
      className={styles.relationship}
      aria-label="The offer on one scale"
    >
      <div className="model-heading">
        <div>
          <span className="eyebrow">THE REFERENCE STAYS THE SAME</span>
          <h3>
            Less money.
            <br />
            <em>The same starting whole.</em>
          </h3>
        </div>
      </div>
      {authorized && (
        <div ref={root} className={`employee-story ${styles.exploration}`}>
          <figure className={`salary-model story-salary ${styles.salaryModel}`}>
            <div className="model-heading">
              <span className={styles.offerIdentity} aria-hidden="true">
                ₱
              </span>
              <div>
                <h3>The revised offer</h3>
                <p>One position · monthly salary</p>
              </div>
            </div>
            <svg
              className={styles.salarySvg}
              viewBox="0 0 640 330"
              aria-label="Original offer, revised offer and removed portion on the same peso scale"
            >
              <g {...trigger("original", "Inspect original offer")}>
                <text x="40" y="28" className={styles.modelRole}>
                  Original offer
                </text>
                <text
                  x="580"
                  y="28"
                  textAnchor="end"
                  className={styles.modelAmount}
                >
                  {offerMoney(apply!.original!)}
                </text>
                <rect
                  x="40"
                  y="48"
                  width="540"
                  height="62"
                  rx="4"
                  className="original-block"
                />
                {Array.from({ length: 9 }, (_, i) => (
                  <path
                    key={i}
                    d={`M${94 + i * 54} 48v62`}
                    className="tile-divider"
                  />
                ))}
                <path d="M40 119v9h540v-9" className="total-bracket" />
                <text
                  x="310"
                  y="150"
                  textAnchor="middle"
                  className={styles.modelNote}
                >
                  The reference whole · 100%
                </text>
              </g>
              <g {...trigger("total", "Inspect revised offer")}>
                <text x="40" y="191" className={styles.modelRole}>
                  Revised offer
                </text>
                <text
                  x="580"
                  y="191"
                  textAnchor="end"
                  className={styles.modelAmount}
                >
                  {offerMoney(apply!.next!)}
                </text>
                <rect
                  x="40"
                  y="211"
                  width={w}
                  height="62"
                  rx="4"
                  className="original-block"
                />
                {Array.from({ length: 8 }, (_, i) => (
                  <path
                    key={i}
                    d={`M${94 + i * 54} 211v62`}
                    className="tile-divider"
                  />
                ))}
              </g>
              <g {...trigger("addition", "Inspect the removed portion")}>
                <rect
                  x={40 + w}
                  y="211"
                  width={540 - w}
                  height="62"
                  rx="4"
                  className={styles.removedPortion}
                />
                <path d={`M${40 + w} 282v9H580v-9`} className="total-bracket" />
              </g>
              <text
                x="580"
                y="316"
                textAnchor="end"
                className={styles.modelNote}
              >
                Removed ·{" "}
                {offerMoney(String(Math.abs(Number(apply!.difference))))}
              </text>
            </svg>
            <p className="story-explore-hint">
              Hover, focus or tap a part of the model for a closer look.
            </p>
          </figure>
          <div className="story-exploration-slot">
            <aside
              className="story-callout"
              id={id}
              aria-label="Offer inspection"
              hidden
            >
              <header>
                <span className="story-kicker">A CLOSER LOOK</span>
                <button
                  type="button"
                  data-explore-close
                  aria-label="Close offer inspection"
                >
                  ×
                </button>
              </header>
              <h3 />
              <svg
                className="explore-diagram"
                viewBox="0 0 300 118"
                role="img"
                aria-label=""
              >
                <text x="8" y="17" data-mini-label />
                <rect
                  className="mini-original"
                  x="8"
                  y="32"
                  width="240"
                  height="32"
                  rx="3"
                />
                {Array.from({ length: 9 }, (_, i) => (
                  <path
                    key={i}
                    d={`M${32 + i * 24} 32v32`}
                    className="tile-divider"
                  />
                ))}
                <g className="mini-add">
                  <rect
                    x="224"
                    y="32"
                    width="24"
                    height="32"
                    className={styles.removedPortion}
                  />
                </g>
                <rect
                  className="mini-copy"
                  x="224"
                  y="32"
                  width="24"
                  height="32"
                />
                <path className="mini-reference" d="M8 72v7h240v-7" />
                <text x="8" y="103" data-mini-result />
              </svg>
              <p className="mini-equation" />
              <p className="mini-copy-text" />
              <footer>
                <span>Keep the original in view</span>
                <button
                  type="button"
                  data-explore-replay
                  aria-label="Replay supplemental diagram"
                >
                  ↻
                </button>
              </footer>
            </aside>
          </div>
          <span className={styles.srOnly} role="status" data-announce />
        </div>
      )}
      <div className={styles.relationshipEquation}>
        <span data-fact-id={difference?.id}>
          {apply?.difference != null
            ? offerMoney(apply.difference).replace("-", "−")
            : difference?.text}
        </span>
        <span aria-hidden="true">÷</span>
        <span>
          {apply?.original != null ? offerMoney(apply.original) : "Original"}
        </span>
        <span aria-hidden="true">× 100 =</span>
        <strong data-fact-id={percentage?.id}>
          {percentage
            ? `${apply?.percentage ?? percentage.text}%`.replace("-", "−")
            : ""}
        </strong>
      </div>
    </section>
  );
}
