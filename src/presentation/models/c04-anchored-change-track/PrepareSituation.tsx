import { useEffect, useRef } from "react";
import { createSalaryExploration } from "../c04-reference/employee-exploration";
import { useInspectionSound } from "../../audio/public";
import styles from "./prepare.module.css";

const lessons = {
  original: {
    title: "Before the review",
    copy: "Maya earned ₱18,000 a month before the review. What would you look for on her next salary statement?",
    equation: "Salary statement · before the review",
    labels: ["Before the review", "₱18,000 per month"] as const,
  },
  addition: {
    title: "After the review",
    copy: "Here’s Maya’s salary after the review. Look back at the first statement. What do you notice?",
    equation: "Salary statement · after the review",
    labels: ["After the review", "₱18,000 per month"] as const,
  },
  total: {
    title: "Two moments in Maya’s story",
    copy: "One statement is from before the review; the other is from after it. What do the amounts tell you about Maya’s salary?",
    equation: "Before the review → After the review",
    labels: ["Keep both documents", "What do you notice?"] as const,
  },
};
export function PrepareSituation({
  before = true,
  after = true,
  interactive = false,
  blocked = false,
  pause,
  announce,
  inspectionId,
}: {
  before?: boolean;
  after?: boolean;
  interactive?: boolean;
  blocked?: boolean;
  pause?: () => void;
  announce?: (text: string) => void;
  inspectionId: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const inspectionSound = useInspectionSound();
  const voice = useRef(inspectionSound);
  voice.current = inspectionSound;
  const latest = useRef({ blocked, pause, announce });
  useEffect(() => {
    latest.current = { blocked, pause, announce };
  });
  useEffect(() => {
    if (!interactive || !root.current) return;
    const control = createSalaryExploration(root.current, {
      pause: () => latest.current.pause?.(),
      blocked: () => latest.current.blocked,
      reduced: () =>
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      announce: (text) => latest.current.announce?.(text),
      lessons,
      copyDistance: 0,
      sound: (event, detail) => voice.current(event, detail),
    });
    return () => control.dispose();
  }, [interactive]);
  const trigger = (part: string, label: string) =>
    interactive
      ? {
          "data-explore": part,
          role: "button",
          tabIndex: blocked ? -1 : 0,
          "aria-label": label,
          "aria-controls": inspectionId,
          "aria-expanded": false,
          "aria-disabled": blocked,
        }
      : {};
  return (
    <div ref={root}>
      <figure className={`story-salary ${styles.scene}`}>
        <svg
          className={styles.documents}
          viewBox="0 0 470 340"
          data-dock={interactive || undefined}
          role={interactive ? "group" : "img"}
          aria-label={`Maya’s salary review.${before ? " Before the review: ₱18,000 per month." : ""}${after ? " After the review: ₱18,000 per month." : ""}`}
        >
          <circle cx="236" cy="150" r="125" fill="#e8eddc" />
          <path d="M74 286H396" className={styles.line} />
          <g transform="translate(191 28)">
            <circle cx="44" cy="32" r="26" fill="#d9b99b" />
            <path d="M18 30Q16 0 43 4Q75 3 71 35L60 19L30 20Z" fill="#3d4836" />
            <path d="M2 100Q0 64 43 64Q86 64 88 100" fill="#879d65" />
            <text x="44" y="122" textAnchor="middle" className={styles.name}>
              Maya
            </text>
          </g>
          <g
            data-document="before"
            style={{ display: before ? undefined : "none" }}
            transform="translate(16 140)"
            className={styles.documentTrigger}
            {...trigger("original", "Inspect before the review")}
          >
            <rect className={styles.paper} width="188" height="150" rx="8" />
            <text x="16" y="27" className={styles.label}>
              BEFORE THE REVIEW
            </text>
            <path d="M16 40H172" className={styles.line} />
            <text x="16" y="79" className={styles.amount}>
              ₱18,000
            </text>
            <text x="16" y="101" className={styles.small}>
              per month
            </text>
            <path d="M16 118H105M16 129H88" className={styles.line} />
            <circle cx="153" cy="123" r="14" className={styles.seal} />
            <path d="m147 123 4 4 8-9" stroke="#435432" fill="none" />
          </g>
          <g transform="translate(211 213)">
            <rect width="48" height="42" rx="7" className={styles.review} />
            <text x="24" y="27" textAnchor="middle" fontSize="24">
              ?
            </text>
          </g>
          <g
            data-document="after"
            style={{ display: after ? undefined : "none" }}
            transform="translate(270 140)"
            className={styles.documentTrigger}
            {...trigger("addition", "Inspect after the review")}
          >
            <rect className={styles.paper} width="188" height="150" rx="8" />
            <text x="16" y="27" className={styles.label}>
              AFTER THE REVIEW
            </text>
            <path d="M16 40H172" className={styles.line} />
            <text x="16" y="79" className={styles.amount}>
              ₱18,000
            </text>
            <text x="16" y="101" className={styles.small}>
              per month
            </text>
            <path d="M16 118H105M16 129H88" className={styles.line} />
            <circle cx="153" cy="123" r="14" className={styles.seal} />
            <path d="m147 123 4 4 8-9" stroke="#435432" fill="none" />
          </g>
        </svg>
      </figure>
      {interactive && (
        <>
          <p className="story-explore-hint">
            Hover, focus or tap a statement to take a closer look.
          </p>
          <div className="story-exploration-slot">
            <aside
              className="story-callout"
              id={inspectionId}
              aria-label="Document inspection"
              hidden
            >
              <header>
                <span className="story-kicker">A CLOSER LOOK</span>
                <button
                  type="button"
                  data-explore-close
                  aria-label="Close document inspection"
                >
                  ×
                </button>
              </header>
              <h3 />
              <svg
                className="explore-diagram"
                viewBox="0 0 300 118"
                role="img"
                aria-label=""
              >
                <text x="8" y="17" data-mini-label />
                <rect
                  x="8"
                  y="30"
                  width="260"
                  height="43"
                  rx="4"
                  fill="#e8eddc"
                  stroke="#879d65"
                />
                <path
                  className="mini-reference"
                  d="M8 80H268"
                  stroke="#879d65"
                />
                <g className="mini-copy" />
                <g className="mini-add" />
                <text x="8" y="103" data-mini-result />
              </svg>
              <p className="mini-equation" />
              <p className="mini-copy-text" />
              <footer>
                <span>Maya’s salary statements</span>
                <button
                  type="button"
                  data-explore-replay
                  aria-label="Replay supplemental diagram"
                >
                  ↺
                </button>
              </footer>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
