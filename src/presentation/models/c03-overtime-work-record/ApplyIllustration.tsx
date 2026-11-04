import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import { ExploreHourMark } from "./ExploreGlyph";
import styles from "./work-record.module.css";

export function ApplyIllustration({
  projection,
}: {
  projection: C03WorkRecordProjection;
}) {
  return (
    <figure className={styles.nicoIllustration}>
      <svg
        viewBox="0 0 500 390"
        role="img"
        aria-label="James’s monthly overtime: established hourly rate, ordinary working days, and ten extra hours to calculate."
      >
        <circle cx="250" cy="172" r="145" fill="#d8e2c8" />
        <path d="M24 350h452" stroke="#a4b38b" />
        <g transform="translate(190 10)">
          <circle cx="50" cy="40" r="27" fill="#d8b294" />
          <path d="M22 39Q18 5 50 9Q83 5 78 43L62 25L30 29Z" fill="#3d4836" />
          <path d="M3 112Q4 72 50 73Q95 72 98 112" fill="#718951" />
          <text
            x="50"
            y="137"
            textAnchor="middle"
            fill="#203c33"
            fontFamily="Georgia, serif"
            fontSize="22"
          >
            James
          </text>
        </g>
        <g transform="translate(25 160) rotate(-5 115 80)">
          <rect
            width="226"
            height="174"
            rx="10"
            fill="#fffdf7"
            stroke="#879d65"
          />
          <text x="18" y="30" fill="#52645a" fontSize="10" letterSpacing="1.1">
            ORDINARY WORKING DAYS
          </text>
          <path d="M18 43h190" stroke="#c7d0b8" />
          <text
            x="18"
            y="89"
            fill="#203c33"
            fontFamily="Georgia, serif"
            fontSize="37"
          >
            {pesos(projection.workEvidence.rate.magnitude.toString())}
          </text>
          <text x="18" y="115" fill="#52645a" fontSize="14">
            regular pay per hour
          </text>
          <path d="M18 140h110M18 151h75" stroke="#b7c3a5" />
        </g>
        <g transform="translate(258 177) rotate(5 108 77)">
          <rect
            width="216"
            height="162"
            rx="10"
            fill="#fff2dc"
            stroke="#b28248"
          />
          <text x="16" y="27" fill="#71531d" fontSize="10" letterSpacing="1">
            OVERTIME THIS MONTH
          </text>
          <text
            x="16"
            y="66"
            fill="#493a22"
            fontFamily="Georgia, serif"
            fontSize="31"
          >
            {projection.workEvidence.hours.magnitude.toString()} extra hours
          </text>
          {Array.from({ length: 10 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${28 + (i % 5) * 39} ${95 + Math.floor(i / 5) * 35}) scale(.58)`}
            >
              <ExploreHourMark />
            </g>
          ))}
        </g>
        <circle cx="448" cy="136" r="27" fill="#fffdf7" stroke="#879d65" />
        <text
          x="448"
          y="147"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="35"
          fill="#71531d"
        >
          ?
        </text>
      </svg>
    </figure>
  );
}
