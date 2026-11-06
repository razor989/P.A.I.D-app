import type { ActivityStep } from "../content";
import type { Cover } from "./cover";

/** C06 Commission covers: sales, rates and the share that becomes earnings.
 * Original, decorative artwork drawn in the shared 300×400 cover frame. */

const gold = "#e2b04a";

/** A circular dial with a fixed share (the rate) cut out in gold. */
function RateDial({
  cx,
  cy,
  r,
  share,
  ink,
  face,
}: Readonly<{
  cx: number;
  cy: number;
  r: number;
  /** Share of the full turn, 0–1. */
  share: number;
  ink: string;
  face: string;
}>) {
  const a = share * 2 * Math.PI;
  const x = cx + Math.sin(a) * r;
  const y = cy - Math.cos(a) * r;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={face} stroke={ink} strokeWidth="4" />
      <path
        d={`M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x} ${y} Z`}
        fill={gold}
        stroke={ink}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </>
  );
}

/** A sales bar whose top slice, the commission share, is picked out in gold. */
function SalesBar({
  x,
  base,
  height,
  width,
  fill,
  ink,
}: Readonly<{
  x: number;
  base: number;
  height: number;
  width: number;
  fill: string;
  ink: string;
}>) {
  const share = Math.round(height * 0.22);
  return (
    <>
      <rect
        x={x}
        y={base - height}
        width={width}
        height={height}
        rx="4"
        fill={fill}
      />
      <rect
        x={x}
        y={base - height}
        width={width}
        height={share}
        rx="4"
        fill={gold}
      />
      <rect
        x={x}
        y={base - height}
        width={width}
        height={height}
        rx="4"
        fill="none"
        stroke={ink}
        strokeWidth="2.5"
      />
    </>
  );
}

