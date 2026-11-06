import { useEffect, useRef, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { TransferEvidence } from "./TransferEvidence";
import { TransferRecord } from "./TransferRecord";
import { TransferSynthesis } from "./TransferSynthesis";
import { TransferConclusion } from "./TransferConclusion";
import { TransferDiagram } from "./TransferDiagram";
import { TransferTeaching } from "./TransferTeaching";
import base from "./commission.module.css";
import t from "./transfer.module.css";

/** Revisitable presentation views of actual COMPLETE, never new progression evidence. */
export function TransferCompletion(props: C06PreparePresentation) {
  const [view, setView] = useState<
    "teaching" | "recap" | "synthesis" | "conclusion"
  >("recap");
  const [revisit, setRevisit] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLElement>(null);
  useEffect(() => {
    if (props.blocked) return;
    heading.current?.focus({ preventScroll: true });
    surface.current?.scrollIntoView?.({ block: "start" });
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || view === "conclusion") return;
    const animation = surface.current?.animate?.(
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const cancel = () => animation?.cancel();
    media.addEventListener("change", cancel);
    return () => {
      cancel();
      media.removeEventListener("change", cancel);
    };
  }, [view, props.blocked]);
  if (props.projection.frame.stateId !== "COMPLETE") return null;
  const feedback = props.projection.transferFeedback;
  return (
    <section
      ref={surface}
      className={t.completion}
      aria-label="Check and Transfer completion"
      data-transfer-completion={view}
      data-blocked={props.blocked || undefined}
    >
      <header className={t.recapHero}>
        {view === "recap" && (
          <span className={t.seal} aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m7 16 6 6L25 9" />
            </svg>
          </span>
        )}
        {view !== "synthesis" && view !== "recap" && (
          <p className={base.eyebrow}>
            {view === "teaching"
              ? "COMMISSION · WORKED RELATIONSHIP"
              : "COMMISSION · BEYOND THE RECORD"}
          </p>
        )}
        <h2 ref={heading} tabIndex={-1}>
          {view === "teaching" ? (
            "The June relationship, revisited."
          ) : view === "recap" ? (
            <>
              A month of sales.
              <br />
              <em>A pay story connected.</em>
            </>
          ) : view === "synthesis" ? (
            <>
              Read the promise.
              <br />
              <em>Understand the payment.</em>
            </>
          ) : (
            <>
              More than a number.
              <br />
              <em>A way of reasoning.</em>
            </>
          )}
        </h2>
      </header>
      {view === "teaching" ? (
        <TransferTeaching
          projection={props.projection}
          blocked={props.blocked}
        />
      ) : view === "recap" ? (
        <>
          <div className={`${t.workspace} ${t.recapLedger}`}>
            <TransferRecord projection={props.projection} />
            <div>
              <section
                className={t.recapFeedback}
                aria-label="Recorded feedback"
              >
                <p className={base.eyebrow}>02 · THE CHECK</p>
                <h3>What the check showed</h3>
                {feedback ? (
                  <p data-content-id={feedback.content.id}>
                    {feedback.content.text}
                  </p>
                ) : (
                  <p>
                    The earlier feedback is unavailable. Compare your recorded
                    response with the worked relationship below.
                  </p>
                )}
              </section>
            </div>
          </div>
          <section className={`${t.connectionBoard} ${t.recapWorked}`}>
            <p className={base.eyebrow}>03 · PUTTING THE PARTS TOGETHER</p>
            <h3>The worked relationship</h3>
            <TransferDiagram solved blocked={props.blocked} />
            <div className={t.recapEquations}>
              <p>
                <strong>₱120,000 × 3% = ₱3,600 commission.</strong>
              </p>
              <p>
                <strong>₱15,000 + ₱3,600 = ₱18,600 total compensation.</strong>
              </p>
            </div>
            <p>
              These are the worked results. Compare them with your response
              above. The sales amount is not another payment to Lina.
            </p>
          </section>
          <button
            className={base.secondary}
            disabled={props.blocked}
            aria-expanded={revisit}
            onClick={() => setRevisit(!revisit)}
          >
            {revisit
              ? "Close June relationship"
              : "Revisit Lina’s June relationship"}
          </button>
          {revisit && <TransferEvidence projection={props.projection} solved />}
        </>
      ) : view === "synthesis" ? (
        <>
          <TransferSynthesis blocked={props.blocked} />
          <aside className={t.invitation}>
            <div>
              <p className={base.eyebrow}>BEYOND THE CALCULATION</p>
              <h3>
                What will you notice
                <br />
                <em>next time?</em>
              </h3>
              <p>
                Follow the agreement, the reference and the meaning through a
                short visual conclusion.
              </p>
              <button
                className={base.secondary}
                disabled={props.blocked}
                onClick={() => setView("conclusion")}
              >
                Beyond the sales record →
              </button>
            </div>
            <svg
              viewBox="0 0 360 240"
              role="img"
              aria-label="A June pay record opens into connected commission ideas"
            >
              <ellipse
                cx="180"
                cy="120"
                rx="160"
                ry="90"
                fill="none"
                stroke="currentColor"
                transform="rotate(-20 180 120)"
              />
              <g transform="translate(66 44) rotate(-6 110 80)">
                <rect width="228" height="152" rx="12" fill="#f5edda" />
                <path
                  d="M24 36h180M24 60h120"
                  stroke="#879d65"
                  strokeWidth="3"
                />
                <rect
                  x="24"
                  y="86"
                  width="70"
                  height="42"
                  rx="6"
                  fill="#c4d1b0"
                />
                <rect
                  x="124"
                  y="86"
                  width="80"
                  height="42"
                  rx="6"
                  fill="#dbb66d"
                />
                <path d="M96 107h26" stroke="#385a43" strokeWidth="3" />
              </g>
            </svg>
          </aside>
        </>
      ) : (
        <div className={t.storyScreen}>
          <div className={t.storyScreenTransition} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <TransferConclusion blocked={props.blocked} />
        </div>
      )}
      <footer className={t.actions}>
        {view !== "recap" && view !== "teaching" && (
          <button
            className={base.secondary}
            disabled={props.blocked}
            onClick={() =>
              setView(view === "conclusion" ? "synthesis" : "recap")
            }
          >
            {view === "conclusion"
              ? "← Back to ideas together"
              : "← Back to my recap"}
          </button>
        )}
        {(view === "recap" || view === "teaching") && (
          <button
            className={base.primary}
            disabled={props.blocked}
            onClick={() => setView(view === "teaching" ? "recap" : "synthesis")}
          >
            {view === "teaching"
              ? "Back to my recap →"
              : "Commission: Ideas Together →"}
          </button>
        )}
        {view === "recap" && (
          <button
            className={base.secondary}
            disabled={props.blocked}
            onClick={() => setView("teaching")}
          >
            ← Previous screen
          </button>
        )}
      </footer>
    </section>
  );
}
