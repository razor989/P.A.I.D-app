import { useId, useRef, useState } from "react";
import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import { ExploreGlyph } from "./ExploreGlyph";
import { useWorkRecordMotion } from "./use-work-record-motion";
import base from "./work-record.module.css";
import styles from "./transfer.module.css";

export function TransferSynthesis({
  projection,
  blocked,
}: {
  projection: C03WorkRecordProjection;
  blocked: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const surface = useRef<HTMLElement>(null);
  const id = useId();
  useWorkRecordMotion(surface, `${selected}/${revealed}`, blocked);
  const records = projection.competencyRecords;
  if (!records) return null;
  const record = records[selected]!;
  const result = record.overtimePay.resolution;
  const amount =
    result.kind === "KNOWN"
      ? pesos(result.value.magnitude.toString())
      : "Unavailable";
  return (
    <section
      ref={surface}
      className={styles.synthesisRefined}
      aria-label="Overtime-pay connections"
    >
      <ol className={styles.journeyLine} aria-label="The overtime-pay journey">
        {[
          ["Nico", "Notice the extra hours"],
          ["Two conditions", "Find what the day changes"],
          ["James", "Use a monthly total"],
          ["Mara", "Transfer to a holiday"],
        ].map(([name, reading], i) => (
          <li key={name}>
            <span>0{i + 1}</span>
            <div>
              <strong>{name}</strong>
              <small>{reading}</small>
            </div>
          </li>
        ))}
      </ol>
      <section
        className={styles.connectionLab}
        aria-labelledby={`${id}-heading`}
      >
        <header className={styles.labHeading}>
          <p className={base.eyebrow}>Start with the controlled comparison</p>
          <h3 id={`${id}-heading`}>
            Same hours. Same rate.
            <br />
            <em>What does the day change?</em>
          </h3>
          <p>
            In A02, we held ₱100 per hour and two extra hours steady. Only the
            condition—and the rule linked to it—changed. Follow either record
            through the same relationship.
          </p>
        </header>
        <fieldset disabled={blocked} className={styles.labChoices}>
          <legend>Choose a record to follow</legend>
          {records.map((r, i) => (
            <label key={i}>
              <input
                type="radio"
                name={id}
                checked={selected === i}
                onChange={() => {
                  setSelected(i);
                  setRevealed(false);
                }}
              />
              <span>
                {
                  [
                    "Ordinary day",
                    "Rest day",
                    "James’s month",
                    "Mara’s holiday",
                  ][i]
                }
              </span>
            </label>
          ))}
        </fieldset>
        <div
          className={styles.relationshipBoard}
          data-motion="scene"
          key={selected}
        >
          <div className={styles.dayRule}>
            <ExploreGlyph name={selected === 1 ? "rest" : "day"} />
            <div>
              <span>The condition chooses the rule</span>
              <strong>{record.condition}</strong>
            </div>
            <ExploreGlyph name="next" />
            <div>
              <span>Applicable multiplier</span>
              <strong>
                × {revealed ? record.multiplier.magnitude.toString() : "?"}
              </strong>
            </div>
          </div>
          <div className={styles.factorRail}>
            <div>
              <span>Established hourly rate</span>
              <strong>{pesos(record.rate.magnitude.toString())}</strong>
              <small>per hour</small>
            </div>
            <b aria-hidden="true">×</b>
            <div>
              <span>The day’s rule</span>
              <strong>
                {revealed ? record.multiplier.magnitude.toString() : "?"}
              </strong>
              <small>dimensionless multiplier</small>
            </div>
            <b aria-hidden="true">×</b>
            <div>
              <span>Extra time</span>
              <strong>{record.hours.magnitude.toString()}</strong>
              <small>overtime hours</small>
            </div>
          </div>
          <div className={styles.labResult}>
            <div>
              <span>Overtime pay only</span>
              <strong>{revealed ? amount : "Follow the connection"}</strong>
            </div>
            <button
              className={base.secondary}
              disabled={blocked}
              aria-expanded={revealed}
              aria-controls={`${id}-reading`}
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? "Hide the calculation" : "Reveal the connection"}
              <ExploreGlyph name="next" />
            </button>
          </div>
        </div>
        <div
          className={styles.labReading}
          id={`${id}-reading`}
          aria-live="polite"
          aria-atomic="true"
        >
          {revealed ? (
            <p>
              <strong>
                {pesos(record.rate.magnitude.toString())} ×{" "}
                {record.multiplier.magnitude.toString()} ×{" "}
                {record.hours.magnitude.toString()} = {amount}.
              </strong>{" "}
              {selected < 2
                ? "The hourly rate and two hours stayed the same. The condition and its multiplier explain the difference."
                : selected === 2
                  ? "James’s ten hours are the monthly overtime total—not a single-day shift. His hourly rate is already established."
                  : "Mara’s three extra hours are separate from the first eight. The result does not include first-eight-hours earnings."}
            </p>
          ) : (
            <p>
              {selected < 2
                ? "Keep the rate and hours in place. Predict which part of the calculation will change when you switch the day."
                : selected === 2
                  ? "A monthly total, but the same relationship. Which factors come from James’s work record?"
                  : "A different day, rate and overtime duration. Trace each factor from Mara’s established record."}
            </p>
          )}
        </div>
        {selected < 2 && revealed && (
          <figure className={styles.controlledComparison}>
            <figcaption>
              <strong>The A02 pair · one peso scale</strong>
              <span>Same ₱100/hour · same 2 overtime hours</span>
            </figcaption>
            {records.slice(0, 2).map((r, i) => {
              const pay = r.overtimePay.resolution;
              return (
                <div key={r.condition} className={styles.comparisonRow}>
                  <span>{i === 0 ? "Ordinary day" : "Rest day"}</span>
                  <div className={styles.comparisonTrack}>
                    <span
                      style={{
                        width: `${((i === 0 ? 250 : 338) / 338) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {pay.kind === "KNOWN"
                      ? pesos(pay.value.magnitude.toString())
                      : "—"}
                  </strong>
                </div>
              );
            })}
            <p>
              ₱338 − ₱250 = ₱88 more overtime pay. Here, the day’s rule explains
              the difference.
            </p>
          </figure>
        )}
      </section>
      <aside className={styles.transferNote}>
        <ExploreGlyph name="day" />
        <div>
          <h4>Carry the reasoning—not just the number.</h4>
          <p>
            James and Mara have different rates and hours as well as different
            conditions. Their totals alone cannot isolate the day’s effect. What
            transfers is the relationship:{" "}
            <strong>
              condition → rule; rate × multiplier × overtime hours → overtime
              pay.
            </strong>
          </p>
        </div>
      </aside>
    </section>
  );
}
