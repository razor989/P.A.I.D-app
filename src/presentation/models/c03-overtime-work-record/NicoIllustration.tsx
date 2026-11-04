import styles from "./work-record.module.css";

/** Composed entry/recap illustration, not a miniature instructional renderer. */
export function NicoIllustration({ recap = false }: { recap?: boolean }) {
  return (
    <figure className={styles.nicoIllustration}>
      <svg
        viewBox="0 0 470 340"
        role="img"
        aria-label={
          recap
            ? "Nico’s eight regular hours and two extra hours, with a question still to explore"
            : "Nico: eight regular hours, two additional hours, usual hourly pay ₱100.00"
        }
      >
        <circle cx="236" cy="150" r="125" fill="#e8eddc" />
        <path d="M30 303H440" stroke="#a4b38b" />
        <g transform="translate(188 15)">
          <circle cx="44" cy="32" r="26" fill="#d9b99b" />
          <path d="M18 30Q15 1 42 4Q74 1 71 35L58 17L29 20Z" fill="#3d4836" />
          <path d="M2 100Q0 64 43 64Q86 64 88 100" fill="#879d65" />
          <text
            x="44"
            y="123"
            textAnchor="middle"
            className={styles.illustrationName}
          >
            Nico
          </text>
        </g>
        <g transform="translate(18 145) rotate(-5 100 70)">
          <rect
            width="212"
            height="150"
            rx="8"
            fill="#fffdf7"
            stroke="#879d65"
          />
          <text x="16" y="27" className={styles.illustrationLabel}>
            REGULAR WORK
          </text>
          <path d="M16 40H196" stroke="#c7d0b8" />
          <text x="16" y="82" className={styles.illustrationAmount}>
            8 hours
          </text>
          <text x="16" y="107" className={styles.illustrationSmall}>
            ₱100.00 per hour
          </text>
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={16 + i * 22}
              y="121"
              width="18"
              height="13"
              rx="2"
              fill="#879d65"
            />
          ))}
        </g>
        <g transform="translate(257 145) rotate(5 95 70)">
          <rect
            width="193"
            height="150"
            rx="8"
            fill="#fff8e6"
            stroke="#b59045"
          />
          <text x="16" y="27" className={styles.illustrationLabel}>
            ADDITIONAL WORK
          </text>
          <path d="M16 40H177" stroke="#d6c8a5" />
          <text x="16" y="82" className={styles.illustrationAmount}>
            +2 hours
          </text>
          <text x="16" y="107" className={styles.illustrationSmall}>
            {recap ? "What if the day changed?" : "What about the extra pay?"}
          </text>
          <rect x="16" y="121" width="36" height="13" rx="2" fill="#d8ac4d" />
          <rect x="58" y="121" width="36" height="13" rx="2" fill="#d8ac4d" />
        </g>
        <g transform="translate(212 219)">
          <rect width="48" height="42" rx="7" fill="#f4e4b9" stroke="#b59045" />
          <text x="24" y="29" textAnchor="middle" fontSize="28" fill="#71531d">
            ?
          </text>
        </g>
      </svg>
    </figure>
  );
}
