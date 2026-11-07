// Semantic sound cues. Components name what happened (a selection, a moment
// settling, an engine-confirmed response); this table decides what it sounds
// like. Files are the curated, levelled renders in src/assets/audio (see
// PROVENANCE.md there and scripts/sound-recipe.ts for their sources).

export type Bus =
  "ui" | "model" | "detail" | "navigation" | "feedback" | "milestone";

export type CueId =
  // Everyday interface
  | "ui.select"
  | "ui.toggle.on"
  | "ui.toggle.off"
  | "ui.open"
  | "ui.close"
  // Mathematical models (presentation events only, never correctness)
  | "model.step"
  | "model.tick"
  | "model.select"
  | "model.snap"
  | "model.reveal"
  // Engine-authoritative results
  | "response.recorded"
  | "feedback.affirm"
  | "feedback.reconsider"
  | "feedback.part.affirm"
  | "feedback.part.reconsider"
  // Session-authoritative completion
  | "activity.complete"
  // Navigation layers, scheduled by the transition choreography
  | "nav.air.rise"
  | "nav.air.fall"
  | "nav.tick"
  | "nav.settle"
  | "nav.land"
  | "nav.fallback"
  | "chapter.slide"
  | "chapter.slide.back"
  | "chapter.perforation"
  | "chapter.release"
  | "chapter.seal"
  // Startup: Color Registration layers
  | "startup.air"
  | "startup.pin"
  | "startup.tone"
  | "startup.reveal"
  // Explanation playback, autoplay only (stepping and scrubbing keep
  // model.step / model.tick)
  | "story.moment"
  | "story.grow"
  | "story.appear"
  | "story.stamp"
  | "story.draw"
  | "story.piece"
  | "story.end"
  // Hover / focus inspections and the mini-animations inside them
  | "inspect.open"
  | "inspect.close"
  | "inspect.switch";

export type CueSpec = Readonly<{
  files: readonly string[];
  bus: Bus;
  gainDb: number;
  /** Repeats of the same cue inside this window are ignored. */
  cooldownMs: number;
  /** Simultaneous voices of this cue; the oldest gives way. */
  maxVoices: number;
  /** Subtle playback-rate variation for repetitive tactile cues. */
  rateJitter: number;
  /** Cues sharing a group keep at least `groupGapMs` apart (fatigue guard). */
  group: string | null;
  groupGapMs: number;
}>;

