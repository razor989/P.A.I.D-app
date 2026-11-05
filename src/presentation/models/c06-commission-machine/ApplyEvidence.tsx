import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import styles from "./commission.module.css";
import a from "./apply.module.css";

export function ApplyMachine({
  projection,
}: {
  projection: C06CommissionProjection;
}) {
  const { model } = projection;
  return (
    <figure
      className={a.machine}
      aria-label="Straight commission: sales multiplied by rate determines commission"
    >
      <div>
        <span>Sales base</span>
        <strong>
          {model.sales.kind === "KNOWN"
            ? displayQuantity(model.sales.value)
            : "Information needed"}
        </strong>
      </div>
      <span aria-hidden="true">×</span>
      <div>
        <span>Agreed rate</span>
        <strong>
          {model.commissionRate.kind === "KNOWN"
            ? displayQuantity(model.commissionRate.value)
            : "Information needed"}
        </strong>
      </div>
      <span aria-hidden="true">=</span>
      <div>
        <span>Commission</span>
        <strong>
          {model.commission?.resolution.kind === "KNOWN"
            ? displayQuantity(model.commission.resolution.value)
            : "Not revealed yet"}
        </strong>
      </div>
      <figcaption>
        The straight-commission machine ends here. No salary or total-pay branch
        is part of this agreement.
      </figcaption>
    </figure>
  );
}

export function PropertySaleIllustration() {
  return (
    <svg
      className={a.scene}
      viewBox="0 0 480 240"
      role="img"
      aria-label="A sold property and its signed commission agreement"
    >
      <ellipse cx="240" cy="214" rx="207" ry="16" fill="#d6d7be" />
      <path
        d="M58 116 179 28 300 116"
        fill="#a1b08c"
        stroke="#385a47"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M79 110v98h198v-98L179 42Z"
        fill="#faf6e8"
        stroke="#385a47"
        strokeWidth="4"
      />
      <path
        d="M159 208v-72h43v72M104 125h34v35h-34ZM224 125h30v35h-30Z"
        fill="#bdceb0"
        stroke="#385a47"
        strokeWidth="3"
      />
      <path
        d="M307 71h134v138H307Z"
        fill="#fffdf7"
        stroke="#9aab83"
        strokeWidth="3"
      />
      <path
        d="M328 96h91M328 109h68M328 166h91M328 181h54"
        stroke="#a4ad93"
        strokeWidth="3"
      />
      <text
        x="374"
        y="146"
        textAnchor="middle"
        fill="#21583f"
        fontSize="29"
        fontFamily="Georgia,serif"
      >
        5%
      </text>
      <path d="M55 175h80v29H55Z" fill="#21583f" />
      <text
        x="95"
        y="195"
        textAnchor="middle"
        fill="#fffdf7"
        fontSize="17"
        fontFamily="Arial,sans-serif"
      >
        SOLD
      </text>
    </svg>
  );
}

export function ApplyEvidence({
  projection,
  focus = "sale",
}: {
  projection: C06CommissionProjection;
  focus?: "agreement" | "sale" | "payment";
}) {
  const { model } = projection;
  return (
    <aside
      className={a.evidence}
      aria-label="Property sale evidence"
      data-focus={focus}
    >
      <PropertySaleIllustration />
      <p className={styles.eyebrow}>Agreement + sale record</p>
      <h3>One property. One commission.</h3>
      <p>
        A closed property sale. A commission promise. Two records with different
        jobs.
      </p>
      <dl className={a.facts}>
        <div data-evidence="sale">
          <dt>Property sale</dt>
          <dd>
            {model.sales.kind === "KNOWN"
              ? displayQuantity(model.sales.value)
              : "Information needed"}
          </dd>
        </div>
        <div data-evidence="agreement">
          <dt>Agreed rate</dt>
          <dd>
            {model.commissionRate.kind === "KNOWN"
              ? displayQuantity(model.commissionRate.value)
              : "Information needed"}
          </dd>
        </div>
        <div data-evidence="payment">
          <dt>Pay arrangement</dt>
          <dd>Straight commission</dd>
        </div>
      </dl>
      <p className={a.note}>
        {focus === "agreement"
          ? "Read the promise: the agreed percentage applies to sales. No fixed salary is promised."
          : focus === "sale"
            ? "The full sale supplies the reference. It is not itself the agent’s payment."
            : "Distinguish the value sold from the payment earned for selling it."}
      </p>
    </aside>
  );
}
