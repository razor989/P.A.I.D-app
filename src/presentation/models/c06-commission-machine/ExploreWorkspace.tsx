import type { C06CommissionProjection } from "./public";
import { ExploreRelationship } from "./ExploreModel";
import styles from "./commission.module.css";
import e from "./explore.module.css";

export function ExploreWorkspace({
  role,
  projection,
  guided = false,
}: {
  role: string;
  projection: C06CommissionProjection;
  guided?: boolean;
}) {
  const total = role.startsWith("total");
  const comparing = role === "changeReason";
  const fixed = ["fixedReason", "base", "rate"].includes(role);
  const b = role.endsWith("B");
  const commission =
    projection.response?.kind === "COMPOSITE"
      ? projection.response.parts.find(
          (p) => p.key === (b ? "commissionB" : "commissionA"),
        )?.response
      : null;
  return (
    <aside className={e.workspace} aria-label="Evidence for this question">
      <p className={styles.eyebrow}>
        {comparing
          ? "Compare the two monthly records"
          : fixed
            ? "One agreement · both situations"
            : `Trace the pay · Situation ${b ? "B" : "A"}`}
      </p>
      <h4>
        {comparing
          ? "Different sales. Same promises."
          : fixed
            ? "Keep the promises in view"
            : total
              ? "Join pay to pay"
              : "Measure the sales-linked share"}
      </h4>
      <div className={e.evidenceTokens}>
        <span>
          Monthly salary<strong>₱15,000</strong>
          <small>Fixed promise</small>
        </span>
        <span>
          Commission rate<strong>3% of sales</strong>
          <small>Same rate in A and B</small>
        </span>
        {!fixed && (
          <span>
            Monthly sales
            <strong>
              {comparing
                ? "A: ₱300,000 → B: ₱500,000"
                : b
                  ? "₱500,000"
                  : "₱300,000"}
            </strong>
            <small>Reference—not pay</small>
          </span>
        )}
      </div>
      <ExploreRelationship
        kind={
          comparing ? "commission" : fixed ? "base" : total ? "total" : "rate"
        }
      />
      <p className={e.formulaTrace}>
        {comparing
          ? "Sales changes → commission changes → total pay changes"
          : fixed
            ? "Same salary + same rate ≠ necessarily the same total pay"
            : total
              ? "Salary + commission → total pay"
              : "Sales × (rate ÷ 100) → commission"}
      </p>
      {total && commission?.kind === "EXACT_QUANTITY" && (
        <p>
          Your commission response:{" "}
          <strong>₱{commission.value.magnitude.toString()}</strong>. Add the
          separate salary—not the sales record.
        </p>
      )}
      {guided && (
        <div className={e.reference}>
          <h4>
            {fixed
              ? "Read the agreement, not the sales record"
              : total
                ? "Which amounts are actually pay?"
                : "What does three percent mean?"}
          </h4>
          <p>
            {fixed
              ? "Changing sales does not rewrite either promise. Compare the salary and rate before deciding what changes."
              : total
                ? "Commission is one payment. Salary is another. Sales measures goods sold and is not an extra payment. Combine the two payments."
                : "Percent means out of one hundred. Find one hundredth of sales, then take three of those equal shares. Keep the salary outside this multiplication."}
          </p>
        </div>
      )}
    </aside>
  );
}
