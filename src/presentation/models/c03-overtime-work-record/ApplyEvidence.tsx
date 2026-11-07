import type { C03WorkRecordProjection } from "./public";
import { ApplyInspection, ApplyInspectable } from "./ApplyInspection";
import { ExploreGlyph, ExploreHourMark } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import styles from "./apply.module.css";

/** Exposed facts and learner answers only; no local evaluation or pay calculation. */
export function ApplyEvidence({
  projection,
  blocked = false,
  focus = "condition",
}: {
  projection: C03WorkRecordProjection;
  blocked?: boolean;
  focus?: string;
}) {
  const { rate, hours, conditions } = projection.workEvidence;
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const answer = (key: string) => {
    const response = parts.find((part) => part.key === key)?.response;
    return response?.kind === "EXACT_QUANTITY"
      ? response.value.magnitude.toString()
      : null;
  };
  const math = projection.mathematicalExplanation;
  const multiplier =
    math?.multiplier.magnitude.toString() ?? answer("multiplier");
  const resolution = math?.overtimePay.resolution;
  const submittedPay = answer("overtimePay");
  const pay =
    resolution?.kind === "KNOWN"
      ? pesos(resolution.value.magnitude.toString())
      : submittedPay
        ? pesos(submittedPay)
        : "?";
  return (
    <ApplyInspection projection={projection} blocked={blocked}>
      <section
        className={styles.record}
        aria-label="James’s monthly work record"
        data-focus={focus}
      >
        <header className={styles.recordHeader}>
          <div>
            <span className={styles.kicker}>James · This month</span>
            <h3>
              Ten extra hours.
              <br />
              <em>What are they worth?</em>
            </h3>
          </div>
          <ExploreGlyph name="day" />
        </header>
        <div className={styles.conditionPath}>
          <ApplyInspectable part="condition" className={styles.conditionFact}>
            <ExploreGlyph name="day" />
            <span>
              Kind of day<strong>{conditions?.[0]}</strong>
            </span>
          </ApplyInspectable>
          <span className={styles.connector} aria-hidden="true">
            ↓
          </span>
          <ApplyInspectable part="multiplier" className={styles.multiplierFact}>
            <span>{math ? "Applicable multiplier" : "Your multiplier"}</span>
            <strong>× {multiplier ?? "?"}</strong>
          </ApplyInspectable>
        </div>
        <div className={styles.factorRow}>
          <ApplyInspectable part="rate" className={styles.rateFact}>
            <span>Regular hourly rate</span>
            <strong>{pesos(rate.magnitude.toString())}</strong>
            <small>per hour</small>
          </ApplyInspectable>
          <span className={styles.multiply} aria-hidden="true">
            ×
          </span>
          <div className={styles.factorLink}>
            <span>{math ? "Applicable multiplier" : "Your multiplier"}</span>
            <strong>{multiplier ?? "?"}</strong>
          </div>
        </div>
        <ApplyInspectable part="hours" className={styles.hoursFact}>
          <span className={styles.multiply} aria-hidden="true">
            ×
          </span>
          <span className={styles.hoursHeading}>
            <strong>{hours.magnitude.toString()} overtime hours</strong>
            <span>during the month</span>
          </span>
          <svg
            viewBox="0 0 350 150"
            role="img"
            aria-label="Ten hour marks represent 10 overtime hours accumulated during the month, not ten workdays."
          >
            {Array.from({ length: 10 }, (_, i) => (
              <g
                key={i}
                transform={`translate(${38 + (i % 5) * 68} ${33 + Math.floor(i / 5) * 64})`}
              >
                <ExploreHourMark n={i + 1} />
              </g>
            ))}
            <path
              d="M12 126v9h326v-9M175 135v10"
              fill="none"
              stroke="#9a7c45"
            />
          </svg>
          <span className={styles.hourCaption}>
            All ten belong in the calculation.
          </span>
        </ApplyInspectable>
        <div className={styles.payPath}>
          <span aria-hidden="true">↓</span>
          <ApplyInspectable part="pay" className={styles.payFact}>
            <span>
              {math
                ? "Confirmed overtime pay"
                : projection.frame.stateId === "REVISION" && submittedPay
                  ? "Your last overtime pay · recheck it"
                  : "Your overtime pay"}
            </span>
            <strong>{pay}</strong>
            <small>For the extra hours only</small>
          </ApplyInspectable>
        </div>
        <p className={styles.modelHint}>
          Hover, focus or tap a part to take a closer look.
        </p>
      </section>
    </ApplyInspection>
  );
}
