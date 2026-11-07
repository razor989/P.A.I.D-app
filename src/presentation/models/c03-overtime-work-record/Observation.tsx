import { useEffect, useRef, useState } from "react";
import { useStoryAccents, useStoryCues } from "../../audio/public";
import type { StoryAccent } from "../../audio/public";
import type { C03WorkRecordProjection } from "./public";
import { WorkEvidence } from "./WorkEvidence";
import {
  momentDuration,
  moments,
  projectWorkRecordStory,
} from "./work-record-story";
import styles from "./work-record.module.css";
import { useStoryDock } from "../../activity/public";

/** Heard while the workday plays by itself (ms): the hourly rate joins the
 * record, then the two overtime hours are placed (WorkEvidence, c03-hour). */
const observationAccents: readonly StoryAccent[] = [
  { at: 16_000, cue: "story.appear" },
  { at: 24_000, cue: "story.piece" },
  { at: 24_055, cue: "story.piece", rate: 1.04 },
];

/** Accepted C04 continuous-clock transport, adapted locally without Actor state. */
export function Observation({
  projection,
  onRespond,
  blocked,
  reduced,
  returning = false,
  returnLabel = "Return to your thinking",
}: {
  projection: C03WorkRecordProjection;
  onRespond: () => void;
  blocked: boolean;
  reduced: boolean;
  returning?: boolean;
  returnLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const story = projectWorkRecordStory(time);
  useEffect(() => {
    if (!playing || blocked) return;
    let request = 0,
      previous = performance.now();
    const tick = (now: number) => {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      const delta = Math.min(100, now - previous);
      previous = now;
      setTime((value) => Math.min(story.end, value + delta));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, blocked, story.end]);
  useEffect(() => {
    setPlaying(false);
  }, [reduced, blocked]);
  useEffect(() => {
    if (time === story.end) setPlaying(false);
  }, [time, story.end]);
  const surface = useRef<HTMLDivElement>(null);
  useStoryDock(
    surface,
    "[data-inspection-model] > figure",
    story.index,
    reduced,
  );
  const cues = useStoryCues(story.index, {
    playing,
    ended: time >= story.end,
  });
  useStoryAccents(time, playing, reduced, observationAccents);
  /** A deliberate move to a moment. */
  function step(value: number) {
    cues.stepped();
    seek(value);
  }
  function seek(next: number) {
    if (blocked) return;
    setPlaying(false);
    setTime(projectWorkRecordStory(next).position);
  }
  return (
    <>
      <div ref={surface} className={styles.storySurface}>
        <div className={styles.observation}>
          <WorkEvidence
            projection={projection}
            moment={story.index}
            cue={story.cue}
            interactive
            blocked={blocked}
            onInspection={(open) => {
              if (open) setPlaying(false);
            }}
          />
          <div className={styles.narration}>
            <p className={styles.storyKicker}>NICO’S WORKDAY</p>
            <h3>{story.moment.title}</h3>
            {story.moment.captions.map((caption, index) => (
              <p
                key={caption}
                hidden={index > story.cue}
                className={styles.caption}
                data-current={index === story.cue}
                data-cue={index}
              >
                {caption}
              </p>
            ))}
          </div>
        </div>
        <div
          className={styles.playback}
          role="group"
          aria-label="Work Record playback"
          data-playback
          data-playing={playing}
        >
          <button
            className={styles.skipControl}
            aria-label="Previous moment"
            disabled={blocked || story.index === 0}
            onClick={() => step((story.index - 1) * momentDuration)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <button
            className={styles.playControl}
            aria-label={playing ? "Pause playback" : "Play workday"}
            disabled={blocked}
            onClick={() => {
              if (time === story.end) setTime(0);
              cues.toggled(!playing || time === story.end);
              setPlaying(!playing || time === story.end);
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
            disabled={blocked || story.index === moments.length - 1}
            onClick={() => step((story.index + 1) * momentDuration)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
          <button
            className={styles.restartControl}
            disabled={blocked}
            onClick={() => step(0)}
          >
            <span aria-hidden="true">↺</span>{" "}
            <span className={styles.restartText}>Restart</span>
          </button>
          <label>
            <span className={styles.positionLabel}>Workday position</span>
            <input
              type="range"
              min="0"
              max={story.end}
              step="100"
              value={time}
              disabled={blocked}
              aria-valuetext={`${story.moment.label}, ${(time / 1000).toFixed(1)} seconds`}
              onChange={(event) => {
                cues.scrubbing();
                seek(Number(event.currentTarget.value));
              }}
            />
          </label>
          <span className={styles.time} aria-hidden="true">
            {(time / 1000).toFixed(1)} / {story.end / 1000} s
          </span>
        </div>
        <nav className={styles.moments} aria-label="Explore Nico’s evidence">
          {moments.map((item, index) => (
            <button
              key={item.label}
              disabled={blocked}
              aria-current={story.index === index ? "step" : undefined}
              onClick={() => step(index * momentDuration)}
            >
              <span className={styles.chapterNumber} aria-hidden="true">
                0{index + 1}
              </span>
              <svg viewBox="0 0 120 64" aria-hidden="true" focusable="false">
                <rect
                  x="1"
                  y="1"
                  width="118"
                  height="62"
                  rx="6"
                  fill="#faf7eb"
                  stroke="#b8c4a6"
                />
                {Array.from({ length: 8 }, (_, n) => (
                  <rect
                    key={n}
                    x={9 + (n % 4) * 15}
                    y={16 + Math.floor(n / 4) * 17}
                    width="11"
                    height="13"
                    rx="2"
                    fill="#829b64"
                  />
                ))}
                {index > 0 && (
                  <g fill="#b8954d">
                    <rect x="78" y="24" width="13" height="21" rx="2" />
                    <rect x="96" y="24" width="13" height="21" rx="2" />
                  </g>
                )}
                {index === 2 && (
                  <g>
                    <circle
                      cx="96"
                      cy="16"
                      r="13"
                      fill="#f4f0df"
                      stroke="#987735"
                    />
                    <text
                      x="96"
                      y="22"
                      textAnchor="middle"
                      fontSize="19"
                      fill="#785b27"
                    >
                      ?
                    </text>
                  </g>
                )}
              </svg>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className={styles.actions}>
        <button
          disabled={blocked}
          className={styles.primary}
          onClick={onRespond}
        >
          {returning ? returnLabel : "Share my first thinking"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}
