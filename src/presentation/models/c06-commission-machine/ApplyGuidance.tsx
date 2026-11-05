import { useState } from "react";
import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import styles from "./commission.module.css";
import a from "./apply.module.css";

/** Diagnostic comes from the source evaluator; these panels never grade a draft. */
export function ApplyGuidance({
  projection,
  help = false,
}: {
  projection: C06CommissionProjection;
  help?: boolean;
}) {
  const diagnostic = projection.applyDiagnostic;
  const start =
    diagnostic === "ARRANGEMENT"
      ? 0
      : diagnostic === "SALES_BASE"
        ? 1
        : diagnostic === "RATE" || diagnostic === "UNITS"
          ? 2
          : 3;
  const [step, setStep] = useState(help ? 0 : start);
  const labels = [
    "The promise",
    "The reference",
    "The percentage",
    "The payment",
  ];
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const amount = parts.find((part) => part.key === "commission")?.response;
  return (
    <section
      className={a.guidance}
      aria-label={
        help
          ? "Walk through straight commission"
          : "Trace and revise your claim"
      }
    >
      <nav className={a.guideTabs} aria-label="Relationship walkthrough">
        {labels.map((label, index) => (
          <button
            key={label}
            className={styles.secondary}
            aria-pressed={step === index}
            onClick={() => setStep(index)}
          >
            {String(index + 1).padStart(2, "0")} · {label}
          </button>
        ))}
      </nav>
      <div key={step} className={a.guideCanvas}>
        {step === 0 && (
          <>
            <div
              className={a.promiseDiagram}
              aria-label="Sales linked by a percentage to commission"
            >
              <span>Sale record</span>
              <b>× agreed rate</b>
              <strong>Commission only</strong>
            </div>
            <h3>Let the agreement choose the structure.</h3>
            <p>
              The agreement promises 5% of sales. Follow that link to
              commission. There is no separate fixed-salary promise to
              attach—not a salary box containing zero.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <div className={a.referenceDiagram}>
              <span>Property sale record</span>
              <strong>
                {projection.model.sales.kind === "KNOWN"
                  ? displayQuantity(projection.model.sales.value)
                  : "Information needed"}
              </strong>
              <span>↓ the full reference enters the calculation</span>
            </div>
            <h3>Use what was sold—not what was earned.</h3>
            <p>
              The property’s selling price is the sales base. Keep the whole
              sale in view when applying the rate. Commission is the output you
              are finding, not a replacement sales base.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div
              className={a.hundred}
              role="img"
              aria-label="Five shaded parts out of one hundred represent five percent"
            >
              {Array.from({ length: 100 }, (_, index) => (
                <span key={index} data-shaded={index < 5} />
              ))}
            </div>
            <div className={a.percentEquation}>
              <strong>5%</strong>
              <span>=</span>
              <strong>5 / 100</strong>
              <span>=</span>
              <strong>0.05</strong>
            </div>
            <h3>Same rate. Two useful forms.</h3>
            <p>
              Record 5 in the percentage field. For multiplication, use 0.05:
              five hundredths of the full sale. Entering 0.05 in a percentage
              field means 0.05%, a different rate.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <div className={a.paymentDiagram}>
              <div>
                <span>Value sold</span>
                <strong>Property price</strong>
              </div>
              <span aria-hidden="true">≠</span>
              <div>
                <span>Payment earned</span>
                <strong>Commission</strong>
              </div>
            </div>
            <h3>Name the payment before you claim it.</h3>
            <p>
              Apply the agreed percentage to the sales base. The resulting pesos
              are commission for this sale. Do not add the property price or
              invent a salary payment.
            </p>
            {amount?.kind === "EXACT_QUANTITY" && (
              <p className={a.learnerClaim}>
                Your recorded claim:{" "}
                <strong>{displayQuantity(amount.value)}</strong>. Return to the
                calculation and check how you obtained it.
              </p>
            )}
          </>
        )}
      </div>
      <footer className={a.panelNav}>
        <p>
          {help
            ? "Inspect any link. Your work stays in place."
            : "Follow the highlighted link, then revise your own claim."}
        </p>
        {step < 3 && (
          <button className={styles.primary} onClick={() => setStep(step + 1)}>
            Follow the next link →
          </button>
        )}
      </footer>
    </section>
  );
}
