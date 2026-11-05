import { useId } from "react";
import t from "./transfer.module.css";

/** Scene-specific engraved record illustrations; labels belong to the diagram. */
export function TransferConclusionArt({
  scene,
  revealed,
}: {
  scene: number;
  revealed: boolean;
}) {
  const id = useId();
  return (
    <svg
      className={t.finaleArt}
      viewBox="0 0 760 380"
      role="img"
      aria-label={
        [
          "Lina’s June agreement promises a fixed base salary and a sales-linked commission.",
          "June sales of ₱120,000 at 3 percent determine ₱3,600 commission.",
          "₱15,000 salary and ₱3,600 commission join to make ₱18,600 total; only commission carries forward.",
          "Read the agreement, trace the sales reference, and name the payment.",
        ][scene]
      }
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#627a59" stopOpacity=".4" />
          <stop offset="1" stopColor="#18382e" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={`${id}-grid`}
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M28 0H0v28"
            fill="none"
            stroke="#e9dab6"
            strokeOpacity=".06"
          />
        </pattern>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="m1 1 7 4-7 4"
            fill="none"
            stroke="#dbb66d"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
      <rect width="760" height="380" fill={`url(#${id}-grid)`} />
      <ellipse cx="380" cy="190" rx="340" ry="185" fill={`url(#${id}-glow)`} />
      <g
        className={t.artOrbit}
        fill="none"
        stroke="#dbb66d"
        strokeOpacity=".22"
      >
        <ellipse cx="380" cy="190" rx="345" ry="150" />
        <path d="M36 190h32m624 0h32M380 24v22m0 288v22" />
      </g>
      {scene === 0 ? (
        <g className={t.artDocument}>
          <path d="m221 51 332 6 12 278-332 7Z" fill="#0b241d" opacity=".5" />
          <rect x="210" y="35" width="340" height="296" rx="7" fill="#f4ecd9" />
          <path d="M230 55h300v256H230Z" fill="none" stroke="#b9b294" />
          <text x="252" y="84" className={t.artKicker}>
            THE PAY AGREEMENT
          </text>
          <text x="252" y="116" className={t.artTitle}>
            Lina · June
          </text>
          <path d="M252 134h256" stroke="#a7ad8d" />
          <g className={t.artBranch}>
            <rect
              x="247"
              y="150"
              width="266"
              height="60"
              rx="4"
              fill="#dce4cd"
            />
            <text x="264" y="173" className={t.artLabel}>
              01 / FIXED BASE SALARY
            </text>
            <text x="264" y="197" className={t.artValue}>
              ₱15,000
            </text>
          </g>
          <g className={t.artBranch}>
            <rect
              x="247"
              y="221"
              width="266"
              height="60"
              rx="4"
              fill="#ead7ab"
            />
            <text x="264" y="244" className={t.artLabel}>
              02 / SALES-LINKED COMMISSION
            </text>
            <text x="264" y="268" className={t.artValue}>
              {revealed ? "3% of June sales" : "The agreed share of sales"}
            </text>
          </g>
          <path d="M255 300h100" stroke="#7b896a" />
          <text x="448" y="305" className={t.artLabel}>
            AGREED
          </text>
          <circle cx="552" cy="302" r="27" fill="#c9a45e" />
          <path
            d="m540 301 8 8 16-18"
            fill="none"
            stroke="#284a39"
            strokeWidth="3"
          />
        </g>
      ) : scene === 1 ? (
        <g>
          <g className={t.artDocument}>
            <rect
              x="66"
              y="76"
              width="280"
              height="214"
              rx="8"
              fill="#f4ecd9"
            />
            <path d="M86 96h240v174H86Z" fill="none" stroke="#b9b294" />
            <text x="108" y="126" className={t.artKicker}>
              JUNE / SALES RECORD
            </text>
            <text x="108" y="173" className={t.artAmount}>
              ₱120,000
            </text>
            <path d="M108 195h192m-192 19h140m-140 19h162" stroke="#b9b294" />
            <text x="108" y="256" className={t.artLabel}>
              THE REFERENCE · NOT THE PAY
            </text>
          </g>
          <path
            className={t.artTrace}
            d="M349 181h128"
            fill="none"
            stroke="#dbb66d"
            strokeWidth="2"
            markerEnd={`url(#${id}-arrow)`}
          />
          <g className={t.artBranch}>
            <circle cx="409" cy="181" r="35" fill="#dabc7b" />
            <text x="409" y="189" textAnchor="middle" className={t.artValue}>
              × 3%
            </text>
          </g>
          <g className={t.artBranch}>
            <rect
              x="490"
              y="114"
              width="208"
              height="140"
              rx="9"
              fill="#ead7ab"
            />
            <text x="594" y="149" textAnchor="middle" className={t.artKicker}>
              COMMISSION
            </text>
            <text x="594" y="196" textAnchor="middle" className={t.artAmount}>
              {revealed ? "₱3,600" : "Sales × rate"}
            </text>
            <text x="594" y="228" textAnchor="middle" className={t.artLabel}>
              THE RESULTING PAYMENT
            </text>
          </g>
          <text x="380" y="332" textAnchor="middle" className={t.artLightLabel}>
            THE RATE ACTS ON SALES — NOT ON SALARY.
          </text>
        </g>
      ) : scene === 2 ? (
        <g>
          <path
            className={t.artTrace}
            d="M276 109h72q22 0 22 22v49m-94 36h72q22 0 22-22v-14h76"
            stroke="#dbb66d"
            strokeWidth="2"
            fill="none"
            markerEnd={`url(#${id}-arrow)`}
          />
          {[
            ["BASE SALARY", "₱15,000", 66, "#dce4cd"],
            ["COMMISSION", "₱3,600", 173, "#ead7ab"],
          ].map(([label, amount, y, color]) => (
            <g key={label} className={t.artBranch}>
              <rect
                x="60"
                y={y}
                width="216"
                height="86"
                rx="7"
                fill={String(color)}
              />
              <text x="82" y={Number(y) + 27} className={t.artKicker}>
                {label}
              </text>
              <text x="82" y={Number(y) + 63} className={t.artAmount}>
                {amount}
              </text>
            </g>
          ))}
          <circle cx="370" cy="180" r="17" fill="#18382e" stroke="#dbb66d" />
          <path d="M362 180h16m-8-8v16" stroke="#dbb66d" strokeWidth="2" />
          <g className={t.artDocument}>
            <rect
              x="458"
              y="120"
              width="242"
              height="119"
              rx="8"
              fill="#f4ecd9"
            />
            <text x="579" y="154" textAnchor="middle" className={t.artKicker}>
              TOTAL COMPENSATION
            </text>
            <text
              x="579"
              y="199"
              textAnchor="middle"
              className={revealed ? t.artAmount : t.artValue}
            >
              {revealed ? "₱18,600" : "Salary + commission"}
            </text>
            <path d="M480 216h198" stroke="#b9b294" />
          </g>
          <path
            className={t.artTrace}
            d="M168 259v49h315"
            stroke="#dbb66d"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            fill="none"
            markerEnd={`url(#${id}-arrow)`}
          />
          <text x="498" y="305" className={t.artLightLabel}>
            CARRY FORWARD
          </text>
          <text x="498" y="329" className={t.artLightValue}>
            Commission only · ₱3,600
          </text>
        </g>
      ) : (
        <g>
          <path
            className={t.artTrace}
            d="M217 180h79m168 0h79"
            fill="none"
            stroke="#dbb66d"
            strokeWidth="2"
            markerEnd={`url(#${id}-arrow)`}
          />
          <g className={t.artDocument}>
            <rect
              x="72"
              y="92"
              width="145"
              height="177"
              rx="6"
              fill="#f4ecd9"
            />
            <text x="94" y="124" className={t.artKicker}>
              01 / READ
            </text>
            <path
              d="M94 146h100m-100 18h82m-82 18h94m-94 18h65"
              stroke="#8b9979"
              strokeWidth="2"
            />
            <circle cx="174" cy="234" r="17" fill="#c9a45e" />
            <path
              d="m166 234 6 6 11-13"
              fill="none"
              stroke="#284a39"
              strokeWidth="2"
            />
          </g>
          <g className={t.artBranch}>
            <circle cx="380" cy="180" r="84" fill="#284d3c" stroke="#9baf83" />
            <text
              x="380"
              y="153"
              textAnchor="middle"
              className={t.artLightLabel}
            >
              02 / TRACE
            </text>
            <text
              x="380"
              y="194"
              textAnchor="middle"
              className={t.artLightAmount}
            >
              Sales × rate
            </text>
            <path d="M335 216h90" stroke="#dbb66d" />
            <circle cx="380" cy="216" r="4" fill="#dbb66d" />
          </g>
          <g className={t.artBranch}>
            <path
              d="M548 108h140v151l-10-6-10 6-10-6-10 6-10-6-10 6-10-6-10 6-10-6-10 6-10-6-10 6-10-6-10 6Z"
              fill="#ead7ab"
            />
            <text x="568" y="142" className={t.artKicker}>
              03 / NAME
            </text>
            <text x="568" y="180" className={t.artValue}>
              Commission
            </text>
            <text x="568" y="211" className={t.artAmount}>
              ₱3,600
            </text>
            <path d="M568 230h100" stroke="#a58d59" />
          </g>
          <text x="380" y="328" textAnchor="middle" className={t.artLightLabel}>
            THE PROMISE. THE REFERENCE. THE MEANING.
          </text>
        </g>
      )}
    </svg>
  );
}
