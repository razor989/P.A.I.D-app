import { useId, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { CompetencyId } from "@/core/public";
import type { CompetencySummary } from "../../shell/public";
import { competencyStories } from "../content";
import type { CompetencyStory } from "../content";
import { CompetencyArt } from "../art/CompetencyArt";
import { StampBadge, WaveRule } from "../art/Motifs";
import { useSound } from "../../audio/public";
import { useSlideshow } from "./useSlideshow";
import styles from "./library.module.css";

type Featured = Readonly<{
  summary: CompetencySummary;
  story: CompetencyStory;
}>;

/** Editorial hero: one competency at a time, with synchronised heading,
 * introduction, artwork and entrance action. It is an invitation only — the
 * collection below remains an independent route to every competency. */
export function HeroSlideshow({
  competencies,
  blocked,
  onSelect,
}: Readonly<{
  competencies: readonly CompetencySummary[];
  blocked: boolean;
  onSelect: (id: CompetencyId) => void;
}>) {
  const featured: Featured[] = competencies.flatMap((summary) => {
    const story = competencyStories[summary.id];
    return story ? [{ summary, story }] : [];
  });
  const show = useSlideshow(featured.length, blocked);
  // Only the learner's own choices sound; autoplay advances silently.
  const sound = useSound();
  const choose = (i: number) => {
    if (i !== show.index) sound.play("ui.select");
    show.goTo(i);
  };
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const rotation = useRef<HTMLButtonElement>(null);
  // Only a real mouse over an interactive area holds rotation: a cursor
  // resting on the headline or artwork must not freeze the show, and touch
  // produces no matching "leave", so it never holds.
  const hoverHold = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") show.setHovered(true);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") show.setHovered(false);
    },
  };
  if (featured.length === 0) return null;
  const active = featured[show.index]!;
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? i + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? i - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? featured.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    const wrapped = (target + featured.length) % featured.length;
    choose(wrapped);
    tabs.current[wrapped]?.focus();
  };
  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="Featured competencies"
      data-theme={active.story.theme}
      data-direction={show.direction}
      onFocus={(event) =>
        // Focus on the rotation control itself never holds rotation, so
        // pressing Play always resumes it (WAI-ARIA APG carousel pattern).
        show.setFocused(event.target !== rotation.current)
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          show.setFocused(false);
      }}
    >
      <div
        className={styles.heroStage}
        aria-live={show.playing && !show.held ? "off" : "polite"}
      >
        {featured.map(({ summary, story }, i) => (
          <div
            key={summary.id}
            id={`${base}-slide-${i}`}
            className={styles.slide}
            role="tabpanel"
            aria-roledescription="slide"
            aria-labelledby={`${base}-tab-${i}`}
            hidden={i !== show.index}
            data-motion-origin
            data-theme={story.theme}
          >
            <div className={styles.slideCopy}>
              <p className={styles.eyebrow}>
                <span className={styles.eyebrowNumber}>{story.number}</span>
                {summary.label}
              </p>
              <h2 className={styles.heroTitle}>{story.headline}</h2>
              <WaveRule className={styles.wave} />
              <p className={styles.heroIntro}>{story.intro}</p>
              <button
                type="button"
                data-paid-nav
                className={styles.heroAction}
                {...hoverHold}
                disabled={blocked || !summary.available}
                onClick={() => onSelect(summary.id)}
              >
                <span>Enter {summary.label}</span>
                <svg
                  viewBox="0 0 28 12"
                  aria-hidden="true"
                  focusable="false"
                  className={styles.arrow}
                >
                  <path
                    d="M1 6h24M20 1l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className={styles.slideArt}>
              <div className={styles.artPanel}>
                <CompetencyArt id={summary.id} className={styles.heroArt} />
              </div>
              <StampBadge
                className={styles.stamp}
                text="GRADE 11 · GENERAL MATH · LEARN · "
              />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.heroControls} {...hoverHold}>
        <div
          role="tablist"
          aria-label="Choose a featured competency"
          className={styles.tabs}
        >
          {featured.map(({ summary, story }, i) => {
            const selected = i === show.index;
            return (
              <button
                key={summary.id}
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                id={`${base}-tab-${i}`}
                type="button"
                role="tab"
                data-paid-nav
                className={styles.tab}
                aria-selected={selected}
                aria-controls={`${base}-slide-${i}`}
                tabIndex={selected ? 0 : -1}
                disabled={blocked}
                onClick={() => choose(i)}
                onKeyDown={(event) => moveTab(event, i)}
              >
                <span className={styles.tabNumber}>{story.number}</span>
                <span className={styles.tabLabel}>{summary.label}</span>
                <span
                  className={styles.tabProgress}
                  data-running={
                    selected && show.playing && !show.held ? "" : undefined
                  }
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className={styles.heroButtons}>
          <button
            type="button"
            data-paid-nav
            className={styles.roundButton}
            aria-label="Previous competency"
            disabled={blocked}
            onClick={() => {
              sound.play("ui.select");
              show.previous();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            data-paid-nav
            className={styles.roundButton}
            aria-label="Next competency"
            disabled={blocked}
            onClick={() => {
              sound.play("ui.select");
              show.next();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            ref={rotation}
            type="button"
            data-paid-nav
            className={styles.playButton}
            disabled={blocked}
            onClick={() => {
              sound.play(show.playing ? "ui.toggle.off" : "ui.toggle.on");
              show.togglePlaying();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {show.playing ? (
                <path
                  d="M8 5v14M16 5v14"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              ) : (
                <path d="M8 5l11 7-11 7z" fill="currentColor" />
              )}
            </svg>
            <span>{show.playing ? "Pause slideshow" : "Play slideshow"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
