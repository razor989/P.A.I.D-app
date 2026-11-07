import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import { CommissionInspection } from "./CommissionInspection";
import { SalesIllustration } from "./CommissionIllustrations";
import styles from "./commission.module.css";

/** Givens only; derived earnings are reserved for source-issued teaching. */
export function CommissionEvidence({
  projection,
  moment = 3,
  blocked = false,
  onInspection,
}: {
  projection: C06CommissionProjection;
  moment?: number;
  blocked?: boolean;
  onInspection?: (open: boolean) => void;
}) {
  const { model } = projection;
  const sales =
    model.sales.kind === "KNOWN"
      ? displayQuantity(model.sales.value)
      : "Information needed";
  const rate =
    model.commissionRate.kind === "KNOWN"
      ? displayQuantity(model.commissionRate.value)
      : "Information needed";
  return (
    <CommissionInspection
      blocked={blocked}
      onInspection={onInspection}
      facts={[
        {
          id: "sales",
          title: "They sold goods. What did they earn?",
          copy: `${sales} is the value of goods each worker sold. It doesn’t mean either worker takes that amount home. To find out about pay, we need the promise in the pay agreement.`,
        },
        {
          id: "rate",
          title: "A small share, linked to sales",
          copy: `${rate} describes the commission rate. Think of 100 equal parts: five are highlighted to show what 5% means. The sales record stays intact; this picture describes a pay relationship, not money being taken out of Sales.`,
        },
        {
          id: "terms",
          title: "What does each agreement promise?",
          copy: "Both workers are promised commission on sales. Worker B is also promised a fixed monthly salary. That extra promise sits beside commission; it is not another sales record and is not multiplied by the commission rate.",
        },
      ]}
    >
      {(target) => (
        <section
          className={styles.record}
          aria-label="The workers’ sales and agreements"
          data-dock
        >
          <SalesIllustration compact />
          <dl className={styles.facts}>
            <div>
              <dt>Sales · each worker</dt>
              <dd>
                <button className={styles.factButton} {...target("sales")}>
                  {sales}
                </button>
              </dd>
            </div>
            {moment >= 1 && (
              <div>
                <dt>Commission rate · both</dt>
                <dd>
                  <button className={styles.factButton} {...target("rate")}>
                    {rate}
                  </button>
                </dd>
              </div>
            )}
          </dl>
          {moment >= 2 && (
            <div className={styles.agreements}>
              <div>
                <h3>Worker A</h3>
                <p>Commission on sales.</p>
              </div>
              <div>
                <h3>Worker B</h3>
                <p>A fixed monthly salary, plus commission on sales.</p>
              </div>
              <button className={styles.textButton} {...target("terms")}>
                Look closer at the promises ↗
              </button>
            </div>
          )}
        </section>
      )}
    </CommissionInspection>
  );
}
