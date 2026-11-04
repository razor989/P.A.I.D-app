import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import { ExploreGlyph } from "./ExploreGlyph";
import styles from "./apply.module.css";

/** Additional scaffolding follows real source diagnostics; it never grades a draft. */
export function ApplyGuidance({
  projection,
}: {
  projection: C03WorkRecordProjection;
}) {
  const diagnostic = projection.diagnostic;
  const condition =
    diagnostic === "CONDITION_MULTIPLIER" || diagnostic === "WORK_CONDITION";
  const units = diagnostic === "UNITS";
  const rate = pesos(projection.workEvidence.rate.magnitude.toString());
  return (
    <section
      className={styles.guidance}
      aria-label="A closer look at your calculation"
    >
      <div className={styles.guideGraphic} aria-hidden="true">
        <ExploreGlyph name={condition ? "day" : "replay"} />
        <span>
          {condition
            ? "Ordinary working day"
            : units
              ? "Multiplier · pesos"
              : `${rate} × ? × ${projection.workEvidence.hours.magnitude.toString()}`}
        </span>
      </div>
      <div>
        <h4>
          {condition
            ? "Go back to the kind of day."
            : units
              ? "Keep the two answers in their own units."
              : "Follow all three factors."}
        </h4>
        <ol>
          {condition ? (
            <>
              <li>Find “ordinary working days” on James’s record.</li>
              <li>
                Compare it with the ordinary-day example you explored—not the
                rest-day example.
              </li>
              <li>
                Change the multiplier if needed, then recalculate the overtime
                pay.
              </li>
            </>
          ) : units ? (
            <>
              <li>
                Enter the multiplier as a decimal, without a percent sign.
              </li>
              <li>
                Enter the overtime-pay amount in pesos, not pesos per hour.
              </li>
            </>
          ) : (
            <>
              <li>Start with {rate} per hour; it is already an hourly rate.</li>
              <li>Apply your ordinary-day multiplier.</li>
              <li>
                Multiply by all ten overtime hours. Stop there—do not add
                regular earnings.
              </li>
            </>
          )}
        </ol>
        <p>
          The work record beside your answers highlights where to look. Your
          entries are still there when you revise.
        </p>
      </div>
    </section>
  );
}
