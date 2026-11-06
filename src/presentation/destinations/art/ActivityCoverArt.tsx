import { useId } from "react";
import type { CompetencyId } from "@/core/public";
import type { ActivityStep } from "../content";
import type { Cover, CoverSet } from "./cover";
import { c03Covers } from "./C03Covers";
import { c06Covers } from "./C06Covers";

/** Original "book cover" artwork for the four activity steps of each offered
 * competency. Decorative: the gallery caption and panel carry the accessible
 * meaning. */
export function ActivityCoverArt({
  competency,
  step,
  number,
  title,
  className,
}: Readonly<{
  competency?: CompetencyId | undefined;
  step: ActivityStep;
  number: string;
  title: string;
  className?: string | undefined;
}>) {
  const g = useId();
  const set = (competency && coverSets[competency]) || coverSets.C04;
  const palette = set.covers[step];
  const lines = splitTitle(title);
  return (
    <svg
      className={className}
      viewBox="0 0 300 400"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${g}-bg`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={palette.top} />
          <stop offset="1" stopColor={palette.bottom} />
        </linearGradient>
        <linearGradient id={`${g}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill={`url(#${g}-bg)`} />
      <g>{palette.art}</g>
      {/* typographic cover block */}
      <text
        x="24"
        y="44"
        fill={palette.ink}
        fontFamily="Lexend, sans-serif"
        fontSize="13"
        letterSpacing="3"
        fontWeight="600"
      >
        {`ACTIVITY ${number}`}
      </text>
      <line
        x1="24"
        y1="56"
        x2="64"
        y2="56"
        stroke={palette.ink}
        strokeWidth="2"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x="24"
          y={96 + i * 36}
          fill={palette.ink}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="34"
          letterSpacing="-1"
        >
          {line}
        </text>
      ))}
      <text
        x="24"
        y="380"
        fill={palette.ink}
        fontFamily="Lexend, sans-serif"
        fontSize="11"
        letterSpacing="2.5"
        opacity="0.8"
      >
        {`P.A.I.D. · ${set.footer}`}
      </text>
      <rect width="16" height="400" fill={`url(#${g}-spine)`} />
    </svg>
  );
}

function splitTitle(title: string) {
  if (title === "Explore and Learn") return ["Explore", "and Learn"];
  if (title === "Check and Transfer") return ["Check and", "Transfer"];
  return [title];
}

