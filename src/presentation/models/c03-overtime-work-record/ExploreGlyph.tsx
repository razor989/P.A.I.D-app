/** Fixed geometry avoids font-dependent alignment in A02 controls. */
export function ExploreGlyph({
  name,
}: {
  name:
    | "previous"
    | "next"
    | "play"
    | "pause"
    | "replay"
    | "close"
    | "day"
    | "rest"
    | "check";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "previous" ? (
        <path d="m14 6-6 6 6 6" />
      ) : name === "next" ? (
        <path d="m10 6 6 6-6 6" />
      ) : name === "play" ? (
        <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />
      ) : name === "pause" ? (
        <path d="M8 5v14M16 5v14" strokeWidth="3" />
      ) : name === "replay" ? (
        <>
          <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
        </>
      ) : name === "close" ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : name === "check" ? (
        <path d="m5 12 4 4L19 6" />
      ) : name === "rest" ? (
        <path d="M16 3A9 9 0 1 0 21 16 10 10 0 0 1 16 3Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l4 2" />
        </>
      )}
    </svg>
  );
}

/** One equal hour unit, reused in the work records and their inspection
 * miniatures. `n` numbers the hour within its record (1, 2, 3 …). The
 * former 6-unit "EXTRA HOUR" label was unreadable at every size; captions
 * beside each model say what the marks are. */
export function ExploreHourMark({ n = 1 }: { n?: number }) {
  return (
    <g>
      <rect
        x="-25"
        y="-24"
        width="50"
        height="48"
        rx="12"
        fill="#fff2dc"
        stroke="#b28248"
      />
      <path d="M-14-15h28" stroke="#d6ad5b" strokeWidth="2" />
      <circle cx="-12" cy="4" r="6.5" fill="none" stroke="#8b672c" />
      <path
        d="M-12 0v4l3 2"
        fill="none"
        stroke="#8b672c"
        strokeLinecap="round"
      />
      <text
        x={n > 9 ? 9 : 8}
        y="12"
        textAnchor="middle"
        fill="#493a22"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        fontSize={n > 9 ? 19 : 23}
      >
        {n}
      </text>
    </g>
  );
}
