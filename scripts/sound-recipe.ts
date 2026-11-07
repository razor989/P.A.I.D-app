/// <reference types="node" />
// P.A.I.D. sound recipe: the single editable description of every production
// cue file. `scripts/build-sound-cues.ts` renders it from the owner's external,
// read-only libraries into `src/assets/audio/`. To swap a cue after audition,
// change its `layers` here (an alternate's layers can be pasted in) and rebuild.
//
// Libraries (paths relative to the Sounds root passed with --source):
//   D  Clean UI – 20 Minimal Interaction Sounds (R4orce)        foundation
//   E  Soft Signal – Free Minimal UI SFX Pack                   designed accents
//   B  Free Natural SFX Pack (cicifyre)                         tactile layer
//   A  Epic Stock Media – Smart UI (Notification subset)        tonal ink-drop
//   C  "macOS Golden Gate" pack (owner-accepted rights risk)    sparing accents
//   S  generated in build-sound-cues.ts (shaped filtered noise) under-layers
//
// Tonal centre: G major / E minor. Cents values retune sources that measured
// sharp (Clean UI tones sit roughly +15…+33 cents) or that need a shared key.

export type Library = "A" | "B" | "C" | "D" | "E" | "S";

export type SynthId =
  | "air-rise"
  | "air-fall"
  | "paper-slide"
  | "paper-slide-back"
  | "perforation"
  | "release"
  | "split-swish"
  | "startup-air"
  | "page-turn"
  | "grow";

export type Layer = Readonly<{
  /** Library-relative source file, or a generated layer. */
  source: string | Readonly<{ synth: SynthId }>;
  lib: Library;
  /** Placement inside the cue, milliseconds. */
  at?: number;
  /** Relative gain before the cue is levelled as a whole. */
  gainDb?: number;
  /** Pitch shift by resampling (also changes length slightly). */
  cents?: number;
  /** Explicit window into the processed source, milliseconds. */
  startMs?: number;
  endMs?: number;
  fadeOutMs?: number;
  reverse?: boolean;
  highpassHz?: number;
  lowpassHz?: number;
  /** High shelf at 8 kHz, dB (negative tames bright transients). */
  shelfDb?: number;
}>;

export type Category =
  | "ui"
  | "model"
  | "navigation"
  | "startup"
  | "feedback"
  | "milestone"
  | "story"
  | "inspect";

export type CueFile = Readonly<{
  file: string;
  category: Category;
  channels: 1 | 2;
  /** Loudest 30 ms RMS window after levelling, dBFS. */
  targetDb: number;
  role: string;
  layers: readonly Layer[];
  alternates?: readonly Readonly<{
    label: string;
    layers: readonly Layer[];
    channels?: 1 | 2;
  }>[];
}>;

const D = "Clean UI - 20 Minimal Interaction Sounds/WAV_48kHz_24bit/";
const E = "Soft-Signal-Free-Minimal-UI-SFX-Pack-v1.0.0/WAV/";
const B = "Free Natural SFX Pack/";
const A =
  "Epic Stock Media - Smart UI/One_Shots/Notification/Abstract/ESM_One_Shot_FX_Notification_UI_Abstract_";
const C = "MACOS GOLDEN GATE SFX/";

const d = (file: string, extra: Partial<Layer> = {}): Layer => ({
  source: D + file,
  lib: "D",
  highpassHz: 90,
  ...extra,
});
const e = (file: string, extra: Partial<Layer> = {}): Layer => ({
  source: E + file,
  lib: "E",
  highpassHz: 90,
  ...extra,
});
// Natural pack transients are very bright: always tame the top octave.
const b = (file: string, extra: Partial<Layer> = {}): Layer => ({
  source: B + file,
  lib: "B",
  highpassHz: 120,
  shelfDb: -3,
  ...extra,
});
const a = (file: string, extra: Partial<Layer> = {}): Layer => ({
  source: A + file,
  lib: "A",
  highpassHz: 120,
  ...extra,
});
const c = (file: string, extra: Partial<Layer> = {}): Layer => ({
  source: C + file,
  lib: "C",
  highpassHz: 90,
  ...extra,
});
const s = (synth: SynthId, extra: Partial<Layer> = {}): Layer => ({
  source: { synth },
  lib: "S",
  ...extra,
});

