import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import t from "./transfer.module.css";
import { TransferDiagram } from "./TransferDiagram";

/** Values come only from the source's exposure-filtered production projection. */
export function TransferEvidence({
  projection,
  solved = false,
  focus = "all",
  blocked = false,
}: {
  projection: C06CommissionProjection;
  solved?: boolean;
  focus?: string;
  blocked?: boolean;
}) {
  const { model } = projection;
  const amount = (value: typeof model.commission) =>
    value?.resolution.kind === "KNOWN"
      ? `₱${Number(value.resolution.value.magnitude.toString()).toLocaleString("en-PH")}`
      : "Your result";
  return (
    <section
      className={t.evidence}
      aria-label="Lina’s June agreement and sales"
    >
      <header>
        <span className={t.tag}>THE APPLIANCE STORE · JUNE</span>
        <h3>
          A month of sales.
          <br />
          <em>Two parts to the promise.</em>
        </h3>
      </header>
      <p className={t.recordIdentity}>
        Lina’s pay record <span>June · Base salary + commission</span>
      </p>
      <TransferDiagram
        solved={solved}
        focus={focus}
        blocked={blocked}
        sales={
          model.sales.kind === "KNOWN"
            ? `₱${Number(model.sales.value.magnitude.toString()).toLocaleString("en-PH")}`
            : "Information needed"
        }
        rate={
          model.commissionRate.kind === "KNOWN"
            ? `${model.commissionRate.value.magnitude.toString()}%`
            : "Information needed"
        }
        salary={
          model.baseSalary?.kind === "KNOWN"
            ? `₱${Number(model.baseSalary.value.magnitude.toString()).toLocaleString("en-PH")}`
            : "Information needed"
        }
        commission={amount(model.commission)}
        total={amount(model.totalCompensation)}
      />
      <dl className={t.visuallyHidden}>
        <div>
          <dt>June sales</dt>
          <dd>
            {model.sales.kind === "KNOWN"
              ? displayQuantity(model.sales.value)
              : "Information needed"}
          </dd>
        </div>
        <div>
          <dt>Commission rate</dt>
          <dd>
            {model.commissionRate.kind === "KNOWN"
              ? displayQuantity(model.commissionRate.value)
              : "Information needed"}
          </dd>
        </div>
        <div>
          <dt>Monthly base salary</dt>
          <dd>
            {model.baseSalary?.kind === "KNOWN"
              ? displayQuantity(model.baseSalary.value)
              : "Information needed"}
          </dd>
        </div>
      </dl>
      <p>
        Lina’s agreement promises a monthly base salary plus commission on her
        June sales.
      </p>
      <p className={t.note}>
        Sales is the reference for commission—not an extra payment to Lina. Keep
        all amounts tied to June.
      </p>
    </section>
  );
}

export function StoreIllustration() {
  return (
    <svg
      className={t.illustration}
      viewBox="0 0 520 280"
      role="img"
      aria-label="Lina beside the appliance-store counter and June sales record"
    >
      <rect x="1" y="1" width="518" height="278" rx="18" fill="#e9eedf" />
      <path d="M35 225H485M55 70H465" stroke="#a8b696" strokeWidth="2" />
      <rect
        x="65"
        y="92"
        width="122"
        height="132"
        rx="8"
        fill="#fffdf6"
        stroke="#879a6b"
        strokeWidth="3"
      />
      <path
        d="M65 145H187M172 110V130M172 164V187"
        stroke="#879a6b"
        strokeWidth="3"
      />
      <rect
        x="212"
        y="160"
        width="240"
        height="65"
        rx="6"
        fill="#c4d1b0"
        stroke="#657d4f"
        strokeWidth="2"
      />
      <path
        d="M270 158V133Q270 109 300 109Q330 109 330 133V158"
        fill="#3d6352"
      />
      <circle cx="300" cy="83" r="23" fill="#c99473" />
      <path
        d="M277 83Q271 48 301 47Q329 48 324 87L315 66L284 69Z"
        fill="#354638"
      />
      <rect
        x="360"
        y="115"
        width="67"
        height="55"
        rx="4"
        fill="#fffdf6"
        stroke="#657d4f"
        strokeWidth="2"
      />
      <path
        d="M372 131H414M372 143H406M372 155H411"
        stroke="#a8b696"
        strokeWidth="3"
      />
      <text x="260" y="255" textAnchor="middle" fill="#385544" fontSize="14">
        The agreement explains how sales become pay.
      </text>
    </svg>
  );
}