// Static literals so the bundler emits exactly these files and nothing else.
export const cueFiles = {
  "ui-select-1": new URL("../../assets/audio/ui-select-1.ogg", import.meta.url)
    .href,
  "ui-select-2": new URL("../../assets/audio/ui-select-2.ogg", import.meta.url)
    .href,
  "ui-toggle-on": new URL(
    "../../assets/audio/ui-toggle-on.ogg",
    import.meta.url,
  ).href,
  "ui-toggle-off": new URL(
    "../../assets/audio/ui-toggle-off.ogg",
    import.meta.url,
  ).href,
  "ui-open": new URL("../../assets/audio/ui-open.ogg", import.meta.url).href,
  "ui-close": new URL("../../assets/audio/ui-close.ogg", import.meta.url).href,
  "model-step-1": new URL(
    "../../assets/audio/model-step-1.ogg",
    import.meta.url,
  ).href,
  "model-step-2": new URL(
    "../../assets/audio/model-step-2.ogg",
    import.meta.url,
  ).href,
  "model-step-3": new URL(
    "../../assets/audio/model-step-3.ogg",
    import.meta.url,
  ).href,
  "model-step-4": new URL(
    "../../assets/audio/model-step-4.ogg",
    import.meta.url,
  ).href,
  "model-select": new URL(
    "../../assets/audio/model-select.ogg",
    import.meta.url,
  ).href,
  "model-snap": new URL("../../assets/audio/model-snap.ogg", import.meta.url)
    .href,
  "model-reveal": new URL(
    "../../assets/audio/model-reveal.ogg",
    import.meta.url,
  ).href,
  "response-recorded": new URL(
    "../../assets/audio/response-recorded.ogg",
    import.meta.url,
  ).href,
  "feedback-affirm": new URL(
    "../../assets/audio/feedback-affirm.ogg",
    import.meta.url,
  ).href,
  "feedback-reconsider": new URL(
    "../../assets/audio/feedback-reconsider.ogg",
    import.meta.url,
  ).href,
  "activity-complete": new URL(
    "../../assets/audio/activity-complete.ogg",
    import.meta.url,
  ).href,
  "nav-air-rise": new URL(
    "../../assets/audio/nav-air-rise.ogg",
    import.meta.url,
  ).href,
  "nav-air-fall": new URL(
    "../../assets/audio/nav-air-fall.ogg",
    import.meta.url,
  ).href,
  "nav-tick-1": new URL("../../assets/audio/nav-tick-1.ogg", import.meta.url)
    .href,
  "nav-tick-2": new URL("../../assets/audio/nav-tick-2.ogg", import.meta.url)
    .href,
  "nav-settle": new URL("../../assets/audio/nav-settle.ogg", import.meta.url)
    .href,
  "nav-land": new URL("../../assets/audio/nav-land.ogg", import.meta.url).href,
  "nav-fallback": new URL(
    "../../assets/audio/nav-fallback.ogg",
    import.meta.url,
  ).href,
  "chapter-slide": new URL(
    "../../assets/audio/chapter-slide.ogg",
    import.meta.url,
  ).href,
  "chapter-slide-back": new URL(
    "../../assets/audio/chapter-slide-back.ogg",
    import.meta.url,
  ).href,
  "chapter-perforation": new URL(
    "../../assets/audio/chapter-perforation.ogg",
    import.meta.url,
  ).href,
  "chapter-release": new URL(
    "../../assets/audio/chapter-release.ogg",
    import.meta.url,
  ).href,
  "chapter-seal": new URL(
    "../../assets/audio/chapter-seal.ogg",
    import.meta.url,
  ).href,
  "startup-air": new URL("../../assets/audio/startup-air.ogg", import.meta.url)
    .href,
  "startup-pin": new URL("../../assets/audio/startup-pin.ogg", import.meta.url)
    .href,
  "startup-tone": new URL(
    "../../assets/audio/startup-tone.ogg",
    import.meta.url,
  ).href,
  "startup-reveal": new URL(
    "../../assets/audio/startup-reveal.ogg",
    import.meta.url,
  ).href,
  "story-moment": new URL(
    "../../assets/audio/story-moment.ogg",
    import.meta.url,
  ).href,
  "story-grow": new URL("../../assets/audio/story-grow.ogg", import.meta.url)
    .href,
  "story-appear": new URL(
    "../../assets/audio/story-appear.ogg",
    import.meta.url,
  ).href,
  "story-stamp": new URL("../../assets/audio/story-stamp.ogg", import.meta.url)
    .href,
  "story-draw": new URL("../../assets/audio/story-draw.ogg", import.meta.url)
    .href,
  "story-piece-1": new URL(
    "../../assets/audio/story-piece-1.ogg",
    import.meta.url,
  ).href,
  "story-piece-2": new URL(
    "../../assets/audio/story-piece-2.ogg",
    import.meta.url,
  ).href,
  "story-piece-3": new URL(
    "../../assets/audio/story-piece-3.ogg",
    import.meta.url,
  ).href,
  "story-end": new URL("../../assets/audio/story-end.ogg", import.meta.url)
    .href,
  "inspect-open": new URL(
    "../../assets/audio/inspect-open.ogg",
    import.meta.url,
  ).href,
  "inspect-close": new URL(
    "../../assets/audio/inspect-close.ogg",
    import.meta.url,
  ).href,
  "inspect-switch": new URL(
    "../../assets/audio/inspect-switch.ogg",
    import.meta.url,
  ).href,
} as const;

export type CueFileName = keyof typeof cueFiles;

const spec = (
  files: readonly CueFileName[],
  bus: Bus,
  options: Partial<Omit<CueSpec, "files" | "bus">> = {},
): CueSpec => ({
  files,
  bus,
  gainDb: options.gainDb ?? 0,
  cooldownMs: options.cooldownMs ?? 80,
  maxVoices: options.maxVoices ?? 2,
  rateJitter: options.rateJitter ?? 0,
  group: options.group ?? null,
  groupGapMs: options.groupGapMs ?? 0,
});

/** Accents that follow the model's own motion share one fatigue guard. */
const accent = { group: "story-accent", groupGapMs: 220 } as const;

const steps = [
  "model-step-1",
  "model-step-2",
  "model-step-3",
  "model-step-4",
] as const;

