import { useEffect, useId, useRef, useState } from "react";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import { FeedbackSurface } from "@/presentation/feedback/public";
import { ModalSurface, ReviewSurface } from "@/presentation/support/public";
import type { C04Presentation } from "./public";
import { PrepareLegacyResponse } from "./PrepareLegacyResponse";
import {
  momentDuration,
  prepareMoments,
  projectPrepareStory,
} from "./prepare-v3-story";
import styles from "./prepare-v3.module.css";

export function PrepareV3Experience(props: C04Presentation) {
  if (props.prepareContractId === "C04-A01-interpretation-v1")
    return <PrepareLegacyResponse {...props} />;
  return <PrepareWorkshop {...props} />;
}

function PrepareWorkshop(props: C04Presentation) {
  const { frame, blocked, onIntent, onPresented } = props;
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [question, setQuestion] = useState(0);
  const [inspection, setInspection] = useState<
    "original" | "new" | "reference" | null
  >(null);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const reviewInvoker = useRef<HTMLButtonElement>(null);
  const inspectInvoker = useRef<HTMLButtonElement | null>(null);
  const restoringInspectionFocus = useRef(false);
  const id = useId();
  const supportOpen = Boolean(frame.review || frame.sourceReview);
  const disabled = blocked || supportOpen;
  const complete = frame.stateId === "COMPLETE";
  const entry = frame.stateId === "ENTRY";
  const landing = entry && !started;
  const checked = Boolean(
    props.prepare &&
    props.prepare.difference !== null &&
    props.prepare.percentage !== null,
  );
  const story = projectPrepareStory(time, checked);
  const selections = props.prepareSelections ?? {};
  const fields = props.fields ?? [];
  const current = fields[question];
  const editable = frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
  const previousSupport = useRef(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!playing || disabled || reduced || inspection || landing) return;
    let request = 0,
      last: number | null = null;
    const tick = (now: number) => {
      if (last !== null)
        setTime((value) =>
          Math.min(story.end, value + Math.min(100, now - last!)),
        );
      last = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, disabled, reduced, inspection, landing, story.end]);
  useEffect(() => {
    if (!disabled && frame.feedbackState && feedback.current?.isConnected)
      onPresented?.("feedback", feedback.current);
  }, [disabled, frame, onPresented]);
  useEffect(() => {
    const closing = previousSupport.current && !supportOpen;
    previousSupport.current = supportOpen;
    if (!closing || blocked) return;
    const request = requestAnimationFrame(() => {
      if (
        reviewInvoker.current?.isConnected &&
        !document.querySelector("dialog[open]")
      )
        reviewInvoker.current.focus();
    });
    return () => cancelAnimationFrame(request);
  }, [supportOpen, blocked]);
  function seek(value: number) {
    if (!disabled) {
      setPlaying(false);
      setTime(projectPrepareStory(value, checked).position);
      setInspection(null);
    }
  }
  function inspect(
    part: "original" | "new" | "reference",
    target: HTMLButtonElement,
  ) {
    if (disabled || restoringInspectionFocus.current) return;
    setPlaying(false);
    inspectInvoker.current = target;
    setInspection(part);
  }
  function dismiss() {
    setInspection(null);
    restoringInspectionFocus.current = true;
    inspectInvoker.current?.focus();
    restoringInspectionFocus.current = false;
  }
  const amount = (value: string | undefined) =>
    value === undefined
      ? ""
      : `â‚±${Number(value).toLocaleString("en-PH")} per month`;
  const shownInspection =
    !disabled && (inspection !== "reference" || checked) ? inspection : null;
  const qcopy = (q: number, role: string) =>
    frame.contentReferences.find(
      (ref) => ref.id === `c04/S01/guided-q${q + 1}-${role}`,
    )?.text;
  return (
    <section
      className={styles.prepare}
      aria-labelledby={`${id}-heading`}
      data-c04-track="C04-A01"
      onKeyDown={(event) => {
        if (event.key === "Escape" && inspection) {
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <header className={styles.masthead}>
        <span className={styles.brand}>
          P.A.I.D<span>.</span>
        </span>
        <span className={styles.mastLabel}>
          THE CHANGE WORKSHOP
          <br />
          PERCENTAGE CHANGE
        </span>
        <span className={styles.edition}>01 / Prepare</span>
      </header>
      <div className={styles.sheet}>
        {landing ? (
          <div className={styles.landing}>
            <div className={styles.invitation}>
              <p className={styles.eyebrow}>
                A closer look Â· Mayaâ€™s salary review
              </p>
              <h2 ref={heading} id={`${id}-heading`} tabIndex={-1}>
                Two moments. <br />
                <em>One salary review.</em>
              </h2>
              <p className={styles.lead}>
                Before asking how much changed, get to know the two amounts.
              </p>
              <p>
                Follow Mayaâ€™s salary from before the review to after it. Learn
                to keep Original and New in view, then make your own comparison.
              </p>
              <button
                className={styles.primary}
                disabled={disabled}
                onClick={() => {
                  setStarted(true);
                  heading.current?.focus();
                }}
              >
                Start with Maya <span aria-hidden="true">â†—</span>
              </button>
              <div className={styles.entryMeta}>
                <span>Look closely</span>
                <span>Make a comparison</span>
                <span>Explain your reasoning</span>
              </div>
            </div>
            <div
              className={styles.entryArt}
              aria-label="Mayaâ€™s two monthly salary statements"
            >
              <p className={styles.artTitle}>THE SALARY REVIEW</p>
              <div className={styles.orbit} />
              <div className={styles.ticket}>
                <span className={styles.avatar} aria-hidden="true">
                  M
                </span>
                <span className={styles.eyebrow}>BEFORE THE REVIEW</span>
                <strong>Maya</strong>
                <span>Monthly salary</span>
                <b>{amount(props.prepare?.original)}</b>
                <i aria-hidden="true" />
              </div>
              <div className={`${styles.ticket} ${styles.ticketAfter}`}>
                <span className={styles.stamp}>AFTER</span>
                <span className={styles.eyebrow}>AFTER THE REVIEW</span>
                <strong>Maya</strong>
                <span>Monthly salary</span>
                <b>{amount(props.prepare?.next)}</b>
                <i aria-hidden="true" />
              </div>
              <span className={styles.artNote}>
                Two statements to keep in view.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.progress} aria-label="Activity sections">
              <span>01 Â· Observe</span>
              <span aria-current={editable ? "step" : undefined}>
                02 Â· Reason
              </span>
              <span aria-current={complete ? "step" : undefined}>
                03 Â· Take it forward
              </span>
            </div>
            <header className={styles.lessonHeading}>
              <p className={styles.eyebrow}>
                {complete ? "Take it forward" : "Mayaâ€™s salary review"}
              </p>
              <h2 ref={heading} id={`${id}-heading`} tabIndex={-1}>
                {complete
                  ? "Same amounts. Distinct roles."
                  : "Keep the starting point in view."}
              </h2>
              <p>
                {
                  frame.contentReferences.find((ref) =>
                    ref.id.endsWith("/scenario"),
                  )?.text
                }
              </p>
            </header>
            <div className={styles.workbench}>
              <div className={styles.modelHeading}>
                <div>
                  <p className={styles.eyebrow}>The monthly salary model</p>
                  <h3>{story.moment.title}</h3>
                </div>
                <span className={styles.scaleNote}>
                  One scale Â· PHP per month
                </span>
              </div>
              <div
                className={styles.model}
                data-moment={story.index}
                data-aligned={story.aligned}
              >
                <div className={styles.salaryRow}>
                  <div className={styles.rowLabel}>
                    <span className={styles.eyebrow}>BEFORE THE REVIEW</span>
                    <strong>Original</strong>
                    <span>The starting reference</span>
                  </div>
                  <button
                    className={styles.salaryStrip}
                    disabled={disabled}
                    aria-expanded={shownInspection === "original"}
                    aria-controls={`${id}-inspection`}
                    onFocus={(e) => inspect("original", e.currentTarget)}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse")
                        inspect("original", e.currentTarget);
                    }}
                    onClick={(e) => inspect("original", e.currentTarget)}
                  >
                    <span>{amount(props.prepare?.original)}</span>
                    <small>
                      Inspect Original <span aria-hidden="true">â†—</span>
                    </small>
                  </button>
                </div>
                {story.showNew && (
                  <div
                    className={`${styles.salaryRow} ${story.aligned ? "" : styles.offsetRow}`}
                  >
                    <div className={styles.rowLabel}>
                      <span className={styles.eyebrow}>AFTER THE REVIEW</span>
                      <strong>New</strong>
                      <span>The amount after review</span>
                    </div>
                    <button
                      className={`${styles.salaryStrip} ${styles.newStrip}`}
                      disabled={disabled}
                      aria-expanded={shownInspection === "new"}
                      aria-controls={`${id}-inspection`}
                      onFocus={(e) => inspect("new", e.currentTarget)}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse")
                          inspect("new", e.currentTarget);
                      }}
                      onClick={(e) => inspect("new", e.currentTarget)}
                    >
                      <span>{amount(props.prepare?.next)}</span>
                      <small>
                        Inspect New <span aria-hidden="true">â†—</span>
                      </small>
                    </button>
                  </div>
                )}
                {story.aligned && (
                  <p className={styles.baseline}>
                    Shared starting line{" "}
                    <span aria-hidden="true">
                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                    </span>{" "}
                    Same peso scale
                  </p>
                )}
                {story.showDifference && (
                  <div className={styles.difference}>
                    <span aria-hidden="true">â”‚</span>
                    <p>
                      <strong>
                        Difference Â·{" "}
                        {amount(props.prepare?.difference ?? undefined)}
                      </strong>
                      <br />
                      New âˆ’ Original Â· the endpoints coincide.
                    </p>
                  </div>
                )}
                {story.showReference && (
                  <button
                    className={styles.referenceStrip}
                    disabled={disabled}
                    onFocus={(e) => inspect("reference", e.currentTarget)}
                    onClick={(e) => inspect("reference", e.currentTarget)}
                  >
                    Original reference Â· {amount(props.prepare?.original)}{" "}
                    <strong>100% of itself</strong>
                  </button>
                )}
                {story.showPercentage && (
                  <div className={styles.formula}>
                    <p>(New âˆ’ Original) Ã· Original Ã— 100</p>
                    <strong>{props.prepare?.percentage}% change</strong>
                    <span>The result is expressed as a percentage.</span>
                  </div>
                )}
              </div>
              {shownInspection && (
                <aside
                  id={`${id}-inspection`}
                  className={styles.inspection}
                  aria-label="Model inspection"
                >
                  <div>
                    <span className={styles.eyebrow}>
                      Look closer Â· {shownInspection}
                    </span>
                    <h4>
                      {shownInspection === "original"
                        ? "A role, not just a number."
                        : shownInspection === "new"
                          ? "A second moment in time."
                          : "The reference stays intact."}
                    </h4>
                    <p>
                      {shownInspection === "original"
                        ? "Original is the salary before the review. It remains the reference when we compare the later amount."
                        : shownInspection === "new"
                          ? "New tells us the salary after the review. Its role comes from when it was recorded, not from being a different number."
                          : "The Original is 100% of itself. Percentage change describes the difference as a share of that Originalâ€”not the whole salary as a share of itself."}
                    </p>
                    <div className={styles.inspectionDiagram}>
                      <span>
                        {shownInspection === "new" ? "After" : "Before"}
                      </span>
                      <span aria-hidden="true">â†’</span>
                      <strong>
                        {shownInspection === "new" ? "New" : "Original"}
                      </strong>
                    </div>
                  </div>
                  <button
                    disabled={disabled}
                    onClick={dismiss}
                    aria-label="Close model inspection"
                  >
                    Close Ã—
                  </button>
                </aside>
              )}
              <p className={styles.caption}>{story.moment.caption}</p>
              <div
                className={styles.playback}
                aria-label="Explanation playback"
              >
                <button
                  disabled={disabled || reduced}
                  aria-label={
                    playing && story.position < story.end
                      ? "Pause explanation"
                      : "Play explanation"
                  }
                  onClick={() => {
                    if (time >= story.end) setTime(0);
                    setInspection(null);
                    setPlaying(!playing || story.position >= story.end);
                  }}
                >
                  {playing && story.position < story.end ? "Pause" : "Play"}
                </button>
                <button
                  disabled={disabled || story.index === 0}
                  onClick={() => seek((story.index - 1) * momentDuration)}
                >
                  Previous moment
                </button>
                <label className={styles.scrubber}>
                  Explanation position
                  <input
                    type="range"
                    min="0"
                    max={story.end}
                    step="1"
                    value={story.position}
                    disabled={disabled}
                    aria-valuetext={story.moment.name}
                    onChange={(e) => seek(Number(e.currentTarget.value))}
                  />
                </label>
                <button
                  disabled={disabled || story.index === (checked ? 6 : 3)}
                  onClick={() => seek((story.index + 1) * momentDuration)}
                >
                  Next moment
                </button>
                <button disabled={disabled} onClick={() => seek(0)}>
                  Restart
                </button>
              </div>
              <nav className={styles.moments} aria-label="Explanation moments">
                {prepareMoments
                  .slice(0, checked ? 7 : 4)
                  .map((moment, index) => (
                    <button
                      key={moment.name}
                      disabled={disabled}
                      aria-current={story.index === index ? "step" : undefined}
                      onClick={() => seek(index * momentDuration)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>{" "}
                      {moment.name}
                    </button>
                  ))}
              </nav>
              {reduced && (
                <p className={styles.motionNote}>
                  Reduced motion: use the named moments or position slider. All
                  teaching is available without playback.
                </p>
              )}
            </div>
            {entry && (
              <div className={styles.nextPanel}>
                <div>
                  <p className={styles.eyebrow}>Now itâ€™s your turn</p>
                  <h3>Give the two amounts their roles.</h3>
                  <p>You can return to every model moment while you reason.</p>
                </div>
                <button
                  className={styles.primary}
                  disabled={disabled}
                  onClick={() => {
                    setInspection(null);
                    setPlaying(false);
                    seek(3 * momentDuration);
                    onIntent("CONTINUE");
                  }}
                >
                  Make your comparison <span aria-hidden="true">â†’</span>
                </button>
              </div>
            )}
            {editable && (
              <section
                className={styles.response}
                aria-label="Guided reasoning"
              >
                <div className={styles.responseIntro}>
                  <p className={styles.eyebrow}>
                    Your comparison Â·{" "}
                    {question < 4 ? `${question + 1} of 4` : "Review"}
                  </p>
                  <h3>Look. Choose. Make the connection.</h3>
                  <p>
                    Choose each response yourself. Nothing is checked until you
                    ask to check your reasoning.
                  </p>
                  <ol>
                    {fields.map((field, index) => (
                      <li key={field.role}>
                        <button
                          disabled={disabled}
                          aria-current={question === index ? "step" : undefined}
                          onClick={() => setQuestion(index)}
                        >
                          {index + 1}. {field.role}{" "}
                          <span>
                            {selections[field.role]
                              ? "Selected"
                              : "Not selected"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={styles.question}>
                  {question < 4 && current ? (
                    <>
                      <fieldset disabled={disabled}>
                        <legend>{qcopy(question, "title")}</legend>
                        <p>{qcopy(question, "prompt")}</p>
                        {current.options?.map((option) => (
                          <label className={styles.option} key={option.id}>
                            <input
                              type="radio"
                              name={`${id}-${current.role}`}
                              value={option.id}
                              checked={selections[current.role] === option.id}
                              onChange={() =>
                                props.onDraft?.({
                                  ...selections,
                                  [current.role]: option.id,
                                })
                              }
                            />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </fieldset>
                      <div className={styles.actions}>
                        <button
                          disabled={disabled || question === 0}
                          onClick={() => setQuestion(question - 1)}
                        >
                          Previous question
                        </button>
                        <button
                          className={styles.primary}
                          disabled={disabled}
                          onClick={() => setQuestion(question + 1)}
                        >
                          {question === 3
                            ? "Review my choices"
                            : "Next question"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4>Your choices, together.</h4>
                      <dl className={styles.summary}>
                        {fields.map((field, index) => (
                          <div key={field.role}>
                            <dt>{field.role}</dt>
                            <dd>
                              {field.options?.find(
                                (option) =>
                                  option.id === selections[field.role],
                              )?.text ?? "Not selected"}
                            </dd>
                            <button
                              disabled={disabled}
                              onClick={() => setQuestion(index)}
                            >
                              Edit {field.role}
                            </button>
                          </div>
                        ))}
                      </dl>
                      <button
                        className={styles.primary}
                        disabled={
                          disabled ||
                          !frame.allowedLearnerIntents.some(
                            (intent) =>
                              intent === "CHECK_RESPONSE" ||
                              intent === "CHECK_AGAIN",
                          )
                        }
                        onClick={() => {
                          setPlaying(false);
                          setInspection(null);
                          onIntent(
                            frame.allowedLearnerIntents.includes("CHECK_AGAIN")
                              ? "CHECK_AGAIN"
                              : "CHECK_RESPONSE",
                          );
                        }}
                      >
                        Check my reasoning
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
            {frame.feedbackState && (
              <div
                ref={feedback}
                data-feedback
                data-presentation-identity={props.presentationIdentity}
                data-content-id={frame.feedbackState.content.id}
                className={styles.feedback}
              >
                <FeedbackSurface
                  feedback={{
                    outcome: frame.feedbackState.outcome,
                    content: frame.feedbackState.content.text,
                  }}
                />
                <p>
                  Use moments 05â€“07 to connect the checked difference to the
                  Original reference. You may revise your choices or finish this
                  activity.
                </p>
                <div className={styles.actions}>
                  <button
                    disabled={disabled}
                    onClick={() => seek(4 * momentDuration)}
                  >
                    Explore the checked relationship
                  </button>
                  {frame.allowedLearnerIntents.includes("REVISE") && (
                    <button
                      disabled={disabled}
                      onClick={() => {
                        setPlaying(false);
                        setInspection(null);
                        setTime(3 * momentDuration);
                        setQuestion(0);
                        onIntent("REVISE");
                      }}
                    >
                      Revise response
                    </button>
                  )}
                  {frame.allowedLearnerIntents.includes("FINISH_ACTIVITY") && (
                    <button
                      className={styles.primary}
                      disabled={disabled}
                      onClick={() => onIntent("FINISH_ACTIVITY")}
                    >
                      Finish activity
                    </button>
                  )}
                </div>
              </div>
            )}
            {complete && (
              <div className={styles.nextPanel}>
                <div>
                  <p className={styles.eyebrow}>Prepare complete</p>
                  <h3>The amount does not decide the role.</h3>
                  <p>
                    Original is the starting reference. New is the amount after
                    the review. Next, investigate what happens when salaries do
                    change.
                  </p>
                </div>
                {props.canContinueSession && (
                  <button
                    className={styles.primary}
                    disabled={disabled}
                    onClick={props.onContinueSession}
                  >
                    Next activity <span aria-hidden="true">â†’</span>
                  </button>
                )}
              </div>
            )}
            {(frame.allowedLearnerIntents.includes("OPEN_SUPPORT") ||
              supportOpen) && (
              <button
                className={styles.review}
                ref={reviewInvoker}
                disabled={blocked}
                onClick={() => props.onSupport?.("REVIEW")}
              >
                Review
              </button>
            )}
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <span>THE CHANGE WORKSHOP</span>
        <span>Original â†’ New â†’ Difference â†’ Meaning</span>
      </footer>
      <ModalSurface
        open={supportOpen}
        title="Review"
        description="Activity relationship review"
        closeLabel="Close review"
        invokingControlRef={reviewInvoker}
        onClose={() => props.onSupport?.("CLOSE")}
      >
        {frame.review && (
          <ReviewSurface
            review={{
              origin: frame.review,
              relationships: frame.review.relationships,
            }}
            closeLabel="Return to activity"
            onClose={() => props.onSupport?.("CLOSE")}
          />
        )}
      </ModalSurface>
      <AccessibilityCoordinator
        blocked={disabled}
        event={{
          kind: "major-step",
          identity: `${frame.activityId}/${frame.stateId}/${landing ? "landing" : "workshop"}`,
          target: heading,
        }}
      />
    </section>
  );
}
