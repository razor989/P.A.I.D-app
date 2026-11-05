import { useId, useRef, useState } from "react";
import { ExactDecimal, quantity } from "@/core/public";
import type { C06PreparePresentation } from "./public";
import { ApplyEvidence } from "./ApplyEvidence";
import { ApplyRecord } from "./ApplyRecord";
import { parseExploreNumber } from "./explore-input";
import styles from "./commission.module.css";
import a from "./apply.module.css";

const panels = [
  "Read the agreement",
  "Build the calculation",
  "Explain the payment",
];
const fields = [
  ["sales", "Sales base (₱)", "The whole sale that the rate applies to."],
  [
    "rate",
    "Commission rate (%)",
    "Enter the percentage, not its decimal equivalent.",
  ],
  [
    "commission",
    "Agent’s commission (₱)",
    "Your proposed payment—not the sale proceeds.",
  ],
] as const;

/** Reading panels are not assessment gates. One independent composite, one Actor check. */
export function ApplyResponse(props: C06PreparePresentation) {
  const id = useId();
  const [panel, setPanel] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const parts =
    props.projection.response?.kind === "COMPOSITE"
      ? props.projection.response.parts
      : [];
  const editable =
    props.projection.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const blocked = props.blocked || Boolean(props.projection.frame.review);
  function move(next: number) {
    setPanel(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  if (!editable) return <ApplyRecord projection={props.projection} />;
  function choice(role: string) {
    const bank = props.projection.applyPrompts?.find(
      (item) => item.role === role,
    );
    const response = parts.find((part) => part.key === role)?.response;
    return (
      bank && (
        <fieldset className={a.choices} disabled={blocked}>
          <legend>{bank.prompt}</legend>
          {bank.options.map((option, index) => (
            <label key={option.id} className={a.choice}>
              <input
                type="radio"
                name={`${id}-${role}`}
                checked={
                  response?.kind === "SINGLE_SELECTION" &&
                  response.selectionId === option.id
                }
                onChange={() =>
                  props.onResponse({
                    kind: "COMPOSITE",
                    parts: [
                      ...parts.filter((part) => part.key !== role),
                      {
                        key: role,
                        response: {
                          kind: "SINGLE_SELECTION",
                          selectionId: option.id,
                        },
                      },
                    ],
                  })
                }
              />
              <span className={a.choiceNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{option.text}</span>
            </label>
          ))}
        </fieldset>
      )
    );
  }
  function field(key: (typeof fields)[number][0]) {
    const [, label, hint] = fields.find((item) => item[0] === key)!;
    const response = parts.find((part) => part.key === key)?.response;
    const value =
      drafts[key] ??
      (response?.kind === "EXACT_QUANTITY"
        ? response.value.magnitude.toString()
        : "");
    const invalid = Boolean(
      value.trim() && parseExploreNumber(value, key === "rate") === null,
    );
    return (
      <label className={a.quantity}>
        <span>{label}</span>
        <input
          aria-label={label}
          inputMode="decimal"
          value={value}
          disabled={blocked}
          aria-invalid={invalid}
          aria-describedby={`${id}-${key}`}
          onChange={(event) => {
            const text = event.currentTarget.value;
            setDrafts((previous) => ({ ...previous, [key]: text }));
            const parsed = parseExploreNumber(text, key === "rate");
            props.onResponse({
              kind: "COMPOSITE",
              parts: [
                ...parts.filter((part) => part.key !== key),
                ...(parsed === null
                  ? []
                  : [
                      {
                        key,
                        response: {
                          kind: "EXACT_QUANTITY" as const,
                          value: quantity(
                            ExactDecimal.from(parsed),
                            key === "rate"
                              ? "PERCENTAGE_RATE"
                              : "MONETARY_AMOUNT",
                            key === "rate" ? "%" : "PHP",
                            null,
                          ),
                        },
                      },
                    ]),
              ],
            });
          }}
        />
        <small id={`${id}-${key}`}>
          {invalid
            ? "Check the number and comma grouping, for example 1,000."
            : hint}
        </small>
      </label>
    );
  }
  return (
    <>
      <nav className={a.steps} aria-label="Commission workbench panels">
        {panels.map((label, index) => (
          <button
            key={label}
            disabled={blocked}
            aria-current={index === panel ? "step" : undefined}
            onClick={() => move(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className={a.workspace}>
        <ApplyEvidence
          projection={props.projection}
          focus={panel === 0 ? "agreement" : panel === 1 ? "sale" : "payment"}
        />
        <section
          key={panel}
          className={a.workbench}
          aria-label="Your commission claim"
        >
          <p className={styles.eyebrow}>Your reasoning · {panel + 1} / 3</p>
          <h3 ref={heading} tabIndex={-1}>
            {panels[panel]}
          </h3>
          {panel === 0 && (
            <>
              <p>
                The sale tells you what was sold. The agreement tells you how
                the agent is paid. Decide which structure belongs before using
                the numbers.
              </p>
              {choice("arrangement")}
              <p className={a.note}>
                A missing salary promise is not a salary of zero.
              </p>
            </>
          )}
          {panel === 1 && (
            <>
              <p>
                Build your own claim from the record. The spaces below are your
                inputs and result—not a solved machine.
              </p>
              <div className={a.equation}>
                {field("sales")}
                <span className={a.operator} aria-hidden="true">
                  ×
                </span>
                {field("rate")}
              </div>
              <div className={a.percentBridge}>
                <span>Percentage → decimal for multiplication</span>
                <strong>Your rate ÷ 100</strong>
              </div>
              <div className={a.resultInput}>
                <span aria-hidden="true">↓</span>
                {field("commission")}
              </div>
              <p className={a.note}>
                The sale stays on the record. Calculating commission does not
                consume or reduce it. Commas and optional currency/percent signs
                are accepted.
              </p>
            </>
          )}
          {panel === 2 && (
            <>
              <p>
                A number needs a meaning. What payment are you claiming for the
                agent?
              </p>
              {choice("interpretation")}
              <ApplyRecord projection={props.projection} compact />
              <p className={a.note}>
                Check the complete claim when you are ready. You can revisit any
                panel without losing your answers.
              </p>
            </>
          )}
          <footer className={a.panelNav}>
            {panel > 0 && (
              <button
                className={styles.secondary}
                disabled={blocked}
                onClick={() => move(panel - 1)}
              >
                ← Previous panel
              </button>
            )}
            {panel < 2 ? (
              <button
                className={styles.primary}
                disabled={blocked}
                onClick={() => move(panel + 1)}
              >
                Next panel →
              </button>
            ) : (
              <button
                className={styles.primary}
                disabled={
                  blocked ||
                  !props.projection.frame.allowedLearnerIntents.some(
                    (intent) =>
                      intent === "CHECK_RESPONSE" || intent === "CHECK_AGAIN",
                  )
                }
                onClick={() =>
                  props.onAction(
                    props.projection.frame.allowedLearnerIntents.includes(
                      "CHECK_AGAIN",
                    )
                      ? "CHECK_AGAIN"
                      : "CHECK_RESPONSE",
                  )
                }
              >
                Check my commission claim
              </button>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}
