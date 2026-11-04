import styles from "./work-record.module.css";

/** Pictures express a learner's idea, never an evaluated result. Text stays canonical. */
export function ThinkingIllustration({ idea }: { idea: string }) {
  const uncertain =
    idea === "c03-a01-not-sure" || idea === "c03-a01-compare-ideas";
  const day = idea === "c03-a01-day-matters" || idea === "c03-a01-depends";
  const hours = idea === "c03-a01-count-hours";
  const higher = idea === "c03-a01-extra-rate";
  const start = idea === "c03-a01-where-start";
  return (
    <svg
      className={styles.thinkingPicture}
      viewBox="0 0 180 112"
      aria-hidden="true"
      focusable="false"
      data-idea={idea}
    >
      <rect
        x="4"
        y="4"
        width="172"
        height="104"
        rx="12"
        fill="#f4f0df"
        stroke="#b8c4a6"
      />
      {uncertain ? (
        <>
          <path
            d="M23 25h64v43H53L38 81V68H23z"
            fill="#dce5cc"
            stroke="#53683d"
          />
          <path
            d="M96 41h58v39h-12v13l-17-13H96z"
            fill="#efdeb4"
            stroke="#987735"
          />
          <text x="56" y="56" textAnchor="middle" fontSize="30" fill="#435432">
            ?
          </text>
          <path d="M108 54h33m-33 10h23" stroke="#987735" strokeWidth="3" />
        </>
      ) : day ? (
        <>
          <rect
            x="23"
            y="25"
            width="58"
            height="62"
            rx="5"
            fill="#e1e7d2"
            stroke="#53683d"
          />
          <rect
            x="101"
            y="25"
            width="58"
            height="62"
            rx="5"
            fill="#efdeb4"
            stroke="#987735"
          />
          <path
            d="M23 42h58m20 0h58M37 18v16m30-16v16m48-16v16m30-16v16"
            stroke="#53683d"
            strokeWidth="3"
          />
          <text x="52" y="73" textAnchor="middle" fontSize="24" fill="#435432">
            ?
          </text>
          <text x="130" y="73" textAnchor="middle" fontSize="24" fill="#856329">
            ?
          </text>
        </>
      ) : hours ? (
        <>
          {[35, 95].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="25"
                width="48"
                height="53"
                rx="5"
                fill="#efdeb4"
                stroke="#987735"
              />
              <text
                x={x + 24}
                y="59"
                textAnchor="middle"
                fontSize="23"
                fill="#785b27"
              >
                +1
              </text>
            </g>
          ))}
          <path
            d="M35 85v7h108v-7"
            fill="none"
            stroke="#987735"
            strokeWidth="2"
          />
        </>
      ) : start ? (
        <>
          <circle cx="36" cy="75" r="13" fill="#dce5cc" stroke="#53683d" />
          <path
            d="M49 75h39V39h40"
            fill="none"
            stroke="#53683d"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
          <path
            d="m121 31 10 8-10 8"
            fill="none"
            stroke="#53683d"
            strokeWidth="3"
          />
          <text x="145" y="49" textAnchor="middle" fontSize="32" fill="#856329">
            ?
          </text>
        </>
      ) : (
        <>
          <rect
            x="20"
            y="31"
            width="46"
            height="49"
            rx="5"
            fill="#dce5cc"
            stroke="#53683d"
          />
          <text x="43" y="62" textAnchor="middle" fontSize="20" fill="#435432">
            1h
          </text>
          <path
            d="M73 55h28m-7-6 7 6-7 6"
            fill="none"
            stroke="#53683d"
            strokeWidth="2"
          />
          <rect
            x="108"
            y={higher ? 22 : 31}
            width="50"
            height={higher ? 58 : 49}
            rx="5"
            fill="#efdeb4"
            stroke="#987735"
          />
          <text x="133" y="63" textAnchor="middle" fontSize="25" fill="#785b27">
            {idea === "c03-a01-rate-rule" ? "?" : "₱"}
          </text>
          {higher && (
            <path
              d="M133 15V7m-4 4 4-4 4 4"
              fill="none"
              stroke="#987735"
              strokeWidth="2"
            />
          )}
        </>
      )}
    </svg>
  );
}
