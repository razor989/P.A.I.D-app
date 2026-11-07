import { useRef, useState } from "react";
import { ExactDecimal, quantity } from "@/core/public";
import type { C06PreparePresentation } from "./public";
import { ChoiceThumbnail } from "./ExploreChoice";
import { ExploreWorkspace } from "./ExploreWorkspace";
import { ExploreRecord } from "./ExploreRecord";
import { parseExploreNumber } from "./explore-input";
import { useSound } from "../../audio/public";
import styles from "./commission.module.css";
import e from "./explore.module.css";

const questions = [
  ["fixedReason", "What stays fixed?", ""],
  ["changeReason", "What causes the change?", ""],
  ["orderReason", "Which calculation comes first?", ""],
  ["rate", "Read the agreed commission rate", "Commission rate (%)"],
  ["base", "Read the separate salary promise", "Monthly base salary (₱)"],
  [
    "commissionA",
    "Find Situation A’s commission",
    "Situation A commission (₱)",
  ],
  [
    "totalA",
    "Combine Situation A’s two payments",
    "Situation A total compensation (₱)",
  ],
  [
    "commissionB",
    "Find Situation B’s commission",
    "Situation B commission (₱)",
  ],
  [
    "totalB",
    "Combine Situation B’s two payments",
    "Situation B total compensation (₱)",
  ],
] as const;

