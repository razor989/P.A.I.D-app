import { ExploreGlyph } from "./ExploreGlyph";
import styles from "./transfer.module.css";

export function TransferInvitation({
  blocked,
  onOpen,
}: {
  blocked: boolean;
  onOpen: () => void;
}) {
  return (
    <section
      className={styles.storyInvitationPanel}
      aria-label="Continue to the cinematic conclusion"
    >
      <div>
        <span className={styles.invitationEyebrow}>Beyond the work record</span>
        <h3>
          Extra hours.
          <br />
          <em>A way of seeing the whole story.</em>
        </h3>
        <p>The day, the rule, the amount. Take the connections with you.</p>
        <button disabled={blocked} onClick={onOpen}>
          Beyond the work record
          <ExploreGlyph name="next" />
        </button>
      </div>
      <svg
        viewBox="0 0 380 280"
        role="img"
        aria-label="A work record opens into connected overtime ideas."
      >
        <ellipse
          cx="190"
          cy="149"
          rx="164"
          ry="108"
          fill="none"
          stroke="#eed29655"
          transform="rotate(-25 190 149)"
        />
        <ellipse
          cx="190"
          cy="149"
          rx="137"
          ry="85"
          fill="none"
          stroke="#eed29633"
          transform="rotate(-25 190 149)"
        />
        <g transform="translate(73 48) rotate(-7 120 90)">
          <rect width="238" height="174" rx="10" fill="#f5edda" />
          <path
            d="M24 42h190M24 76h116M24 102h170"
            stroke="#8d9d74"
            strokeWidth="2"
          />
          <rect x="25" y="122" width="34" height="30" rx="5" fill="#cdd9bc" />
          <rect x="69" y="122" width="34" height="30" rx="5" fill="#cdd9bc" />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={130 + i * 27}
              y="122"
              width="20"
              height="30"
              rx="4"
              fill="#dbb66d"
            />
          ))}
          <circle cx="193" cy="49" r="22" fill="#d9b979" />
          <path
            d="m183 49 8 8 14-17"
            fill="none"
            stroke="#264337"
            strokeWidth="3"
          />
        </g>
      </svg>
    </section>
  );
}
