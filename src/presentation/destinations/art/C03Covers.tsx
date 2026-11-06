import type { ActivityStep } from "../content";
import type { Cover } from "./cover";

/** C03 Overtime Pay covers: time and earnings. Original, decorative artwork
 * drawn in the shared 300×400 cover frame. */

/** Point on a clock face, `deg` measured clockwise from twelve o'clock. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as const;
}

function ClockFace({
  cx,
  cy,
  r,
  ink,
  face,
  hour,
}: Readonly<{
  cx: number;
  cy: number;
  r: number;
  ink: string;
  face: string;
  hour: number;
}>) {
  const [hx, hy] = polar(cx, cy, r * 0.5, hour * 30);
  const [mx, my] = polar(cx, cy, r * 0.75, 0);
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={face} stroke={ink} strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(cx, cy, r * 0.8, i * 30);
        const [x2, y2] = polar(cx, cy, r * 0.92, i * 30);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={ink}
            strokeWidth={i % 3 === 0 ? 4 : 2}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={hx}
        y2={hy}
        stroke={ink}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={mx}
        y2={my}
        stroke={ink}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="5" fill={ink} />
    </>
  );
}

/** The two extra hours, from eight to ten, as a sector of the clock face. */
function extraHours(cx: number, cy: number, r: number) {
  const [x1, y1] = polar(cx, cy, r, 240);
  const [x2, y2] = polar(cx, cy, r, 300);
  return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function HourBlocks({
  x,
  y,
  regular,
  extra,
  regularFill,
  extraFill,
  ink,
}: Readonly<{
  x: number;
  y: number;
  regular: number;
  extra: number;
  regularFill: string;
  extraFill: string;
  ink: string;
}>) {
  return (
    <>
      {Array.from({ length: regular + extra }, (_, i) => (
        <rect
          key={i}
          x={x + i * 21}
          y={y}
          width="17"
          height="16"
          rx="3"
          fill={i < regular ? regularFill : extraFill}
          stroke={i < regular ? "none" : ink}
          strokeWidth="2"
        />
      ))}
    </>
  );
}

function CoinStack({
  x,
  base,
  count,
  ink,
}: Readonly<{ x: number; base: number; count: number; ink: string }>) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={base - i * 9}
          rx="22"
          ry="7"
          fill="#f2c45a"
          stroke={ink}
          strokeWidth="2.5"
        />
      ))}
    </>
  );
}

