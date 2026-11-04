import { useEffect, useState } from "react";
import type { C03WorkRecordProjection } from "./public";
import { ExploreModel } from "./ExploreModel";
import { ExploreInspection, Inspectable } from "./ExploreInspection";
import type { ExplorePart } from "./ExploreInspection";
import { ExploreGlyph } from "./ExploreGlyph";
import { exploreBeatDuration, projectExploreStory } from "./explore-story";
import styles from "./work-record.module.css";
import explore from "./explore.module.css";

const terms: [RegExp, ExplorePart][] = [
  [/regular hourly rate|hourly rate|₱100 an hour|₱100/g, "rate"],
  [/two extra hours|two hours|overtime hours/gi, "hours"],
  [/ordinary working day|rest day|kind of day/gi, "condition"],
  [/multiplier|1\.25|1\.69/g, "multiplier"],
  [/overtime pay/g, "pay"],
];
function narrative(text: string) {
  const matches = terms
    .flatMap(([pattern, part]) =>
      [...text.matchAll(pattern)].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        part,
      })),
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let end = 0;
  const pieces = [];
  for (const match of matches) {
    if (match.start < end) continue;
    pieces.push(
      text.slice(end, match.start),
      <Inspectable key={match.start} part={match.part}>
        {match.text}
      </Inspectable>,
    );
    end = match.end;
  }
  pieces.push(text.slice(end));
  return pieces;
}
export function ExploreStory({
  projection,
  stage,
  blocked,
  reduced,
  onSelectCondition,
}: {
  projection: C03WorkRecordProjection;
  stage: number;
  blocked: boolean;
  reduced: boolean;
  onSelectCondition?: ((id: string) => void) | undefined;
}) {
  const passages = projection.frame.contentReferences.filter((item) =>
    item.id.startsWith(`c03/${projection.frame.stateId}/passage-`),
  );
  const durations = passages.map((item) => exploreBeatDuration(item.text));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const {
    index,
    progress,
    starts,
    end: total,
  } = projectExploreStory(time, durations);
  useEffect(() => {
    if (!playing || blocked) return;
    let request = 0,
      previous = performance.now();
    function tick(now: number) {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      const delta = Math.min(100, now - previous);
      previous = now;
      setTime((value) => Math.min(total, value + delta));
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, blocked, total]);
  useEffect(() => {
    setPlaying(false);
  }, [blocked, reduced]);
  useEffect(() => {
    if (time === total) setPlaying(false);
  }, [time, total]);
  function seek(value: number) {
    if (!blocked) {
      setPlaying(false);
      setTime(Math.max(0, Math.min(total, value)));
    }
  }
  return (
    <ExploreInspection
      projection={projection}
      blocked={blocked}
      onInspect={() => setPlaying(false)}
    >
      <section
        className={explore.story}
        aria-label="Overtime explanation"
        data-playing={playing}
        data-moment={index}
      >
        <div className={explore.storyLayout}>
          <ExploreModel
            projection={projection}
            stage={stage}
            cue={index}
            progress={reduced ? 1 : progress}
            blocked={blocked}
            compact={false}
            onInspect={() => setPlaying(false)}
            onSelectCondition={onSelectCondition}
          />
          <div className={explore.narrator}>
            <h3>
              {
                [
                  "Two extra hours",
                  "An ordinary working day",
                  "What if it were a rest day?",
                  "Why is the pay different?",
                  "From the record to a formula",
                ][stage]
              }
            </h3>
            {passages.map((passage, i) => (
              <p
                key={passage.id}
                hidden={i > index}
                data-current={i === index}
                className={explore.caption}
              >
                {narrative(passage.text)}
              </p>
            ))}
            {stage === 4 && (
              <div className={explore.formula}>
                <span>Overtime pay</span>
                <strong>
                  <span style={{ opacity: index >= 0 ? 1 : 0.25 }}>
                    Regular hourly rate
                  </span>
                  <br />
                  <span style={{ opacity: index >= 1 ? 1 : 0.25 }}>
                    × overtime multiplier
                  </span>
                  <br />
                  <span style={{ opacity: index >= 2 ? 1 : 0.25 }}>
                    × overtime hours
                  </span>
                </strong>
              </div>
            )}
          </div>
        </div>
        <div
          className={styles.playback}
          role="group"
          aria-label="Overtime explanation playback"
        >
          <button
            className={styles.skipControl}
            disabled={blocked || index === 0}
            aria-label="Previous moment"
            onClick={() => seek(starts[index - 1] ?? 0)}
          >
            <ExploreGlyph name="previous" />
          </button>
          <button
            className={styles.playControl}
            disabled={blocked}
            aria-label={playing ? "Pause playback" : "Play explanation"}
            onClick={() => {
              if (time === total) setTime(0);
              setPlaying(!playing);
            }}
          >
            <ExploreGlyph name={playing ? "pause" : "play"} />
          </button>
          <button
            className={styles.skipControl}
            disabled={blocked || index === passages.length - 1}
            aria-label="Next moment"
            onClick={() => seek(starts[index + 1] ?? total)}
          >
            <ExploreGlyph name="next" />
          </button>
          <button
            className={styles.restartControl}
            disabled={blocked}
            onClick={() => seek(0)}
          >
            <ExploreGlyph name="replay" /> Restart
          </button>
          <label>
            Explanation position
            <input
              type="range"
              min="0"
              max={total}
              step="50"
              value={time}
              disabled={blocked}
              aria-valuetext={`Moment ${index + 1} of ${passages.length}`}
              onChange={(event) => seek(Number(event.currentTarget.value))}
            />
          </label>
          <span className={styles.time}>
            {(time / 1000).toFixed(1)} / {(total / 1000).toFixed(1)} s
          </span>
        </div>
        <nav
          className={explore.momentNav}
          aria-label="Explanation moments"
          data-count={passages.length}
        >
          {passages.map((passage, i) => (
            <button
              key={passage.id}
              aria-current={i === index ? "step" : undefined}
              disabled={blocked}
              onClick={() => seek(starts[i]!)}
            >
              <span className={explore.chapterNumber}>0{i + 1}</span>
              <svg viewBox="0 0 80 40" aria-hidden="true">
                {i === 0 ? (
                  <>
                    <circle
                      cx="40"
                      cy="20"
                      r="14"
                      fill="#e5ead7"
                      stroke="#718951"
                    />
                    <path d="M40 10v11l8 4" stroke="#435432" fill="none" />
                  </>
                ) : i === 1 ? (
                  <>
                    <rect
                      x="20"
                      y="7"
                      width="40"
                      height="29"
                      rx="3"
                      fill="#e5ead7"
                      stroke="#718951"
                    />
                    <path d="M20 16h40M30 3v10M50 3v10" stroke="#718951" />
                  </>
                ) : i === 2 ? (
                  <>
                    <rect x="6" y="11" width="35" height="20" fill="#879d65" />
                    <rect x="41" y="11" width="22" height="20" fill="#b28248" />
                  </>
                ) : i === 3 ? (
                  <>
                    <rect x="5" y="7" width="45" height="10" fill="#718951" />
                    <rect x="5" y="24" width="65" height="10" fill="#b28248" />
                  </>
                ) : (
                  <>
                    <path
                      d="M8 20h60m-9-9 9 9-9 9"
                      stroke="#435432"
                      strokeWidth="2"
                      fill="none"
                    />
                    <text x="20" y="15" fontSize="16" fill="#71531d">
                      ×
                    </text>
                  </>
                )}
              </svg>
              <span className={explore.chapterTitle}>
                {
                  [
                    "Start",
                    "The day",
                    "Each hour",
                    "The pay",
                    "Put it together",
                  ][i]
                }
              </span>
            </button>
          ))}
        </nav>
      </section>
    </ExploreInspection>
  );
}
