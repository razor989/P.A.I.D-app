import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import explore from "./explore.module.css";

/** Entry artwork contains established evidence, never withheld multipliers/results. */
export function ExploreIllustration({
  projection,
}: {
  projection: C03WorkRecordProjection;
}) {
  return (
    <figure
      className={explore.heroArt}
      aria-label="Two work records: the same hourly rate and two overtime hours, on different kinds of day"
    >
      <svg
        viewBox="0 0 500 380"
        role="img"
        aria-label="Ordinary working day and rest day: what changes?"
      >
        <circle cx="250" cy="183" r="158" fill="#e5ead7" />
        <circle
          cx="250"
          cy="183"
          r="127"
          fill="none"
          stroke="#b5c19f"
          strokeDasharray="4 9"
        />
        {[0, 1].map((row) => (
          <g
            key={row}
            transform={`translate(${row ? 218 : 22} ${row ? 114 : 45}) rotate(${row ? 5 : -5} 125 110)`}
          >
            <rect
              width="244"
              height="221"
              rx="9"
              fill={row ? "#fff4e4" : "#fffdf7"}
              stroke={row ? "#b28248" : "#718951"}
              strokeWidth="2"
            />
            <path d="M22 54h200" stroke="#c4c9b4" />
            <text x="22" y="34" fontSize="13" fontWeight="bold" fill="#294736">
              {row ? "B / REST DAY" : "A / ORDINARY DAY"}
            </text>
            <text
              x="22"
              y="93"
              fontSize="31"
              fontFamily="Georgia"
              fill="#203c33"
            >
              {pesos(projection.workEvidence.rate.magnitude.toString())}
            </text>
            <text x="22" y="117" fontSize="13" fill="#52645a">
              regular hourly rate
            </text>
            {[0, 1].map((i) => (
              <g key={i} transform={`translate(${22 + i * 82} 139)`}>
                <rect width="70" height="45" rx="4" fill="#d6ad5b" />
                <text
                  x="35"
                  y="29"
                  textAnchor="middle"
                  fontSize="21"
                  fill="#47391f"
                >
                  +1 h
                </text>
              </g>
            ))}
            <text x="22" y="205" fontSize="13" fill="#52645a">
              Two overtime hours
            </text>
          </g>
        ))}
        <circle
          cx="235"
          cy="218"
          r="30"
          fill="#435432"
          stroke="#f7f4ec"
          strokeWidth="6"
        />
        <text
          x="235"
          y="230"
          textAnchor="middle"
          fontFamily="Georgia"
          fontSize="39"
          fill="#fffdf7"
        >
          ?
        </text>
        <path d="M40 330h420" stroke="#b5c19f" />
        <text x="250" y="357" textAnchor="middle" fontSize="14" fill="#52645a">
          Same rate. Same hours. A different condition.
        </text>
      </svg>
    </figure>
  );
}
