import { useEffect, useId, useRef, useState } from "react";
import type { C04Presentation } from "./public";
import { PrepareLegacyResponse } from "./PrepareLegacyResponse";
import { PrepareV3Experience } from "./PrepareV3Experience";
import { PrepareSituation } from "./PrepareSituation";
import {
  momentDuration,
  prepareMoments,
  projectPrepareStory,
} from "./prepare-story";
import "../c04-reference/styles.css";
import "../c04-reference/atmosphere.css";
import "../c04-reference/refinement.css";
import "../c04-reference/instructional-enhancement.css";
import styles from "./prepare.module.css";
import { LessonMasthead } from "../../navigation/public";

export function PrepareExperience(props: C04Presentation) {
  if (props.prepareContractId === "C04-A01-interpretation-v1")
    return <PrepareLegacyResponse {...props} />;
  if (props.prepareContractId === "C04-A01-guided-prepare-v3")
    return <PrepareV3Experience {...props} />;
  return <PrepareWorkshop {...props} />;
}
function PrepareWorkshop(props: C04Presentation) {
  const { frame, blocked, onIntent, onPresented } = props;
  const [reading, setReading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const inspectionId = useId();
  const story = projectPrepareStory(time);
  const complete = frame.stateId === "COMPLETE";
  const entry = frame.stateId === "ENTRY";
  const showStory = reviewing || (entry && reading);
  const showLanding = entry && !reading && !reviewing;
  const identity = `${frame.stateId}/${frame.responseStage}/${showStory}/${showLanding}`;
  const field = props.fields?.[0];
  const current = props.prepareSelections?.[field?.role ?? ""];
  const can = (intent: Parameters<typeof onIntent>[0]) =>
    !blocked && frame.allowedLearnerIntents.includes(intent);
  const question = Math.max(0, props.prepareStageIndex ?? 0);
  const copy = (part: string) =>
    frame.contentReferences.find(
      (item) => item.id === `c04/S01/diagnostic-q${question + 1}-${part}`,
    )?.text ?? "";
  const records = props.prepareRecordedLabels ?? [];
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(media.matches);
      setPlaying(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!playing || blocked || !showStory) return;
    let request = 0,
      previous = performance.now();
    const tick = (now: number) => {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      const elapsed = Math.min(100, now - previous);
      previous = now;
      setTime((value) => Math.min(story.end, value + elapsed));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, blocked, showStory, story.end]);
  useEffect(() => {
    if (blocked) return;
    heading.current?.focus({ preventScroll: true });
    if (reduced || !surface.current) return;
    const animations: Animation[] = [];
    const animate = (
      element: Element | null,
      frames: Keyframe[],
      duration: number,
      delay = 0,
    ) => {
      const animation = element?.animate?.(frames, {
        duration,
        delay,
        easing: "cubic-bezier(.2,.75,.25,1)",
        fill: "backwards",
      });
      if (animation) animations.push(animation);
    };
    animate(
      surface.current.querySelector(
        ".entry, .workbench, .consolidation-layout, .completion",
      ),
      [{ transform: "translateX(18px)" }, { transform: "none" }],
      340,
    );
    surface.current
      .querySelectorAll(
        "h2, .entry-copy > p, .check-header > p, .recap-section-heading",
      )
      .forEach((element, index) =>
        animate(
          element,
          [
            {
              transform: "translateY(15px)",
              // Keep diagnostic instructions readable during their entrance.
              opacity: element.matches(".check-header > .lead") ? 1 : 0,
              clipPath: "inset(0 0 100% 0)",
            },
            { transform: "none", opacity: 1, clipPath: "inset(0)" },
          ],
          420,
          index * 90,
        ),
      );
    return () => animations.forEach((animation) => animation.cancel());
  }, [identity, blocked, reduced]);
  useEffect(() => {
    if (blocked || reduced || !showStory) return;
    const animations: Animation[] = [];
    surface.current
      ?.querySelectorAll(".story-caption.is-current")
      .forEach((element, index) => {
        const animation = element.animate?.(
          [
            { opacity: 0, transform: "translateY(15px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 420,
            delay: index * 90,
            easing: "cubic-bezier(.2,.75,.25,1)",
            fill: "backwards",
          },
        );
        if (animation) animations.push(animation);
      });
    return () => animations.forEach((animation) => animation.cancel());
  }, [story.index, story.cue, showStory, blocked, reduced]);
  useEffect(() => {
    if (blocked || reduced || !showStory) return;
    const animations: Animation[] = [];
    surface.current
      ?.querySelectorAll(
        ".story-narration h3, [data-document]:not([style*='display: none'])",
      )
      .forEach((element, index) => {
        // Individual translate preserves the SVG documents' composed transform attributes.
        const animation = element.animate?.(
          [
            { opacity: 0, translate: "0 15px" },
            { opacity: 1, translate: "0 0" },
          ],
          {
            duration: 420,
            delay: index * 90,
            easing: "cubic-bezier(.2,.75,.25,1)",
            fill: "backwards",
          },
        );
        if (animation) animations.push(animation);
      });
    return () => animations.forEach((animation) => animation.cancel());
  }, [story.index, showStory, blocked, reduced]);
  useEffect(() => {
    if (
      !blocked &&
      !reviewing &&
      frame.feedbackState &&
      feedback.current?.isConnected
    )
      onPresented?.("feedback", feedback.current);
  }, [blocked, reviewing, frame, onPresented]);
  function seek(value: number) {
    if (blocked) return;
    setPlaying(false);
    setTime(projectPrepareStory(value).position);
  }
  function review() {
    setPlaying(false);
    setReviewing(true);
  }
  return (
    <section
      className={`c04-reference ${styles.workshop}`}
      data-c04-track="C04-A01"
      data-prepare-contract="v4"
    >
      <LessonMasthead>
        <header className="masthead">
          <span className="brand">p.a.i.d.</span>
          <span className="mast-label">The money &amp; math workshop</span>
          <span className="edition">Grade 11</span>
        </header>
      </LessonMasthead>
      <div className="reference-main" ref={surface}>
        {showLanding ? (
          <>
            <section className="entry">
              <div className="entry-copy">
                <h2 ref={heading} tabIndex={-1}>
                  A review.
                  <br />
                  <em>A different salary?</em>
                </h2>
                <p className="lead">
                  Maya’s company has reviewed her salary. What would you look at
                  to decide what happened?
                </p>
                <p className={`lead ${styles.introduction}`}>
                  Let’s look at her two salary statements. Then you’ll share
                  what you notice. There’s no score—just a few ideas to explore.
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={blocked}
                  onClick={() => setReading(true)}
                >
                  Start with Maya <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="entry-art">
                <PrepareSituation inspectionId={`${inspectionId}-entry`} />
              </div>
            </section>
            <section className="entry-bottom">
              <span className="mini-icon" aria-hidden="true">
                ₱
              </span>
              <p>
                <strong>Begin with what you notice</strong>
                <br />
                What can two salary statements tell you—and what would you want
                to investigate?
              </p>
            </section>
          </>
        ) : showStory ? (
          <>
            <p className="stage-orientation">Prepare · Notice and wonder</p>
            <section className="lesson-heading">
              <h2 ref={heading} tabIndex={-1}>
                What catches <em>your attention?</em>
              </h2>
            </section>
            <section className="workbench">
              <div
                className="employee-story"
                data-playing={playing && time < story.end}
              >
                <div className="story-composition">
                  <PrepareSituation
                    before={story.showBefore}
                    after={story.showAfter}
                    interactive
                    blocked={blocked}
                    pause={() => setPlaying(false)}
                    announce={setAnnouncement}
                    inspectionId={inspectionId}
                  />
                  <div className="story-narration">
                    <p className="story-kicker">MAYA’S SALARY REVIEW</p>
                    <h3>{story.moment.title}</h3>
                    {story.moment.captions.map((caption, index) => (
                      <p
                        key={caption}
                        hidden={index > story.cue}
                        className={`story-caption ${index === story.cue ? "is-current" : ""}`}
                      >
                        {caption}
                      </p>
                    ))}
                  </div>
                </div>
                <div
                  className="story-playback"
                  role="group"
                  aria-label="Situation playback"
                >
                  <button
                    className="story-skip"
                    aria-label="Previous moment"
                    disabled={blocked || story.index === 0}
                    onClick={() => seek((story.index - 1) * momentDuration)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m14 6-6 6 6 6" />
                    </svg>
                  </button>
                  <button
                    className="story-play"
                    aria-label={
                      playing && time < story.end
                        ? "Pause situation"
                        : "Play situation"
                    }
                    disabled={blocked}
                    onClick={() => {
                      if (time === story.end) setTime(0);
                      setPlaying(!playing || time === story.end);
                    }}
                  ></button>
                  <button
                    className="story-skip"
                    aria-label="Next moment"
                    disabled={blocked || story.index === 5}
                    onClick={() => seek((story.index + 1) * momentDuration)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m10 6 6 6-6 6" />
                    </svg>
                  </button>
                  <button
                    className="story-restart"
                    aria-label="Replay from start"
                    disabled={blocked}
                    onClick={() => seek(0)}
                  >
                    <span aria-hidden="true">↺</span> Restart
                  </button>
                  <label>
                    Situation position
                    <input
                      type="range"
                      min="0"
                      max={story.end}
                      step="100"
                      value={time}
                      disabled={blocked}
                      aria-valuetext={`${story.moment.name}, ${(time / 1000).toFixed(1)} seconds`}
                      onChange={(event) =>
                        seek(Number(event.currentTarget.value))
                      }
                    />
                  </label>
                  <span className="story-time" aria-hidden="true">
                    {(time / 1000).toFixed(1)} / 51 s
                  </span>
                </div>
                <div
                  className="story-moments"
                  role="group"
                  aria-label="Choose a story moment"
                >
                  {prepareMoments.map((moment, index) => (
                    <button
                      key={moment.name}
                      aria-label={`0${index + 1} ${moment.name}`}
                      disabled={blocked}
                      aria-pressed={index === story.index}
                      onClick={() => seek(index * momentDuration)}
                    >
                      <span className="chapter-number">0{index + 1}</span>
                      <svg viewBox="0 0 66 28" aria-hidden="true">
                        <rect x="5" y="3" width="23" height="22" rx="2" />
                        <path
                          d={
                            index >= 3
                              ? "M38 3h23v22H38ZM31 14h5"
                              : "M11 9h12M11 14h12M11 19h8"
                          }
                        />
                      </svg>
                      <span className="chapter-title">{moment.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <div className="lesson-nav">
              <button
                className="text-button"
                disabled={blocked}
                onClick={() => {
                  setPlaying(false);
                  if (reviewing) setReviewing(false);
                  else setReading(false);
                }}
              >
                ←{" "}
                {reviewing
                  ? complete
                    ? "Return to recap"
                    : "Return to your thinking"
                  : "Introduction"}
              </button>
              {!reviewing && (
                <button
                  className="primary"
                  disabled={!can("CONTINUE")}
                  onClick={() => {
                    setPlaying(false);
                    onIntent("CONTINUE");
                  }}
                >
                  Share your first thinking →
                </button>
              )}
            </div>
          </>
        ) : complete ? (
          <section className="completion recap-summary" data-recap>
            <header className="recap-hero">
              <div className="completion-seal" aria-hidden="true">
                ✓
              </div>
              <p className="recap-eyebrow">Your starting point</p>
              <h2 ref={heading} tabIndex={-1}>
                Keep asking:
                <br />
                <em>“What am I comparing?”</em>
              </h2>
              <p className="recap-takeaway">
                Your first ideas.
                <br />
                Your next questions.
              </p>
              <p className="recap-stage">
                You shared your ideas on {records.length} of 4 questions.
                {records.length < 4
                  ? " You can leave the other questions for now."
                  : " Here’s what you thought about Maya’s story."}{" "}
                These are starting ideas to explore, not a score.
              </p>
            </header>
            <section>
              <div className="recap-section-heading">
                <span aria-hidden="true">01</span>
                <div>
                  <h3>What you brought to the story</h3>
                  <p>
                    Keep these ideas in mind as we look at another salary story.
                  </p>
                </div>
              </div>
              <ol className={styles.recapList}>
                {records.map((record) => (
                  <li key={record.role}>
                    <h4>
                      {{
                        original: "The first salary",
                        new: "The later salary",
                        difference: "The difference",
                        interpretation: "What happened",
                      }[record.role] ?? record.role}
                    </h4>
                    <p>You chose: {record.text}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section className="recap-transfer">
              <h3>Take a question into the next activity</h3>
              <p className={styles.note}>
                Two employees receive the same extra money. Would that tell you
                whether their salaries grew by the same percentage? Keep your
                first thinking in mind as you investigate.
              </p>
            </section>
            <div className="completion-actions">
              {props.canContinueSession && (
                <button
                  className="primary"
                  disabled={blocked}
                  onClick={props.onContinueSession}
                >
                  Explore and Learn →
                </button>
              )}
              <button
                className="text-button"
                disabled={blocked}
                onClick={review}
              >
                Revisit Maya’s story →
              </button>
              <button
                className="text-button"
                disabled={blocked}
                onClick={props.onReturnToLibrary}
              >
                Return to the Learning Library
              </button>
            </div>
          </section>
        ) : (
          <div className={styles.diagnostic}>
            <section className="check-header">
              <p className="practice-count">
                Your first thinking · {question + 1} of 4
              </p>
              <h2 ref={heading} tabIndex={-1}>
                {copy("title")}
              </h2>
              <p className="lead">{copy("prompt")}</p>
            </section>
            <div className="consolidation-layout">
              <section
                className="choice-panel"
                aria-label="Your first thinking"
              >
                <fieldset
                  disabled={
                    blocked ||
                    !frame.allowedLearnerIntents.includes("RESPONSE_CHANGED")
                  }
                >
                  <legend>Choose the statement closest to your thinking</legend>
                  {field?.options?.map((option) => (
                    <label
                      className={`choice ${current === option.id ? "selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name="prepare-answer"
                        value={option.id}
                        checked={current === option.id}
                        onChange={() =>
                          props.onDraft?.({ [field.role]: option.id })
                        }
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </fieldset>
                {frame.feedbackState && (
                  <div
                    className="feedback"
                    role="status"
                    ref={feedback}
                    data-content-id={frame.feedbackState.content.id}
                    data-presentation-identity={props.presentationIdentity}
                  >
                    <h3>Thanks for sharing your idea.</h3>
                    <p>{frame.feedbackState.content.text}</p>
                  </div>
                )}
                {(can("CHECK_RESPONSE") || can("CHECK_AGAIN")) && (
                  <button
                    className="primary"
                    disabled={blocked}
                    onClick={() =>
                      onIntent(
                        can("CHECK_RESPONSE")
                          ? "CHECK_RESPONSE"
                          : "CHECK_AGAIN",
                      )
                    }
                  >
                    Share my thinking →
                  </button>
                )}
                <div className={styles.actions}>
                  {can("NEXT_GUIDED_QUESTION") && (
                    <button
                      className="primary"
                      onClick={() => onIntent("NEXT_GUIDED_QUESTION")}
                    >
                      Next question →
                    </button>
                  )}
                  {can("FINISH_ACTIVITY") && question === 3 && (
                    <button
                      className="primary"
                      onClick={() => onIntent("FINISH_ACTIVITY")}
                    >
                      See your recap →
                    </button>
                  )}
                  {can("REVISE") && (
                    <button
                      className="text-button"
                      onClick={() => onIntent("REVISE")}
                    >
                      Change my choice
                    </button>
                  )}
                  {can("FINISH_ACTIVITY") && question < 3 && (
                    <button
                      className="text-button"
                      onClick={() => onIntent("FINISH_ACTIVITY")}
                    >
                      Finish here for now
                    </button>
                  )}
                </div>
                <p className={styles.note}>
                  There’s no score. Choose what makes sense to you now—we’ll
                  explore these ideas together. You don’t need to be right to
                  continue.
                </p>
              </section>
              <aside
                className="practice-visual"
                aria-label="Maya’s salary documents"
              >
                <PrepareSituation inspectionId={`${inspectionId}-questions`} />
              </aside>
            </div>
            <div className="lesson-nav">
              <button
                className="text-button"
                disabled={blocked}
                onClick={review}
              >
                ← Revisit Maya’s story
              </button>
            </div>
          </div>
        )}
      </div>
      <footer className="site-footer">Prepare · Percentage change</footer>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </section>
  );
}
