import { useRef } from "react";
import type { C03PreparePresentation } from "./public";
import { TransferModel } from "./TransferModel";
import { ExploreGlyph } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import { useWorkRecordMotion } from "./use-work-record-motion";
import base from "./work-record.module.css";
import styles from "./transfer.module.css";

/** Explains the source diagnostic, never evaluates a second answer locally. */
export function TransferGuidance({
  projection,
  blocked,
  onRevise,
}: C03PreparePresentation & { onRevise: (step: number) => void }) {
  const surface = useRef<HTMLElement>(null);
  const [kind, title, prompt, target] =
    projection.diagnostic === "WORK_CONDITION"
      ? ([
          "condition",
          "Let the day choose the rule.",
          "Compare your identification with the day stated in the record.",
          0,
        ] as const)
      : projection.diagnostic === "CONDITION_MULTIPLIER"
        ? ([
            "multiplier",
            "Reconnect the day and its multiplier.",
            "Your proposed multiplier does not match the day in the record. Follow the day’s rule in the relationship reference.",
            1,
          ] as const)
        : projection.diagnostic === "UNITS"
          ? ([
              "units",
              "Keep the answers in their own units.",
              "A multiplier is a decimal with no unit. Overtime pay is an amount in pesos—not pesos per hour. Review both entries; this diagnostic does not identify a single field.",
              1,
            ] as const)
          : ([
              "calculation",
              "Follow the factors through the record.",
              "Your payment needs another look. The amount alone does not tell us which calculation step went wrong. Trace each factor, then multiply again.",
              2,
            ] as const);
  useWorkRecordMotion(surface, kind, blocked);
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const read = (key: string) => {
    const r = parts.find((p) => p.key === key)?.response;
    return r?.kind === "SINGLE_SELECTION"
      ? r.selectionId
      : r?.kind === "EXACT_QUANTITY"
        ? r.value.magnitude.toString()
        : "Not entered";
  };
  return (
    <section
      ref={surface}
      className={styles.reconsideration}
      aria-label="Revisit the evidence"
      data-diagnostic={kind}
    >
      <header data-motion="scene">
        <p className={base.eyebrow}>
          Look closer · Your response and the evidence
        </p>
        <h3>{title}</h3>
        <p>{prompt}</p>
      </header>
      <div className={styles.guidedWorkspace}>
        <TransferModel projection={projection} blocked={blocked} focus={kind} />
        <div className={styles.guidanceReading}>
          <div className={styles.submittedEvidence}>
            <span>
              Your submitted{" "}
              {kind === "condition"
                ? "condition"
                : kind === "multiplier"
                  ? "multiplier"
                  : kind === "units"
                    ? "entries"
                    : "overtime pay"}
            </span>
            <strong>
              {kind === "condition"
                ? read("condition")
                : kind === "multiplier"
                  ? `× ${read("multiplier")}`
                  : kind === "units"
                    ? `× ${read("multiplier")} · ₱${read("overtimePay")}`
                    : pesos(read("overtimePay"))}
            </strong>
            <small>This is your response—not a corrected answer.</small>
          </div>
          <ol className={styles.guidanceTrail}>
            <li data-motion="scene">
              <span>01</span>
              <div>
                <h4>
                  {kind === "condition"
                    ? "Read the day in the record."
                    : kind === "multiplier"
                      ? "Start from the condition."
                      : kind === "units"
                        ? "Separate the two quantities."
                        : "Start with the hourly rate."}
                </h4>
                <p>
                  {kind === "condition"
                    ? "The work record states regular holiday. No date or calendar inference is needed. Compare that evidence with your identification."
                    : kind === "multiplier"
                      ? `Your identification is “${read("condition")}”. The record states a regular holiday. The multiplier must follow from that condition, not from the number of hours.`
                      : kind === "units"
                        ? "The multiplier changes the pay for an hour; it is not itself a peso payment. The final response names the payment for all three extra hours."
                        : `${pesos(projection.workEvidence.rate.magnitude.toString())} is already the regular hourly rate. Keep it as the starting factor—no wage conversion is required.`}
                </p>
              </div>
            </li>
            <li data-motion="scene">
              <span>02</span>
              <div>
                <h4>
                  {kind === "condition" || kind === "multiplier"
                    ? "Trace the rule link."
                    : "Follow only the extra hours."}
                </h4>
                <p>
                  {kind === "condition" || kind === "multiplier"
                    ? "Inspect the condition and multiplier parts of the model. Open the relationship reference to check the rule, then return to your own entries."
                    : "The eight pale marks are completed first-eight hours, outside this calculation. The three gold marks are the overtime hours. This boundary is a check—not a claim about how you obtained your answer."}
                </p>
              </div>
            </li>
            <li data-motion="scene">
              <span>03</span>
              <div>
                <h4>
                  {kind === "condition" || kind === "multiplier"
                    ? "Reconnect your answers."
                    : "Read the whole calculation."}
                </h4>
                <p>
                  {kind === "condition" || kind === "multiplier"
                    ? "Revise the indicated response, then revisit the payment if that change affects your calculation. The three answers will be checked together again."
                    : "Regular hourly rate × applicable multiplier × 3 overtime hours. Recalculate the product and enter overtime pay only. Do not add first-eight-hours earnings."}
                </p>
              </div>
            </li>
          </ol>
          <div className={styles.guidanceActions}>
            <button
              className={base.primary}
              disabled={
                blocked ||
                !projection.frame.allowedLearnerIntents.includes("REVISE")
              }
              onClick={() => onRevise(target)}
            >
              {kind === "condition"
                ? "Revisit my condition"
                : kind === "multiplier"
                  ? "Revisit my multiplier"
                  : kind === "units"
                    ? "Review my entries"
                    : "Revisit my calculation"}
              <ExploreGlyph name="next" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
