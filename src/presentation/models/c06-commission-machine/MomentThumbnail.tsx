import e from "./explore.module.css";

/** Small relationship diagrams, not scaled-down screenshots or answer controls. */
export function MomentThumbnail({
  stage,
  moment,
}: {
  stage: number;
  moment: number;
}) {
  const kind =
    stage === 0
      ? ["agreement", "salary", "rate"][moment]
      : stage === 1
        ? ["sales", "share", "multiply"][moment]
        : stage === 2 || stage === 3
          ? ["sales", "multiply", "combine"][moment]
          : stage === 4
            ? ["agreement", "compare", "combine"][moment]
            : ["multiply", "combine", "compare"][moment];
  return (
    <svg className={e.momentThumbnail} viewBox="0 0 120 72" aria-hidden="true">
      {kind === "agreement" || kind === "sales" ? (
        <>
          <rect
            x="24"
            y="6"
            width="72"
            height="60"
            rx="5"
            fill="#fffdf7"
            stroke="#879a6b"
          />
          <path d="M36 18h48M36 25h32" stroke="#879a6b" strokeWidth="3" />
          <text x="60" y="47" textAnchor="middle" fontSize="13" fill="#203c33">
            {kind === "agreement" ? "Salary + 3%" : "Sales record"}
          </text>
          <path d="M36 56h48" stroke="#d7b25e" strokeWidth="4" />
        </>
      ) : kind === "rate" || kind === "share" ? (
        <>
          {Array.from({ length: 100 }, (_, i) => (
            <rect
              key={i}
              x={31 + (i % 10) * 6}
              y={3 + Math.floor(i / 10) * 5}
              width="4"
              height="3"
              fill={i < 3 ? "#987735" : "#dfe7d2"}
            />
          ))}
          <text x="60" y="66" textAnchor="middle" fontSize="13" fill="#203c33">
            3 in every 100
          </text>
        </>
      ) : kind === "multiply" ? (
        <>
          <text x="60" y="23" textAnchor="middle" fontSize="14" fill="#203c33">
            Sales × 3%
          </text>
          <path
            d="M60 30v12m-5-5 5 5 5-5"
            stroke="#987735"
            fill="none"
            strokeWidth="2"
          />
          <rect x="17" y="48" width="86" height="20" rx="4" fill="#efdeb4" />
          <text x="60" y="62" textAnchor="middle" fontSize="12" fill="#203c33">
            Commission
          </text>
        </>
      ) : (
        <>
          {[0, 1].map((row) => (
            <g key={row} transform={`translate(12 ${12 + row * 28})`}>
              <rect width="43" height="18" rx="2" fill="#657d4f" />
              {kind !== "salary" && (
                <rect
                  x="43"
                  width={row ? 48 : 28}
                  height="18"
                  rx="2"
                  fill="#d7b25e"
                />
              )}
            </g>
          ))}
          {kind === "combine" && (
            <text
              x="60"
              y="38"
              textAnchor="middle"
              fontSize="14"
              fill="#203c33"
            >
              +
            </text>
          )}
        </>
      )}
    </svg>
  );
}
