import { useEffect, useId, useRef, useState } from "react";
import type { C03WorkRecordProjection } from "./public";
import { ExploreGlyph, ExploreHourMark } from "./ExploreGlyph";
import { pesos } from "./WorkEvidence";
import { useWorkRecordMotion } from "./use-work-record-motion";
import styles from "./transfer.module.css";

const scenes = [
  {
    label: "The extra hours",
    title: "A workday ends. The record continues.",
    question: "Which part of the work are we calculating?",
    reading:
      "For Mara, the first eight hours have been completed. The three extra hours are the overtime hours—not all eleven hours, and not a new hourly rate.",
    closing: "Begin by finding the extra hours.",
  },
  {
    label: "The kind of day",
    title: "The hours alone cannot tell the whole story.",
    question: "What must we know before choosing the rule?",
    reading:
      "An ordinary day, a rest day and a regular holiday are not interchangeable conditions. Mara’s record shows a regular holiday. That condition links her calculation to its approved multiplier.",
    closing: "Let the condition choose the rule.",
  },
  {
    label: "The connection",
    title: "Every factor has a job.",
    question: "How do the pieces become one meaningful amount?",
    reading:
      "The rate establishes pay for one regular hour. The applicable multiplier accounts for the overtime condition. The overtime hours tell us how much extra time the calculation covers.",
    closing: "Connect the rule to the rate and the hours.",
  },
  {
    label: "Take it with you",
    title: "Extra hours tell part of the story.",
    question: "The condition gives the calculation its meaning.",
    reading:
      "When you meet an overtime figure, look beyond the total. Ask which condition applies, which hourly rate is given, how many extra hours are included—and what the amount actually represents.",
    closing:
      "Read carefully. Connect the evidence. Make the amount mean something.",
  },
] as const;