const c04Covers: Readonly<Record<ActivityStep, Cover>> = {
  /* Readiness: a sun rising over a ruled starting page, with the dashed
     starting line every later comparison returns to. */
  prepare: {
    top: "#f6dcc0",
    bottom: "#e79f74",
    ink: "#4a2414",
    art: (
      <>
        <circle cx="168" cy="262" r="74" fill="#f8c25c" />
        {[-60, -30, 0, 30, 60].map((deg) => (
          <line
            key={deg}
            x1="168"
            y1="262"
            x2={168 + Math.sin((deg * Math.PI) / 180) * 120}
            y2={262 - Math.cos((deg * Math.PI) / 180) * 120}
            stroke="#fff3df"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="2 16"
          />
        ))}
        <rect x="0" y="262" width="300" height="138" fill="#c96a43" />
        <g transform="rotate(-7 150 318)">
          <rect x="62" y="270" width="176" height="96" rx="6" fill="#fff8ef" />
          {[0, 1, 2].map((i) => (
            <line
              key={i}
              x1="78"
              y1={296 + i * 20}
              x2="222"
              y2={296 + i * 20}
              stroke="#e4b89a"
              strokeWidth="2.5"
            />
          ))}
          <line
            x1="78"
            y1="296"
            x2="150"
            y2="296"
            stroke="#4a2414"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="62"
            y1="336"
            x2="238"
            y2="336"
            stroke="#4a2414"
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
          <g transform="rotate(-38 220 300)">
            <rect
              x="176"
              y="292"
              width="74"
              height="12"
              rx="3"
              fill="#2f6b4f"
            />
            <path d="M250 292 l14 6 -14 6 Z" fill="#4a2414" />
          </g>
        </g>
      </>
    ),
  },
  /* Discovery: the original salary bar, the added change in gold, and a
     lens on exactly where the reference ends. */
  explore: {
    top: "#e3ead6",
    bottom: "#b9c9a0",
    ink: "#1f3d30",
    art: (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1="0"
            y1={170 + i * 28}
            x2="300"
            y2={170 + i * 28}
            stroke="#1f3d30"
            strokeOpacity="0.1"
          />
        ))}
        <rect
          x="48"
          y="246"
          width="70"
          height="114"
          rx="6"
          fill="#879d65"
          stroke="#1f3d30"
          strokeWidth="3"
        />
        <rect x="150" y="246" width="70" height="114" rx="6" fill="#879d65" />
        <rect x="150" y="196" width="70" height="54" rx="6" fill="#d8ac4d" />
        <rect
          x="150"
          y="196"
          width="70"
          height="164"
          rx="6"
          fill="none"
          stroke="#1f3d30"
          strokeWidth="3"
        />
        <line
          x1="36"
          y1="246"
          x2="250"
          y2="246"
          stroke="#1f3d30"
          strokeWidth="2.5"
          strokeDasharray="6 5"
        />
        <line
          x1="30"
          y1="360"
          x2="270"
          y2="360"
          stroke="#1f3d30"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx="214"
          cy="236"
          r="38"
          fill="#fbf7ef"
          fillOpacity="0.45"
          stroke="#1f3d30"
          strokeWidth="6"
        />
        <line
          x1="242"
          y1="264"
          x2="272"
          y2="296"
          stroke="#1f3d30"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </>
    ),
  },
  /* Problem solving: two salary offers, a worked comparison between them,
     and a decision marked in ink. */
  apply: {
    top: "#2f5f6f",
    bottom: "#1d3c49",
    ink: "#f7f1e3",
    art: (
      <>
        <g transform="rotate(-6 100 270)">
          <rect
            x="34"
            y="196"
            width="118"
            height="150"
            rx="10"
            fill="#f7f1e3"
          />
          <rect x="50" y="216" width="56" height="10" rx="5" fill="#2f5f6f" />
          <rect x="50" y="300" width="86" height="28" rx="6" fill="#879d65" />
          <rect x="50" y="242" width="70" height="7" rx="3.5" fill="#b8c6c9" />
          <rect x="50" y="258" width="52" height="7" rx="3.5" fill="#b8c6c9" />
        </g>
        <g transform="rotate(5 220 268)">
          <rect
            x="160"
            y="186"
            width="118"
            height="150"
            rx="10"
            fill="#f7f1e3"
          />
          <rect x="176" y="206" width="56" height="10" rx="5" fill="#2f5f6f" />
          <rect x="176" y="282" width="86" height="36" rx="6" fill="#d8ac4d" />
          <rect x="176" y="232" width="70" height="7" rx="3.5" fill="#b8c6c9" />
          <rect x="176" y="248" width="52" height="7" rx="3.5" fill="#b8c6c9" />
          <circle
            cx="252"
            cy="208"
            r="16"
            fill="none"
            stroke="#e5714f"
            strokeWidth="4"
          />
          <path
            d="M244 208 l6 6 11 -12"
            fill="none"
            stroke="#e5714f"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <path
          d="M128 172 C 150 150, 176 150, 196 166"
          fill="none"
          stroke="#f8c25c"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M186 156 l12 10 -15 4"
          fill="none"
          stroke="#f8c25c"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  /* Reflection and transfer: one check at the centre, carried along a
     path to three new situations — a price, a bill, and a fresh start. */
  transfer: {
    top: "#f1d58f",
    bottom: "#d9a441",
    ink: "#3a2a0c",
    art: (
      <>
        <path
          d="M60 330 C 40 260, 120 250, 150 236 S 250 200, 240 150"
          fill="none"
          stroke="#3a2a0c"
          strokeWidth="3"
          strokeDasharray="7 7"
        />
        <circle
          cx="150"
          cy="246"
          r="44"
          fill="#fbf7ef"
          stroke="#3a2a0c"
          strokeWidth="5"
        />
        <path
          d="M128 246 l15 15 30 -32"
          fill="none"
          stroke="#2f6b4f"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* price tag */}
        <g transform="rotate(-18 62 330)">
          <path
            d="M36 316 h40 l14 14 -14 14 h-40 Z"
            fill="#fbf7ef"
            stroke="#3a2a0c"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <circle cx="76" cy="330" r="4" fill="#3a2a0c" />
        </g>
        {/* bill */}
        <g transform="rotate(8 244 148)">
          <rect
            x="222"
            y="118"
            width="44"
            height="58"
            rx="4"
            fill="#fbf7ef"
            stroke="#3a2a0c"
            strokeWidth="3.5"
          />
          <line
            x1="230"
            y1="134"
            x2="258"
            y2="134"
            stroke="#3a2a0c"
            strokeWidth="3"
          />
          <line
            x1="230"
            y1="146"
            x2="250"
            y2="146"
            stroke="#3a2a0c"
            strokeWidth="3"
          />
          <line
            x1="230"
            y1="160"
            x2="258"
            y2="160"
            stroke="#c96a43"
            strokeWidth="4"
          />
        </g>
        {/* fresh start: a seedling from zero */}
        <g>
          <line
            x1="226"
            y1="356"
            x2="282"
            y2="356"
            stroke="#3a2a0c"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M254 356 v-34"
            stroke="#2f6b4f"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M254 334 c -18 -2 -22 -16 -20 -22 c 12 0 20 8 20 22 Z"
            fill="#2f6b4f"
          />
          <path
            d="M254 326 c 16 -2 20 -14 18 -20 c -11 0 -18 7 -18 20 Z"
            fill="#879d65"
          />
        </g>
      </>
    ),
  },
};

const coverSets: Partial<Readonly<Record<CompetencyId, CoverSet>>> & {
  C04: CoverSet;
} = {
  C03: { footer: "OVERTIME PAY", covers: c03Covers },
  C04: { footer: "PERCENTAGE CHANGE", covers: c04Covers },
  C06: { footer: "COMMISSION", covers: c06Covers },
};
