import { useEffect, useId, useRef, useState } from "react";
import { ExactDecimal } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import type { C03PreparePresentation } from "./public";
import { ExploreGlyph } from "./ExploreGlyph";
import base from "./work-record.module.css";
import styles from "./transfer.module.css";

const keys = ["condition", "multiplier", "overtimePay"] as const;
const number = (text: string) =>
  /^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim());
export function TransferResponse({
  projection,
  blocked,
  onResponse,
  onAction,
  onHelp,
  step,
  onStep,
}: C03PreparePresentation & { step: number; onStep: (n: number) => void }) {
  const { frame } = projection;
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const canonical = (key: string) => {
    const r = parts.find((p) => p.key === key)?.response;
    return r?.kind === "SINGLE_SELECTION"
      ? r.selectionId
      : r?.kind === "EXACT_QUANTITY"
        ? r.value.magnitude.toString()
        : "";
  };
  const [drafts, setDrafts] = useState<
    Record<string, { text: string; canonical: string }>
  >({});
  const shown = (key: string) =>
    drafts[key]?.canonical === canonical(key)
      ? drafts[key].text
      : canonical(key);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const editable =
    !blocked && frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  useEffect(() => {
    if (!blocked && frame.stateId === "REVISION") {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [blocked, frame.stateId]);
  const move = (n: number) => {
    onStep(n);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  };
  function publish(key: (typeof keys)[number], text: string) {
    const r: LearnerResponse | null =
      key === "condition"
        ? { kind: "SINGLE_SELECTION", selectionId: text }
        : number(text)
          ? {
              kind: "EXACT_QUANTITY",
              value: {
                magnitude: ExactDecimal.from(text.trim().replace(/\.$/, "")),
                kind: key === "multiplier" ? "MULTIPLIER" : "MONETARY_AMOUNT",
                unit: key === "multiplier" ? "dimensionless" : "PHP",
                basis: null,
              },
            }
          : null;
    setDrafts({
      ...drafts,
      [key]: {
        text,
        canonical:
          r?.kind === "EXACT_QUANTITY" ? r.value.magnitude.toString() : text,
      },
    });
    // Canonical ordering makes diagnosis independent of which panel was edited last.
    const next = [
      ...parts.filter((p) => p.key !== key),
      ...(r ? [{ key, response: r }] : []),
    ];
    onResponse({
      kind: "COMPOSITE",
      parts: keys.flatMap((k) => next.filter((p) => p.key === k)),
    });
  }
  const field = keys[step]!;
  const ready =
    Boolean(canonical("condition")) &&
    number(shown("multiplier")) &&
    number(shown("overtimePay"));
  const check = frame.allowedLearnerIntents.includes("CHECK_AGAIN")
    ? "CHECK_AGAIN"
    : "CHECK_RESPONSE";
  return (
    <section
      className={styles.response}
      aria-label="Your regular-holiday reasoning"
    >
      <nav className={styles.steps} aria-label="Reasoning steps">
        {["Read the day", "Apply its rule", "Calculate the pay"].map(
          (label, i) => (
            <button
              key={label}
              disabled={blocked}
              aria-current={step === i ? "step" : undefined}
              onClick={() => move(i)}
            >
              <span>0{i + 1}</span>
              {label}
            </button>
          ),
        )}
      </nav>
      <div className={styles.responseBody}>
        <h3 ref={heading} tabIndex={-1}>
          {
            [
              "What kind of overtime is this?",
              "Which rule follows from that day?",
              "What do the three extra hours earn?",
            ][step]
          }
        </h3>
        <p>
          {
            [
              "Use the condition stated in Mara’s record. You do not need to work out a holiday from a date.",
              "Connect your chosen condition to its approved multiplier. Use the relationship reference if you need it—this is not a memory test.",
              "The hourly rate is already established. Apply the day’s multiplier, then account for all three overtime hours.",
            ][step]
          }
        </p>
        {step === 0 ? (
          <fieldset disabled={!editable} className={styles.choices}>
            <legend>Overtime condition</legend>
            {frame.responseControls
              ?.find((c) => c.role === "condition")
              ?.options?.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={id}
                    checked={canonical("condition") === option.id}
                    onChange={() => publish("condition", option.id)}
                  />
                  <ExploreGlyph
                    name={option.id === "rest day" ? "rest" : "day"}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
          </fieldset>
        ) : (
          <>
            <div className={styles.reasoningChain}>
              <span>{canonical("condition") || "Your condition"}</span>
              <ExploreGlyph name="next" />
              <strong>× {shown("multiplier") || "?"}</strong>
              {step === 2 && (
                <>
                  <span>× 3 extra hours</span>
                </>
              )}
            </div>
            <label className={styles.inputLabel} htmlFor={id}>
              {field === "multiplier"
                ? "Applicable overtime multiplier"
                : "Overtime pay (₱)"}
            </label>
            <div className={styles.inputWrap}>
              <span aria-hidden="true">
                {field === "multiplier" ? "×" : "₱"}
              </span>
              <input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                disabled={!editable}
                value={shown(field)}
                onChange={(e) => publish(field, e.target.value)}
                aria-describedby={`${id}-hint`}
              />
            </div>
            <p className={styles.hint} id={`${id}-hint`}>
              {field === "multiplier"
                ? "Use a decimal multiplier, not a percentage."
                : "Enter pesos without commas or the currency symbol. Overtime pay only."}
            </p>
          </>
        )}
        {step === 1 && (
          <button
            className={base.textButton}
            disabled={
              blocked || !frame.allowedLearnerIntents.includes("OPEN_SUPPORT")
            }
            onClick={onHelp}
          >
            Open the relationship reference
          </button>
        )}
        {step === 2 && (
          <dl className={styles.answerSummary}>
            {keys.map((key) => (
              <div key={key}>
                <dt>
                  {key === "condition"
                    ? "Your condition"
                    : key === "multiplier"
                      ? "Your multiplier"
                      : "Your overtime pay"}
                </dt>
                <dd>{shown(key) || "Not yet entered"}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={styles.panelActions}>
          {step > 0 && (
            <button
              className={base.textButton}
              disabled={blocked}
              onClick={() => move(step - 1)}
            >
              <ExploreGlyph name="previous" />
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              className={base.primary}
              disabled={
                blocked ||
                (step === 0
                  ? !canonical("condition")
                  : !number(shown("multiplier")))
              }
              onClick={() => move(step + 1)}
            >
              Continue <ExploreGlyph name="next" />
            </button>
          ) : (
            <button
              className={base.primary}
              disabled={
                blocked ||
                !ready ||
                !frame.allowedLearnerIntents.includes(check)
              }
              onClick={() => onAction(check)}
            >
              Check my reasoning <ExploreGlyph name="next" />
            </button>
          )}
        </div>
        <p className={styles.hint}>
          The three answers are checked together. Moving between panels does not
          check them.
        </p>
      </div>
    </section>
  );
}
