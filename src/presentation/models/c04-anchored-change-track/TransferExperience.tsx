import { useEffect, useId, useRef } from "react";
import { ModalSurface, ReviewSurface } from "@/presentation/support/public";
import type { C04Presentation } from "./public";
import { TransferResponse } from "./TransferResponse";
import { TransferModel } from "./TransferModel";
import { TransferCompletion } from "./TransferCompletion";
import "../c04-reference/styles.css";
import "../c04-reference/atmosphere.css";
import "../c04-reference/refinement.css";
import "../c04-reference/instructional-enhancement.css";
import styles from "./transfer.module.css";
import { LessonMasthead } from "../../navigation/public";
import { revealHeading } from "../../activity/public";

export function TransferExperience(props: C04Presentation) {
  const { frame, blocked, onIntent, onPresented } = props;
  const title = useId(),
    heading = useRef<HTMLHeadingElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null),
    terminal = useRef<HTMLDivElement>(null),
    reviewInvoker = useRef<HTMLButtonElement>(null);
  const entry = frame.stateId === "ENTRY",
    complete = frame.stateId === "COMPLETE",
    teaching = frame.stateId === "POST_CONFIRMATION_EXPLANATION";
  const responding = frame.stateId === "ACTIVE" || frame.stateId === "REVISION";
  const supportOpen = Boolean(frame.review || frame.sourceReview),
    disabled = blocked || supportOpen;
  const can = (intent: Parameters<typeof onIntent>[0]) =>
    !disabled && frame.allowedLearnerIntents.includes(intent);
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c04/S04/${role}`);
  const passage = copy("undefined-result"),
    completion = copy("completion");
  const focusedStep = useRef<string | null>(null);
  useEffect(() => {
    if (disabled) return;
    const step = `${frame.stateId}/${frame.responseStage ?? ""}`;
    // Closing support restores its invoker; only a new learning step owns focus.
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    // A new step's heading lands below the lesson nav, not scrolled away.
    // The intro opens at the top with its masthead (the shell resets scroll);
    // the completion recap brings itself into view.
    if (entry || complete) heading.current?.focus({ preventScroll: true });
    else revealHeading(heading.current, Boolean(media?.matches));
    if (media?.matches) return;
    const animation = surface.current?.animate?.(
      [{ transform: "translateY(8px)" }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const stop = () => animation?.cancel();
    media?.addEventListener("change", stop);
    return () => {
      stop();
      media?.removeEventListener("change", stop);
    };
  }, [frame.stateId, frame.responseStage, disabled, entry, complete]);
  useEffect(() => {
    if (disabled) return;
    if (frame.feedbackState && feedback.current?.isConnected)
      onPresented?.("feedback", feedback.current);
    if (teaching && passage && terminal.current?.isConnected)
      onPresented?.("terminal", terminal.current);
  }, [disabled, frame.feedbackState, teaching, passage, onPresented]);
  const reported = props.responseDraft ?? {};
  return (
    <section
      className={`c04-reference ${styles.workshop}`}
      aria-labelledby={title}
      data-c04-track="C04-A04"
    >
      <LessonMasthead>
        <header className="masthead">
          <span className="brand">p.a.i.d.</span>
          <span className="mast-label">The money &amp; math workshop</span>
          <span className="edition">Grade 11</span>
        </header>
      </LessonMasthead>
      <div className="reference-main" ref={surface}>
        {entry ? (
          <div className="entry">
            <div className="entry-copy">
              <span className="eyebrow">
                <span className="green-dot" />
                04 / CHECK AND TRANSFER
              </span>
              <h2 id={title} ref={heading} tabIndex={-1}>
                Something new.
                <br />
                <em>A different start.</em>
              </h2>
              <p className="lead">
                You’ve looked at raises and a revised salary offer. Let’s try
                something a little different: an allowance that starts from
                nothing.
              </p>
              {copy("scenario") && (
                <p
                  className="entry-description"
                  data-content-id={copy("scenario")!.id}
                >
                  {copy("scenario")!.text}
                </p>
              )}
              <button
                className="primary"
                disabled={!can("CONTINUE")}
                onClick={() => onIntent("CONTINUE")}
              >
                Consider the allowance →
              </button>
            </div>
            <div className={styles.entryModel}>
              <TransferModel transfer={props.transfer} blocked={disabled} />
            </div>
          </div>
        ) : complete ? (
          <TransferCompletion {...props} titleId={title} blocked={disabled} />
        ) : (
          <>
            <header className={`lesson-heading ${styles.heading}`}>
              <div>
                <span className="eyebrow">04 / CHECK AND TRANSFER</span>
                <h2 id={title} ref={heading} tabIndex={-1}>
                  {complete ? (
                    <>
                      A change in money.
                      <br />
                      <em>A limit to the comparison.</em>
                    </>
                  ) : teaching ? (
                    <>
                      The increase is real.
                      <br />
                      <em>The percentage is undefined.</em>
                    </>
                  ) : (
                    <>
                      From no allowance
                      <br />
                      <em>to something new.</em>
                    </>
                  )}
                </h2>
              </div>
            </header>
            <div className={styles.workspace}>
              <div className={styles.situation}>
                <TransferModel transfer={props.transfer} blocked={disabled} />
                {responding && copy("scenario") && (
                  <p
                    className={styles.scenario}
                    data-content-id={copy("scenario")!.id}
                  >
                    {copy("scenario")!.text}
                  </p>
                )}
              </div>
              <div className={styles.work}>
                {responding && (
                  <TransferResponse
                    key={props.draftIdentity}
                    {...props}
                    blocked={disabled}
                  />
                )}
                {frame.feedbackState && !teaching && !complete && (
                  <>
                    <section
                      className={styles.checked}
                      aria-label="Your checked response"
                    >
                      <h3>Your response</h3>
                      <dl className={styles.record}>
                        <div>
                          <dt>Change in allowance</dt>
                          <dd>
                            {reported.difference === "UNDEFINED"
                              ? "Undefined"
                              : `₱${reported.difference ?? "—"}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Percentage change</dt>
                          <dd>
                            {reported.percentage === "UNDEFINED"
                              ? "Undefined"
                              : `${reported.percentage ?? "—"}%`}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <div
                      ref={feedback}
                      className={`feedback ${frame.feedbackState.outcome === "CONFIRMED" ? "correct" : "retry"} ${styles.feedback}`}
                      data-feedback
                      data-presentation-identity={props.presentationIdentity}
                      data-content-id={frame.feedbackState.content.id}
                      role="status"
                    >
                      <h3>
                        {frame.feedbackState.outcome === "CONFIRMED"
                          ? "Your answer holds"
                          : "Look again"}
                      </h3>
                      <p>{frame.feedbackState.content.text}</p>
                    </div>
                    <div className="lesson-nav">
                      {can("REVISE") && (
                        <button
                          className="text-button"
                          onClick={() => onIntent("REVISE")}
                        >
                          Revise my response
                        </button>
                      )}
                      <button
                        className="primary"
                        disabled={!can("CONTINUE")}
                        onClick={() => onIntent("CONTINUE")}
                      >
                        Look at the relationship →
                      </button>
                    </div>
                  </>
                )}
                {((teaching && passage) || (complete && completion)) && (
                  <div
                    ref={teaching ? terminal : undefined}
                    className={styles.explanation}
                    data-terminal={teaching ? "" : undefined}
                    data-presentation-identity={props.presentationIdentity}
                  >
                    <p
                      className={styles.conclusion}
                      data-content-id={(teaching ? passage : completion)!.id}
                    >
                      {(teaching ? passage : completion)!.text}
                    </p>
                    <div className={styles.mathComparison}>
                      <section>
                        <h3>How many pesos changed?</h3>
                        <p className={styles.equation}>
                          ₱1,500 − ₱0 = <strong>+₱1,500</strong>
                        </p>
                        <p>
                          There was no allowance before, and now there’s ₱1,500.
                          So we can say how much it grew: ₱1,500 more each
                          month.
                        </p>
                      </section>
                      <section>
                        <h3>What about the percentage increase?</h3>
                        <p className={styles.equation}>
                          <span className={styles.fraction}>
                            <span>₱1,500</span>
                            <span>₱0</span>
                          </span>
                          <span>× 100</span>
                          <strong>Undefined</strong>
                        </p>
                        <p>
                          To find a percentage change, we divide the increase by
                          the amount we started with. Here, that would mean
                          dividing ₱1,500 by zero—and division by zero isn’t
                          defined.
                        </p>
                      </section>
                    </div>
                    <p className={styles.transfer}>
                      In the earlier examples, there was already some money to
                      compare the change with. Here we started with zero. That
                      doesn’t stop us describing the gain: the allowance rose by
                      ₱1,500. It just means we can’t express that gain as a
                      percentage of the original.
                    </p>
                    <div className="lesson-nav">
                      {teaching && (
                        <button
                          className="primary"
                          disabled={!can("FINISH_ACTIVITY")}
                          onClick={() => onIntent("FINISH_ACTIVITY")}
                        >
                          Finish activity
                        </button>
                      )}
                      {complete && (
                        <button
                          className="primary"
                          disabled={disabled}
                          onClick={props.onReturnToLibrary}
                        >
                          Return to the Learning Library →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {(frame.allowedLearnerIntents.includes("OPEN_SUPPORT") ||
              supportOpen) && (
              <div className={styles.review}>
                <button
                  ref={reviewInvoker}
                  className="text-button"
                  disabled={blocked}
                  onClick={() => props.onSupport?.("REVIEW")}
                >
                  Review the relationship
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="site-footer">
        <span>Check and Transfer · Percentage change</span>
        <span>
          {complete
            ? "The end of this percentage-change journey."
            : "Monthly communication allowance"}
        </span>
      </footer>
      <ModalSurface
        open={supportOpen}
        title="Review the relationship"
        description="The allowance and its original reference"
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
            closeLabel="Return to the allowance"
            onClose={() => props.onSupport?.("CLOSE")}
          />
        )}
      </ModalSurface>
    </section>
  );
}
