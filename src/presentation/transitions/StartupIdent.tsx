import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSound } from "../audio/public";
import { MotionRun, motionMode, watchInterruptions } from "./runtime";
import styles from "./transitions.module.css";

/* Readiness is a display signal only: the startup surface (Library, a
 * restored lesson or a recovery choice) has rendered underneath. */
let surfaceReady = false;
export function signalStartupSurface() {
  surfaceReady = true;
}

/** Decided once per page; React may call a state initializer twice. */
let decision: boolean | null = null;
let ended = false;

/** A reload or history traversal is not a cold start. Read from Navigation
 * Timing, so no storage is touched (and no learner data is involved). */
function isColdLoad(): boolean {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    return !entry || entry.type === "navigate";
  } catch {
    return true;
  }
}

/** A genuine cold start only: once per page lifetime (remounts and
 * StrictMode never replay it), never after an in-tab reload or history
 * traversal, and Android app resume never reloads the page at all. */
function claimIdent(): boolean {
  if (decision === null) decision = motionMode() === "full" && isColdLoad();
  return decision && !ended;
}

const plates = [
  { key: "clay", color: "#c25a36", dx: -1, dy: -0.7, r: -2.2 },
  { key: "sage", color: "#3d7a5c", dx: 0.9, dy: 0.55, r: 1.6 },
  { key: "indigo", color: "#4a5aa6", dx: -0.25, dy: 1, r: -0.8 },
] as const;

const PLATE = { duration: 520, delay: 40, stagger: 70 } as const;
/** The plate easing first reaches register at ~54% of its run (then
 * overshoots and settles back): the moment a plate drops onto its pin. */
const PLATE_REGISTERS = 0.54;
const KEY_PRINT = 560;

/** Color Registration: three ink plates arrive out of register, lock into
 * one P.A.I.D. mark, and the sheet parts to reveal whatever the authorised
 * startup destination is. Decorative, aria-hidden, never a gate. */
