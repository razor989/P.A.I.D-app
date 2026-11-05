import { useEffect, useId, useRef, useState } from "react";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import type { C06PreparePresentation } from "./public";
import { parseExploreNumber } from "./explore-input";
import { TransferRecord } from "./TransferRecord";
import base from "./commission.module.css";
import t from "./transfer.module.css";

const labels = [
  "Read the agreement",
  "Determine commission",
  "Determine total pay",
];
/** Local panels organize reading; the production Actor checks one full response. */
export function TransferResponse(
  props: C06PreparePresentation & {
    panel: number;
    onPanel: (panel: number) => void;
  },
) {
  const { panel, onPanel: setPanel } = props;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    if (!props.blocked) heading.current?.focus({ preventScroll: true });
  }, [panel, props.blocked]);
  const { frame, response } = props.projection;
  const parts = response?.kind === "COMPOSITE" ? response.parts : [];
  const editable =
    !props.blocked && frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  function publish(
    key: string,
    answer: Extract<
      LearnerResponse,
      { kind: "SINGLE_SELECTION" | "EXACT_QUANTITY" }
    > | null,
  ) {
    const updated = [
      ...parts.filter((part) => part.key !== key),
      ...(answer ? [{ key, response: answer }] : []),
    ];
    props.onResponse({
      kind: "COMPOSITE",
      parts: ["arrangement", "commission", "total"].flatMap((role) =>
        updated.filter((part) => part.key === role),
      ),
    });
  }
  function move(next: number) {
    setPanel(next);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function field(key: "commission" | "total", label: string) {
    const part = parts.find((item) => item.key === key)?.response;
    const value =
      drafts[key] ??
      (part?.kind === "EXACT_QUANTITY" ? part.value.magnitude.toString() : "");
    const valid = !value.trim() || parseExploreNumber(value, false) !== null;
    return (
      <div className={t.quantity}>
        <label htmlFor={`${id}-${key}`}>{label}</label>
        <div className={t.inputWell}>
          <span aria-hidden="true">₱</span>
          <input
            id={`${id}-${key}`}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            disabled={!editable}
            aria-invalid={!valid || undefined}
            aria-describedby={`${id}-${key}-hint`}
            onChange={(event) => {
              const text = event.target.value;
              setDrafts({ ...drafts, [key]: text });
              const number = parseExploreNumber(text, false);
              publish(
                key,
                number === null
                  ? null
                  : {
                      kind: "EXACT_QUANTITY",
                      value: quantity(
                        ExactDecimal.from(number),
                        "MONETARY_AMOUNT",
                        "PHP",
                        "June",
                      ),
                    },
              );
            }}
          />
          <small>June</small>
        </div>
        <p id={`${id}-${key}-hint`} className={t.note}>
          {valid
            ? "Enter your amount in pesos. Commas and an optional ₱ sign are accepted."
            : "Enter a number with correctly grouped commas, such as 1,200."}
        </p>
      </div>
    );
  }
  const arrangement = parts.find(
    (part) => part.key === "arrangement",
  )?.response;
  const check = frame.allowedLearnerIntents.includes("CHECK_AGAIN")
    ? "CHECK_AGAIN"
    : "CHECK_RESPONSE";
  return (
    <section
      className={t.response}
      aria-label="Your independent June calculation"
    >
      <nav className={t.steps} aria-label="June reasoning panels">
        {labels.map((label, index) => (
          <button
            key={label}
            disabled={props.blocked}
            aria-current={panel === index ? "step" : undefined}
            onClick={() => move(index)}
          >
            <span>0{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className={t.panel} key={panel}>
        <p className={t.tag}>YOUR REASONING · 0{panel + 1} / 03</p>
        <h3 ref={heading} tabIndex={-1}>
          {
            [
              "What does the agreement promise?",
              "What commission did Lina earn?",
              "What is Lina’s June total?",
            ][panel]
          }
        </h3>
        {panel === 0 ? (
          <>
            <p>
              Read the agreement beside you. Which compensation arrangement
              describes Lina’s pay?
            </p>
            <fieldset className={t.choices} disabled={!editable}>
              <legend>Compensation arrangement</legend>
              {[
                ["STRAIGHT_COMMISSION", "Straight commission"],
                ["BASE_PLUS_COMMISSION", "Base-plus-commission"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`${id}-arrangement`}
                    checked={
                      arrangement?.kind === "SINGLE_SELECTION" &&
                      arrangement.selectionId === value
                    }
                    onChange={() =>
                      publish("arrangement", {
                        kind: "SINGLE_SELECTION",
                        selectionId: value!,
                      })
                    }
                  />
                  <span className={t.choiceGraphic} aria-hidden="true">
                    {value === "STRAIGHT_COMMISSION"
                      ? "Sales × rate → pay"
                      : "Salary + (sales × rate) → pay"}
                  </span>
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </>
        ) : panel === 1 ? (
          <>
            <p>
              Use the June sales and the agreed rate. Work out the commission
              yourself, then record your result.
            </p>
            {field("commission", "Lina’s June commission (₱)")}
            <p className={t.prompt}>
              Which amount does the percentage apply to?
            </p>
          </>
        ) : (
          <>
            <p>
              Now determine the compensation covered by Lina’s agreement. Keep
              the sales record separate from the money she earns.
            </p>
            {field("total", "Lina’s June total compensation (₱)")}
            <TransferRecord projection={props.projection} />
          </>
        )}
        <footer className={t.actions}>
          {panel > 0 && (
            <button
              className={base.secondary}
              disabled={props.blocked}
              onClick={() => move(panel - 1)}
            >
              ← Previous panel
            </button>
          )}
          {panel < 2 ? (
            <button
              className={base.primary}
              disabled={props.blocked}
              onClick={() => move(panel + 1)}
            >
              Next panel →
            </button>
          ) : (
            <button
              className={base.primary}
              disabled={
                props.blocked || !frame.allowedLearnerIntents.includes(check)
              }
              onClick={() => props.onAction(check)}
            >
              Check my June calculation
            </button>
          )}
        </footer>
        <p className={t.note}>
          Revisit any panel without losing your answers. All three responses are
          checked together.
        </p>
      </div>
    </section>
  );
}
