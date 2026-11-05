import { useEffect, useRef, useState } from "react";
import { TransferConclusionArt } from "./TransferConclusionArt";
import { useWorkRecordMotion } from "./use-commission-motion";
import base from "./commission.module.css";
import t from "./transfer.module.css";

const scenes = [
  [
    "The promise",
    "Before the amount, read the agreement.",
    "A sale alone cannot tell you what someone earns. Look for the commission rate and whether the agreement includes a base salary.",
    "Which parts of pay are actually promised?",
  ],
  [
    "The reference",
    "A percentage needs something to act on.",
    "In Lina’s June record, the percentage applies to sales. The commission is her payment from that relationship—not the sales proceeds and not a percentage of her salary.",
    "What is this rate a percentage of?",
  ],
  [
    "The connection",
    "Build the total without losing the parts.",
    "Lina’s agreement combines base salary with commission. Find commission first, then add the promised salary once. An amount can be correct and still be used in the wrong place.",
    "Is this commission, or a total that already includes salary?",
  ],
  [
    "Take it with you",
    "Make the amount mean something.",
    "When you meet a commission figure, read its agreement, trace its sales base, and name the payment it represents. Carry the reasoning with you—not just the number.",
    "Read the promise. Trace the relationship. Name the result.",
  ],
] as const;

/** Optional COMPLETE-only narrative using the approved context; no new assessment. */
export function TransferConclusion({ blocked }: { blocked: boolean }) {
  const [scene, setScene] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLElement>(null);
  useWorkRecordMotion(surface, `${scene}/${revealed}`, blocked);
  useEffect(() => {
    if (!blocked) heading.current?.focus({ preventScroll: true });
  }, [scene, blocked]);
  const current = scenes[scene]!;
  function move(next: number) {
    setScene(next);
    setRevealed(false);
  }
  return (
    <section
      ref={surface}
      className={t.cinema}
      aria-label="Commission beyond the sales record"
    >
      <p className={base.eyebrow}>BEYOND THE SALES RECORD · {scene + 1} / 4</p>
      <h3 ref={heading} tabIndex={-1}>
        {current[1]}
      </h3>
      <div className={t.storyStage} key={scene}>
        <TransferConclusionArt scene={scene} revealed={revealed} />
        <div className={t.storyCaption}>
          <span className={t.tag}>{current[0]}</span>
          <strong>{current[3]}</strong>
        </div>
      </div>
      {scene < 3 && (
        <button
          className={base.secondary}
          disabled={blocked}
          aria-expanded={revealed}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? "Pause with the question" : "Follow the connection"}
        </button>
      )}
      <div className={t.reading} aria-live="polite">
        {revealed || scene === 3 ? (
          <p>{current[2]}</p>
        ) : (
          <p>Take a moment with the question. Continue when you are ready.</p>
        )}
      </div>
      <footer className={t.actions}>
        <button
          className={base.secondary}
          disabled={blocked || scene === 0}
          onClick={() => move(scene - 1)}
        >
          ← Previous scene
        </button>
        <button
          className={base.primary}
          disabled={blocked}
          onClick={() => move(scene === 3 ? 0 : scene + 1)}
        >
          {scene === 3 ? "Watch again ↻" : "Next scene →"}
        </button>
      </footer>
      {scene === 3 && (
        <p className={t.closing}>
          The end of this commission journey. A way of thinking to take with
          you.
        </p>
      )}
    </section>
  );
}
