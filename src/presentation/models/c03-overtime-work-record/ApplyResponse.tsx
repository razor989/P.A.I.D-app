import { useId, useRef, useState } from "react";
import { ExactDecimal } from "@/core/public";
import type { C03PreparePresentation } from "./public";
import base from "./work-record.module.css";
import styles from "./apply.module.css";
import { ExploreGlyph } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";

const labels = {
  multiplier: "Applicable overtime multiplier",
  overtimePay: "Overtime pay (₱)",
};
const fields = ["multiplier", "overtimePay"] as const;
const valid = (text: string) =>
  /^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim());

/** Two reading panels, one independent composite response and one authoritative Check. */
export function ApplyResponse({
  projection,
  blocked,
  onResponse,
  onAction,
  panel,
  onPanel,
}: C03PreparePresentation & {
  panel: number;
  onPanel: (panel: number) => void;
}) {
  const { frame } = projection;
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const value = (key: string) => {
    const response = parts.find((part) => part.key === key)?.response;
    return response?.kind === "EXACT_QUANTITY"
      ? response.value.magnitude.toString()
      : "";
  };
  const [drafts, setDrafts] = useState<
    Record<string, { text: string; canonical: string }>
  >({});
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const editable =
    !blocked && frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const shown = (key: string) =>
    drafts[key]?.canonical === value(key) ? drafts[key].text : value(key);
  const field = fields[panel]!;
  function move(next: number) {
    onPanel(next);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function publish(key: (typeof fields)[number], text: string) {
    const normalized = text.trim().replace(/\.$/, "");
    const response = valid(text)
      ? {
          kind: "EXACT_QUANTITY" as const,
          value: {
            magnitude: ExactDecimal.from(normalized),
            kind: key === "multiplier" ? "MULTIPLIER" : "MONETARY_AMOUNT",
            unit: key === "multiplier" ? "dimensionless" : "PHP",
            basis: null,
          },
        }
      : null;
    setDrafts({
      ...drafts,
      [key]: { text, canonical: response?.value.magnitude.toString() ?? "" },
    });
    onResponse({
      kind: "COMPOSITE",
      parts: [
        ...parts.filter((part) => part.key !== key),
        ...(response ? [{ key, response }] : []),
      ],
    });
  }
  const canCheck =
    !blocked &&
    fields.every((key) => valid(shown(key))) &&
    frame.allowedLearnerIntents.some(
      (intent) => intent === "CHECK_RESPONSE" || intent === "CHECK_AGAIN",
    );
  return (
    <section className={styles.response} aria-label="Your overtime calculation">
      <nav className={styles.panels} aria-label="Calculation steps">
        {["Choose the multiplier", "Calculate the pay"].map((label, i) => (
          <button
            key={label}
            disabled={blocked}
            aria-current={i === panel ? "step" : undefined}
            onClick={() => move(i)}
          >
            <span>0{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className={styles.responseBody}>
        <h3 ref={heading} tabIndex={-1}>
          {panel === 0
            ? "Which multiplier fits?"
            : "What do the extra hours earn?"}
        </h3>
        <p>
          {panel === 0
            ? "James’s extra hours fall on ordinary working days. Which multiplier goes with that kind of day?"
            : "Use James’s hourly rate, your multiplier and all ten extra hours. How much overtime pay does that give him?"}
        </p>
        <div
          className={styles.relationship}
          aria-label="Overtime pay relationship"
        >
          {panel === 0 ? (
            <>
              <span>Ordinary working day</span>
              <ExploreGlyph name="next" />
              <span>
                Your multiplier<strong>× {shown("multiplier") || "?"}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                Hourly rate
                <strong>
                  {pesos(projection.workEvidence.rate.magnitude.toString())}
                </strong>
              </span>
              <b>×</b>
              <span>
                Your multiplier<strong>{shown("multiplier") || "?"}</strong>
              </span>
              <b>×</b>
              <span>
                Extra hours
                <strong>
                  {projection.workEvidence.hours.magnitude.toString()}
                </strong>
              </span>
            </>
          )}
        </div>
        <label className={styles.inputLabel} htmlFor={id}>
          {labels[field]}
        </label>
        <div className={styles.inputWrap}>
          <span aria-hidden="true">{field === "multiplier" ? "×" : "₱"}</span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={!editable}
            value={shown(field)}
            onChange={(event) => publish(field, event.target.value)}
            aria-describedby={`${id}-hint`}
          />
        </div>
        <p id={`${id}-hint`} className={styles.hint}>
          {field === "multiplier"
            ? "Enter a decimal multiplier, not a percentage."
            : "Enter a peso amount without a currency symbol or commas."}
        </p>
        {shown(field) && !valid(shown(field)) && (
          <p role="status">Use a decimal number to record this answer.</p>
        )}
        {panel === 0 ? (
          <button
            className={base.primary}
            disabled={blocked || !valid(shown(field))}
            onClick={() => move(1)}
          >
            Use this multiplier <ExploreGlyph name="next" />
          </button>
        ) : (
          <>
            <dl className={styles.summary}>
              <div>
                <dt>Your multiplier</dt>
                <dd>{shown("multiplier") || "Not yet entered"}</dd>
              </div>
              <div>
                <dt>Your overtime pay</dt>
                <dd>
                  {shown("overtimePay")
                    ? `₱${shown("overtimePay")}`
                    : "Not yet entered"}
                </dd>
              </div>
            </dl>
            <button
              className={base.primary}
              disabled={!canCheck}
              onClick={() =>
                onAction(
                  frame.allowedLearnerIntents.includes("CHECK_AGAIN")
                    ? "CHECK_AGAIN"
                    : "CHECK_RESPONSE",
                )
              }
            >
              Check my calculation <ExploreGlyph name="next" />
            </button>
          </>
        )}
        {panel === 0 && (
          <p className={styles.hint}>
            You can change it before checking both answers.
          </p>
        )}
      </div>
    </section>
  );
}
