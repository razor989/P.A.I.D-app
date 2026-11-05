import type { C06PreparePresentation } from "./public";
import { TransferEvidence } from "./TransferEvidence";
import { TransferRecord } from "./TransferRecord";
import base from "./commission.module.css";
import t from "./transfer.module.css";

/** Explains the evaluator's diagnostic; never infers a learner's calculation. */
export function TransferGuidance(
  props: C06PreparePresentation & { onRevise: (panel: number) => void },
) {
  const diagnostic = props.projection.transferDiagnostic;
  const [focus, target, title, steps] =
    diagnostic === "ARRANGEMENT"
      ? ([
          "salary",
          0,
          "Start with the promise, not the payment.",
          [
            "Find both promises in the agreement: a monthly salary and a commission on sales.",
            "Compare that structure with your selected arrangement. Straight commission has no salary branch.",
            "Revisit your arrangement, then check whether the amounts follow the same structure.",
          ],
        ] as const)
      : diagnostic === "TOTAL_COMPENSATION"
        ? ([
            "total",
            2,
            "Keep the pay components together—and the sales apart.",
            [
              "Start with commission as a payment earned from sales, not the sales proceeds themselves.",
              "Trace the separate salary branch. It joins commission once to make total compensation.",
              "Recalculate only those two components. The separate allowance does not belong in this record.",
            ],
          ] as const)
        : diagnostic === "UNITS"
          ? ([
              "commission",
              1,
              "Give each amount its proper meaning.",
              [
                "Both numeric responses name monetary amounts in pesos for June.",
                "A rate is a percentage; sales is a reference amount. Neither is the commission payment itself.",
                "Review both monetary entries. This diagnostic does not identify one field as the only issue.",
              ],
            ] as const)
          : ([
              "rate",
              1,
              "Reconnect the percentage to the sales record.",
              [
                "Locate June sales and the agreed commission rate at the top of the model.",
                "Three percent acts on sales—not salary. Trace that multiplication to the commission node.",
                "Calculate the product again, then revisit total if your commission changes. The amount alone cannot tell us how you calculated it.",
              ],
            ] as const);
  return (
    <section className={t.guidance} aria-label="Revisit the June evidence">
      <header className={t.sectionHeading}>
        <p className={base.eyebrow}>LOOK CLOSER · FOLLOW THE EVIDENCE</p>
        <h3>{title}</h3>
      </header>
      <div className={t.workspace}>
        <TransferEvidence
          projection={props.projection}
          focus={focus}
          blocked={props.blocked}
        />
        <div>
          <TransferRecord projection={props.projection} />
          <ol className={t.guidanceTrail}>
            {steps.map((step, index) => (
              <li key={step}>
                <span>0{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <button
            className={base.primary}
            disabled={
              props.blocked ||
              !props.projection.frame.allowedLearnerIntents.includes("REVISE")
            }
            onClick={() => props.onRevise(target)}
          >
            Revise my June calculation
          </button>
          <p className={t.note}>
            Your entries stay yours. Revise and check all three responses again
            before continuing.
          </p>
        </div>
      </div>
    </section>
  );
}
