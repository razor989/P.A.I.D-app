import styles from "./unfinished.module.css";

export type ArtWorld = Readonly<{
  world: string;
  deep: string;
  soft: string;
  wash: string;
}>;

const ink = "#203c33";
const paper = "#fffaf0";
const clay = "#a8492a";
const gold = "#d8ac4d";
const indigo = "#3f4f8f";

/** Original P.A.I.D. illustration of unfinished learning: an open workbook
 * marked with a ribbon, a bar model only partly built, a progress path paused
 * midway and a pencil set down across the gutter. Decorative only. */
export function UnfinishedWorkArt({ world }: { world: ArtWorld }) {
  return (
    <svg
      className={styles.artSvg}
      viewBox="0 0 480 250"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="480" height="250" fill={world.soft} />
      <circle cx="92" cy="74" r="58" fill={world.wash} opacity="0.85" />
      <circle cx="404" cy="92" r="66" fill="#f5e6bf" opacity="0.75" />
      <path
        d="M0 206 C 120 186 360 186 480 206 V 250 H 0 Z"
        fill={world.wash}
      />

      {/* Loose maths tiles, drifting. */}
      <g className={styles.drift}>
        <g transform="translate(66 128) rotate(-12)">
          <rect x="-19" y="-19" width="38" height="38" rx="7" fill={indigo} />
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="24"
            fontWeight="700"
            fill="#fff"
          >
            %
          </text>
        </g>
      </g>
      <g className={styles.driftSlow}>
        <path d="M392 46 L418 88 L366 88 Z" fill={clay} />
        <rect
          x="404"
          y="132"
          width="26"
          height="26"
          rx="4"
          fill={gold}
          transform="rotate(14 417 145)"
        />
      </g>
      <g className={styles.drift}>
        <path
          d="M128 52 v18 M119 61 h18"
          stroke={world.world}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="350" cy="40" r="6" fill={world.world} opacity="0.7" />
      </g>

      {/* The workbook. */}
      <g transform="translate(240 206)">
        <ellipse
          cx="0"
          cy="6"
          rx="156"
          ry="11"
          fill={world.deep}
          opacity="0.16"
        />
        {/* Cover peeking beneath the pages. */}
        <path
          d="M-162 2 L-150 -122 C -100 -138 -40 -136 0 -120 C 40 -136 100 -138 150 -122 L 162 2 C 110 -14 40 -12 0 8 C -40 -12 -110 -14 -162 2 Z"
          fill={world.world}
          stroke={ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Left page. */}
        <path
          d="M-4 -2 C -50 -20 -108 -18 -150 -4 L -140 -118 C -98 -132 -44 -130 -4 -114 Z"
          fill={paper}
          stroke={ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Right page. */}
        <path
          d="M4 -2 C 50 -20 108 -18 150 -4 L 140 -118 C 98 -132 44 -130 4 -114 Z"
          fill={paper}
          stroke={ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M0 -116 V 4" stroke={ink} strokeWidth="2" opacity="0.5" />

        {/* Left page: ruled notes and a bar model, its last bar unfinished. */}
        <g stroke="#c9bfa8" strokeWidth="4" strokeLinecap="round">
          <path d="M-126 -100 L-62 -108" />
          <path d="M-124 -86 L-80 -92" />
        </g>
        <path d="M-128 -18 L-26 -28" stroke={ink} strokeWidth="2.5" />
        <rect x="-118" y="-50" width="20" height="30" fill={world.world} />
        <rect x="-90" y="-66" width="20" height="44" fill={world.world} />
        <rect
          x="-62"
          y="-82"
          width="20"
          height="58"
          fill="none"
          stroke={world.world}
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
        <rect
          x="-62"
          y="-44"
          width="20"
          height="20"
          fill={world.world}
          opacity="0.55"
        />

        {/* Right page: a path taken so far, paused, and the rest still to go. */}
        <path
          d="M22 -26 C 42 -40 56 -58 76 -64"
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M76 -64 C 96 -70 108 -86 124 -98"
          fill="none"
          stroke={ink}
          strokeWidth="2.5"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <circle cx="22" cy="-26" r="5" fill={ink} />
        <g transform="translate(76 -64)">
          <circle r="11" fill={gold} stroke={ink} strokeWidth="2.5" />
          <path
            d="M-3 -4.5 V 4.5 M3 -4.5 V 4.5"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M124 -98 V -116 L 136 -112 L 124 -107"
          fill={clay}
          stroke={ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Ribbon bookmark, marking the place to come back to. */}
        <path
          d="M98 -128 H 116 V -62 L 107 -72 L 98 -62 Z"
          fill={clay}
          stroke={ink}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Pencil, set down across the gutter. */}
        <g transform="translate(-30 -40) rotate(-24)">
          <rect
            x="0"
            y="-6"
            width="72"
            height="12"
            rx="2"
            fill={gold}
            stroke={ink}
            strokeWidth="2.5"
          />
          <rect
            x="-10"
            y="-6"
            width="12"
            height="12"
            rx="2"
            fill="#e7a6a0"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path
            d="M72 -6 L 90 0 L 72 6 Z"
            fill="#f2ddb0"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M84 -2 L 90 0 L 84 2 Z" fill={ink} />
        </g>
      </g>
    </svg>
  );
}