export const c03Covers: Readonly<Record<ActivityStep, Cover>> = {
  /* Readiness: the regular day ends at eight hours on the clock, and two
     extra hours stand out on the work record below. */
  prepare: {
    top: "#f4d6bd",
    bottom: "#dc9068",
    ink: "#4a2414",
    art: (
      <>
        <circle cx="150" cy="232" r="96" fill="#f8c25c" fillOpacity="0.35" />
        <ClockFace
          cx={150}
          cy={232}
          r={70}
          ink="#4a2414"
          face="#fff8ef"
          hour={10}
        />
        <path d={extraHours(150, 232, 62)} fill="#e9a93a" fillOpacity="0.7" />
        <ClockFace
          cx={150}
          cy={232}
          r={70}
          ink="#4a2414"
          face="none"
          hour={10}
        />
        <g transform="rotate(-4 150 342)">
          <rect x="38" y="318" width="224" height="44" rx="7" fill="#fff8ef" />
          <HourBlocks
            x={47}
            y={332}
            regular={8}
            extra={2}
            regularFill="#c96a43"
            extraFill="#f2c45a"
            ink="#4a2414"
          />
        </g>
      </>
    ),
  },
  /* Discovery: the same two hours on two kinds of day, paid differently. */
  explore: {
    top: "#f3e6d2",
    bottom: "#e2bf93",
    ink: "#3f2412",
    art: (
      <>
        <g transform="rotate(-5 88 236)">
          <rect x="36" y="168" width="104" height="132" rx="8" fill="#fffaf2" />
          <rect x="36" y="168" width="104" height="26" rx="8" fill="#8b6b4e" />
          <rect x="36" y="184" width="104" height="10" fill="#8b6b4e" />
          <rect
            x="56"
            y="238"
            width="64"
            height="24"
            rx="5"
            fill="#f2c45a"
            stroke="#3f2412"
            strokeWidth="2.5"
          />
          <line
            x1="88"
            y1="238"
            x2="88"
            y2="262"
            stroke="#3f2412"
            strokeWidth="2.5"
          />
        </g>
        <g transform="rotate(5 212 236)">
          <rect
            x="160"
            y="168"
            width="104"
            height="132"
            rx="8"
            fill="#fffaf2"
          />
          <rect x="160" y="168" width="104" height="26" rx="8" fill="#c96a43" />
          <rect x="160" y="184" width="104" height="10" fill="#c96a43" />
          {/* rest day: a quiet crescent */}
          <path
            d="M232 206 a14 14 0 1 0 14 18 a11 11 0 1 1 -14 -18 Z"
            fill="#c96a43"
          />
          <rect
            x="180"
            y="238"
            width="64"
            height="24"
            rx="5"
            fill="#f2c45a"
            stroke="#3f2412"
            strokeWidth="2.5"
          />
          <line
            x1="212"
            y1="238"
            x2="212"
            y2="262"
            stroke="#3f2412"
            strokeWidth="2.5"
          />
        </g>
        <CoinStack x={88} base={354} count={3} ink="#3f2412" />
        <CoinStack x={212} base={354} count={5} ink="#3f2412" />
        <line
          x1="40"
          y1="364"
          x2="260"
          y2="364"
          stroke="#3f2412"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  /* Problem solving: a month of work records, the overtime days marked, and
     a worked tally beneath. */
  apply: {
    top: "#5c3123",
    bottom: "#391c13",
    ink: "#f7ecdf",
    art: (
      <>
        <g transform="rotate(-3 150 262)">
          <rect
            x="42"
            y="164"
            width="216"
            height="196"
            rx="10"
            fill="#f7ecdf"
          />
          <rect x="58" y="180" width="80" height="10" rx="5" fill="#5c3123" />
          {Array.from({ length: 28 }, (_, i) => {
            const marked = [3, 9, 10, 17, 24].includes(i);
            return (
              <rect
                key={i}
                x={58 + (i % 7) * 26}
                y={204 + Math.floor(i / 7) * 24}
                width="20"
                height="18"
                rx="3"
                fill={marked ? "#e9a93a" : "#e3cdb8"}
                stroke={marked ? "#5c3123" : "none"}
                strokeWidth="2"
              />
            );
          })}
          <line
            x1="58"
            y1="314"
            x2="204"
            y2="314"
            stroke="#b98d70"
            strokeWidth="3"
          />
          <line
            x1="58"
            y1="328"
            x2="168"
            y2="328"
            stroke="#b98d70"
            strokeWidth="3"
          />
          <line
            x1="58"
            y1="342"
            x2="240"
            y2="342"
            stroke="#5c3123"
            strokeWidth="3.5"
          />
          <rect x="214" y="312" width="28" height="22" rx="4" fill="#e9a93a" />
        </g>
        {/* pencil */}
        <g transform="rotate(38 252 196)">
          <rect x="242" y="128" width="16" height="92" rx="3" fill="#f2c45a" />
          <rect x="242" y="128" width="16" height="14" rx="3" fill="#e5714f" />
          <path d="M242 220 l8 18 8 -18 Z" fill="#f7ecdf" />
          <path d="M247 231 l3 7 3 -7 Z" fill="#391c13" />
        </g>
      </>
    ),
  },
  /* Reflection and transfer: the familiar clock carried along a path to a
     new kind of day, a regular holiday. */
  transfer: {
    top: "#f5dca8",
    bottom: "#e0a457",
    ink: "#3a2410",
    art: (
      <>
        <path
          d="M84 300 C 96 240, 150 250, 176 230 S 214 196, 222 186"
          fill="none"
          stroke="#3a2410"
          strokeWidth="3"
          strokeDasharray="7 7"
        />
        <ClockFace
          cx={78}
          cy={312}
          r={40}
          ink="#3a2410"
          face="#fff8ef"
          hour={10}
        />
        <g transform="rotate(6 222 232)">
          <rect
            x="170"
            y="186"
            width="104"
            height="120"
            rx="8"
            fill="#fff8ef"
          />
          <rect x="170" y="186" width="104" height="28" rx="8" fill="#b8432d" />
          <rect x="170" y="202" width="104" height="12" fill="#b8432d" />
          {/* holiday star */}
          <path
            d={Array.from({ length: 10 }, (_, i) => {
              const [x, y] = polar(222, 262, i % 2 === 0 ? 30 : 13, i * 36);
              return `${i === 0 ? "M" : "L"}${x} ${y}`;
            }).join(" ")}
            fill="#e9a93a"
            stroke="#3a2410"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
        {/* pennant */}
        <line
          x1="262"
          y1="150"
          x2="262"
          y2="196"
          stroke="#3a2410"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M262 152 l30 10 -30 10 Z" fill="#b8432d" />
      </>
    ),
  },
};
