import { useState } from "react";
import type { C06CommissionProjection } from "./public";
import { ExploreRelationship } from "./ExploreModel";
import styles from "./commission.module.css";
import e from "./explore.module.css";

/** Guided attention only. Source evaluation remains the sole assessment authority. */
export function ExploreGuidance({
  projection,
}: {
  projection: C06CommissionProjection;
}) {
  const [step, setStep] = useState(0);
  const [part, setPart] = useState<string | null>(null);
  const diagnostic = projection.exploreDiagnostic;
  const fixed = diagnostic === "INVARIANTS";
  const total =
    diagnostic === "TOTAL_COMPENSATION" || diagnostic === "CAUSAL_CHANGE";
  const title = fixed
    ? "Find the promise that stayed fixed"
    : total
      ? "Separate the two parts of pay"
      : "Follow the rate before adding salary";
  return (
    <section className={e.guidance} aria-label="Guided reconsideration">
      <p className={styles.eyebrow}>
        Investigate before revising · {step + 1} of 3
      </p>
      <h3>{title}</h3>
      {step === 0 && (
        <>
          <p>
            {fixed
              ? "Put the two monthly sales records beside the single agreement. Select a quantity to inspect its job—not an answer to submit."
              : total
                ? "A sales record and a pay record measure different things. Inspect the parts below: which are payments to the representative?"
                : "The agreement says 3% of sales. Inspect the candidate quantities and locate the reference for that rate."}
          </p>
          <div className={styles.actions}>
            {["sales", "base", "commission"].map((id) => (
              <button
                key={id}
                className={styles.secondary}
                aria-pressed={part === id}
                onClick={() => setPart(id)}
              >
                {id === "base"
                  ? "Fixed salary"
                  : id === "sales"
                    ? "Sales record"
                    : "Commission"}
              </button>
            ))}
          </div>
          {part && (
            <div className={e.reference} role="status">
              <ExploreRelationship kind={part} />
              <p>
                {part === "sales"
                  ? "Sales measures goods sold. It supplies the reference for 3%; it is not another payment to add to salary."
                  : part === "base"
                    ? "Salary is the agreement’s separate monthly promise. It remains ₱15,000 in both situations and is added after commission is found."
                    : "Commission is pay linked to sales at the agreed rate. It can change even though the salary and rate stay fixed."}
              </p>
            </div>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <ExploreRelationship
            kind={fixed ? "base" : total ? "total" : "rate"}
          />
          <h4>
            {fixed
              ? "Read the matching salary bars"
              : total
                ? "Join pay to pay"
                : "Measure a share of the sales reference"}
          </h4>
          <p>
            {fixed
              ? "Both salary bars have the same length. A larger sales record does not rewrite the agreement. Rate is also a fixed promise: 3% in both situations."
              : total
                ? "Green is salary; gold is commission. Together they make total compensation. Reporting only the gold part omits salary; adding sales includes money that is not the representative’s pay."
                : "Three highlighted cells out of one hundred mean three hundredths. Apply 0.03 to sales alone. Multiplying salary by this rate would change a separate promise into a sales-linked one."}
          </p>
        </>
      )}
      {step === 2 && (
        <>
          <h4>Connect the evidence to your response</h4>
          <p>
            {fixed
              ? "Revisit your fixed-quantity explanation and the rate/salary entries. Do they describe the same agreement in both situations?"
              : total
                ? "Revisit why total pay changed. Then check that each total includes its commission and the unchanged salary—not the sales amount."
                : "Revisit your operation-order explanation. For each situation, calculate commission from sales and rate first; then use that commission in the total."}
          </p>
          <p>
            Your existing responses are unchanged. Return to them and make the
            revision yourself.
          </p>
        </>
      )}
      <div className={styles.actions}>
        {step > 0 && (
          <button
            className={styles.secondary}
            onClick={() => setStep(step - 1)}
          >
            ← Previous guidance
          </button>
        )}
        {step < 2 && (
          <button
            className={styles.primary}
            disabled={step === 0 && !part}
            onClick={() => setStep(step + 1)}
          >
            Follow the relationship →
          </button>
        )}
      </div>
    </section>
  );
}

export function ExploreHelp({
  projection,
}: {
  projection: C06CommissionProjection;
}) {
  const [topic, setTopic] = useState(() =>
    ["EXP-01", "EXP-05"].includes(projection.frame.stateId)
      ? "base"
      : ["EXP-03", "EXP-06"].includes(projection.frame.stateId)
        ? "total"
        : "rate",
  );
  const [beat, setBeat] = useState(0);
  const topics = [
    { id: "rate", label: "What does 3% mean?" },
    { id: "base", label: "What stays fixed?" },
    { id: "total", label: "How is total pay assembled?" },
  ];
  return (
    <div className={e.helpContent}>
      <p className={styles.eyebrow}>
        Look closer · the agreement and its consequences
      </p>
      <h2>Follow one relationship at a time.</h2>
      <p>
        Choose the relationship you want to examine. Help does not change or
        submit your answers.
      </p>
      <div
        className={e.helpTopics}
        role="group"
        aria-label="Choose a help topic"
      >
        {topics.map((item) => (
          <button
            key={item.id}
            className={styles.secondary}
            aria-pressed={topic === item.id}
            onClick={() => {
              setTopic(item.id);
              setBeat(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ExploreRelationship key={`${topic}/${beat}`} kind={topic} />
      <h3>
        {beat === 0
          ? "1 · Locate the quantities"
          : "2 · Explain their relationship"}
      </h3>
      <p>
        {topic === "rate"
          ? beat === 0
            ? "Start with sales: the value of goods sold. Imagine the entire sales reference divided into one hundred equal shares. The salary is outside that reference."
            : "Three of those shares describe 3%. Sales × 0.03 gives their value as commission. The sales record remains intact; we have measured a relationship, not removed money."
          : topic === "base"
            ? beat === 0
              ? "Find the monthly salary in the agreement: ₱15,000. Compare the two matching green salary bars. Neither depends on which sales record is active."
              : "The commission rate is another fixed promise: 3%. A different commission amount comes from applying that same rate to different sales—not from changing the agreement."
            : beat === 0
              ? "Find salary and commission as separate parts of the pay picture. Both are pay; the sales record is not."
              : "Resolve the commission from sales × rate first. Then join it to salary. Keeping these jobs separate prevents treating commission as the whole pay or applying the rate to salary."}
      </p>
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          onClick={() => setBeat(beat === 0 ? 1 : 0)}
        >
          {beat === 0
            ? "Follow this relationship →"
            : "↺ Revisit the first step"}
        </button>
      </div>
      {projection.frame.review?.relationships.map((item) => (
        <p className={e.helpSource} key={item.id}>
          {item.text}
        </p>
      ))}
    </div>
  );
}
