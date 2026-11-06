import { useEffect, useId, useRef, useState } from "react";
import type { C03PreparePresentation } from "./public";
import { ApplyIllustration } from "./ApplyIllustration";
import { ApplyRecap } from "./ApplyRecap";
import { ApplyGuidance } from "./ApplyGuidance";
import { ExploreGlyph } from "./ExploreGlyph";
import { ApplyEvidence } from "./ApplyEvidence";
import { ApplyResponse } from "./ApplyResponse";
import { useWorkRecordMotion } from "./use-work-record-motion";
import base from "./work-record.module.css";
import styles from "./apply.module.css";
import { LessonMasthead } from "../../navigation/public";

export function ApplyWorkRecord(props: C03PreparePresentation) {
  const { projection, blocked, onFeedbackPresented } = props;
  const { frame } = projection;
  const id = useId();
  const [panel, setPanel] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const support = useRef<HTMLDivElement>(null);
  const wasSupporting = useRef(false);
  const focused = useRef("");
  const supporting = Boolean(frame.review);
  const disabled = blocked || supporting;
  const entry = frame.stateId === "ENTRY";
  const complete = frame.stateId === "COMPLETE";
  useWorkRecordMotion(surface, frame.stateId, disabled);
  const can = (intent: string) =>
    !disabled && frame.allowedLearnerIntents.some((item) => item === intent);
  const copy = (role: string) =>
    frame.contentReferences.find((item) => item.id === `c03/S03/${role}`)?.text;
  useEffect(() => {
    if (blocked) return;
    if (supporting) {
      wasSupporting.current = true;
      support.current?.focus();
      return;
    }
    if (wasSupporting.current) {
      wasSupporting.current = false;
      help.current?.focus();
      return;
    }
    if (focused.current !== frame.stateId) {
      focused.current = frame.stateId;
      heading.current?.focus({ preventScroll: true });
    }
  }, [frame.stateId, blocked, supporting]);
  useEffect(() => {
    const element = feedback.current;
    if (
      !disabled &&
      frame.feedbackState &&
      element?.isConnected &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      onFeedbackPresented?.(element);
  }, [disabled, frame.feedbackState, onFeedbackPresented]);
  if (frame.activityId !== "C03-A03")
    throw new TypeError("Apply requires the canonical C03-A03 projection");

  return (
    <article
      ref={surface}
      className={`${base.workshop} ${styles.workshop}`}
      data-c03-track="C03-A03"
      aria-labelledby={id}
    >
      <LessonMasthead>
        <header className={base.masthead}>
          <span className={base.brand}>p.a.i.d.</span>
          <span className={base.mastLabel}>The money &amp; math workshop</span>
          <span className={base.edition}>Grade 11</span>
        </header>
      </LessonMasthead>
      <div className={`${base.sheet} ${styles.sheet}`}>
        <div inert={supporting} aria-hidden={supporting || undefined}>
          {entry ? (
            <>
              <section className={styles.landing} data-motion="scene">
                <div className={base.entryCopy}>
                  <p className={base.eyebrow}>03 / Apply · Overtime pay</p>
                  <h2 id={id} ref={heading} tabIndex={-1}>
                    Extra hours.
                    <br />
                    <em>Your calculation.</em>
                  </h2>
                  <p className={base.lead}>
                    You’ve seen what the day can change. Now put that idea to
                    work for James.
                  </p>
                  <p
                    className={base.scenario}
                    data-content-id="c03/S03/scenario"
                  >
                    {copy("scenario")}
                  </p>
                  <button
                    className={base.primary}
                    disabled={!can("CONTINUE")}
                    onClick={() => props.onAction("CONTINUE")}
                  >
                    Open James’s work record <ExploreGlyph name="next" />
                  </button>
                </div>
                <ApplyIllustration projection={projection} />
              </section>
              <div className={base.entryBottom}>
                <span aria-hidden="true">
                  <ExploreGlyph name="next" />
                </span>
                <p>
                  <strong>What are those ten extra hours worth?</strong>
                  <br />
                  Choose the multiplier for the day, then work out James’s
                  overtime pay.
                </p>
              </div>
            </>
          ) : complete ? (
            <ApplyRecap
              {...props}
              blocked={disabled}
              heading={heading}
              titleId={id}
            />
          ) : (
            <>
              <header className={styles.lessonHeading}>
                <p className={base.eyebrow}>03 / APPLY · JAMES’S OVERTIME</p>
                <h2 id={id} ref={heading} tabIndex={-1}>
                  Make the evidence <em>add up.</em>
                </h2>
              </header>
              <div className={styles.workspace}>
                <ApplyEvidence
                  projection={projection}
                  blocked={disabled}
                  focus={
                    projection.diagnostic === "CONDITION_MULTIPLIER"
                      ? "condition"
                      : projection.diagnostic === "ARITHMETIC"
                        ? "calculation"
                        : panel === 0
                          ? "condition"
                          : "calculation"
                  }
                />
                <ApplyResponse
                  {...props}
                  blocked={disabled}
                  panel={panel}
                  onPanel={setPanel}
                />
              </div>
              {frame.feedbackState && (
                <div
                  ref={feedback}
                  className={`${base.feedback} ${styles.feedback}`}
                  role="status"
                  data-outcome={frame.feedbackState.outcome}
                >
                  <h3>
                    {frame.feedbackState.outcome === "CONFIRMED"
                      ? "Your calculation holds together."
                      : "Trace the reasoning again."}
                  </h3>
                  <p data-content-id={frame.feedbackState.content.id}>
                    {frame.feedbackState.content.text}
                  </p>
                  {frame.feedbackState.outcome === "RECONSIDERATION" && (
                    <ApplyGuidance projection={projection} />
                  )}
                </div>
              )}
              <footer className={base.actions}>
                <div className={base.actionGroup}>
                  {can("REVISE") && (
                    <button
                      className={base.secondary}
                      onClick={() => props.onAction("REVISE")}
                    >
                      Revise my calculation
                    </button>
                  )}
                  {can("OPEN_SUPPORT") && (
                    <button
                      ref={help}
                      className={base.textButton}
                      onClick={props.onHelp}
                    >
                      Review the relationship
                    </button>
                  )}
                </div>
                {can("FINISH_ACTIVITY") && (
                  <button
                    className={base.primary}
                    onClick={() => props.onAction("FINISH_ACTIVITY")}
                  >
                    See my worked recap <ExploreGlyph name="next" />
                  </button>
                )}
              </footer>
            </>
          )}
        </div>
        {frame.review && (
          <div
            ref={support}
            tabIndex={-1}
            className={styles.support}
            role="region"
            aria-label="Review the overtime relationship"
          >
            <p className={base.eyebrow}>A closer look</p>
            <h3>Start with the day.</h3>
            {frame.review.relationships.map((item) => (
              <p key={item.id}>{item.text}</p>
            ))}
            <ApplyEvidence
              projection={projection}
              blocked={blocked}
              focus={panel === 0 ? "condition" : "calculation"}
            />
            <div className={styles.relationship}>
              <span>Hourly rate</span>
              <b>×</b>
              <span>Applicable multiplier</span>
              <b>×</b>
              <span>Overtime hours</span>
            </div>
            <p>
              James’s hourly rate is already established. The 10 hours are a
              monthly total, not a single shift. Stop at overtime pay.
            </p>
            <button
              className={base.primary}
              disabled={blocked}
              onClick={props.onCloseHelp}
            >
              Return to my calculation
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
