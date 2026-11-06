import type { C06CommissionProjection } from "./public";
import { displayQuantity } from "./CommissionMachine";
import { CommissionInspection } from "./CommissionInspection";
import styles from "./commission.module.css";
import e from "./explore.module.css";

type Model = C06CommissionProjection["model"];
const known = (value: Model["sales"]) =>
  value.kind === "KNOWN" ? displayQuantity(value.value) : "Information needed";
const output = (value: Model["commission"]) =>
  value ? known(value.resolution) : "Not revealed yet";

export function SalesComparisonIllustration() {
  return (
    <svg
      className={e.scene}
      viewBox="0 0 520 330"
      role="img"
      aria-label="One representative examines two monthly sales records under the same salary and commission agreement"
    >
      <ellipse cx="260" cy="292" rx="230" ry="22" fill="#dfe6d2" />
      <path
        d="M28 210h464v67H28z"
        fill="#eee3c8"
        stroke="#a39168"
        strokeWidth="2"
      />
      <path d="M56 277v32m408-32v32" stroke="#8b7751" strokeWidth="9" />
      <g className={e.representative}>
        <path d="M194 215v-64q0-39 48-39t48 39v64" fill="#617952" />
        <circle cx="242" cy="79" r="35" fill="#dbab81" />
        <path
          d="M207 79q-8-57 43-43 30 5 28 43l-15-17q-28 8-43-4z"
          fill="#34463b"
        />
        <path
          d="M230 94q12 8 23-1"
          fill="none"
          stroke="#84583f"
          strokeWidth="2"
        />
        <path
          d="M207 158l-39 47m108-47 45 47"
          stroke="#dbab81"
          strokeWidth="17"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(330 26) rotate(5)">
        <rect
          width="158"
          height="131"
          rx="7"
          fill="#fffdf7"
          stroke="#879a6b"
          strokeWidth="2"
        />
        <text x="15" y="28" fontSize="15">
          ONE AGREEMENT
        </text>
        <path d="M15 40h127" stroke="#b8c4a6" />
        <text x="15" y="69" fontSize="18">
          ₱15,000 salary
        </text>
        <text x="15" y="98" fontSize="18">
          + 3% of sales
        </text>
        <path
          d="m124 108 6 6 11-13"
          fill="none"
          stroke="#657d4f"
          strokeWidth="3"
        />
      </g>
      {[0, 1].map((n) => (
        <g
          key={n}
          className={e.salesPaper}
          style={{ animationDelay: `${n * 180}ms` }}
          transform={`translate(${n ? 300 : 52} 186) rotate(${n ? 4 : -5})`}
        >
          <rect
            width="164"
            height="99"
            rx="5"
            fill="#fffdf7"
            stroke="#879a6b"
            strokeWidth="2"
          />
          <text x="14" y="25" fontSize="15">
            SITUATION {n ? "B" : "A"}
          </text>
          {Array.from({ length: n ? 5 : 3 }, (_, i) => (
            <rect
              key={i}
              x={14 + i * 27}
              y="43"
              width="20"
              height="27"
              fill="#becda6"
            />
          ))}
          <path d="M14 82h133" stroke="#b8c4a6" />
        </g>
      ))}
    </svg>
  );
}

