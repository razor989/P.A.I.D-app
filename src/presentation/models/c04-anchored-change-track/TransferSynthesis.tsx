import { useId, useState } from "react";
import styles from "./transfer.module.css";

const comparisons = [
  { original: 1500, next: 3000, percentage: "100%", label: "₱1,500 original" },
  { original: 3000, next: 4500, percentage: "50%", label: "₱3,000 original" },
  { original: 0, next: 1500, percentage: "Undefined", label: "₱0 original" },
] as const;
const money = (amount: number) => `₱${amount.toLocaleString("en-PH")}`;

/** Ungraded, post-disclosure comparison. Never writes a response or assessment result. */
export function TransferSynthesis({ blocked }: { blocked: boolean }) {
  const [example, setExample] = useState<(typeof comparisons)[number]>(
    comparisons[0],
  );
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  return (
    <section
      className={styles.synthesis}
      aria-label="Percentage change connections"
    >
      <div className={styles.synthesisHeading}>
        <span className="eyebrow">SAME INCREASE · DIFFERENT REFERENCE</span>
        <h3>
          ₱1,500 more. <em>Always the same percentage?</em>
        </h3>
        <p>
          Let’s keep adding ₱1,500, but start with different amounts. Choose a
          starting amount and watch the bars. What percentage increase would you
          expect this time?
        </p>
      </div>
      <fieldset className={styles.referenceChoices} disabled={blocked}>
        <legend>What if we started with…?</legend>
        {comparisons.map((item) => (
          <label key={item.original}>
            <input
              type="radio"
              name={`reference-${id}`}
              checked={example.original === item.original}
              onChange={() => {
                setExample(item);
                setRevealed(false);
              }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.connectionGrid}>
        <figure className={styles.connectionModel}>
          <figcaption>
            <strong>We’re still adding ₱1,500</strong>
            <span>The scale stays the same, so you can compare the bars.</span>
          </figcaption>
          <svg
            viewBox="0 0 560 240"
            role="img"
            data-reference-model
            data-motion-blocked={blocked || undefined}
            aria-label={`Original ${money(example.original)}. New ${money(example.next)}. Added amount 1,500 pesos. Same peso scale.`}
          >
            <text x="20" y="28">
              Original
            </text>
            <text x="540" y="28" textAnchor="end">
              {money(example.original)}
            </text>
            <line x1="20" y1="42" x2="20" y2="190" className={styles.guide} />
            <rect
              x="20"
              y="45"
              width={example.original / 9}
              height="38"
              rx="3"
              className={styles.referenceBar}
              data-reference-bar
              style={{ width: example.original / 9 }}
            />
            <line
              x1="20"
              y1="45"
              x2="20"
              y2="83"
              className={styles.zero}
              style={{ opacity: example.original === 0 ? 1 : 0 }}
              data-reference-zero
            />
            <text x="20" y="120">
              New
            </text>
            <text x="540" y="120" textAnchor="end">
              {money(example.next)}
            </text>
            <rect
              x="20"
              y="137"
              width={example.original / 9}
              height="38"
              rx="3"
              className={styles.referenceBar}
              data-reference-bar
              style={{ width: example.original / 9 }}
            />
            <g
              className={styles.movingAddition}
              data-moving-addition
              style={{ transform: `translateX(${example.original / 9}px)` }}
            >
              <rect
                x="20"
                y="137"
                width={1500 / 9}
                height="38"
                rx="3"
                className={styles.addedBar}
              />
              <text
                x={20 + 1500 / 18}
                y="208"
                textAnchor="middle"
                className={styles.addedLabel}
              >
                +₱1,500
              </text>
            </g>
          </svg>
          <div className={styles.modelKey}>
            <span>Original amount</span>
            <span>Added amount</span>
          </div>
        </figure>
        <div className={styles.connectionReading}>
          <span className="eyebrow">COMPARED WITH THE ORIGINAL</span>
          <p className={styles.connectionQuestion}>
            {example.original === 0
              ? "We started with nothing. Can we express this increase as a percentage?"
              : `How does the extra ₱1,500 compare with the ${money(example.original)} we started with?`}
          </p>
          <button
            className="secondary"
            disabled={blocked || revealed}
            aria-expanded={revealed}
            aria-controls={id}
            onClick={() => setRevealed(true)}
          >
            {revealed ? "Comparison revealed" : "Reveal the comparison"}
          </button>
          <div
            id={id}
            className={styles.connectionResult}
            aria-live="polite"
            aria-atomic="true"
          >
            {revealed ? (
              <>
                <strong>{example.percentage}</strong>
                <p>
                  {example.original === 0
                    ? "We did gain ₱1,500. But to find the percentage, we’d need to divide that gain by zero. We can’t do that, so the percentage change is undefined—not 0%, 100% or infinity."
                    : `₱1,500 ÷ ${money(example.original)} × 100 = ${example.percentage}. ${example.original === 1500 ? "Look at the bars: the extra money is just as much as we started with. That’s a 100% increase." : "This time, the extra money is only half of what we started with. The same ₱1,500 gives us a 50% increase."}`}
                </p>
              </>
            ) : (
              <p>
                Take a moment to make your prediction. Then reveal the
                comparison and see how it fits the bars.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className={styles.referenceRule}>
        <div>
          <span>01 / FIND</span>
          <strong>New − Original</strong>
          <p>First, subtract what you started with from the new amount.</p>
        </div>
        <div>
          <span>02 / COMPARE</span>
          <strong>Difference ÷ Original × 100</strong>
          <p>
            Then ask how much of the original that change represents. Remember,
            this step only works when the original isn’t zero.
          </p>
        </div>
        <div>
          <span>03 / INTERPRET</span>
          <strong>Keep the reference in view.</strong>
          <p>
            A positive result means an increase; a negative result means a
            decrease. With a zero original, describe the amount that changed
            instead of giving a percentage.
          </p>
        </div>
      </div>
    </section>
  );
}
