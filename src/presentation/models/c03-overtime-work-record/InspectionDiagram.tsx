/** C03 evidence-only counterpart of C04's replayable mini explanation. */
export function InspectionDiagram({ rate }: { rate: string }) {
  return (
    <svg
      viewBox="0 0 320 140"
      aria-hidden="true"
      focusable="false"
      data-inspection-diagram
    >
      <g data-diagram="regular">
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            data-mini-piece
            x={16 + i * 36}
            y="33"
            width="30"
            height="44"
            rx="4"
            fill="#dce5cc"
            stroke="#53683d"
          />
        ))}
        <path
          d="M16 87v9h282v-9"
          fill="none"
          stroke="#53683d"
          strokeWidth="2"
        />
        <text x="160" y="121" textAnchor="middle" fill="#435432" fontSize="17">
          Eight regular hours
        </text>
      </g>
      <g data-diagram="extra" display="none">
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={12 + i * 24}
            y="35"
            width="19"
            height="42"
            rx="3"
            fill="#dce5cc"
            stroke="#53683d"
          />
        ))}
        <path d="M211 25v63" stroke="#987735" strokeDasharray="4 4" />
        {[230, 270].map((x) => (
          <g key={x} data-mini-piece>
            <rect
              x={x}
              y="35"
              width="32"
              height="42"
              rx="4"
              fill="#efdeb4"
              stroke="#987735"
            />
            <text
              x={x + 16}
              y="62"
              textAnchor="middle"
              fontSize="16"
              fill="#785b27"
            >
              +1
            </text>
          </g>
        ))}
        <text x="106" y="114" textAnchor="middle" fontSize="16" fill="#435432">
          Regular work
        </text>
        <text x="266" y="114" textAnchor="middle" fontSize="16" fill="#785b27">
          Two more
        </text>
      </g>
      <g data-diagram="rate" display="none">
        <rect
          x="22"
          y="25"
          width="72"
          height="62"
          rx="6"
          fill="#dce5cc"
          stroke="#53683d"
        />
        <text x="58" y="63" textAnchor="middle" fontSize="21" fill="#435432">
          1 hour
        </text>
        <path
          d="M105 56h39m-9-7 9 7-9 7"
          fill="none"
          stroke="#53683d"
          strokeWidth="2"
        />
        <g data-mini-piece>
          <rect
            x="158"
            y="25"
            width="142"
            height="62"
            rx="6"
            fill="#f8f6ea"
            stroke="#53683d"
          />
          <text x="229" y="63" textAnchor="middle" fontSize="23" fill="#435432">
            {rate}
          </text>
        </g>
        <text x="160" y="119" textAnchor="middle" fontSize="16" fill="#435432">
          Nico’s usual pay for a regular hour
        </text>
      </g>
      <g data-diagram="context" display="none">
        <rect
          x="25"
          y="23"
          width="75"
          height="80"
          rx="6"
          fill="#dce5cc"
          stroke="#53683d"
        />
        <path
          d="M25 44h75M43 15v19m38-19v19"
          stroke="#53683d"
          strokeWidth="3"
        />
        <circle cx="62" cy="73" r="14" fill="#f8f6ea" stroke="#53683d" />
        <path
          d="M111 65h35"
          stroke="#53683d"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <g data-mini-piece>
          <rect
            x="157"
            y="34"
            width="145"
            height="64"
            rx="6"
            fill="#f8f6ea"
            stroke="#53683d"
          />
          <text x="229" y="61" textAnchor="middle" fontSize="17" fill="#435432">
            Ordinary
          </text>
          <text x="229" y="83" textAnchor="middle" fontSize="17" fill="#435432">
            working day
          </text>
        </g>
      </g>
    </svg>
  );
}