/** Different parts have different explanatory representations, never a generic equation box. */
export function ExploreRelationship({ kind }: { kind: string }) {
  const salary = kind === "base";
  const total = kind === "total";
  return (
    <svg
      className={e.detailGraphic}
      viewBox="0 0 300 140"
      role="img"
      aria-label={
        salary
          ? "Matching fixed salary bars in both situations"
          : total
            ? "Salary and commission join to make total pay"
            : kind === "commission"
              ? "The same 3% rate applied to a larger sales reference gives a larger commission"
              : kind === "sales"
                ? "The sales reference stays intact when a commission share is measured"
                : "Three highlighted parts out of one hundred represent a 3% share of sales"
      }
    >
      {kind === "sales" ? (
        <>
          <rect
            x="14"
            y="12"
            width="126"
            height="104"
            rx="5"
            fill="#f6f3e7"
            stroke="#879a6b"
          />
          <text x="24" y="34" fontSize="13">
            Sales record
          </text>
          <path
            d="M24 49h101m-101 17h101m-101 17h101"
            stroke="#879a6b"
            strokeWidth="3"
          />
          <path
            data-mini-piece
            d="M153 63h33m-7-7 7 7-7 7"
            fill="none"
            stroke="#987735"
            strokeWidth="2"
          />
          <circle
            data-mini-piece
            cx="235"
            cy="62"
            r="32"
            fill="#efdeb4"
            stroke="#987735"
          />
          <text x="217" y="68" fontSize="18">
            3%
          </text>
          <text x="14" y="137" fontSize="12">
            Reference intact · measure a share
          </text>
        </>
      ) : kind === "commission" ? (
        <>
          <text x="12" y="18" fontSize="12">
            Same rate · different sales references
          </text>
          {[0, 1].map((n) => (
            <g key={n} transform={`translate(12 ${34 + n * 43})`}>
              <rect
                width={n ? 250 : 150}
                height="24"
                fill="#dfe7d2"
                stroke="#879a6b"
              />
              <rect
                data-mini-piece
                width={n ? 7.5 : 4.5}
                height="24"
                fill="#b28248"
              />
              <text x={n ? 195 : 95} y="17" fontSize="12">
                {n ? "B" : "A"} · 3%
              </text>
            </g>
          ))}
          <text x="12" y="135" fontSize="12">
            Larger whole → larger 3% share
          </text>
        </>
      ) : salary || total ? (
        <>
          <text x="10" y="22" fontSize="13">
            {salary ? "Same promise in A and B" : "Two parts of pay—not sales"}
          </text>
          {[0, 1].map((n) => (
            <g key={n} transform={`translate(12 ${38 + n * 48})`}>
              <text x="0" y="20" fontSize="13">
                {n ? "B" : "A"}
              </text>
              <rect
                data-mini-piece
                className={e.grow}
                x="23"
                width="130"
                height="28"
                rx="3"
                fill="#657d4f"
              />
              {total && (
                <rect
                  data-mini-piece
                  className={e.grow}
                  x="153"
                  width={n ? 130 : 78}
                  height="28"
                  rx="3"
                  fill="#d7b25e"
                />
              )}
              {!total && (
                <text x="163" y="20" fontSize="14">
                  ₱15,000
                </text>
              )}
            </g>
          ))}
        </>
      ) : (
        <>
          {Array.from({ length: 100 }, (_, i) => (
            <rect
              key={i}
              data-mini-piece={i < 3 ? true : undefined}
              className={i < 3 ? e.shareCell : undefined}
              x={12 + (i % 20) * 13.5}
              y={15 + Math.floor(i / 20) * 16}
              width="11"
              height="13"
              rx="1"
              fill={i < 3 ? "#d7b25e" : "#dfe7d2"}
              stroke="#a6b68e"
              strokeWidth=".5"
            />
          ))}
          <text x="12" y="118" fontSize="13">
            {kind === "sales"
              ? "100% of the sales reference remains."
              : "3 of 100 equal shares = 3% = 0.03"}
          </text>
        </>
      )}
    </svg>
  );
}