export const c06Covers: Readonly<Record<ActivityStep, Cover>> = {
  /* Readiness: two pay agreements side by side over the same sales. */
  prepare: {
    top: "#e0e3f3",
    bottom: "#aab2da",
    ink: "#1e2552",
    art: (
      <>
        <g transform="rotate(-5 90 224)">
          <rect x="40" y="166" width="100" height="116" rx="8" fill="#fbfaff" />
          <rect x="54" y="180" width="54" height="9" rx="4.5" fill="#1e2552" />
          {/* salary plus commission: a fixed block and a small share */}
          <rect x="54" y="222" width="72" height="26" rx="5" fill="#5b64a8" />
          <rect x="54" y="254" width="30" height="14" rx="4" fill={gold} />
          <rect x="54" y="198" width="60" height="6" rx="3" fill="#c8cbe6" />
        </g>
        <g transform="rotate(5 210 224)">
          <rect
            x="160"
            y="166"
            width="100"
            height="116"
            rx="8"
            fill="#fbfaff"
          />
          <rect x="174" y="180" width="54" height="9" rx="4.5" fill="#1e2552" />
          {/* straight commission: the share alone */}
          <rect x="174" y="222" width="72" height="46" rx="5" fill={gold} />
          <rect x="174" y="198" width="60" height="6" rx="3" fill="#c8cbe6" />
        </g>
        {[0, 1].map((side) =>
          [26, 44, 34].map((h, i) => (
            <rect
              key={`${side}-${i}`}
              x={52 + side * 124 + i * 26}
              y={356 - h}
              width="18"
              height={h}
              rx="3"
              fill="#1e2552"
            />
          )),
        )}
        <path
          d="M140 330 h20 M140 340 h20"
          stroke="#1e2552"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="36"
          y1="360"
          x2="264"
          y2="360"
          stroke="#1e2552"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  /* Discovery: one agreement, its rate fixed on the dial, while sales rise
     and the commission share grows with them. */
  explore: {
    top: "#e7e5f4",
    bottom: "#c2bee3",
    ink: "#24204f",
    art: (
      <>
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={i}
            x1="0"
            y1={176 + i * 30}
            x2="300"
            y2={176 + i * 30}
            stroke="#24204f"
            strokeOpacity="0.1"
          />
        ))}
        <RateDial
          cx={78}
          cy={198}
          r={34}
          share={0.15}
          ink="#24204f"
          face="#fbfaff"
        />
        {[54, 86, 118, 150].map((h, i) => (
          <SalesBar
            key={i}
            x={124 + i * 38}
            base={358}
            height={h}
            width={28}
            fill="#6a62b3"
            ink="#24204f"
          />
        ))}
        <path
          d="M118 286 C 160 270, 220 224, 262 196"
          fill="none"
          stroke="#24204f"
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        <path
          d="M250 194 l14 1 -6 13"
          fill="none"
          stroke="#24204f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="30"
          y1="360"
          x2="276"
          y2="360"
          stroke="#24204f"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  /* Problem solving: a property sale closes, and a share of the price
     becomes the agent's commission. */
  apply: {
    top: "#2c3371",
    bottom: "#191d47",
    ink: "#f3f0ff",
    art: (
      <>
        <RateDial
          cx={236}
          cy={194}
          r={30}
          share={0.2}
          ink="#f3f0ff"
          face="#3c4488"
        />
        <path d="M52 254 L124 194 L196 254 Z" fill="#e5714f" />
        <rect x="66" y="250" width="116" height="96" fill="#f3f0ff" />
        <rect x="110" y="292" width="28" height="54" rx="3" fill="#2c3371" />
        <rect x="80" y="266" width="22" height="20" rx="2" fill="#9ba3dc" />
        <rect x="146" y="266" width="22" height="20" rx="2" fill="#9ba3dc" />
        {/* sold sign */}
        <line
          x1="236"
          y1="252"
          x2="236"
          y2="346"
          stroke="#f3f0ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="206"
          y1="262"
          x2="262"
          y2="262"
          stroke="#f3f0ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="204" y="272" width="62" height="32" rx="5" fill={gold} />
        <text
          x="235"
          y="294"
          textAnchor="middle"
          fill="#191d47"
          fontFamily="Lexend, sans-serif"
          fontSize="15"
          fontWeight="700"
          letterSpacing="2"
        >
          SOLD
        </text>
        <line
          x1="30"
          y1="346"
          x2="276"
          y2="346"
          stroke="#f3f0ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  /* Reflection and transfer: a familiar relationship on a new pay record,
     salary and commission doing different jobs, carried into a new month. */
  transfer: {
    top: "#dadcf0",
    bottom: "#9ea7d6",
    ink: "#1c2350",
    art: (
      <>
        <g transform="rotate(-4 120 264)">
          <rect x="44" y="172" width="152" height="184" rx="8" fill="#fbfaff" />
          <rect x="60" y="188" width="70" height="10" rx="5" fill="#1c2350" />
          {[0, 1, 2].map((i) => (
            <line
              key={i}
              x1="60"
              y1={216 + i * 16}
              x2={i === 1 ? 150 : 178}
              y2={216 + i * 16}
              stroke="#c8cbe6"
              strokeWidth="3"
            />
          ))}
          {/* the pay split into the two jobs it does */}
          <rect x="60" y="280" width="74" height="28" rx="5" fill="#4a539e" />
          <rect x="134" y="280" width="46" height="28" rx="5" fill={gold} />
          <line
            x1="60"
            y1="326"
            x2="180"
            y2="326"
            stroke="#1c2350"
            strokeWidth="3.5"
          />
        </g>
        <path
          d="M196 230 C 226 214, 246 226, 244 252"
          fill="none"
          stroke="#1c2350"
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        <path
          d="M236 244 l8 12 8 -12"
          fill="none"
          stroke="#1c2350"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="rotate(6 244 300)">
          <rect x="214" y="264" width="62" height="70" rx="6" fill="#fbfaff" />
          <rect x="214" y="264" width="62" height="18" rx="6" fill="#1c2350" />
          <rect x="214" y="274" width="62" height="8" fill="#1c2350" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect
              key={i}
              x={222 + (i % 3) * 16}
              y={292 + Math.floor(i / 3) * 16}
              width="11"
              height="10"
              rx="2"
              fill={i === 0 ? gold : "#c8cbe6"}
            />
          ))}
        </g>
      </>
    ),
  },
};