export const cues: Readonly<Record<CueId, CueSpec>> = {
  "ui.select": spec(["ui-select-1", "ui-select-2"], "ui", { cooldownMs: 60 }),
  "ui.toggle.on": spec(["ui-toggle-on"], "ui"),
  "ui.toggle.off": spec(["ui-toggle-off"], "ui"),
  "ui.open": spec(["ui-open"], "ui", { cooldownMs: 120, maxVoices: 1 }),
  "ui.close": spec(["ui-close"], "ui", { cooldownMs: 120, maxVoices: 1 }),

  "model.step": spec(steps, "model", { cooldownMs: 60, rateJitter: 0.015 }),
  "model.tick": spec(steps, "model", {
    gainDb: -7,
    cooldownMs: 90,
    rateJitter: 0.02,
  }),
  "model.select": spec(["model-select"], "model", { cooldownMs: 100 }),
  "model.snap": spec(["model-snap"], "model", {
    cooldownMs: 150,
    maxVoices: 1,
  }),
  "model.reveal": spec(["model-reveal"], "model", {
    cooldownMs: 250,
    maxVoices: 1,
  }),

  "response.recorded": spec(["response-recorded"], "feedback", {
    cooldownMs: 300,
    maxVoices: 1,
  }),
  "feedback.affirm": spec(["feedback-affirm"], "feedback", {
    cooldownMs: 300,
    maxVoices: 1,
  }),
  "feedback.reconsider": spec(["feedback-reconsider"], "feedback", {
    cooldownMs: 300,
    maxVoices: 1,
  }),
  "feedback.part.affirm": spec(["feedback-affirm"], "feedback", {
    gainDb: -5,
    cooldownMs: 200,
    maxVoices: 1,
  }),
  "feedback.part.reconsider": spec(["feedback-reconsider"], "feedback", {
    gainDb: -5,
    cooldownMs: 200,
    maxVoices: 1,
  }),

  "activity.complete": spec(["activity-complete"], "milestone", {
    cooldownMs: 1500,
    maxVoices: 1,
  }),

  "nav.air.rise": spec(["nav-air-rise"], "navigation", { cooldownMs: 0 }),
  "nav.air.fall": spec(["nav-air-fall"], "navigation", { cooldownMs: 0 }),
  "nav.tick": spec(["nav-tick-1", "nav-tick-2"], "navigation", {
    cooldownMs: 0,
    maxVoices: 6,
    rateJitter: 0.02,
  }),
  "nav.settle": spec(["nav-settle"], "navigation", { cooldownMs: 0 }),
  "nav.land": spec(["nav-land"], "navigation", { cooldownMs: 0 }),
  "nav.fallback": spec(["nav-fallback"], "navigation", { cooldownMs: 0 }),
  "chapter.slide": spec(["chapter-slide"], "navigation", { cooldownMs: 0 }),
  "chapter.slide.back": spec(["chapter-slide-back"], "navigation", {
    cooldownMs: 0,
  }),
  "chapter.perforation": spec(["chapter-perforation"], "navigation", {
    cooldownMs: 0,
  }),
  "chapter.release": spec(["chapter-release"], "navigation", {
    cooldownMs: 0,
    maxVoices: 2,
  }),
  "chapter.seal": spec(["chapter-seal"], "navigation", { cooldownMs: 0 }),

  "startup.air": spec(["startup-air"], "navigation", { cooldownMs: 0 }),
  "startup.pin": spec(["startup-pin"], "navigation", {
    cooldownMs: 0,
    maxVoices: 3,
  }),
  "startup.tone": spec(["startup-tone"], "navigation", { cooldownMs: 0 }),
  "startup.reveal": spec(["startup-reveal"], "navigation", { cooldownMs: 0 }),

  "story.moment": spec(["story-moment"], "model", {
    cooldownMs: 400,
    maxVoices: 1,
  }),
  "story.grow": spec(["story-grow"], "detail", {
    ...accent,
    cooldownMs: 120,
    rateJitter: 0.02,
  }),
  "story.appear": spec(["story-appear"], "detail", {
    ...accent,
    cooldownMs: 120,
  }),
  "story.stamp": spec(["story-stamp"], "detail", {
    ...accent,
    cooldownMs: 200,
    maxVoices: 1,
  }),
  "story.draw": spec(["story-draw"], "detail", {
    ...accent,
    cooldownMs: 300,
    maxVoices: 1,
  }),
  "story.piece": spec(
    ["story-piece-1", "story-piece-2", "story-piece-3"],
    "detail",
    {
      cooldownMs: 35,
      maxVoices: 3,
      rateJitter: 0.03,
    },
  ),
  "story.end": spec(["story-end"], "model", { cooldownMs: 1000, maxVoices: 1 }),

  "inspect.open": spec(["inspect-open"], "ui", {
    cooldownMs: 150,
    maxVoices: 1,
  }),
  "inspect.close": spec(["inspect-close"], "ui", {
    cooldownMs: 150,
    maxVoices: 1,
  }),
  "inspect.switch": spec(["inspect-switch"], "ui", {
    cooldownMs: 90,
    maxVoices: 1,
  }),
};

/** Mix trim per bus, linear. The hierarchy itself is baked into the files. */
export const busGain: Readonly<Record<Bus, number>> = {
  ui: 1,
  model: 1,
  // Mini-animation accents sit about 3 dB under the model's own cues.
  detail: 0.71,
  navigation: 1,
  feedback: 1,
  milestone: 1,
};

export const MASTER_GAIN = 0.85;