export const recipe: readonly CueFile[] = [
  /* ───────────── Everyday interface ───────────── */
  {
    file: "ui-select-1",
    category: "ui",
    channels: 1,
    targetDb: -24,
    role: "Routine selection (cover, slide, tab, inspection pin).",
    layers: [d("03_Button_Tap_Soft_01.wav", { cents: -15 })],
    alternates: [
      { label: "Natural wood2", layers: [b("03-wood2.wav")] },
      { label: "Soft Signal soft_click", layers: [e("soft_click.wav")] },
    ],
  },
  {
    file: "ui-select-2",
    category: "ui",
    channels: 1,
    targetDb: -24,
    role: "Round-robin partner of ui-select-1.",
    layers: [d("04_Button_Tap_Soft_02.wav")],
  },
  {
    file: "ui-toggle-on",
    category: "ui",
    channels: 1,
    targetDb: -22,
    role: "A control switched on (play, keep open, sound on).",
    layers: [d("09_Toggle_On_01.wav")],
    alternates: [
      { label: "Soft Signal toggle_on", layers: [e("toggle_on.wav")] },
    ],
  },
  {
    file: "ui-toggle-off",
    category: "ui",
    channels: 1,
    targetDb: -23,
    role: "A control switched off (pause, release pin).",
    layers: [d("10_Toggle_Off_01.wav")],
    alternates: [
      { label: "Soft Signal toggle_off", layers: [e("toggle_off.wav")] },
    ],
  },
  {
    file: "ui-open",
    category: "ui",
    channels: 1,
    targetDb: -22,
    role: "Island, dialog or help panel opens (rising A–C#–E).",
    layers: [e("panel_open.wav")],
    alternates: [
      { label: "Clean UI expand", layers: [d("20_Expand_01.wav")] },
      { label: "macOS dictation start", layers: [c("dictation start.mp3")] },
    ],
  },
  {
    file: "ui-close",
    category: "ui",
    channels: 1,
    targetDb: -23,
    role: "Island, dialog or help panel closes (falling A–F#–D inverse).",
    layers: [e("panel_close.wav")],
    alternates: [
      {
        label: "Clean UI expand reversed",
        layers: [d("20_Expand_01.wav", { reverse: true })],
      },
      { label: "macOS boop", layers: [c("boop.mp3")] },
    ],
  },

  /* ───────────── Mathematical models ───────────── */
  ...["02-wood1.wav", "03-wood2.wav", "04-wood3.wav", "05-wood4.wav"].map(
    (file, i): CueFile => ({
      file: `model-step-${i + 1}`,
      category: "model",
      channels: 1,
      targetDb: -24,
      role: "A story model settles on a moment (prev/next/moment buttons); quieter at runtime for scrub ticks.",
      layers: [b(file)],
      ...(i === 0
        ? {
            alternates: [
              {
                label: "Clean UI clicky",
                layers: [d("01_Button_Tap_Clicky_01.wav")],
              },
              { label: "Natural cardboard1", layers: [b("21-cardboard1.wav")] },
            ],
          }
        : {}),
    }),
  ),
  {
    file: "model-select",
    category: "model",
    channels: 1,
    targetDb: -23,
    role: "A representation, situation or record switch took effect.",
    layers: [
      d("13_Focus_01.wav", { cents: -15 }),
      b("21-cardboard1.wav", { gainDb: -9 }),
    ],
    alternates: [
      { label: "Soft Signal tab_change", layers: [e("tab_change.wav")] },
      {
        label: "Clean UI focus only",
        layers: [d("13_Focus_01.wav", { cents: -15 })],
      },
    ],
  },
  {
    file: "model-snap",
    category: "model",
    channels: 1,
    targetDb: -22,
    role: "A value lands in its graphical slot (graphical operation complete, not correctness).",
    layers: [
      b("20-lotion_lid.wav", { endMs: 140, fadeOutMs: 40 }),
      d("01_Button_Tap_Clicky_01.wav", { gainDb: -8 }),
    ],
    alternates: [
      {
        label: "Soft Signal firm_click + wood3",
        layers: [e("firm_click.wav"), b("04-wood3.wav", { gainDb: -4 })],
      },
    ],
  },
  {
    file: "model-reveal",
    category: "model",
    channels: 1,
    targetDb: -22,
    role: "A relationship or connection is revealed in the model.",
    layers: [e("clue_reveal.wav", { cents: 65 })],
    alternates: [
      {
        label: "Smart UI dry droplet Am",
        channels: 2,
        layers: [
          a("04_LoFi_Expressive_Reverb_UI_Dry_Single_Water_Liquid_Am.wav"),
        ],
      },
      {
        label: "Clean UI notification",
        layers: [d("15_Notification_01.wav", { cents: -20 })],
      },
    ],
  },

  /* ───────────── Responses and feedback ───────────── */
  {
    file: "response-recorded",
    category: "feedback",
    channels: 1,
    targetDb: -21,
    role: "A Prepare response was recorded (participation, never a score).",
    layers: [
      d("07_Button_Tap_Confirm_01.wav", { cents: -33 }),
      b("03-wood2.wav", { gainDb: -8 }),
    ],
    alternates: [
      { label: "Soft Signal save", layers: [e("save.wav")] },
      {
        label: "Clean UI confirm 02",
        layers: [d("08_Button_Tap_Confirm_02.wav", { cents: -33 })],
      },
    ],
  },
  {
    file: "feedback-affirm",
    category: "feedback",
    channels: 1,
    targetDb: -19,
    role: "Engine CONFIRMED a scored response (gentle C–E–G–C resolution).",
    layers: [e("success.wav")],
    alternates: [
      {
        label: "Clean UI success 01 (retuned to D)",
        layers: [d("16_Success_01.wav", { cents: -27 })],
      },
      { label: "Clean UI success 02", layers: [d("17_Success_02.wav")] },
      { label: "macOS mezzo", layers: [c("mezzo.mp3")] },
    ],
  },
  {
    file: "feedback-reconsider",
    category: "feedback",
    channels: 1,
    targetDb: -20,
    role: "Engine asks the learner to reconsider (inviting E–B–G, never a buzzer).",
    layers: [e("hint_available.wav")],
    alternates: [
      {
        label: "Clean UI focus 02",
        layers: [d("14_Focus_02.wav", { cents: -15 })],
      },
      { label: "macOS pebble", layers: [c("pebble.mp3")] },
    ],
  },
  {
    file: "activity-complete",
    category: "milestone",
    channels: 2,
    targetDb: -16,
    role: "Session finalized an activity: thump + C-major motif resolving on a G chord (IV→I).",
    layers: [
      b("22-cardboard2.wav", { gainDb: -6, endMs: 160, fadeOutMs: 50 }),
      e("success.wav", { gainDb: -5 }),
      c("breeze.mp3", { at: 210 }),
    ],
    alternates: [
      {
        label: "Soft Signal level_complete (no macOS)",
        layers: [e("level_complete.wav")],
      },
      {
        label: "Thump + achievement",
        layers: [
          b("22-cardboard2.wav", { gainDb: -6, endMs: 160, fadeOutMs: 50 }),
          e("achievement.wav"),
        ],
      },
      {
        label: "Thump + motif + level_complete in G (no macOS)",
        layers: [
          b("22-cardboard2.wav", { gainDb: -6, endMs: 160, fadeOutMs: 50 }),
          e("success.wav", { gainDb: -5 }),
          e("level_complete.wav", { at: 210, cents: -243 }),
        ],
      },
    ],
  },

  /* ───────────── Navigation layers (scheduled at runtime) ───────────── */
  {
    file: "nav-air-rise",
    category: "navigation",
    channels: 2,
    targetDb: -30,
    role: "Paper-air swell under the accordion unfold.",
    layers: [s("air-rise")],
  },
  {
    file: "nav-air-fall",
    category: "navigation",
    channels: 2,
    targetDb: -30,
    role: "Paper-air release under the accordion fold.",
    layers: [s("air-fall")],
  },
  {
    file: "nav-tick-1",
    category: "navigation",
    channels: 1,
    targetDb: -31,
    role: "A folded panel touches down (one per hinge).",
    layers: [b("21-cardboard1.wav", { highpassHz: 200, endMs: 70 })],
  },
  {
    file: "nav-tick-2",
    category: "navigation",
    channels: 1,
    targetDb: -31,
    role: "Round-robin partner of nav-tick-1.",
    layers: [b("05-wood4.wav", { highpassHz: 200, gainDb: -2 })],
  },
  {
    file: "nav-settle",
    category: "navigation",
    channels: 1,
    targetDb: -24,
    role: "The unfolded publication settles (accordion covered).",
    layers: [
      b("21-cardboard1.wav"),
      d("03_Button_Tap_Soft_01.wav", { cents: -15, gainDb: -4 }),
    ],
  },
  {
    file: "nav-land",
    category: "navigation",
    channels: 1,
    targetDb: -24,
    role: "A folded sheet or chapter cover lands back on its card.",
    layers: [
      b("22-cardboard2.wav", { endMs: 120, fadeOutMs: 40 }),
      d("04_Button_Tap_Soft_02.wav", { gainDb: -8 }),
    ],
  },
  {
    file: "chapter-slide",
    category: "navigation",
    channels: 2,
    targetDb: -28,
    role: "The chapter cover lifts into a sheet.",
    layers: [s("paper-slide")],
  },
  {
    file: "chapter-slide-back",
    category: "navigation",
    channels: 2,
    targetDb: -28,
    role: "The torn halves swing shut.",
    layers: [s("paper-slide-back")],
  },
  {
    file: "chapter-perforation",
    category: "navigation",
    channels: 1,
    targetDb: -31,
    role: "The perforation line draws in.",
    layers: [
      b("15-pencil1.wav", { highpassHz: 1500 }),
      s("perforation", { gainDb: -4 }),
    ],
  },
  {
    file: "chapter-release",
    category: "navigation",
    channels: 1,
    targetDb: -27,
    role: "The perforated sheet releases (soft, never a rip).",
    layers: [s("release"), b("21-cardboard1.wav", { gainDb: -6 })],
  },
  {
    file: "chapter-seal",
    category: "navigation",
    channels: 1,
    targetDb: -23,
    role: "The chapter closes: halves meet.",
    layers: [
      b("22-cardboard2.wav", { endMs: 110, fadeOutMs: 35 }),
      d("03_Button_Tap_Soft_01.wav", { cents: -15, gainDb: -5 }),
    ],
  },
  {
    file: "nav-fallback",
    category: "navigation",
    channels: 1,
    targetDb: -27,
    role: "Reduced-motion or same-depth destination change.",
    layers: [d("11_Hover_Soft_01.wav")],
    alternates: [
      { label: "Soft Signal hover_focus", layers: [e("hover_focus.wav")] },
    ],
  },

  /* ───────────── Startup: Color Registration ───────────── */
  {
    file: "startup-air",
    category: "startup",
    channels: 2,
    targetDb: -33,
    role: "Faint movement while the plates travel into register.",
    layers: [s("startup-air")],
  },
  {
    file: "startup-pin",
    category: "startup",
    channels: 1,
    targetDb: -26,
    role: "A colour plate drops onto its registration pin (played three times, rising).",
    layers: [b("02-wood1.wav", { highpassHz: 150 })],
  },
  {
    file: "startup-tone",
    category: "startup",
    channels: 2,
    targetDb: -22,
    role: "The key plate locks in: a single ink-drop tone.",
    layers: [a("03_LoFi_Expressive_Reverb_UI_Dry_Single_Water_Liquid_Em.wav")],
    alternates: [
      { label: "macOS crystal", channels: 2, layers: [c("crystal.mp3")] },
      {
        label: "Clean UI notification",
        layers: [d("15_Notification_01.wav", { cents: -20 })],
      },
    ],
  },
  {
    file: "startup-reveal",
    category: "startup",
    channels: 2,
    targetDb: -29,
    role: "The registered sheet parts to reveal the application.",
    layers: [s("split-swish")],
  },

  /* ───────────── Explanation playback (autoplay only) ───────────── */
  {
    file: "story-moment",
    category: "story",
    channels: 1,
    targetDb: -28,
    role: "Playback moves on to the next moment by itself: a soft page turn.",
    layers: [
      s("page-turn"),
      b("21-cardboard1.wav", { at: 110, endMs: 80, gainDb: -10 }),
    ],
    alternates: [
      { label: "Soft Signal tab_change", layers: [e("tab_change.wav")] },
      { label: "Clean UI Hover_Soft_02", layers: [d("12_Hover_Soft_02.wav")] },
    ],
  },
  {
    file: "story-grow",
    category: "story",
    channels: 1,
    targetDb: -31,
    role: "A bar extends or a grid scales in the model (pitched per use).",
    layers: [s("grow")],
    alternates: [
      {
        label: "Natural pencil1 stroke",
        layers: [b("15-pencil1.wav", { highpassHz: 600 })],
      },
      { label: "Soft Signal load", layers: [e("load.wav", { gainDb: -3 })] },
    ],
  },
  {
    file: "story-appear",
    category: "story",
    channels: 1,
    targetDb: -29,
    role: "An amount, label or document appears in the model.",
    layers: [
      d("13_Focus_01.wav", { cents: -15 }),
      e("clue_reveal.wav", { at: 20, cents: 65, gainDb: -14 }),
    ],
    alternates: [
      { label: "Soft Signal score_tick", layers: [e("score_tick.wav")] },
      {
        label: "Clean UI Focus_02",
        layers: [d("14_Focus_02.wav", { cents: -15 })],
      },
    ],
  },
  {
    file: "story-stamp",
    category: "story",
    channels: 1,
    targetDb: -27,
    role: "A stamp or tag lands on the record.",
    layers: [
      b("05-wood4.wav"),
      d("01_Button_Tap_Clicky_01.wav", { gainDb: -10 }),
    ],
    alternates: [
      {
        label: "Natural lotion_lid",
        layers: [b("20-lotion_lid.wav", { endMs: 140, fadeOutMs: 40 })],
      },
    ],
  },
  {
    file: "story-draw",
    category: "story",
    channels: 1,
    targetDb: -31,
    role: "A reference line draws across the model.",
    layers: [b("16-pencil2.wav", { highpassHz: 900 })],
    alternates: [
      {
        label: "Natural pencil1",
        layers: [b("15-pencil1.wav", { highpassHz: 900 })],
      },
      {
        label: "Natural pen1",
        layers: [b("13-pen1.wav", { highpassHz: 900 })],
      },
    ],
  },
  {
    file: "story-piece-1",
    category: "story",
    channels: 1,
    targetDb: -33,
    role: "A tile or cell is placed (variant 1 of 3; rate rises along a stagger).",
    layers: [b("02-wood1.wav", { endMs: 60, fadeOutMs: 25, highpassHz: 200 })],
  },
  {
    file: "story-piece-2",
    category: "story",
    channels: 1,
    targetDb: -33,
    role: "A tile or cell is placed (variant 2 of 3).",
    layers: [b("04-wood3.wav", { endMs: 60, fadeOutMs: 25, highpassHz: 200 })],
  },
  {
    file: "story-piece-3",
    category: "story",
    channels: 1,
    targetDb: -33,
    role: "A tile or cell is placed (variant 3 of 3).",
    layers: [
      b("21-cardboard1.wav", { endMs: 50, fadeOutMs: 20, highpassHz: 250 }),
    ],
  },
  {
    file: "story-end",
    category: "story",
    channels: 1,
    targetDb: -28,
    role: "The explanation reaches its end: a quiet settle.",
    layers: [
      b("22-cardboard2.wav", { endMs: 120, fadeOutMs: 40 }),
      d("04_Button_Tap_Soft_02.wav", { at: 30, gainDb: -6 }),
    ],
  },

  /* ───────────── Hover / focus inspections ───────────── */
  {
    file: "inspect-open",
    category: "inspect",
    channels: 1,
    targetDb: -31,
    role: "A hover or focus inspection opens: a whisper.",
    layers: [e("panel_open.wav", { highpassHz: 300 })],
    alternates: [
      { label: "Clean UI Hover_Soft_01", layers: [d("11_Hover_Soft_01.wav")] },
      { label: "Soft Signal hover_focus", layers: [e("hover_focus.wav")] },
    ],
  },
  {
    file: "inspect-close",
    category: "inspect",
    channels: 1,
    targetDb: -33,
    role: "A hover or focus inspection closes.",
    layers: [e("panel_close.wav", { highpassHz: 300 })],
  },
  {
    file: "inspect-switch",
    category: "inspect",
    channels: 1,
    targetDb: -32,
    role: "The inspection moves straight to another part.",
    layers: [d("12_Hover_Soft_02.wav", { cents: -15 })],
    alternates: [
      { label: "Soft Signal hover_focus", layers: [e("hover_focus.wav")] },
    ],
  },
];