export function ExploreResponse(props: C06PreparePresentation) {
  const { projection } = props;
  const checks = projection.exploreChecks ?? [];
  const [step, setStep] = useState(() => {
    const missing = checks.findIndex(
      (c) => c.evaluation?.outcome !== "CONFIRMED",
    );
    return missing < 0 ? 0 : missing;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const sound = useSound();
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const editable =
    !props.blocked &&
    projection.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const [role, title, label] = questions[step]!;
  const response = parts.find((p) => p.key === role)?.response;
  const bank = projection.explorePrompts?.find((p) => p.role === role);
  const value =
    response?.kind === "EXACT_QUANTITY"
      ? response.value.magnitude.toString()
      : "";
  const evaluation = checks.find((c) => c.key === role)?.evaluation;
  const confirmed = checked === role && evaluation?.outcome === "CONFIRMED";
  const reconsider =
    checked === role && evaluation?.outcome === "RECONSIDERATION";
  const ready = bank ? response?.kind === "SINGLE_SELECTION" : Boolean(value);
  function move(next: number) {
    setStep(next);
    setChecked(null);
    setHelp(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  if (!editable) return <ExploreRecord projection={projection} />;
  return (
    <section className={e.questionSurface} aria-label="Your guided comparison">
      <p className={styles.eyebrow}>Question {step + 1} of 9</p>
      <h3 ref={heading} tabIndex={-1}>
        {bank?.prompt ?? title}
      </h3>
      <div className={e.questionLayout}>
        <div ref={workspace} tabIndex={-1}>
          <ExploreWorkspace
            role={role}
            projection={projection}
            guided={help || reconsider}
          />
          {help && (
            <button
              className={styles.secondary}
              onClick={() => {
                setHelp(false);
                requestAnimationFrame(() => helpButton.current?.focus());
              }}
            >
              Back to my answer
            </button>
          )}
        </div>
        <div>
          {bank ? (
            <fieldset className={e.choiceGroup}>
              <legend className={e.srOnly}>{bank.prompt}</legend>
              {bank.options.map((option) => (
                <label className={e.choice} key={option.id}>
                  <input
                    type="radio"
                    name={role}
                    checked={
                      response?.kind === "SINGLE_SELECTION" &&
                      response.selectionId === option.id
                    }
                    onChange={() => {
                      setChecked(null);
                      props.onResponse({
                        kind: "COMPOSITE",
                        parts: [
                          ...parts.filter((p) => p.key !== role),
                          {
                            key: role,
                            response: {
                              kind: "SINGLE_SELECTION",
                              selectionId: option.id,
                            },
                          },
                        ],
                      });
                    }}
                  />
                  <ChoiceThumbnail id={option.id} />
                  <span>{option.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <label className={styles.baseChoice}>
              <span id="answer-label">{label}</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-labelledby="answer-label"
                value={drafts[role] ?? value}
                aria-describedby="answer-format"
                aria-invalid={Boolean(drafts[role]?.trim() && !ready)}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  setDrafts((old) => ({ ...old, [role]: text }));
                  setChecked(null);
                  const parsed = parseExploreNumber(text, role === "rate");
                  props.onResponse({
                    kind: "COMPOSITE",
                    parts: [
                      ...parts.filter((p) => p.key !== role),
                      ...(parsed !== null
                        ? [
                            {
                              key: role,
                              response: {
                                kind: "EXACT_QUANTITY" as const,
                                value: quantity(
                                  ExactDecimal.from(parsed),
                                  role === "rate"
                                    ? "PERCENTAGE_RATE"
                                    : "MONETARY_AMOUNT",
                                  role === "rate" ? "%" : "PHP",
                                  role === "rate" ? null : "per month",
                                ),
                              },
                            },
                          ]
                        : []),
                    ],
                  });
                }}
              />
              <span id="answer-format" className={e.inputHint}>
                {drafts[role]?.trim() && !ready
                  ? "Enter a number. Check the comma grouping, for example 1,000."
                  : role === "rate"
                    ? "Enter the percentage, for example 3 or 3%."
                    : "Commas and an optional ₱ sign are welcome. Enter your own calculation."}
              </span>
            </label>
          )}
          <div ref={feedback} tabIndex={-1}>
            {checked === role && (
              <div
                className={e.questionFeedback}
                role="status"
                data-outcome={evaluation?.outcome}
              >
                <h4>
                  {confirmed
                    ? "That relationship follows the agreement."
                    : "Let’s trace this answer together."}
                </h4>
                <p>
                  {confirmed
                    ? "Your answer is checked. Carry this relationship forward."
                    : "Keep your answer in view. Follow the evidence, then revise this question and check again."}
                </p>
                {reconsider && (
                  <p>
                    {role === "changeReason"
                      ? "Compare the same salary in A and B. More sales changes the commission—not the salary or the rate."
                      : role === "orderReason"
                        ? "The percentage applies to sales only. Establish commission before adding the separate salary."
                        : role === "fixedReason"
                          ? "An agreement promises a salary and a rate. A different sales record does not rewrite those promises."
                          : "Use the model’s operation and the agreement. A percentage is a share of sales; total compensation combines salary and commission."}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              ref={helpButton}
              aria-expanded={help}
              onClick={() => {
                setHelp(!help);
                if (!help)
                  requestAnimationFrame(() => {
                    workspace.current?.focus();
                    workspace.current?.scrollIntoView?.({ block: "start" });
                  });
              }}
            >
              {help
                ? "Return to this question"
                : role.startsWith("total")
                  ? "Help me combine the pay"
                  : bank
                    ? "Explain this relationship"
                    : "Help me work through this amount"}
            </button>
            {!confirmed && (
              <button
                className={`${styles.primary} ${e.checkButton}`}
                disabled={!ready}
                onClick={() => {
                  // Reveals the engine's existing per-part evaluation; the
                  // sound follows that result and never decides it.
                  if (evaluation)
                    sound.play(
                      evaluation.outcome === "CONFIRMED"
                        ? "feedback.part.affirm"
                        : "feedback.part.reconsider",
                    );
                  setChecked(role);
                  requestAnimationFrame(() => feedback.current?.focus());
                }}
              >
                {reconsider ? "Check this answer again" : "Check this answer"}
              </button>
            )}
          </div>
          {confirmed && (
            <button
              className={`${styles.primary} ${e.checkButton}`}
              onClick={() => {
                if (step < questions.length - 1) move(step + 1);
                else
                  props.onAction(
                    projection.frame.allowedLearnerIntents.includes(
                      "CHECK_AGAIN",
                    )
                      ? "CHECK_AGAIN"
                      : "CHECK_RESPONSE",
                  );
              }}
            >
              {step < questions.length - 1
                ? "Next question →"
                : "Bring my comparison together →"}
            </button>
          )}
          {step > 0 && (
            <div className={styles.actions}>
              <button
                className={styles.textButton}
                onClick={() => move(step - 1)}
              >
                ← Previous question
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