export function PayPicture({
  model,
  label,
  revealed = 2,
}: {
  model: Model;
  label: string;
  revealed?: number;
}) {
  const commission = model.commission?.resolution;
  const magnitude =
    commission?.kind === "KNOWN"
      ? Number(commission.value.magnitude.toString())
      : 0;
  return (
    <figure className={e.payPicture}>
      <figcaption>
        {label}
        <span>Monthly pay · one shared peso scale</span>
      </figcaption>
      <div
        className={e.payScale}
        role="img"
        aria-label={`Fixed salary ${model.baseSalary ? known(model.baseSalary) : "unknown"}${revealed > 0 ? `; commission ${output(model.commission)}` : ""}`}
      >
        <div className={e.salaryPart} style={{ width: "50%" }}>
          <span>Salary</span>
        </div>
        {revealed > 0 && (
          <div
            className={e.commissionPart}
            style={{ width: `${(magnitude / 30000) * 100}%` }}
          >
            <span>Commission</span>
          </div>
        )}
      </div>
      <div className={e.payLabels}>
        <p>
          <i className={e.salaryKey} />
          Fixed salary
          <strong>
            {model.baseSalary ? known(model.baseSalary) : "Not yet shown"}
          </strong>
        </p>
        {revealed > 0 && (
          <p>
            <i className={e.commissionKey} />
            Commission<strong>{output(model.commission)}</strong>
          </p>
        )}
      </div>
      {revealed > 1 && (
        <p className={e.totalLabel}>
          Together <strong>{output(model.totalCompensation)}</strong> total
          compensation
        </p>
      )}
    </figure>
  );
}

export function ExploreModel({
  projection,
  stage,
  cue,
  progress = 1,
  blocked,
  onInspect,
}: {
  projection: C06CommissionProjection;
  stage: number;
  cue: number;
  progress?: number;
  blocked: boolean;
  onInspect?: ((open: boolean) => void) | undefined;
}) {
  const m = projection.model;
  const facts = [
    {
      id: "sales",
      title: "Start with the sales reference",
      copy: "This is the value of goods sold, not the representative’s pay. Commission measures a share of this amount. The highlighted share is a comparison, not money removed: the sales record stays intact.",
    },
    {
      id: "rate",
      title: "Three for every hundred",
      copy: "Imagine dividing the sales reference into 100 equal shares. Three matching shares describe 3%. Multiplying sales by 0.03 finds their value. A larger reference makes each share larger; the rate itself need not change.",
    },
    {
      id: "base",
      title: "A separate monthly promise",
      copy: "Compare the matching green bars. Each represents the same ₱15,000 salary in the agreement. Sales cannot resize this fixed promise. It joins commission afterward; it is not part of the amount multiplied by 3%.",
    },
    {
      id: "commission",
      title: "Same rate, different reference",
      copy: "Both situations use three hundredths of sales. When the sales reference is larger, the commission share is worth more. This explains a changed commission without inventing a changed rate. Commission is only one part of pay.",
    },
    {
      id: "total",
      title: "Join pay to pay",
      copy: "Read the green salary and gold commission as two parts of compensation. Their combined length shows total pay on one peso scale. Do not add the sales record: it measures goods sold, not another payment to the representative.",
    },
  ];
  const share = stage > 1 || (stage === 1 && cue > 0);
  const commission = stage > 3 || (stage >= 2 && cue > 0);
  const total = stage > 3 || (stage >= 2 && cue > 1);
  return (
    <CommissionInspection
      facts={facts}
      blocked={blocked}
      onInspection={onInspect}
      diagram={(id) => <ExploreRelationship kind={id} />}
    >
      {(target) => (
        <div className={e.model} data-stage={stage} data-cue={cue}>
          <h3 className={e.srOnly}>Investigate the agreement and pay</h3>
          <div className={e.agreement}>
            <span className={styles.eyebrow}>One monthly agreement</span>
            <strong>Salary + commission</strong>
            <div>
              {(stage > 0 || cue > 0) && (
                <button {...target("base")} className={styles.factButton}>
                  ₱15,000 salary · fixed
                </button>
              )}
              {(stage > 0 || cue > 1) && (
                <button {...target("rate")} className={styles.factButton}>
                  3% of sales · fixed
                </button>
              )}
            </div>
          </div>
          {stage >= 1 && (
            <figure className={e.salesReference}>
              <figcaption>
                <button {...target("sales")} className={styles.factButton}>
                  Sales reference
                </button>
                <strong>{known(m.sales)}</strong>
              </figcaption>
              <div
                className={e.hundred}
                role="img"
                aria-label={
                  share
                    ? "Three highlighted shares of the intact 100-share sales reference"
                    : "Intact sales reference divided into 100 equal shares"
                }
              >
                {Array.from({ length: 100 }, (_, i) => (
                  <span
                    key={i}
                    data-share={share && i < 3}
                    style={{
                      opacity:
                        share && i < 3
                          ? 0.35 + Math.min(1, progress * 2) * 0.65
                          : 1,
                    }}
                  />
                ))}
              </div>
              <p>
                {share
                  ? "3 highlighted shares out of 100 · the sales record stays intact"
                  : "The whole sales record—not salary—is our reference."}
              </p>
            </figure>
          )}
          {share && (
            <p className={e.relationship}>
              <button {...target("commission")} className={styles.factButton}>
                Commission
              </button>{" "}
              = sales × 0.03
              {commission && (
                <strong>
                  {known(m.sales)} × 0.03 = {output(m.commission)}
                </strong>
              )}
            </p>
          )}
          {stage >= 2 && (
            <PayPicture
              key={known(m.sales)}
              model={m}
              label="From the agreement to monthly pay"
              revealed={total ? 2 : commission ? 1 : 0}
            />
          )}
          {total && (
            <button {...target("total")} className={styles.factButton}>
              Why add the salary afterward?
            </button>
          )}
          <p className={e.inspectHint}>
            Hover, focus or tap an underlined part to investigate.
          </p>
        </div>
      )}
    </CommissionInspection>
  );
}

