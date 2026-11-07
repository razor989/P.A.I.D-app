import { useCallback, useEffect, useRef, useState } from "react";
import type { C06CommissionProjection } from "./public";
import { CommissionEvidence } from "./CommissionEvidence";
import { MomentIllustration } from "./CommissionIllustrations";
import { useStoryDock } from "../../activity/public";
import styles from "./commission.module.css";

const moments = [
  {
    label: "Month’s end",
    title: "Two workers. A month of selling.",
    captions: [
      "It’s the end of the month. Worker A and Worker B are looking back at what they sold.",
      "Their records match: each sold ₱80,000 worth of goods. That tells us about sales—but is it the same as telling us their pay?",
      "Keep those matching records in mind. There’s another part of the story to look at.",
    ],
  },
  {
    label: "A share of sales",
    title: "Their work earns a commission.",
    captions: [
      "Each worker’s agreement promises pay linked to sales. This part of their pay is called commission.",
      "Both agreements use the same rate: 5%. It describes how commission relates to the amount sold. Look closer at the rate if you’d like to see what 5% means.",
      "So far, the sales match and the rates match. Would you expect the two workers to receive the same pay?",
    ],
  },
  {
    label: "The agreements",
    title: "One agreement has another promise.",
    captions: [
      "Worker A’s agreement promises commission on sales. Worker B’s promises commission too—but that isn’t all.",
      "Worker B is also promised a fixed monthly salary of ₱10,000. That is a separate promise, alongside the sales-linked pay.",
      "Look at the two agreements beside each other. What do they share? What appears in only one?",
    ],
  },
  {
    label: "Your first idea",
    title: "Does matching sales mean matching pay?",
    captions: [
      "We started with two identical sales records. Now we’ve seen the promises behind the workers’ pay.",
      "What do you think those promises could mean for what each worker receives? You don’t need to work out an amount.",
      "Share a first idea and something you’d like to investigate. It’s fine to be unsure—we’ll follow both pay stories together afterward.",
    ],
  },
] as const;
const duration = 24000;
const end = moments.length * duration;

export function CommissionObservation({
  projection,
  blocked,
  reduced,
  onRespond,
  onBack,
  returning = false,
}: {
  projection: C06CommissionProjection;
  blocked: boolean;
  reduced: boolean;
  onRespond: () => void;
  onBack?: (() => void) | undefined;
  returning?: boolean;
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const inspect = useCallback((open: boolean) => {
    if (open) setPlaying(false);
  }, []);
  const index = Math.min(moments.length - 1, Math.floor(time / duration));
  const cue = Math.min(
    2,
    Math.floor((time - index * duration) / (duration / 3)),
  );
  const moment = moments[index]!;
  useEffect(() => {
    if (!playing || blocked) return;
    let request = 0,
      previous = performance.now();
    const tick = (now: number) => {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      const delta = Math.max(0, Math.min(100, now - previous));
      previous = now;
      setTime((value) => Math.min(end, value + delta));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, blocked]);
  useEffect(() => {
    setPlaying(false);
  }, [blocked, reduced]);
  useEffect(() => {
    if (time === end) setPlaying(false);
  }, [time]);
  // Phones: the record stays pinned while the captions change beneath it.
  const surface = useRef<HTMLDivElement>(null);
  useStoryDock(surface, "[data-dock]", index * 3 + cue, reduced);
  function seek(value: number) {
    if (!blocked) {
      setPlaying(false);
      setTime(Math.max(0, Math.min(end, value)));
    }
  }
  return (
    <>
      <div ref={surface} className={styles.storySurface}>
        <div className={styles.observation}>
          <CommissionEvidence
            projection={projection}
            moment={index}
            blocked={blocked}
            onInspection={inspect}
          />
          <div className={styles.narration}>
            <h3>{moment.title}</h3>
            {moment.captions.map((caption, n) => (
              <p
                key={caption}
                hidden={n > cue}
                className={styles.caption}
                data-current={n === cue}
              >
                {caption}
              </p>
            ))}
          </div>
        </div>
        <div
          className={styles.playback}
          role="group"
          aria-label="Sales story playback"
          data-playing={playing}
          data-playback
        >
          <button
            className={styles.skipControl}
            aria-label="Previous moment"
            disabled={blocked || index === 0}
            onClick={() => seek((index - 1) * duration)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <button
            className={styles.playControl}
            aria-label={playing ? "Pause playback" : "Play sales story"}
            disabled={blocked}
            onClick={() => {
              if (time === end) setTime(0);
              setPlaying(!playing || time === end);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={playing ? "M8 6h3v12H8zM15 6h3v12h-3z" : "m9 5 11 7-11 7z"}
              />
            </svg>
          </button>
          <button
            className={styles.skipControl}
            aria-label="Next moment"
            disabled={blocked || index === moments.length - 1}
            onClick={() => seek((index + 1) * duration)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
          <button
            className={styles.restartControl}
            disabled={blocked}
            onClick={() => seek(0)}
          >
            <span aria-hidden="true">↺</span>{" "}
            <span className={styles.restartText}>Restart</span>
          </button>
          <label>
            <span className={styles.positionLabel}>Story position</span>
            <input
              type="range"
              min="0"
              max={end}
              step="100"
              value={time}
              disabled={blocked}
              aria-valuetext={`${moment.label}, ${(time / 1000).toFixed(1)} seconds`}
              onChange={(event) => seek(Number(event.currentTarget.value))}
            />
          </label>
          <span className={styles.time} aria-hidden="true">
            {(time / 1000).toFixed(0)} / {end / 1000} s
          </span>
        </div>
        <nav className={styles.moments} aria-label="Explore the pay story">
          {moments.map((item, n) => (
            <button
              key={item.label}
              disabled={blocked}
              aria-current={index === n ? "step" : undefined}
              onClick={() => seek(n * duration)}
            >
              <span className={styles.chapterNumber} aria-hidden="true">
                0{n + 1}
              </span>
              <MomentIllustration moment={n} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <footer className={styles.actions}>
        {onBack && (
          <button
            className={styles.secondary}
            disabled={blocked}
            onClick={onBack}
          >
            ← Introduction
          </button>
        )}
        <button
          className={styles.primary}
          disabled={blocked}
          onClick={onRespond}
        >
          {returning ? "Return to your thinking" : "Share my first thinking"} →
        </button>
      </footer>
    </>
  );
}
