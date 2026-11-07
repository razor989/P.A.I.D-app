import { useEffect, useRef, useState } from "react";
import { assessDecimalDraft } from "@/presentation/controls/public";
import type { C04Presentation } from "./public";
import { ApplyQuantity } from "./ApplyQuantity";
import { ApplyOffer } from "./ApplyOffer";
import { normalizeApplyNumber } from "./apply-draft";
import { recordedNumber } from "./recorded-number";
import styles from "./apply.module.css";

const labels: Readonly<Record<string, string>> = {
  original: "Original offer",
  new: "Revised offer",
  difference: "Signed difference",
  percentage: "Percentage change",
};
const sections = [
  "Set the reference",
  "Work out the change",
  "State your conclusion",
];

/** Reading panels are not assessment stages. One independent composite, one canonical Check. */
export function ApplyResponse(props: C04Presentation) {
  const { frame, fields = [], blocked } = props;
  const [draft, setDraft] = useState<Readonly<Record<string, string>>>(
    props.responseDraft ?? {},
  );
  const [pending, setPending] = useState<Readonly<Record<string, boolean>>>({});
  const [panel, setPanel] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (blocked || media?.matches) return;
    const animation = page.current?.animate?.(
      [{ transform: "translateY(8px)" }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const cancel = () => animation?.cancel();
    media?.addEventListener("change", cancel);
    return () => {
      cancel();
      media?.removeEventListener("change", cancel);
    };
  }, [panel, blocked]);
  const checking = frame.stateId === "ACTIVE" || frame.stateId === "REVISION";
  const valid =
    fields.length > 0 &&
    fields.every((field) => {
      const value = field.options
        ? (draft[field.role] ?? "")
        : normalizeApplyNumber(draft[field.role] ?? "");
      return (
        !pending[field.role] &&
        (field.options
          ? field.options.some((option) => option.id === value)
          : value === "UNDEFINED"
            ? field.acceptedKinds.includes("SEMANTIC_BOUNDARY")
            : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) &&
              assessDecimalDraft(value).state === "valid")
      );
    });
  function update(role: string, value: string, composing = false) {
    const next = { ...draft, [role]: value },
      nextPending = { ...pending, [role]: composing };
    setDraft(next);
    setPending(nextPending);
    if (!Object.values(nextPending).some(Boolean))
      props.onDraft?.(normalized(next));
  }
  function normalized(values: Readonly<Record<string, string>>) {
    return Object.fromEntries(
      Object.entries(values).map(([role, value]) => [
        role,
        role === "interpretation" ? value : normalizeApplyNumber(value),
      ]),
    );
  }
  const missing = fields.filter((field) => {
    const value = draft[field.role] ?? "";
    return field.options
      ? !field.options.some((o) => o.id === value)
      : pending[field.role] ||
          (value !== "UNDEFINED" &&
            assessDecimalDraft(normalizeApplyNumber(value)).state !== "valid");
  });
  function move(next: number) {
    setPanel(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function quantity(role: string) {
    const field = fields.find((item) => item.role === role);
    return (
      field && (
        <ApplyQuantity
          field={field}
          label={labels[role]!}
          unit={role === "percentage" ? "%" : "₱"}
          value={draft[role] ?? ""}
          disabled={blocked}
          onChange={(value, composing) => update(role, value, composing)}
        />
      )
    );
  }
  if (!checking)
    return (
      <section
        className={styles.submitted}
        aria-label="Your submitted calculation"
      >
        <h3>Your submitted calculation</h3>
        <dl>
          {Object.entries(props.responseDraft ?? {})
            .filter(([role]) => role !== "interpretation")
            .map(([role, value]) => (
              <div key={role}>
                <dt>{labels[role] ?? role}</dt>
                <dd>
                  {value === "UNDEFINED"
                    ? "Undefined"
                    : recordedNumber(value, role === "percentage" ? "%" : "₱")}
                </dd>
              </div>
            ))}
        </dl>
        {props.responseConclusion && (
          <p className={styles.submittedConclusion}>
            {props.responseConclusion}
          </p>
        )}
      </section>
    );
  return (
    <section className={styles.analysis} aria-label="Your offer analysis">
      <nav className={styles.readingNav} aria-label="Parts of your analysis">
        {sections.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={panel === index ? "step" : undefined}
            disabled={blocked}
            onClick={() => move(index)}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div
        className={`${styles.page} ${panel === 0 ? styles.referenceWorkspace : ""}`}
        ref={page}
      >
        {panel === 0 && <ApplyOffer {...props} />}
        <div className={styles.taskBody}>
          <h3 ref={heading} tabIndex={-1}>
            {sections[panel]}
          </h3>
          {panel === 0 && (
            <>
              <p>
                Identify the original offer and the amount that replaces it.
              </p>
              <div className={styles.referencePair}>
                <div>{quantity("original")}</div>
                <span className={styles.linkArrow} aria-hidden="true">
                  →
                </span>
                <div>{quantity("new")}</div>
              </div>
            </>
          )}
          {panel === 1 && (
            <>
              <p>
                Calculate the difference, then compare it with your original
                amount.
              </p>
              <div className={styles.calculation}>
                <div className={styles.mathLine}>
                  <span className={styles.equation}>
                    <small>New − Original</small>
                    {draft.new || "New"} − {draft.original || "Original"}
                  </span>
                  <span aria-hidden="true">=</span>
                  {quantity("difference")}
                </div>
                <div className={styles.mathLine}>
                  <span className={styles.fraction}>
                    <span>{draft.difference || "Difference"}</span>
                    <span>{draft.original || "Original"}</span>
                  </span>
                  <span>× 100 =</span>
                  {quantity("percentage")}
                </div>
              </div>
            </>
          )}
          {panel === 2 && (
            <>
              <p>
                What does your calculation tell you about the revised offer?
              </p>
              <div
                className={styles.claims}
                role="group"
                aria-label="Interpretation of the offer"
              >
                {fields
                  .find((field) => field.role === "interpretation")
                  ?.options?.map((option, index) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`choice ${draft.interpretation === option.id ? "selected" : ""}`}
                      aria-pressed={draft.interpretation === option.id}
                      disabled={blocked}
                      onClick={() => update("interpretation", option.id)}
                    >
                      <span className={styles.claimMark} aria-hidden="true">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option.text}
                    </button>
                  ))}
              </div>
              <div className={styles.reviewDraft}>
                <h4>
                  Your calculation <em>at a glance.</em>
                </h4>
                <dl>
                  {["original", "new", "difference", "percentage"].map(
                    (role) => (
                      <div key={role}>
                        <dt>{labels[role]}</dt>
                        <dd>{draft[role] || "Not entered"}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>
              {!valid && (
                <p className={styles.note}>
                  Complete{" "}
                  {missing
                    .map((f) => labels[f.role] ?? "your conclusion")
                    .join(", ")}{" "}
                  before checking.
                </p>
              )}
            </>
          )}
          <div className="lesson-nav">
            {panel > 0 && (
              <button
                className="text-button"
                disabled={blocked}
                onClick={() => move(panel - 1)}
              >
                ← Back to {panel === 1 ? "the reference" : "the calculation"}
              </button>
            )}
            {panel < 2 ? (
              <button
                className="primary"
                disabled={blocked}
                onClick={() => move(panel + 1)}
              >
                {panel === 0 ? "Work out the change" : "State your conclusion"}{" "}
                →
              </button>
            ) : (
              <button
                className="primary"
                disabled={
                  blocked ||
                  !valid ||
                  !(
                    frame.allowedLearnerIntents.includes("CHECK_RESPONSE") ||
                    frame.allowedLearnerIntents.includes("CHECK_AGAIN")
                  )
                }
                onClick={() =>
                  props.onCheckDraft
                    ? props.onCheckDraft(normalized(draft))
                    : props.onIntent(
                        frame.allowedLearnerIntents.includes("CHECK_AGAIN")
                          ? "CHECK_AGAIN"
                          : "CHECK_RESPONSE",
                      )
                }
              >
                Check
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
