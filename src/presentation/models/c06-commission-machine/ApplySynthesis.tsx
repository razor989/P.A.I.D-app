import { useState } from "react";
import type { C06PreparePresentation } from "./public";
import { ApplyMachine, PropertySaleIllustration } from "./ApplyEvidence";
import { displayQuantity } from "./CommissionMachine";
import styles from "./commission.module.css";
import a from "./apply.module.css";

/** Confirmation is the Actor state; these learner-paced reading beats issue no new receipts. */
export function ApplySynthesis(props: C06PreparePresentation) {
  const [step, setStep] = useState(0);
  const result = props.projection.model.commission?.resolution;
  const beats = [
    [
      "The agreement sets the relationship.",
      "The agent is paid a percentage of sales. This is a straight-commission promise, not a fixed salary with an extra payment.",
    ],
    [
      "The full sale gives the percentage its reference.",
      "The property sold for ₱2,000,000. The agreed 5% means five hundredths of that full sale—not five hundredths of a salary or of commission itself.",
    ],
    [
      "The result belongs to the agent’s commission claim.",
      "The commission is the payment earned for the sale. The property’s price remains the sales record; it is not another payment to add.",
    ],
  ];
  return (
    <section
      className={a.synthesis}
      aria-label="Bring the commission story together"
    >
      <header className={a.synthesisHero}>
        <div>
          <p className={styles.eyebrow}>Your reasoning holds together</p>
          <h3>
            One sale.
            <br />
            <em>A clear commission claim.</em>
          </h3>
          <p>The agent earned</p>
          <strong className={a.heroAmount}>
            {result?.kind === "KNOWN"
              ? displayQuantity(result.value)
              : "Information needed"}
          </strong>
          <p>in commission—not the property-sale proceeds.</p>
        </div>
        <PropertySaleIllustration />
      </header>
      <ApplyMachine projection={props.projection} />
      <nav className={a.steps} aria-label="Commission story links">
        {["Agreement", "Reference", "Payment"].map((label, index) => (
          <button
            key={label}
            disabled={props.blocked}
            aria-current={step === index ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span>0{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div key={step} className={a.closureBeat} role="status">
        <h3>{beats[step]![0]}</h3>
        <p>{beats[step]![1]}</p>
      </div>
      <footer className={a.panelNav}>
        <button
          className={styles.secondary}
          disabled={props.blocked}
          onClick={() => props.onAction("REVISE")}
        >
          Revisit my claim
        </button>
        {step < 2 ? (
          <button
            className={styles.primary}
            disabled={props.blocked}
            onClick={() => setStep(step + 1)}
          >
            Follow the story →
          </button>
        ) : (
          <button
            className={styles.primary}
            disabled={
              props.blocked ||
              !props.projection.frame.allowedLearnerIntents.includes(
                "FINISH_ACTIVITY",
              )
            }
            onClick={() => props.onAction("FINISH_ACTIVITY")}
          >
            See my recap →
          </button>
        )}
      </footer>
    </section>
  );
}
