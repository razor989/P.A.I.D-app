import { useEffect, useState } from "react";
import type { C06PreparePresentation } from "./public";
import { ExploreComparison, ExploreModel } from "./ExploreModel";
import { exploreChapters, exploreDuration, exploreMoment } from "./explore-story";
import { ExploreNarration } from "./ExploreNarration";
import { MomentThumbnail } from "./MomentThumbnail";
import styles from "./commission.module.css";
import e from "./explore.module.css";

export function ExploreStory({
  stage,
  ...props
}: C06PreparePresentation & { stage: number }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const chapter = exploreChapters[stage]!;
  const { cue, progress, starts, end } = exploreMoment(
    time,
    chapter.moments.map((m) => m[1]),
  );
  const disabled = props.blocked || Boolean(props.projection.frame.review);
  const selected = props.projection.frame.modelSelectionControl?.selectedId;
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const pause = () => {
      setPlaying(false);
      setReduced(media.matches);
    };
    media.addEventListener("change", pause);
    return () => media.removeEventListener("change", pause);
  }, []);
  useEffect(() => {
    if (!playing || disabled) return;
    let request = 0,
      previous = performance.now();
    function tick(now: number) {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      const delta = Math.max(0, Math.min(100, now - previous));
      previous = now;
      setTime((value) => Math.min(end, value + delta));
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, disabled, end]);
  useEffect(() => {
    if (disabled || time === end) setPlaying(false);
  }, [disabled, time, end]);
  useEffect(() => {
    setPlaying(false);
  }, [selected]);
  function seek(value: number) {
    if (!disabled) {
      setPlaying(false);
      setTime(value);
    }
  }
  const switcher = props.projection.frame.modelSelectionControl;
  return (
    <section
      className={e.story}
      aria-label="Commission explanation"
      data-playing={playing}
      data-moment={cue}
    >
      <div className={e.storyHeading}>
        <span className={styles.eyebrow}>
          Explore together · {stage + 1} of 6
        </span>
        <span>Moment {cue + 1} of 3</span>
      </div>
      <h3>{chapter.title}</h3>
      {stage === 3 && switcher && (
        <div className={e.switcher}>
          <p>
            <strong>Keep the agreement. Change the sales record.</strong>
            <span>
              Only this model changes; your answers are never filled in.
            </span>
          </p>
          {switcher.options.map((option) => (
            <button
              key={option.id}
              className={styles.secondary}
              disabled={disabled}
              aria-pressed={option.id === switcher.selectedId}
              onClick={() => {
                setPlaying(false);
                setTime(0);
                props.onSelectWorker(option.id);
              }}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      <div className={stage === 4 ? e.comparisonStory : e.storyLayout}>
        <div className={e.instrument}>
          {stage === 4 ? (
            <ExploreComparison
              projection={props.projection}
              cue={full || reduced ? 2 : cue}
            />
          ) : (
            <ExploreModel
              projection={props.projection}
              stage={stage}
              cue={full || reduced ? 2 : cue}
              progress={full || reduced ? 1 : progress}
              blocked={disabled}
              onInspect={(open) => {
                if (open) setPlaying(false);
              }}
            />
          )}
        </div>
        <div className={e.narration}>
          {chapter.moments.map(([label, text], i) => (
            <div
              key={label}
              hidden={!full && !reduced && i > cue}
              className={e.passage}
              data-current={i === cue}
            >
              <h4>{label}</h4>
              <ExploreNarration
                text={text}
                elapsed={time - starts[i]!}
                duration={exploreDuration(text)}
                immediate={full || reduced || i < cue}
              />
            </div>
          ))}
          {stage === 3 && cue > 0 && (
            <p className={e.causalNote} role="status">
              {selected?.endsWith("B")
                ? "Situation B is selected: sales ₱500,000 → commission ₱15,000 → total ₱30,000."
                : "Situation A is selected: sales ₱300,000 → commission ₱9,000 → total ₱24,000."}{" "}
              Salary and rate are unchanged.
            </p>
          )}
        </div>
      </div>
      <div
        className={styles.playback}
        role="group"
        aria-label="Commission explanation playback"
      >
        <button
          className={styles.skipControl}
          aria-label="Previous moment"
          disabled={disabled || cue === 0}
          onClick={() => {
            setFull(false);
            seek(starts[cue - 1]!);
          }}
        >
          ‹
        </button>
        <button
          className={styles.playControl}
          aria-label={playing ? "Pause playback" : "Play explanation"}
          disabled={disabled}
          onClick={() => {
            setFull(false);
            if (time === end) setTime(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button
          className={styles.skipControl}
          aria-label="Next moment"
          disabled={disabled || cue === 2}
          onClick={() => {
            setFull(false);
            seek(starts[cue + 1]!);
          }}
        >
          ›
        </button>
        <button
          className={styles.restartControl}
          disabled={disabled}
          onClick={() => {
            setFull(false);
            seek(0);
          }}
        >
          ↺ Restart
        </button>
        <label>
          Explanation position
          <input
            type="range"
            min="0"
            max={end}
            step="100"
            value={time}
            disabled={disabled}
            aria-valuetext={`${chapter.moments[cue]![0]}, moment ${cue + 1} of 3`}
            onChange={(event) => {
              setFull(false);
              seek(Number(event.currentTarget.value));
            }}
          />
        </label>
      </div>
      <button
        className={styles.textButton}
        onClick={() => {
          setFull(!full);
          setPlaying(false);
        }}
      >
        {full ? "Return to paced explanation" : "Show full explanation"}
      </button>
      <div
        className={`${styles.moments} ${e.momentSelectors}`}
        role="group"
        aria-label="Choose an explanation moment"
      >
        {chapter.moments.map(([label], i) => (
          <button
            key={label}
            disabled={disabled}
            aria-pressed={cue === i}
            aria-current={cue === i ? "step" : undefined}
            onClick={() => {
              setFull(false);
              seek(starts[i]!);
            }}
          >
            <MomentThumbnail stage={stage} moment={i} />
            <span className={styles.chapterNumber} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
