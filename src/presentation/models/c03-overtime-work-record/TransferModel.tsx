import type { C03WorkRecordProjection } from "./public";
import { TransferInspection, TransferInspectable } from "./TransferInspection";
import { ExploreGlyph, ExploreHourMark } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import styles from "./transfer.module.css";

export function TransferModel({
  projection,
  blocked,
  focus = "condition",
}: {
  projection: C03WorkRecordProjection;
  blocked: boolean;
  focus?: string;
}) {
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const value = (key: string) => {
    const r = parts.find((p) => p.key === key)?.response;
    return r?.kind === "EXACT_QUANTITY"
      ? r.value.magnitude.toString()
      : r?.kind === "SINGLE_SELECTION"
        ? r.selectionId
        : null;
  };
  const math = projection.mathematicalExplanation;
  const result = math?.overtimePay.resolution;
  return (
    <TransferInspection projection={projection} blocked={blocked}>
      <section
        className={styles.record}
        aria-label="Mara’s regular-holiday work record"
        data-focus={focus}
      >
        <header>
          <div>
            <span className={styles.eyebrow}>Mara · One regular holiday</span>
            <h3>
              The day is different.
              <br />
              <em>What follows?</em>
            </h3>
          </div>
          <ExploreGlyph name="day" />
        </header>
        <TransferInspectable part="condition" className={styles.day}>
          <span>From Mara’s record</span>
          <strong>Regular holiday</strong>
          <small>
            Your identification: {value("condition") ?? "Not yet recorded"}
          </small>
        </TransferInspectable>
        <TransferInspectable part="hours" className={styles.hours}>
          <span>
            First eight hours completed · then{" "}
            {projection.workEvidence.hours.magnitude.toString()} extra
          </span>
          <svg
            viewBox="0 0 400 145"
            role="img"
            aria-label="Eight completed hours are separate from the three overtime hours being calculated."
          >
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x={12 + i * 26}
                y="24"
                width="21"
                height="49"
                rx="4"
                fill="#dde3d3"
                stroke="#879775"
              />
            ))}
            <path
              d="M224 12v82"
              stroke="#94713a"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${256 + i * 55} 48) scale(.72)`}>
                <ExploreHourMark />
              </g>
            ))}
            <text x="113" y="112" textAnchor="middle">
              First 8 · not calculated here
            </text>
            <text x="309" y="112" textAnchor="middle">
              3 overtime hours
            </text>
          </svg>
          <small>Only the gold hours belong in this calculation.</small>
        </TransferInspectable>
        <div className={styles.factors}>
          <TransferInspectable part="rate">
            <span>Regular hourly rate</span>
            <strong>
              {pesos(projection.workEvidence.rate.magnitude.toString())}
            </strong>
            <small>per hour</small>
          </TransferInspectable>
          <span aria-hidden="true">×</span>
          <TransferInspectable part="multiplier">
            <span>{math ? "Applicable multiplier" : "Your multiplier"}</span>
            <strong>
              {math?.multiplier.magnitude.toString() ??
                value("multiplier") ??
                "?"}
            </strong>
            <small>Follows from the day</small>
          </TransferInspectable>
        </div>
        <p className={styles.chain}>
          × 3 overtime hours <span aria-hidden="true">↓</span>
        </p>
        <TransferInspectable part="pay" className={styles.pay}>
          <span>{math ? "Confirmed overtime pay" : "Your overtime pay"}</span>
          <strong>
            {result?.kind === "KNOWN"
              ? pesos(result.value.magnitude.toString())
              : value("overtimePay")
                ? pesos(value("overtimePay")!)
                : "?"}
          </strong>
          <small>For the three extra hours only</small>
        </TransferInspectable>
        <p className={styles.inspectHint}>
          Hover, focus or tap a part to inspect it.
        </p>
      </section>
    </TransferInspection>
  );
}

export function MaraIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 500 380"
      role="img"
      aria-label="Mara beside a regular-holiday record with eight completed hours and three overtime hours."
    >
      <circle cx="250" cy="170" r="151" fill="#dce5cc" />
      <g transform="translate(192 12)">
        <path d="M20 56Q8 0 56 3Q106 1 96 73L13 82Z" fill="#3d4836" />
        <circle cx="56" cy="43" r="29" fill="#d8b294" />
        <path d="M9 127Q8 80 56 79Q105 78 104 127" fill="#718951" />
        <text
          x="56"
          y="154"
          textAnchor="middle"
          fill="#203c33"
          fontFamily="Georgia, serif"
          fontSize="25"
        >
          Mara
        </text>
      </g>
      <g transform="translate(42 184) rotate(-4 200 80)">
        <rect
          width="416"
          height="166"
          rx="12"
          fill="#fffaf0"
          stroke="#9baa7f"
        />
        <text x="22" y="32" fill="#71531d" fontSize="14" letterSpacing="2">
          REGULAR HOLIDAY
        </text>
        <text
          x="22"
          y="78"
          fill="#203c33"
          fontFamily="Georgia, serif"
          fontSize="34"
        >
          ₱120 per hour
        </text>
        <path d="M22 98h370" stroke="#c0caaa" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={22 + i * 24}
            y="115"
            width="18"
            height="27"
            rx="3"
            fill="#dce3d2"
          />
        ))}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${270 + i * 52} 128) scale(.65)`}>
            <ExploreHourMark />
          </g>
        ))}
      </g>
    </svg>
  );
}
