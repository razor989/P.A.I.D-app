import { useId, useState } from "react";
import base from "./commission.module.css";
import t from "./transfer.module.css";
import { TransferDiagram } from "./TransferDiagram";

const connections = [
  [
    "A01 · Two agreements",
    "The agreement decides what belongs.",
    "The workers shared the same sales and rate, but not the same salary promise. Straight commission ends at commission; base-plus-commission includes a separate salary branch.",
    "Read the promise before building the total.",
  ],
  [
    "A02 · Changing sales",
    "A fixed rate does not mean fixed commission.",
    "When sales changed, the agreed rate and base salary stayed fixed. Commission changed with sales; total compensation changed because it included that commission.",
    "Separate what changes from what stays fixed.",
  ],
  [
    "A03 · A property sale",
    "The sale is not the agent’s payment.",
    "The agent’s straight-commission agreement ended at commission. The property price supplied the sales base, not an extra amount to add to the agent’s pay.",
    "Keep the reference and the result distinct.",
  ],
  [
    "A04 · Lina’s June",
    "One result can become another calculation’s input.",
    "Lina’s commission joins her base salary for the C06 total. Only the commission is the established downstream output; carrying the whole total forward could count the salary again.",
    "Name the amount before using it somewhere else.",
  ],
] as const;

/** COMPLETE-only reflection on approved contexts, never another check or response. */
export function TransferSynthesis({ blocked }: { blocked: boolean }) {
  const [selected, setSelected] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const item = connections[selected]!;
  return (
    <section className={t.synthesis} aria-label="Commission ideas together">
      <header className={t.synthesisHeading}>
        <p className={base.eyebrow}>THE FOUR-ACTIVITY JOURNEY</p>
        <h3>
          Four moments. <em>One connected way of thinking.</em>
        </h3>
        <p>
          Return to a moment from the workshop. What did it teach you to notice
          before calculating?
        </p>
      </header>
      <fieldset className={t.journey} disabled={blocked}>
        <legend>Choose a connection to revisit</legend>
        {connections.map(([label], index) => (
          <label key={label}>
            <input
              type="radio"
              name={id}
              checked={selected === index}
              onChange={() => {
                setSelected(index);
                setRevealed(false);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <div className={t.connectionBoard} key={selected}>
        <div className={t.workspace}>
          <div>
            <TransferDiagram
              blocked={blocked}
              reference={selected === 0}
              solved={revealed}
              straight={selected === 2}
              sales={
                selected === 2
                  ? "₱2,000,000"
                  : selected === 1
                    ? "₱300,000"
                    : "₱120,000"
              }
              rate={selected === 2 ? "5%" : "3%"}
              commission={
                selected === 2
                  ? "₱100,000"
                  : selected === 1
                    ? "₱9,000"
                    : "₱3,600"
              }
              total={selected === 1 ? "₱24,000" : "₱18,600"}
            />
            {selected === 0 && (
              <div className={t.comparisonPair}>
                <span>
                  Straight commission
                  <br />
                  <strong>Commission only</strong>
                </span>
                <span>
                  Base-plus-commission
                  <br />
                  <strong>Salary + commission</strong>
                </span>
              </div>
            )}
            {selected === 1 && revealed && (
              <div className={t.comparisonPair}>
                <span>Sales ₱300,000 → ₱500,000</span>
                <span>
                  Commission ₱9,000 → ₱15,000
                  <br />
                  Rate 3% · salary ₱15,000 stay fixed
                </span>
              </div>
            )}
          </div>
          <div className={t.connectionReading}>
            <h4>{item[1]}</h4>
            <p>
              Pause with this relationship. How would you explain it without
              starting with the final number?
            </p>
            <button
              className={base.secondary}
              disabled={blocked}
              aria-expanded={revealed}
              aria-controls={`${id}-reading`}
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? "Hide the connection" : "Reveal the connection"}
            </button>
            <div id={`${id}-reading`} className={t.reading} aria-live="polite">
              {revealed ? (
                <>
                  <p>{item[2]}</p>
                  <strong>{item[3]}</strong>
                </>
              ) : (
                <p>
                  Your prediction is for reflection, not another recorded
                  answer.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
