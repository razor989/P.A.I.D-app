import { ExactDecimal } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import { useRef, useState } from "react";
import type { C03PreparePresentation } from "./public";
import { ExploreModel } from "./ExploreModel";
import styles from "./work-record.module.css";
import explore from "./explore.module.css";

const fields = [
  "invariants",
  "changes",
  "multiplierA",
  "multiplierB",
  "difference",
];
const titles = [
  "What stays the same?",
  "What changes with the day?",
  "Which multiplier belongs to the ordinary day?",
  "Which multiplier belongs to the rest day?",
  "How much more overtime pay does the rest day give?",
];
const labels: Record<string, string> = {
  multiplierA: "Ordinary working-day multiplier",
  multiplierB: "Rest-day multiplier",
  difference: "Difference in overtime pay (₱)",
};
const options: Record<string, string> = {
  "rate + hours": "The hourly rate and overtime hours",
  "condition + multiplier + overtimePay":
    "The work condition, multiplier and overtime pay",
  "rate + multiplier": "The hourly rate and multiplier",
};
type Check = NonNullable<
  ReturnType<NonNullable<C03PreparePresentation["onCheckPart"]>>
>;

export function ExploreResponse({
  projection,
  blocked,
  onResponse,
  onAction,
  onCheckPart,
}: C03PreparePresentation) {
  const parts =
    projection.response?.kind === "COMPOSITE" ? projection.response.parts : [];
  const [index, setIndex] = useState(0);
  const [checks, setChecks] = useState<
    Record<string, { result: Check; fingerprint: string }>
  >({});
  const [drafts, setDrafts] = useState<
    Record<string, { text: string; canonical: string }>
  >({});
  const [help, setHelp] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const field = fields[index]!;
  const editable =
    projection.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const value = (key: string) => {
    const response = parts.find((part) => part.key === key)?.response;
    return response?.kind === "SINGLE_SELECTION"
      ? response.selectionId
      : response?.kind === "EXACT_QUANTITY"
        ? response.value.magnitude.toString()
        : "";
  };
  const fingerprint = (key: string) => {
    const response = parts.find((part) => part.key === key)?.response;
    return response?.kind === "EXACT_QUANTITY"
      ? `${response.value.kind}/${response.value.unit}/${response.value.basis}/${response.value.magnitude.toString()}`
      : value(key);
  };
  const current =
    checks[field]?.fingerprint === fingerprint(field)
      ? checks[field]?.result
      : null;
  const confirmed = current?.outcome === "CONFIRMED";
  function move(next: number) {
    setIndex(next);
    setHelp(false);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function publish(text: string) {
    let response:
      | Extract<
          LearnerResponse,
          { kind: "SINGLE_SELECTION" | "EXACT_QUANTITY" }
        >
      | undefined;
    const numeric = index >= 2;
    if (text && (!numeric || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)))
      response = numeric
        ? {
            kind: "EXACT_QUANTITY",
            value: {
              magnitude: ExactDecimal.from(
                text.endsWith(".") ? text.slice(0, -1) : text,
              ),
              kind: field === "difference" ? "MONETARY_AMOUNT" : "MULTIPLIER",
              unit: field === "difference" ? "PHP" : "dimensionless",
              basis: null,
            },
          }
        : { kind: "SINGLE_SELECTION", selectionId: text };
    setDrafts({
      ...drafts,
      [field]: {
        text,
        canonical:
          response?.kind === "EXACT_QUANTITY"
            ? response.value.magnitude.toString()
            : response
              ? text
              : "",
      },
    });
    setChecks((currentChecks) =>
      Object.fromEntries(
        Object.entries(currentChecks).filter(([key]) => key !== field),
      ),
    );
    onResponse({
      kind: "COMPOSITE",
      parts: [
        ...parts.filter((part) => part.key !== field),
        ...(response ? [{ key: field, response }] : []),
      ],
    });
  }
  const guidance =
    field === "invariants"
      ? "Compare the rate and clock marks on both records. Do either change?"
      : field === "changes"
        ? "Follow the calendar, then the multiplier and the end of each pay bar."
        : field === "difference"
          ? "Align the bars. Subtract the ordinary-day payment from the rest-day payment."
          : `Find the ${field === "multiplierA" ? "ordinary-day" : "rest-day"} label and the multiplier next to it.`;
  const control = projection.frame.responseControls?.find(
    (control) => control.role === field,
  );
  return (
    <section className={explore.guidedPractice} aria-label="Your comparison">
      <div className={explore.practicePosition}>
        Question {index + 1} of 5{" "}
        <span>
          {fields.map((key, i) => (
            <span
              key={key}
              aria-label={`Question ${i + 1}${checks[key]?.result.outcome === "CONFIRMED" && checks[key]?.fingerprint === fingerprint(key) ? " confirmed" : ""}`}
              data-current={i === index}
              data-confirmed={
                checks[key]?.result.outcome === "CONFIRMED" &&
                checks[key]?.fingerprint === fingerprint(key)
              }
            >
              ●
            </span>
          ))}
        </span>
      </div>
      <div className={explore.responseLayout}>
        <section className={explore.responsePage}>
          <h3 ref={heading} tabIndex={-1}>
            {titles[index]}
          </h3>
          {control?.options ? (
            <fieldset
              className={explore.choiceBank}
              disabled={blocked || !editable}
            >
              <legend>Choose one answer</legend>
              {control.options.map((option, i) => (
                <label
                  key={option.id}
                  className={explore.reasonChoice}
                  data-selected={value(field) === option.id}
                >
                  <input
                    type="radio"
                    name={field}
                    checked={value(field) === option.id}
                    onChange={() => publish(option.id)}
                  />
                  <svg viewBox="0 0 80 48" aria-hidden="true">
                    {i === 0 ? (
                      <>
                        <circle
                          cx="18"
                          cy="24"
                          r="14"
                          fill="#e5ead7"
                          stroke="#718951"
                        />
                        <text
                          x="18"
                          y="30"
                          textAnchor="middle"
                          fontSize="18"
                          fill="#435432"
                        >
                          ₱
                        </text>
                        <circle
                          cx="59"
                          cy="24"
                          r="14"
                          fill="#fff2dc"
                          stroke="#b28248"
                        />
                        <path
                          d="M59 14v11l7 5"
                          fill="none"
                          stroke="#71531d"
                          strokeWidth="2"
                        />
                      </>
                    ) : i === 1 ? (
                      <>
                        <rect
                          x="4"
                          y="8"
                          width="23"
                          height="30"
                          rx="3"
                          fill="#e5ead7"
                          stroke="#718951"
                        />
                        <path d="M4 17h23M32 24h14" stroke="#718951" />
                        <text
                          x="62"
                          y="31"
                          textAnchor="middle"
                          fontSize="24"
                          fill="#71531d"
                        >
                          ×
                        </text>
                        <path d="M48 41h28" stroke="#b28248" strokeWidth="4" />
                      </>
                    ) : (
                      <>
                        <circle
                          cx="18"
                          cy="24"
                          r="14"
                          fill="#e5ead7"
                          stroke="#718951"
                        />
                        <text
                          x="18"
                          y="30"
                          textAnchor="middle"
                          fontSize="18"
                          fill="#435432"
                        >
                          ₱
                        </text>
                        <text
                          x="60"
                          y="33"
                          textAnchor="middle"
                          fontSize="30"
                          fill="#71531d"
                        >
                          ×
                        </text>
                      </>
                    )}
                  </svg>
                  <span>{options[option.id] ?? option.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <label className={explore.quantityField}>
              <span>{labels[field]}</span>
              <div>
                <span aria-hidden="true">
                  {field === "difference" ? "₱" : "×"}
                </span>
                <input
                  aria-label={labels[field]}
                  disabled={blocked || !editable}
                  inputMode="decimal"
                  value={
                    drafts[field]?.canonical === value(field)
                      ? drafts[field].text
                      : value(field)
                  }
                  onChange={(event) => publish(event.currentTarget.value)}
                />
              </div>
            </label>
          )}
          {current && (
            <div
              className={explore.partFeedback}
              role="status"
              data-correct={confirmed}
            >
              <strong>
                {confirmed ? "Yes—that fits." : "Look at this part again."}
              </strong>
              <p>{current.text}</p>
            </div>
          )}
          {projection.frame.feedbackState && !editable && (
            <p>
              Return to an answer to change it, or use the lesson action below.
            </p>
          )}
          <div className={explore.panelActions}>
            {index > 0 && (
              <button
                className={styles.textButton}
                disabled={blocked}
                onClick={() => move(index - 1)}
              >
                ← Back
              </button>
            )}
            {editable &&
              (!confirmed ? (
                <button
                  className={styles.primary}
                  disabled={blocked || !value(field) || !onCheckPart}
                  onClick={() => {
                    const result = onCheckPart?.(field);
                    if (result) {
                      setChecks({
                        ...checks,
                        [field]: { result, fingerprint: fingerprint(field) },
                      });
                      setHelp(result.outcome !== "CONFIRMED");
                    }
                  }}
                >
                  Check this answer →
                </button>
              ) : index < 4 ? (
                <button
                  className={styles.primary}
                  disabled={blocked}
                  onClick={() => move(index + 1)}
                >
                  Next question →
                </button>
              ) : (
                <button
                  className={styles.primary}
                  disabled={
                    blocked ||
                    !fields.every(
                      (key) =>
                        checks[key]?.result.outcome === "CONFIRMED" &&
                        checks[key]?.fingerprint === fingerprint(key),
                    )
                  }
                  onClick={() =>
                    onAction(
                      projection.frame.allowedLearnerIntents.includes(
                        "CHECK_AGAIN",
                      )
                        ? "CHECK_AGAIN"
                        : "CHECK_RESPONSE",
                    )
                  }
                >
                  Check my comparison →
                </button>
              ))}
          </div>
        </section>
        <aside
          className={explore.responseEvidence}
          aria-label="Use the two work records"
        >
          <div className={explore.questionGuide}>
            <strong>
              {help ? "Try it in the picture" : "Use the two records"}
            </strong>
            <p>{guidance}</p>
            {!help && (
              <button
                className={styles.textButton}
                disabled={blocked}
                onClick={() => setHelp(true)}
              >
                Show me where to look
              </button>
            )}
          </div>
          <ExploreModel
            projection={projection}
            blocked={blocked}
            compact
            focus={help ? field : undefined}
          />
        </aside>
      </div>
    </section>
  );
}
