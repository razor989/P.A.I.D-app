import type { C06CommissionProjection } from "./public";
import { ChoiceThumbnail } from "./ExploreChoice";
import { MomentThumbnail } from "./MomentThumbnail";
import styles from "./commission.module.css";
import e from "./explore.module.css";

/** A read-only view of actual responses; never substitutes expected answers. */
export function ExploreRecord({
  projection,
}: {
  projection: C06CommissionProjection;
}) {
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const response = (key: string) =>
    parts.find((part) => part.key === key)?.response;
  function amount(key: string) {
    const saved = response(key);
    if (saved?.kind !== "EXACT_QUANTITY") return "Not recorded";
    // Group the exact decimal string without converting it to a floating point value.
    const [whole = "", fraction] = saved.value.magnitude.toString().split(".");
    const grouped =
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      (fraction ? `.${fraction}` : "");
    return key === "rate" ? `${grouped}%` : `₱${grouped}`;
  }
  return (
    <details className={e.record}>
      <summary>Review your recorded reasoning and calculations</summary>
      <section className={e.recordSection} aria-label="Your recorded reasoning">
        <p className={styles.eyebrow}>Your reasoning</p>
        <div className={e.reasoningRecord}>
          {[
            ["fixedReason", "What stays fixed?"],
            ["changeReason", "What causes the change?"],
            ["orderReason", "Which calculation comes first?"],
          ].map(([key = "", title]) => {
            const saved = response(key);
            const id =
              saved?.kind === "SINGLE_SELECTION"
                ? saved.selectionId
                : undefined;
            const text = projection.explorePrompts
              ?.find((bank) => bank.role === key)
              ?.options.find((option) => option.id === id)?.text;
            return (
              <div className={e.recordedReason} key={key}>
                {id && <ChoiceThumbnail id={id} />}
                <h4>{title}</h4>
                <p>{text ?? "Not recorded"}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className={e.recordSection} aria-label="Your recorded agreement">
        <p className={styles.eyebrow}>The agreement</p>
        <div className={e.agreementRecord}>
          <MomentThumbnail stage={0} moment={0} />
          <dl>
            <div>
              <dt>Commission rate</dt>
              <dd>{amount("rate")}</dd>
            </div>
            <div>
              <dt>Monthly salary</dt>
              <dd>{amount("base")}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section
        className={e.recordSection}
        aria-label="Your recorded calculations"
      >
        <p className={styles.eyebrow}>Your calculations</p>
        <div className={e.calculationRecord}>
          {["A", "B"].map((situation) => (
            <section
              className={e.recordedCalculation}
              key={situation}
              aria-label={`Recorded Situation ${situation}`}
            >
              <h4>Situation {situation}</h4>
              <p className={e.recordContext}>
                Sales record · {situation === "A" ? "₱300,000" : "₱500,000"}
              </p>
              <ol>
                <li>
                  <span>Sales × rate ({amount("rate")})</span>
                  <strong>{amount(`commission${situation}`)}</strong>
                  <small>Commission</small>
                </li>
                <li>
                  <span>Commission + salary ({amount("base")})</span>
                  <strong>{amount(`total${situation}`)}</strong>
                  <small>Total pay</small>
                </li>
              </ol>
            </section>
          ))}
        </div>
      </section>
    </details>
  );
}
