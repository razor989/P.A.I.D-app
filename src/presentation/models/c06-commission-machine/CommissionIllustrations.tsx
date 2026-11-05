import styles from "./commission.module.css";

/** Pictures express situations and learner ideas, never calculate answers. */
export function SalesIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={styles.salesIllustration}
      viewBox="0 0 520 330"
      role="img"
      aria-label="Two workers with matching sales records and separate pay agreements"
    >
      <circle cx="260" cy="157" r="145" fill="#e8eddc" />
      <path d="M30 286h460" stroke="#879a6b" strokeWidth="3" />
      {[0, 1].map((n) => (
        <g key={n} transform={`translate(${n * 245 + 35} 20)`}>
          <circle cx="90" cy="66" r="28" fill={n ? "#b78d5e" : "#d2ad7b"} />
          <path d="M61 64q-2-39 30-32 30 1 28 35L96 47 72 69Z" fill="#35483c" />
          <path
            d="M42 163v-31q0-39 48-39t48 39v31"
            fill={n ? "#b99852" : "#68835c"}
          />
          <rect
            x="12"
            y="153"
            width="156"
            height="111"
            rx="8"
            fill="#fffdf7"
            stroke="#879a6b"
            strokeWidth="2"
          />
          <text
            x="90"
            y="179"
            textAnchor="middle"
            fill="#203c33"
            fontSize="18"
            fontFamily="Georgia"
          >
            Worker {n ? "B" : "A"}
          </text>
          <path d="M32 191h116" stroke="#bdc7b0" />
          <text x="90" y="216" textAnchor="middle" fill="#435432" fontSize="15">
            Matching sales
          </text>
          <g transform="translate(44 230)" fill="#e3eacb" stroke="#657d4f">
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={i * 23} width="17" height="17" rx="2" />
            ))}
          </g>
          {!compact && (
            <g transform="translate(122 65) rotate(8)">
              <rect
                width="65"
                height="77"
                rx="4"
                fill="#f4e7c6"
                stroke="#a28b57"
              />
              <path
                d="M12 17h40m-40 13h32m-32 13h40"
                stroke="#987735"
                strokeWidth="2"
              />
              {n === 1 && (
                <path
                  d="M22 60h24m-12-12v24"
                  stroke="#987735"
                  strokeWidth="3"
                />
              )}
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

export function IdeaIllustration({ idea }: { idea: string }) {
  return (
    <svg
      className={styles.thinkingPicture}
      viewBox="0 0 180 112"
      aria-hidden="true"
      focusable="false"
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
      {idea === "UNSURE" ? (
        <>
          <path
            d="M27 27h80v48H61L43 89V75H27Z"
            fill="#dce5cc"
            stroke="#657d4f"
          />
          <text x="66" y="63" textAnchor="middle" fontSize="33" fill="#435432">
            ?
          </text>
          <path
            d="M119 45h33m-33 13h25m-25 13h30"
            stroke="#987735"
            strokeWidth="3"
          />
        </>
      ) : idea === "AGREEMENTS" ? (
        <>
          {[24, 101].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="22"
                width="55"
                height="70"
                rx="4"
                fill={i ? "#efdeb4" : "#e1e7d2"}
                stroke="#879a6b"
              />
              <path
                d={`M${x + 10} 37h35m-35 12h25m-25 12h35`}
                stroke="#657d4f"
                strokeWidth="2"
              />
              {i === 1 && (
                <path
                  d={`M${x + 21} 76h15m-7-7v14`}
                  stroke="#987735"
                  strokeWidth="3"
                />
              )}
            </g>
          ))}
        </>
      ) : idea === "SALES" ? (
        <>
          <rect
            x="22"
            y="25"
            width="55"
            height="64"
            rx="5"
            fill="#e1e7d2"
            stroke="#657d4f"
          />
          <text x="49" y="63" textAnchor="middle" fontSize="27" fill="#435432">
            ₱
          </text>
          <path
            d="M89 55h23m-6-6 6 6-6 6"
            fill="none"
            stroke="#987735"
            strokeWidth="3"
          />
          <circle cx="139" cy="55" r="22" fill="#efdeb4" stroke="#987735" />
          <text x="139" y="64" textAnchor="middle" fontSize="26" fill="#785b27">
            ?
          </text>
        </>
      ) : (
        <>
          {[30, 108].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} 82V${idea === "DIFFERENT" && i ? 27 : 45}h37v${idea === "DIFFERENT" && i ? 55 : 37}Z`}
                fill={i ? "#efdeb4" : "#dce5cc"}
                stroke={i ? "#987735" : "#657d4f"}
                strokeWidth="2"
              />
              <text
                x={x + 18}
                y="99"
                textAnchor="middle"
                fontSize="13"
                fill="#435432"
              >
                {i ? "B" : "A"}
              </text>
            </g>
          ))}
          <text x="88" y="64" textAnchor="middle" fontSize="23" fill="#785b27">
            {idea === "SAME" ? "=" : "≠"}
          </text>
        </>
      )}
    </svg>
  );
}

export function MomentIllustration({ moment }: { moment: number }) {
  return (
    <svg viewBox="0 0 160 90" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="158"
        height="88"
        rx="8"
        fill="#faf7eb"
        stroke="#b8c4a6"
      />
      {[17, 92].map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y="16"
            width="51"
            height="59"
            rx="4"
            fill={moment >= 2 && i ? "#efdeb4" : "#e1e7d2"}
            stroke="#879a6b"
          />
          <text
            x={x + 25}
            y="34"
            textAnchor="middle"
            fontSize="13"
            fill="#435432"
          >
            {i ? "B" : "A"}
          </text>
          {moment === 0 ? (
            <path
              d={`M${x + 10} 47h31m-31 10h31`}
              stroke="#657d4f"
              strokeWidth="4"
            />
          ) : (
            <text
              x={x + 25}
              y="60"
              textAnchor="middle"
              fontSize="19"
              fill="#785b27"
            >
              {moment === 1 ? "%" : i ? "+ ₱" : "₱"}
            </text>
          )}
        </g>
      ))}
      {moment === 3 && (
        <>
          <circle cx="81" cy="45" r="16" fill="#fffdf7" stroke="#987735" />
          <text x="81" y="53" textAnchor="middle" fontSize="24" fill="#785b27">
            ?
          </text>
        </>
      )}
    </svg>
  );
}

export function RelationshipDiagram({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 400 240" aria-hidden="true" focusable="false">
      {kind === "sales" ? (
        <>
          <g data-mini-piece>
            <rect
              x="18"
              y="30"
              width="165"
              height="160"
              rx="8"
              fill="#e1e7d2"
              stroke="#657d4f"
            />
            <text x="100" y="62" textAnchor="middle">
              SALES RECORD
            </text>
            <text x="100" y="109" textAnchor="middle" fontSize="35">
              ₱
            </text>
            <path d="M45 134h111m-111 18h85" stroke="#879a6b" strokeWidth="3" />
            <text x="100" y="176" textAnchor="middle" fontSize="14">
              Value of goods sold
            </text>
          </g>
          <g data-mini-piece>
            <path
              d="M204 105h33m-9-9 9 9-9 9"
              fill="none"
              stroke="#987735"
              strokeWidth="3"
            />
            <circle cx="307" cy="104" r="48" fill="#efdeb4" stroke="#987735" />
            <text x="307" y="115" textAnchor="middle" fontSize="33">
              ?
            </text>
            <text x="302" y="176" textAnchor="middle" fontSize="14">
              What the worker earns
            </text>
          </g>
          <text x="200" y="221" textAnchor="middle" fontSize="16">
            A sales record is not a pay statement.
          </text>
        </>
      ) : kind === "rate" || kind === "commission" ? (
        <>
          <text x="200" y="25" textAnchor="middle" fontSize="17">
            5% means 5 for every 100
          </text>
          <g data-mini-piece>
            {Array.from({ length: 100 }, (_, i) => (
              <rect
                key={i}
                x={27 + (i % 10) * 14}
                y={47 + Math.floor(i / 10) * 14}
                width="11"
                height="11"
                rx="1"
                fill={i < 5 ? "#b8954d" : "#e1e7d2"}
                stroke="#879a6b"
                strokeWidth=".5"
              />
            ))}
          </g>
          <g data-mini-piece>
            <path
              d="M183 112h40m-9-9 9 9-9 9"
              fill="none"
              stroke="#987735"
              strokeWidth="3"
            />
            <rect
              x="239"
              y="65"
              width="138"
              height="101"
              rx="9"
              fill="#efdeb4"
              stroke="#987735"
            />
            <text x="308" y="99" textAnchor="middle" fontSize="17">
              Commission
            </text>
            <text x="308" y="128" textAnchor="middle" fontSize="14">
              Pay linked to sales
            </text>
          </g>
          <text x="200" y="217" textAnchor="middle" fontSize="15">
            The rate applies to Sales, not a fixed salary.
          </text>
        </>
      ) : (
        <>
          <text x="200" y="25" textAnchor="middle" fontSize="17">
            Two agreements. Different promises.
          </text>
          {[20, 220].map((x, i) => (
            <g key={x} data-mini-piece>
              <rect
                x={x}
                y="45"
                width="160"
                height="150"
                rx="8"
                fill={i ? "#f1e7c9" : "#e1e7d2"}
                stroke={i ? "#987735" : "#657d4f"}
              />
              <text x={x + 80} y="73" textAnchor="middle" fontSize="18">
                Worker {i ? "B" : "A"}
              </text>
              <rect
                x={x + 17}
                y="88"
                width="126"
                height="38"
                rx="5"
                fill="#fffdf7"
                stroke="#879a6b"
              />
              <text x={x + 80} y="112" textAnchor="middle" fontSize="16">
                Commission
              </text>
              {i === 1 ? (
                <>
                  <text x={x + 80} y="146" textAnchor="middle" fontSize="24">
                    +
                  </text>
                  <text x={x + 80} y="175" textAnchor="middle" fontSize="16">
                    Fixed monthly salary
                  </text>
                </>
              ) : (
                <text x={x + 80} y="165" textAnchor="middle" fontSize="16">
                  Ends here
                </text>
              )}
            </g>
          ))}
          <text x="200" y="222" textAnchor="middle" fontSize="15">
            A separate salary promise—not more sales.
          </text>
        </>
      )}
    </svg>
  );
}
