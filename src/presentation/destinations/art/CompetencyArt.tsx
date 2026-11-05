import { useId } from "react";
import type { CompetencyId } from "@/core/public";

/** Original decorative illustrations for the three offered competencies.
 * Meaning is always carried by adjacent text; the art is aria-hidden. */
export function CompetencyArt({
  id,
  className,
}: Readonly<{ id: CompetencyId; className?: string | undefined }>) {
  switch (id) {
    case "C03":
      return <OvertimeArt className={className} />;
    case "C04":
      return <ChangeArt className={className} />;
    case "C06":
      return <CommissionArt className={className} />;
    default:
      return null;
  }
}

type ArtProps = Readonly<{ className?: string | undefined }>;

/** C03 — a clock running past the regular day, a work record whose rows
 * spill beyond the 8-hour line, and earnings stacking up. */
function OvertimeArt({ className }: ArtProps) {
  const g = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${g}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe2b8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe2b8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="318" cy="78" r="70" fill={`url(#${g}-glow)`} />
      <circle cx="318" cy="78" r="26" fill="#f7c98a" />
      <circle cx="330" cy="70" r="22" fill="#c4623a" />
      {/* work record */}
      <g transform="rotate(7 300 270)">
        <rect
          x="206"
          y="176"
          width="168"
          height="196"
          rx="14"
          fill="#fff8ef"
          stroke="#5b2a17"
          strokeWidth="4"
        />
        <rect x="206" y="176" width="168" height="34" rx="14" fill="#5b2a17" />
        <rect x="206" y="196" width="168" height="14" fill="#5b2a17" />
        <rect x="222" y="187" width="62" height="8" rx="4" fill="#f4d9c3" />
        {[0, 1, 2, 3, 4].map((row) => (
          <g key={row} transform={`translate(0 ${226 + row * 28})`}>
            <rect x="222" y="0" width="92" height="12" rx="6" fill="#d98a62" />
            {(row === 1 || row === 3 || row === 4) && (
              <rect
                x="318"
                y="0"
                width={row === 3 ? 42 : 26}
                height="12"
                rx="6"
                fill="#e9b44c"
              />
            )}
          </g>
        ))}
        <line
          x1="316"
          y1="216"
          x2="316"
          y2="360"
          stroke="#5b2a17"
          strokeWidth="2.5"
          strokeDasharray="5 5"
        />
      </g>
      {/* clock */}
      <circle cx="150" cy="170" r="118" fill="#5b2a17" opacity="0.18" />
      <circle
        cx="142"
        cy="160"
        r="112"
        fill="#fff8ef"
        stroke="#5b2a17"
        strokeWidth="6"
      />
      <path d="M142 160 L142 56 A104 104 0 0 1 232 108 Z" fill="#e9b44c" />
      <path
        d="M142 160 L232 108 A104 104 0 0 1 246 160 Z"
        fill="#e9b44c"
        opacity="0.55"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const inner = i % 3 === 0 ? 82 : 90;
        return (
          <line
            key={i}
            x1={142 + Math.sin(a) * inner}
            y1={160 - Math.cos(a) * inner}
            x2={142 + Math.sin(a) * 100}
            y2={160 - Math.cos(a) * 100}
            stroke="#5b2a17"
            strokeWidth={i % 3 === 0 ? 6 : 3}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1="142"
        y1="160"
        x2="142"
        y2="92"
        stroke="#5b2a17"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <line
        x1="142"
        y1="160"
        x2="214"
        y2="122"
        stroke="#c4623a"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="142" cy="160" r="10" fill="#5b2a17" />
      {/* earnings */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(0 ${-i * 14})`}>
          <ellipse cx="86" cy="352" rx="44" ry="13" fill="#b9822a" />
          <ellipse cx="86" cy="346" rx="44" ry="13" fill="#e9b44c" />
        </g>
      ))}
      <ellipse
        cx="86"
        cy="304"
        rx="26"
        ry="6"
        fill="none"
        stroke="#fff3d6"
        strokeWidth="3"
      />
    </svg>
  );
}

/** C04 — an original amount, the same amount plus its change, a dashed
 * reference carried across, and the percentage measured against it. */
function ChangeArt({ className }: ArtProps) {
  const g = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={`${g}-grid`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M24 0H0V24"
            fill="none"
            stroke="#fbf7ef"
            strokeOpacity="0.16"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect
        x="28"
        y="28"
        width="344"
        height="344"
        rx="28"
        fill={`url(#${g}-grid)`}
      />
      {/* baseline */}
      <line
        x1="44"
        y1="340"
        x2="356"
        y2="340"
        stroke="#fbf7ef"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* original */}
      <rect x="78" y="172" width="96" height="168" rx="10" fill="#879d65" />
      <rect
        x="78"
        y="172"
        width="96"
        height="168"
        rx="10"
        fill="none"
        stroke="#203c33"
        strokeWidth="4"
      />
      {/* new = original + increase */}
      <rect x="228" y="172" width="96" height="168" rx="10" fill="#879d65" />
      <rect x="228" y="104" width="96" height="76" rx="10" fill="#d8ac4d" />
      <rect
        x="228"
        y="104"
        width="96"
        height="236"
        rx="10"
        fill="none"
        stroke="#203c33"
        strokeWidth="4"
      />
      <line
        x1="228"
        y1="174"
        x2="324"
        y2="174"
        stroke="#fbf7ef"
        strokeWidth="3"
      />
      {/* reference line */}
      <line
        x1="60"
        y1="172"
        x2="346"
        y2="172"
        stroke="#fbf7ef"
        strokeWidth="3"
        strokeDasharray="8 7"
      />
      {/* arc arrow */}
      <path
        d="M128 158 C 140 70, 228 52, 270 92"
        fill="none"
        stroke="#fbf7ef"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M256 76 L274 96 L248 100"
        fill="none"
        stroke="#fbf7ef"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* percent badge */}
      <circle
        cx="176"
        cy="74"
        r="34"
        fill="#d8ac4d"
        stroke="#203c33"
        strokeWidth="4"
      />
      <circle
        cx="164"
        cy="62"
        r="6"
        fill="none"
        stroke="#203c33"
        strokeWidth="4"
      />
      <circle
        cx="188"
        cy="86"
        r="6"
        fill="none"
        stroke="#203c33"
        strokeWidth="4"
      />
      <line
        x1="190"
        y1="56"
        x2="162"
        y2="92"
        stroke="#203c33"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* markers */}
      <circle cx="126" cy="256" r="8" fill="#fbf7ef" />
      <path
        d="M266 142 h20 M276 132 v20"
        stroke="#203c33"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** C06 — total sales as a whole, a commission wedge carved out at the
 * agreed rate, and earnings flowing from each sale. */
function CommissionArt({ className }: ArtProps) {
  const cx = 170,
    cy = 190,
    r = 110;
  const wedge = (start: number, end: number, radius: number) => {
    const p = (a: number) =>
      `${cx + Math.sin(a) * radius} ${cy - Math.cos(a) * radius}`;
    return `M${cx} ${cy} L${p(start)} A${radius} ${radius} 0 0 1 ${p(end)} Z`;
  };
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
    >
      {/* receipt */}
      <g transform="rotate(-8 300 210)">
        <path
          d="M250 92 h120 v232 l-12 -10 -12 10 -12 -10 -12 10 -12 -10 -12 10 -12 -10 -12 10 -12 -10 -12 10 Z"
          fill="#fbf7ef"
          stroke="#1f2a55"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(0 ${122 + i * 30})`}>
            <rect x="268" y="0" width="52" height="9" rx="4.5" fill="#9aa3d6" />
            <rect x="330" y="0" width="24" height="9" rx="4.5" fill="#1f2a55" />
          </g>
        ))}
        <line
          x1="266"
          y1="276"
          x2="356"
          y2="276"
          stroke="#1f2a55"
          strokeWidth="3"
          strokeDasharray="5 4"
        />
        <rect x="318" y="288" width="36" height="12" rx="6" fill="#e58a6b" />
      </g>
      {/* sales whole */}
      <circle cx={cx + 8} cy={cy + 10} r={r} fill="#1f2a55" opacity="0.3" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#c9c3e6"
        stroke="#1f2a55"
        strokeWidth="5"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const a = (i * Math.PI) / 5;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.sin(a) * r}
            y2={cy - Math.cos(a) * r}
            stroke="#1f2a55"
            strokeOpacity="0.35"
            strokeWidth="2.5"
          />
        );
      })}
      <path
        d={wedge(0, Math.PI / 5, r + 14)}
        fill="#e58a6b"
        stroke="#1f2a55"
        strokeWidth="5"
        strokeLinejoin="round"
        transform="translate(10 -12)"
      />
      <circle cx={cx} cy={cy} r="16" fill="#1f2a55" />
      {/* coins drifting from the wedge */}
      {[
        [252, 50, 16],
        [292, 34, 11],
        [226, 26, 8],
      ].map(([x, y, s]) => (
        <g key={`${x}-${y}`}>
          <circle
            cx={x}
            cy={y}
            r={s}
            fill="#f0c25a"
            stroke="#1f2a55"
            strokeWidth="3"
          />
        </g>
      ))}
      {/* rising sales steps */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={48 + i * 34}
          y={350 - (i + 1) * 22}
          width="26"
          height={(i + 1) * 22}
          rx="5"
          fill="#fbf7ef"
          stroke="#1f2a55"
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}
