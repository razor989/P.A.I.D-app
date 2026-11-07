import { useEffect, useRef, useState } from "react";
import {
  useCueOnChange,
  useStoryAccents,
  useStoryCues,
} from "../../audio/public";
import type { StoryAccent } from "../../audio/public";
import type { C06PreparePresentation } from "./public";
import { ExploreComparison, ExploreModel } from "./ExploreModel";
import { exploreChapters, exploreMoment } from "./explore-story";
import { ExploreNarration } from "./ExploreNarration";
import { MomentThumbnail } from "./MomentThumbnail";
import { useStoryDock } from "../../activity/public";
import styles from "./commission.module.css";
import e from "./explore.module.css";

/**
 * Heard while the explanation plays by itself, on the `cue + progress`
 * scale ExploreModel draws from: the three shared hundredths light up, then
 * commission and total pay join the comparison (ExploreModel's gates).
 */
function exploreAccents(stage: number): StoryAccent[] {
  if (stage === 1)
    return [0, 1, 2].map((i) => ({
      at: 1 + i * 0.08,
      cue: "story.piece",
      rate: 1 + i * 0.03,
    }));
  if (stage === 2 || stage === 3)
    return [
      { at: 1, cue: "story.appear" },
      { at: 2, cue: "story.appear", rate: 1.05 },
    ];
  return [];
}

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
  const cues = useStoryCues(cue, {
    playing: playing && !full,
    ended: time >= end,
  });
  useStoryAccents(
    cue + progress,
    playing && !full,
    reduced,
    exploreAccents(stage),
  );
  /** A deliberate move to a moment. */
  function step(value: number) {
    cues.stepped();
    seek(value);
  }
  function seek(value: number) {
    if (!disabled) {
      setPlaying(false);
      setTime(value);
    }
  }
  // Stepping lands on a moment’s finished state, so the change it describes
  // is visible at once (CSS eases it in). Only scrubbing shows in-betweens.
  const settle = (i: number) => {
    setFull(false);
    step((starts[i + 1] ?? end) - 1);
  };
  const story = useRef<HTMLElement>(null);
  useStoryDock(story, "[data-dock]", cue, reduced);
  const switcher = props.projection.frame.modelSelectionControl;
  useCueOnChange(switcher?.selectedId, "model.select");
  return (
    <section
      ref={story}
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
              marked
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
              <ExploreNarration text={text} />
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
          {!full && !reduced && cue < 2 && (
            <div className={e.upcoming}>
              <p>Still to come</p>
              <ol start={cue + 2}>
                {chapter.moments.slice(cue + 1).map(([label]) => (
                  <li key={label}>{label}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
      <div
        className={styles.playback}
        role="group"
        aria-label="Commission explanation playback"
        data-playback
      >
        <button
          className={styles.skipControl}
          aria-label="Previous moment"
          disabled={disabled || cue === 0}
          onClick={() => settle(cue - 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
        <button
          className={styles.playControl}
          aria-label={playing ? "Pause playback" : "Play explanation"}
          disabled={disabled}
          onClick={() => {
            setFull(false);
            if (time >= end - 1) setTime(0);
            cues.toggled(!playing);
            setPlaying(!playing);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? (
              <path d="M8 6h3v12H8zM15 6h3v12h-3z" />
            ) : (
              <path d="m9 5 11 7-11 7z" />
            )}
          </svg>
        </button>
        <button
          className={styles.skipControl}
          aria-label="Next moment"
          disabled={disabled || cue === 2}
          onClick={() => settle(cue + 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
        <button
          className={styles.restartControl}
          disabled={disabled}
          onClick={() => {
            setFull(false);
            step(0);
          }}
        >
          <span aria-hidden="true">↺</span>{" "}
          <span className={e.restartText}>Restart</span>
        </button>
        <label>
          <span className={e.positionLabel}>Explanation position</span>
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
              cues.scrubbing();
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
            onClick={() => settle(i)}
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
