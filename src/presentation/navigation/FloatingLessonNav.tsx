import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { SoundToggle, useSound } from "@/presentation/audio/public";
import { useLessonSlot } from "./slot";
import { useIslandState } from "./useIslandState";
import styles from "./floating-nav.module.css";

export type LessonPlace = Readonly<{
  /** Competency name, e.g. "Percentage Change". */
  competency: string | null;
  /** Activity name, e.g. "Explore and Learn". */
  activity: string;
  /** Two-digit position in the competency, e.g. "02". */
  number: string | null;
  /** The competency's world colours. */
  world: Readonly<{ world: string; deep: string; soft: string }>;
}>;

/** Floating, shape-changing lesson navigation. Every control keeps the
 * application's existing Session wiring; this only presents it. */
export function FloatingLessonNav({
  place,
  identity,
  canBack,
  canReturn,
  onBack,
  onReturn,
  inert,
}: {
  place: LessonPlace;
  identity: string;
  canBack: boolean;
  canReturn: boolean;
  onBack: () => void;
  onReturn: () => void;
  inert?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const island = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const slot = useLessonSlot();
  const { mode, idle, scrolled, open, close, takeReveal } = useIslandState(
    root,
    identity,
  );
  const compact = mode === "compact";
  const sound = useSound();

  // Each part gathers toward the island: measure its untransformed layout
  // offset to the island centre (offsets ignore transforms).
  useLayoutEffect(() => {
    const element = root.current;
    const target = island.current;
    if (!element || !target || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const cx = target.offsetLeft + target.offsetWidth / 2;
      const cy = target.offsetTop + target.offsetHeight / 2;
      for (const part of element.querySelectorAll<HTMLElement>("[data-part]")) {
        let x = 0;
        let y = 0;
        for (
          let node: HTMLElement | null = part;
          node && node !== element;
          node = node.offsetParent as HTMLElement | null
        ) {
          x += node.offsetLeft;
          y += node.offsetTop;
        }
        part.style.setProperty(
          "--gather-x",
          `${Math.round(cx - (x + part.offsetWidth / 2))}px`,
        );
        part.style.setProperty(
          "--gather-y",
          `${Math.round(cy - (y + part.offsetHeight / 2))}px`,
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const part of element.querySelectorAll("[data-part]"))
      observer.observe(part);
    return () => observer.disconnect();
  }, [slot?.exit]);

  useEffect(() => {
    if (mode === "expanded" && takeReveal())
      (canBack ? back.current : root.current?.querySelector("button"))?.focus();
  }, [mode, takeReveal, canBack]);

  const style = {
    "--world": place.world.world,
    "--world-deep": place.world.deep,
    "--world-soft": place.world.soft,
  } as CSSProperties;

  return (
    <header
      ref={root}
      className={styles.dock}
      style={style}
      data-floating-nav=""
      data-mode={mode}
      data-idle={idle || undefined}
      data-scrolled={scrolled || undefined}
      inert={inert}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !compact &&
          !event.defaultPrevented &&
          root.current?.contains(document.activeElement)
        ) {
          event.preventDefault();
          close();
          sound.play("ui.close");
          requestAnimationFrame(() => island.current?.focus());
        }
      }}
    >
      <p className={styles.brand} data-part="brand" inert={compact}>
        <span className={styles.wordmark}>p.a.i.d.</span>
        <span className={styles.edition}>Grade 11 · money &amp; math</span>
      </p>
      <nav
        id={panelId}
        aria-label="Lesson navigation"
        className={styles.capsule}
        data-part="capsule"
        inert={compact}
      >
        <ul className={styles.items}>
          <li>
            <button
              ref={back}
              type="button"
              className={styles.item}
              data-paid-nav=""
              disabled={!canBack}
              onClick={onBack}
            >
              <svg
                className={styles.glyph}
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M10 3 5 8l5 5" />
              </svg>
              Back
            </button>
          </li>
          <li className={styles.current}>
            <span className={styles.active} aria-current="page">
              <span className={styles.marker} aria-hidden="true" />
              {place.number && (
                <span className={styles.number}>{place.number}</span>
              )}
              <span className={styles.label}>
                {place.competency && (
                  <span className={styles.kicker}>{place.competency}</span>
                )}
                <span className={styles.title}>{place.activity}</span>
              </span>
            </span>
          </li>
          {canReturn && (
            <li>
              <button
                type="button"
                className={styles.item}
                data-paid-nav=""
                onClick={onReturn}
              >
                Learning Library
              </button>
            </li>
          )}
        </ul>
      </nav>
      <div className={styles.trail}>
        <SoundToggle
          className={styles.sound}
          data-part="sound"
          inert={compact}
        />
        <div
          ref={slot?.setExit}
          className={styles.raised}
          data-part="raised"
          inert={compact}
        />
      </div>
      <button
        ref={island}
        type="button"
        className={styles.island}
        data-paid-nav=""
        aria-label="Open lesson navigation"
        aria-expanded={!compact}
        aria-controls={panelId}
        inert={!compact}
        onClick={() => {
          open();
          sound.play("ui.open");
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <circle cx="13.5" cy="15" r="8" fill="#a8492a" />
          <circle cx="26.5" cy="15" r="8" fill="#d8ac4d" />
          <circle cx="20" cy="26.5" r="8" fill="var(--world)" />
        </svg>
      </button>
    </header>
  );
}