/** Optional, COMPLETE-only narrative. No grading, new scenario, or progression event. */
export function TransferFinale({
  projection,
  blocked,
  titleId,
}: {
  projection: C03WorkRecordProjection;
  blocked: boolean;
  titleId: string;
}) {
  const [scene, setScene] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [replay, setReplay] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLElement>(null);
  const id = useId();
  useWorkRecordMotion(surface, `${scene}/${revealed}/${replay}`, blocked);
  useEffect(() => {
    if (!blocked) {
      heading.current?.focus({ preventScroll: true });
      surface.current?.scrollIntoView({ block: "start" });
    }
  }, [scene, blocked]);
  const math = projection.mathematicalExplanation;
  const pay = math?.overtimePay.resolution;
  const amount =
    pay?.kind === "KNOWN" ? pesos(pay.value.magnitude.toString()) : "";
  const move = (next: number) => {
    setScene(next);
    setRevealed(false);
  };
  return (
    <section
      ref={surface}
      className={styles.cinema}
      data-finale={scene === 3 || undefined}
      data-blocked={blocked || undefined}
      aria-label="Overtime pay: beyond the work record"
    >
      <div className={styles.cinemaAtmosphere} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className={styles.cinemaEyebrow}>
        P.A.I.D. · Overtime pay · Beyond the work record
      </p>
      <nav className={styles.sceneTabs} aria-label="Conclusion scenes">
        {scenes.map((s, i) => (
          <button
            key={s.label}
            disabled={blocked}
            aria-current={scene === i ? "step" : undefined}
            onClick={() => move(i)}
          >
            <span>0{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>
      <div className={styles.scene} key={scene}>
        <header data-motion="scene">
          <p className={styles.cinemaEyebrow}>
            {scene === 3
              ? "Different records · The same careful thinking"
              : `Look closer / 0${scene + 1}`}
          </p>
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {scenes[scene]!.title}
          </h2>
          <p className={styles.cinemaQuestion}>{scenes[scene]!.question}</p>
        </header>
        <div
          className={styles.cinemaStage}
          key={`${scene}/${replay}`}
          data-motion="scene"
        >
          <svg
            viewBox="0 0 760 330"
            role="img"
            aria-label={
              scene === 0
                ? "Mara’s eight completed hours separated from three overtime hours."
                : scene === 1
                  ? "The regular-holiday condition connects to its multiplier."
                  : scene === 2
                    ? "Mara’s hourly rate, regular-holiday multiplier and three overtime hours connect to overtime pay."
                    : "Read the day, connect its rule, calculate the extra hours, and interpret overtime pay."
            }
          >
            <ellipse cx="380" cy="294" rx="310" ry="20" fill="#0d2825" />
            {scene === 0 ? (
              <>
                <rect
                  x="66"
                  y="60"
                  width="628"
                  height="214"
                  rx="18"
                  fill="#f5eedc"
                />
                <text
                  x="95"
                  y="100"
                  fill="#365044"
                  fontSize="17"
                  letterSpacing="2"
                >
                  MARA’S REGULAR-HOLIDAY RECORD
                </text>
                {Array.from({ length: 8 }, (_, i) => (
                  <rect
                    key={i}
                    x={95 + i * 36}
                    y="136"
                    width="29"
                    height="61"
                    rx="4"
                    fill="#d3dfc4"
                    stroke="#7d9563"
                  />
                ))}
                <path
                  d="M397 123v104"
                  stroke="#a98649"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
                {[0, 1, 2].map((i) => (
                  <g
                    key={i}
                    transform={`translate(${458 + i * 78} 166)`}
                    data-motion="hour"
                    data-order={i}
                  >
                    <ExploreHourMark />
                  </g>
                ))}
                <text
                  x="234"
                  y="242"
                  textAnchor="middle"
                  fill="#365044"
                  fontSize="18"
                >
                  First eight · outside our calculation
                </text>
                <text
                  x="536"
                  y="242"
                  textAnchor="middle"
                  fill="#71531d"
                  fontSize="18"
                >
                  Three extra hours
                </text>
              </>
            ) : scene === 1 ? (
              <>
                <g data-motion="scene">
                  <path
                    d="M119 70h244v166H119Z"
                    fill="#f5eedc"
                    stroke="#be9c59"
                  />
                  <path
                    d="M119 105h244M167 55v30M315 55v30"
                    stroke="#a98649"
                    strokeWidth="4"
                  />
                  <text
                    x="241"
                    y="150"
                    textAnchor="middle"
                    fill="#365044"
                    fontSize="24"
                  >
                    Regular holiday
                  </text>
                  <text
                    x="241"
                    y="188"
                    textAnchor="middle"
                    fill="#71531d"
                    fontSize="16"
                  >
                    Given in the record
                  </text>
                </g>
                <path
                  d="M390 154h71m-13-10 13 10-13 10"
                  fill="none"
                  stroke="#d8b574"
                  strokeWidth="3"
                />
                <rect
                  x="486"
                  y="98"
                  width="173"
                  height="112"
                  rx="15"
                  fill="#e8d4a6"
                />
                <text
                  x="573"
                  y="138"
                  textAnchor="middle"
                  fill="#493a22"
                  fontSize="16"
                >
                  Applicable multiplier
                </text>
                <text
                  x="573"
                  y="183"
                  textAnchor="middle"
                  fill="#203c33"
                  fontSize="38"
                >
                  {revealed
                    ? `× ${math?.multiplier.magnitude.toString()}`
                    : "× ?"}
                </text>
              </>
            ) : scene === 2 ? (
              <>
                {["Hourly rate", "Day’s multiplier", "Extra hours"].map(
                  (label, i) => (
                    <g key={label} transform={`translate(${55 + i * 243} 66)`}>
                      <rect
                        width="185"
                        height="132"
                        rx="13"
                        fill={i === 1 ? "#e8d4a6" : "#f5eedc"}
                      />
                      <text
                        x="92"
                        y="38"
                        textAnchor="middle"
                        fill="#365044"
                        fontSize="18"
                      >
                        {label}
                      </text>
                      <text
                        x="92"
                        y="93"
                        textAnchor="middle"
                        fill="#203c33"
                        fontSize="35"
                      >
                        {i === 0
                          ? pesos(
                              projection.workEvidence.rate.magnitude.toString(),
                            )
                          : i === 1
                            ? math?.multiplier.magnitude.toString()
                            : projection.workEvidence.hours.magnitude.toString()}
                      </text>
                    </g>
                  ),
                )}
                <text x="268" y="143" fill="#e8d4a6" fontSize="30">
                  ×
                </text>
                <text x="511" y="143" fill="#e8d4a6" fontSize="30">
                  ×
                </text>
                <text
                  x="380"
                  y="270"
                  textAnchor="middle"
                  fill="#f2dfae"
                  fontSize="34"
                >
                  {revealed
                    ? `= ${amount} · overtime pay only`
                    : "One connected calculation"}
                </text>
              </>
            ) : (
              <>
                {[
                  "Read the day",
                  "Connect the rule",
                  "Count the extra hours",
                ].map((label, i) => (
                  <g key={label} transform={`translate(${40 + i * 242} 72)`}>
                    <circle
                      cx="98"
                      cy="55"
                      r="47"
                      fill="none"
                      stroke="#bda36a"
                    />
                    <text
                      x="98"
                      y="65"
                      textAnchor="middle"
                      fill="#f1dcac"
                      fontSize="30"
                    >
                      0{i + 1}
                    </text>
                    <text
                      x="98"
                      y="142"
                      textAnchor="middle"
                      fill="#f8f0dc"
                      fontSize="19"
                    >
                      {label}
                    </text>
                  </g>
                ))}
                <path d="M94 257h572" stroke="#bda36a" />
                <text
                  x="380"
                  y="295"
                  textAnchor="middle"
                  fill="#f1dcac"
                  fontSize="23"
                >
                  Overtime pay · Know what the amount means.
                </text>
              </>
            )}
          </svg>
        </div>
        <div className={styles.cinemaFacts} aria-label="Scene evidence">
          {scene === 0 ? (
            <>
              <span>
                <strong>8 hours</strong>Completed first · not included
              </span>
              <span>
                <strong>3 extra hours</strong>The overtime being calculated
              </span>
            </>
          ) : scene === 1 ? (
            <>
              <span>
                <strong>Regular holiday</strong>The condition in the record
              </span>
              <span>
                <strong>
                  {revealed
                    ? `× ${math?.multiplier.magnitude.toString()}`
                    : "Multiplier to connect"}
                </strong>
                Use the rule linked to the day
              </span>
            </>
          ) : scene === 2 ? (
            <>
              <span>
                <strong>
                  {pesos(projection.workEvidence.rate.magnitude.toString())}
                </strong>
                Regular hourly rate
              </span>
              <span>
                <strong>× {math?.multiplier.magnitude.toString()} × 3</strong>
                Day’s multiplier · extra hours
              </span>
              {revealed && (
                <span>
                  <strong>{amount}</strong>Overtime pay only
                </span>
              )}
            </>
          ) : (
            <>
              <span>
                <strong>Read the day.</strong>Connect its rule to the rate and
                hours.
              </span>
              <span>
                <strong>Name the amount.</strong>Overtime pay is not total
                earnings.
              </span>
            </>
          )}
        </div>
        {scene < 3 ? (
          <div className={styles.cinemaReading}>
            <button
              disabled={blocked}
              aria-expanded={revealed}
              aria-controls={id}
              onClick={() => {
                setRevealed(true);
                setReplay((n) => n + 1);
              }}
            >
              <ExploreGlyph name={revealed ? "replay" : "next"} />
              {revealed ? "Replay this connection" : "Follow the connection"}
            </button>
            <div id={id} aria-live="polite" aria-atomic="true">
              {revealed ? (
                <>
                  <p>{scenes[scene]!.reading}</p>
                  <strong>{scenes[scene]!.closing}</strong>
                </>
              ) : (
                <p>Pause with the record. What would you look at first?</p>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.cinemaClosing} data-motion="scene">
            <p>{scenes[scene]!.reading}</p>
            <strong>{scenes[scene]!.closing}</strong>
            <span>
              Overtime pay · The end of this journey. A way of thinking to take
              with you.
            </span>
          </div>
        )}
      </div>
      <footer className={styles.sceneNavigation}>
        <button
          disabled={blocked || scene === 0}
          onClick={() => move(scene - 1)}
        >
          <ExploreGlyph name="previous" />
          Previous scene
        </button>
        <span>{scene + 1} of 4</span>
        <button
          disabled={blocked}
          onClick={() => move(scene === 3 ? 0 : scene + 1)}
        >
          {scene === 3 ? "Watch again" : "Next scene"}
          <ExploreGlyph name={scene === 3 ? "replay" : "next"} />
        </button>
      </footer>
    </section>
  );
}
