import e from "./explore.module.css";
export function ChoiceThumbnail({ id }: { id: string }) {
  const salary = ["AGREEMENT", "ALL_PAY", "SALARY", "SALARY_FIRST"].includes(
    id,
  );
  const rate = id === "RATE_GROWS";
  const sales = id === "SALES_PAY";
  return (
    <svg className={e.choiceThumbnail} viewBox="0 0 120 72" aria-hidden="true">
      {rate ? (
        <>
          <text x="10" y="33" fontSize="22">
            3%
          </text>
          <path d="m52 26 15 0m-5-5 5 5-5 5" stroke="#987735" fill="none" />
          <text x="77" y="33" fontSize="22">
            ?%
          </text>
        </>
      ) : sales ? (
        <>
          <rect
            x="10"
            y="12"
            width="36"
            height="45"
            fill="#dfe7d2"
            stroke="#879a6b"
          />
          <text x="17" y="40" fontSize="24">
            ₱
          </text>
          <path d="M52 34h21m-6-5 6 5-6 5" stroke="#987735" fill="none" />
          <circle cx="93" cy="34" r="16" fill="#efdeb4" />
          <text x="85" y="42" fontSize="23">
            ₱
          </text>
        </>
      ) : id === "SALARY_FIRST" ? (
        <>
          <text x="7" y="27" fontSize="12">
            Sales + salary
          </text>
          <path d="M20 37h70" stroke="#879a6b" />
          <text x="38" y="59" fontSize="18">
            × 3%
          </text>
        </>
      ) : id === "COMMISSION_FIRST" ? (
        <>
          <text x="8" y="23" fontSize="13">
            Sales × rate
          </text>
          <path d="M56 29v13m-5-5 5 5 5-5" stroke="#879a6b" fill="none" />
          <text x="7" y="60" fontSize="12">
            Commission + salary
          </text>
        </>
      ) : (
        <>
          {[0, 1].map((n) => (
            <g key={n} transform={`translate(8 ${12 + n * 28})`}>
              <rect
                width={salary && id !== "AGREEMENT" && n ? 60 : 40}
                height="17"
                rx="2"
                fill="#657d4f"
              />
              {id !== "COMMISSION_ONLY" && (
                <rect
                  x={salary && id !== "AGREEMENT" && n ? 60 : 40}
                  width={n ? 38 : 23}
                  height="17"
                  rx="2"
                  fill="#d7b25e"
                />
              )}
              {id === "COMMISSION_ONLY" && (
                <path d="m50 0 17 17m0-17L50 17" stroke="#987735" />
              )}
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
