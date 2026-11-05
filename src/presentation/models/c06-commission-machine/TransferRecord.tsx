import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import t from "./transfer.module.css";

export function TransferRecord({
  projection,
}: {
  projection: C06CommissionProjection;
}) {
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  return (
    <section className={t.record} aria-label="Your recorded June response">
      <span className={t.tag}>YOUR RECORDED RESPONSE</span>
      <h3>The answer you submitted.</h3>
      <dl className={t.facts}>
        {[
          ["arrangement", "Arrangement"],
          ["commission", "June commission"],
          ["total", "June total compensation"],
        ].map(([key, label]) => {
          const response = parts.find((part) => part.key === key)?.response;
          const value =
            response?.kind === "SINGLE_SELECTION"
              ? response.selectionId === "BASE_PLUS_COMMISSION"
                ? "Base-plus-commission"
                : "Straight commission"
              : response?.kind === "EXACT_QUANTITY"
                ? displayQuantity(response.value)
                : "Not recorded";
          return (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>
      <p className={t.note}>
        This is your response, not a replacement with the worked answer.
      </p>
    </section>
  );
}