export function StartupIdent() {
  const [show, setShow] = useState(claimIdent);
  const end = () => {
    ended = true;
    setShow(false);
  };
  const root = useRef<HTMLDivElement>(null);
  const sound = useSound();

  useLayoutEffect(() => {
    const node = root.current;
    if (!show || !node) return;
    const origin = performance.now();
    const motion = new MotionRun(end);
    // Sound only where the platform already allows it; the ident never waits
    // for audio, and a blocked context simply leaves it silent.
    sound.primeWithoutGesture();
    const sequence = sound.sequence(
      "startup",
      [
        { cue: "startup.air", at: PLATE.delay },
        ...plates.map((_, i) => ({
          cue: "startup.pin" as const,
          at: Math.round(
            PLATE.delay + i * PLATE.stagger + PLATE.duration * PLATE_REGISTERS,
          ),
          rate: 0.94 + i * 0.06,
        })),
        { cue: "startup.tone", at: KEY_PRINT + 20 },
      ],
      origin,
    );
    let completed = false;
    const complete = () => {
      completed = true;
      motion.finish();
    };
    const stop = watchInterruptions(() => {
      sequence.cancel();
      motion.finish();
    });
    const unit = Math.min(window.innerWidth, window.innerHeight) * 0.06;
    const q = (part: string) =>
      Array.from(node.querySelectorAll<HTMLElement>(`[data-part="${part}"]`));
    // A–B: registration. Plates travel into alignment, slightly staggered.
    q("plate").forEach((plate, i) => {
      const p = plates[i]!;
      motion.animate(
        plate,
        [
          {
            transform: `translate(${p.dx * unit}px, ${p.dy * unit}px) rotate(${p.r}deg)`,
            opacity: 0,
          },
          { opacity: 1, offset: 0.25 },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: PLATE.duration,
          delay: PLATE.delay + i * PLATE.stagger,
          easing: "cubic-bezier(.2,.9,.25,1.08)",
        },
      );
    });
    q("mark").forEach((mark, i) => {
      motion.animate(
        mark,
        [
          { transform: "scale(1.6) rotate(-30deg)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: 480,
          delay: 60 + i * 40,
          easing: "cubic-bezier(.2,.8,.2,1)",
        },
      );
    });
    // C: identity resolution — the key plate prints the crisp mark.
    motion.animate(
      node.querySelector('[data-part="key"]'),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 160, delay: KEY_PRINT, easing: "ease-out" },
    );
    // D: reveal, once the real startup surface is underneath (cap 2.5 s).
    const started = performance.now();
    const reveal = () => {
      // The registered sheet parts: heard only if the startup is audible.
      sound.play("startup.reveal");
      motion.animate(
        node.querySelector('[data-part="top"]'),
        [{ transform: "none" }, { transform: "translateY(-101%)" }],
        {
          duration: 300,
          easing: "cubic-bezier(.65,0,.35,1)",
          fill: "forwards",
        },
      );
      motion.animate(
        node.querySelector('[data-part="bottom"]'),
        [{ transform: "none" }, { transform: "translateY(101%)" }],
        {
          duration: 300,
          delay: 20,
          easing: "cubic-bezier(.65,0,.35,1)",
          fill: "forwards",
        },
      );
      q("plate").forEach((plate, i) => {
        const p = plates[i]!;
        motion.animate(
          plate,
          [
            { transform: "none", opacity: 1 },
            {
              transform: `translate(${p.dx * unit * 2.4}px, ${p.dy * unit * 2.4}px) rotate(${p.r * 2}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 260,
            delay: i * 25,
            easing: "cubic-bezier(.55,0,.8,.25)",
            fill: "forwards",
          },
        );
      });
      for (const part of ["key", "marks"])
        motion.animate(
          node.querySelector(`[data-part="${part}"]`),
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 160, easing: "ease-in", fill: "forwards" },
        );
      motion.at(340, complete);
    };
    const waitForSurface = () => {
      if (surfaceReady || performance.now() - started > 2500) reveal();
      else motion.at(80, waitForSurface);
    };
    motion.at(740, waitForSurface);
    motion.at(3400, complete);
    return () => {
      stop();
      if (!completed) sequence.cancel();
      motion.dispose();
    };
    // One ident per page; the engine is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;
  return createPortal(
    <div
      ref={root}
      className={styles.ident}
      data-paid-transition="startup"
      aria-hidden="true"
      onPointerDown={end}
    >
      <span className={styles.identHalf} data-part="top" data-half="top" />
      <span
        className={styles.identHalf}
        data-part="bottom"
        data-half="bottom"
      />
      <div className={styles.identMark}>
        {plates.map((p) => (
          <svg
            key={p.key}
            className={styles.plate}
            data-part="plate"
            viewBox="0 0 600 260"
            focusable="false"
          >
            <g fill={p.color}>
              {p.key === "clay" && <circle cx="132" cy="74" r="52" />}
              {p.key === "sage" && <path d="M398 214a74 74 0 0 1 148 0Z" />}
              {p.key === "indigo" && (
                <path
                  d="M70 214c40-18 80-18 120 0s80 18 120 0 80-18 120 0 80 18 120 0"
                  fill="none"
                  stroke={p.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                />
              )}
              <text
                x="300"
                y="168"
                textAnchor="middle"
                fontFamily="Lexend, sans-serif"
                fontWeight="600"
                fontSize="132"
                letterSpacing="-4"
              >
                P.A.I.D.
              </text>
            </g>
          </svg>
        ))}
        <svg
          className={styles.plate}
          data-part="key"
          viewBox="0 0 600 260"
          focusable="false"
        >
          <text
            x="300"
            y="168"
            textAnchor="middle"
            fontFamily="Lexend, sans-serif"
            fontWeight="600"
            fontSize="132"
            letterSpacing="-4"
            fill="#263128"
          >
            P.A.I.D.
          </text>
        </svg>
      </div>
      <div className={styles.marks} data-part="marks">
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <svg
            key={corner}
            className={styles.markSvg}
            data-part="mark"
            data-corner={corner}
            viewBox="0 0 40 40"
            focusable="false"
          >
            <circle
              cx="20"
              cy="20"
              r="9"
              fill="none"
              stroke="#263128"
              strokeWidth="1.6"
            />
            <path d="M20 4v32M4 20h32" stroke="#263128" strokeWidth="1.6" />
          </svg>
        ))}
      </div>
    </div>,
    document.body,
  );
}
