import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import a from "./apply.module.css";

/** Read actual commitments; never substitute expected answers. */
export function ApplyRecord({
  projection,
  compact = false,
}: {
  projection: C06CommissionProjection;
  compact?: boolean;
}) {
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const values = [
    ["arrangement", "Pay structure"],
    ["sales", "Sales base"],
    ["rate", "Commission rate"],
    ["commission", "My commission claim"],
    ["interpretation", "What my amount means"],
  ];
  return (
    <section
      className={compact ? a.claimSummary : a.answerRecord}
      aria-label="Your recorded answers"
    >
      <h3>
        {compact ? "Your proposed claim" : "Your recorded commission claim"}
      </h3>
      <dl className={a.facts}>
        {values.map(([key, label]) => {
          const response = parts.find((part) => part.key === key)?.response;
          const text =
            response?.kind === "EXACT_QUANTITY"
              ? displayQuantity(response.value)
              : response?.kind === "SINGLE_SELECTION"
                ? projection.applyPrompts
                    ?.find((bank) => bank.role === key)
                    ?.options.find(
                      (option) => option.id === response.selectionId,
                    )?.text
                : undefined;
          return (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{text ?? "Not recorded yet"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
