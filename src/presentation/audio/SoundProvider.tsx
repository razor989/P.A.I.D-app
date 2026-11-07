import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CueId } from "./cues";
import { silentEngine, type SoundEngine } from "./engine";

const SoundContext = createContext<SoundEngine>(silentEngine);

/** Outside a provider (and in every existing test) sound is a silent no-op. */
export function SoundProvider({
  engine,
  children,
}: Readonly<{ engine: SoundEngine; children: ReactNode }>) {
  useEffect(() => engine.connect(), [engine]);
  return (
    <SoundContext.Provider value={engine}>{children}</SoundContext.Provider>
  );
}

export function useSound(): SoundEngine {
  return useContext(SoundContext);
}

export function useSoundEnabled(): boolean {
  const engine = useSound();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.enabled,
    () => false,
  );
}

/**
 * Plays `cue` when `value` changes after mount. A mount, a remount (returning
 * to an unfinished activity, a recovered session) or a StrictMode re-run
 * starts from the current value and stays silent.
 */
export function useCueOnChange(value: unknown, cue: CueId) {
  const engine = useSound();
  const previous = useRef(value);
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    engine.play(cue);
  }, [engine, value, cue]);
}

/**
 * Plays `cue` each time `active` turns true after mount (a reveal opening, a
 * pinned inspection). Turning false, or mounting already true, is silent.
 */
export function useCueOnEnter(active: boolean, cue: CueId) {
  const engine = useSound();
  const previous = useRef(active);
  useEffect(() => {
    const was = previous.current;
    previous.current = active;
    if (active && !was) engine.play(cue);
  }, [engine, active, cue]);
}

/**
 * Story models. A deliberate step to a moment is a soft tactile step; a scrub
 * ticks only when the shown moment changes while the learner is dragging.
 * While the explanation plays by itself, moving on to the next moment turns a
 * soft page and reaching the end settles quietly. Stepping and scrubbing stop
 * playback first, so they never sound twice.
 */
export function useStoryCues(
  moment: number,
  options: Readonly<{ playing?: boolean; ended?: boolean }> = {},
) {
  const engine = useSound();
  const { playing = false, ended = false } = options;
  const shown = useRef(moment);
  const wasEnded = useRef(ended);
  const scrubAt = useRef(-Infinity);
  useEffect(() => {
    const previous = shown.current;
    if (previous === moment) return;
    shown.current = moment;
    if (performance.now() - scrubAt.current < SCRUB_WINDOW_MS)
      engine.play("model.tick");
    // Forward only: replaying from the start is the Play press's own sound.
    else if (playing && moment > previous) engine.play("story.moment");
  }, [engine, moment, playing]);
  useEffect(() => {
    const before = wasEnded.current;
    wasEnded.current = ended;
    if (ended && !before && playing) engine.play("story.end");
  }, [engine, ended, playing]);
  const stepped = useCallback(() => {
    scrubAt.current = -Infinity;
    engine.play("model.step");
  }, [engine]);
  const scrubbing = useCallback(() => {
    scrubAt.current = performance.now();
  }, []);
  /** The Play/Pause press: `next` is the playing state it switches to. */
  const toggled = useCallback(
    (next: boolean) => engine.play(next ? "ui.toggle.on" : "ui.toggle.off"),
    [engine],
  );
  return { stepped, scrubbing, toggled };
}

export type StoryAccent = Readonly<{
  /** Where the visual event happens, on the story's own position scale. */
  at: number;
  cue: CueId;
  rate?: number;
  gainDb?: number;
  /** Describes motion; skipped when motion is reduced. Defaults by cue. */
  motion?: boolean;
}>;

const MOTION_CUES: ReadonlySet<CueId> = new Set([
  "story.grow",
  "story.draw",
  "story.piece",
]);

/**
 * Accents for the visual events inside a moment, heard only while the story
 * plays by itself: each sounds once as playback passes its position. A seek,
 * a step, a pause or a jump back simply resynchronises silently.
 */
export function useStoryAccents(
  position: number,
  playing: boolean,
  reduced: boolean,
  accents: readonly StoryAccent[],
) {
  const engine = useSound();
  const last = useRef(position);
  const list = useRef(accents);
  list.current = accents;
  useEffect(() => {
    const previous = last.current;
    last.current = position;
    if (!playing || position <= previous) return;
    for (const accent of list.current) {
      if (accent.at <= previous || accent.at > position) continue;
      if (reduced && (accent.motion ?? MOTION_CUES.has(accent.cue))) continue;
      engine.play(accent.cue, {
        ...(accent.rate !== undefined ? { rate: accent.rate } : {}),
        ...(accent.gainDb !== undefined ? { gainDb: accent.gainDb } : {}),
      });
    }
  }, [engine, position, playing, reduced]);
}

const SCRUB_WINDOW_MS = 250;