export function ExploreComparison({
  projection,
  cue = 2,
}: {
  projection: C06CommissionProjection;
  cue?: number;
}) {
  if (!projection.comparison) return null;
  const [a, b] = projection.comparison;
  if (!a || !b) return null;
  const rows = [
    ["Arrangement", "Fixed", "Base plus commission", "Base plus commission"],
    [
      "Salary",
      "Fixed",
      a.baseSalary ? known(a.baseSalary) : "Unknown",
      b.baseSalary ? known(b.baseSalary) : "Unknown",
    ],
    ["Rate", "Fixed", known(a.commissionRate), known(b.commissionRate)],
    ["Sales", "Changed", known(a.sales), known(b.sales)],
    ["Commission", "Changed", output(a.commission), output(b.commission)],
    [
      "Total pay",
      "Changed",
      output(a.totalCompensation),
      output(b.totalCompensation),
    ],
  ];
  return (
    <section className={e.comparison} aria-label="Compare the two situations">
      <p className={e.sharedAgreement}>
        One representative · same agreement · ₱15,000 salary + 3% of sales
      </p>
      <div className={e.paired}>
        <PayPicture
          model={a}
          label="Situation A"
          revealed={cue === 0 ? 0 : 2}
        />
        <PayPicture
          model={b}
          label="Situation B"
          revealed={cue === 0 ? 0 : 2}
        />
      </div>
      {cue > 0 && (
        <p className={e.causalNote}>
          The green salary parts match. The gold commission parts explain the
          difference in total pay.
        </p>
      )}
      {cue > 1 && (
        <details className={e.numericalEvidence}>
          <summary>
            Inspect the numerical evidence: fixed and changed quantities
          </summary>
          <table className={e.comparisonTable}>
            <caption>
              The evidence: what stayed fixed, and what changed?
            </caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">A</th>
                <th scope="col">B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, status, av, bv], i) => (
                <tr key={label}>
                  <th scope="row">
                    <span aria-hidden="true">{i < 3 ? "▰" : "↗"}</span> {label}
                    <small>{status}</small>
                  </th>
                  <td>{av}</td>
                  <td>{bv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
