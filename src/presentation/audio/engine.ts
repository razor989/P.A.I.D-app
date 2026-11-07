import {
  busGain,
  cueFiles,
  cues,
  MASTER_GAIN,
  type Bus,
  type CueFileName,
  type CueId,
} from "./cues";

/**
 * Sound effects are decoration. Nothing here may delay, block or decide
 * anything: a cue that cannot sound right now is dropped, never queued, and
 * every platform failure degrades to silence.
 */
export type SequenceLayer = Readonly<{
  cue: CueId;
  /** Milliseconds after the sequence origin (the visual motion's start). */
  at: number;
  rate?: number;
  gainDb?: number;
}>;

export type SequenceHandle = Readonly<{ cancel: () => void }>;

export type PlayOptions = Readonly<{
  delayMs?: number;
  rate?: number;
  gainDb?: number;
}>;

export type SoundCueEventDetail = Readonly<{
  cue: CueId;
  sequence: string | null;
  atMs: number;
  audible: boolean;
}>;

export type SequenceChannel = "main" | "inspection" | "story";

export const SOUND_CUE_EVENT = "paid:sound-cue";
export const SOUND_CANCEL_EVENT = "paid:sound-cancel";

export interface SoundEngine {
  /** False where the platform has no Web Audio: the toggle is not offered. */
  readonly supported: boolean;
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  subscribe: (listener: () => void) => () => void;
  play(cue: CueId, options?: PlayOptions): void;
  /**
   * Schedules layers against `origin`. A new sequence replaces the one
   * active on the same channel only: inspection or story accents never cut
   * a navigation transition short.
   */
  sequence(
    name: string,
    layers: readonly SequenceLayer[],
    origin?: number,
    channel?: SequenceChannel,
  ): SequenceHandle;
  /**
   * Startup only: may sound already, before any interaction? Never waits and
   * never works around the platform's autoplay policy.
   */
  primeWithoutGesture(): boolean;
  /** Attach page listeners; returns the detach. Safe to call repeatedly. */
  connect(): () => void;
}

const noop = () => {};
const NO_SEQUENCE: SequenceHandle = Object.freeze({ cancel: noop });

export const silentEngine: SoundEngine = Object.freeze({
  supported: false,
  enabled: false,
  setEnabled: noop,
  subscribe: () => noop,
  play: noop,
  sequence: () => NO_SEQUENCE,
  primeWithoutGesture: () => false,
  connect: () => noop,
});

export type SoundPreferences = Readonly<{
  load: () => boolean | null;
  save: (enabled: boolean) => void;
}>;

type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  cue: CueId;
  bus: Bus;
  startsAt: number;
  endsAt: number;
};

type Environment = Readonly<{
  window: Window & typeof globalThis;
  AudioContext: typeof AudioContext | undefined;
  OfflineAudioContext: typeof OfflineAudioContext | undefined;
  now: () => number;
  random: () => number;
}>;

const UNLOCK_EVENTS = [
  "pointerdown",
  "pointerup",
  "touchend",
  "keydown",
  "click",
] as const;
/** A cue may ride an unlock that is still resolving, but only briefly. */
const UNLOCK_GRACE_MS = 250;
/** A sequence layer this late is skipped rather than sounding off-beat. */
const LATE_TOLERANCE_MS = 30;
const MAX_VOICES = 8;
const FADE_S = 0.04;

const db = (value: number) => 10 ** (value / 20);

export function createSoundEngine(
  preferences: SoundPreferences,
  environment: Partial<Environment> = {},
): SoundEngine {
  const win =
    environment.window ?? (typeof window === "undefined" ? undefined : window);
  const Ctx =
    "AudioContext" in environment
      ? environment.AudioContext
      : win?.AudioContext;
  if (!win || !Ctx) return silentEngine;
  const host: Window & typeof globalThis = win;
  const Offline =
    "OfflineAudioContext" in environment
      ? environment.OfflineAudioContext
      : (host.OfflineAudioContext as typeof OfflineAudioContext | undefined);
  const now = environment.now ?? (() => host.performance.now());
  const random = environment.random ?? Math.random;

  let enabled = (() => {
    try {
      return preferences.load() ?? true;
    } catch {
      return true;
    }
  })();
  const listeners = new Set<() => void>();
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const buses = new Map<Bus, GainNode>();
  const buffers = new Map<CueFileName, AudioBuffer>();
  let loading: Promise<void> | null = null;
  let loaded = false;
  let unlockRequestedAt = -Infinity;
  let everRunning = false;
  let voices: Voice[] = [];
  const lastPlayed = new Map<CueId, number>();
  const roundRobin = new Map<CueId, number>();
  const activeSequences = new Map<
    SequenceChannel,
    { name: string; cancel: () => void }
  >();
  const groupPlayed = new Map<string, number>();
  let connections = 0;
  let detach: (() => void) | null = null;

  const emit = (type: string, detail: object) => {
    try {
      host.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
      /* observers are optional */
    }
  };

  function ensureContext(): AudioContext | null {
    if (context) return context;
    try {
      context = new (Ctx as typeof AudioContext)({
        latencyHint: "interactive",
      });
    } catch {
      return null;
    }
    master = context.createGain();
    master.gain.value = enabled ? MASTER_GAIN : 0;
    master.connect(context.destination);
    for (const bus of Object.keys(busGain) as Bus[]) {
      const node = context.createGain();
      node.gain.value = busGain[bus];
      node.connect(master);
      buses.set(bus, node);
    }
    context.addEventListener?.("statechange", () => {
      if (context?.state === "running") everRunning = true;
    });
    if (context.state === "running") everRunning = true;
    return context;
  }

  function decoder(): BaseAudioContext | null {
    if (context) return context;
    // Decode without a realtime context so loading never trips autoplay
    // warnings; AudioBuffers are usable by any context.
    try {
      return Offline ? new Offline(1, 1, 48000) : null;
    } catch {
      return null;
    }
  }

  function load(): Promise<void> {
    if (loading) return loading;
    const target = decoder();
    if (!target) return Promise.resolve();
    loading = Promise.all(
      (Object.keys(cueFiles) as CueFileName[]).map(async (name) => {
        try {
          const response = await host.fetch(cueFiles[name]);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
            const result = target.decodeAudioData(data, resolve, reject);
            result?.then?.(resolve, reject);
          });
          buffers.set(name, buffer);
        } catch {
          /* an undecodable cue simply stays silent */
        }
      }),
    ).then(() => {
      loaded = true;
    }, noop);
    return loading;
  }

  function audible(): boolean {
    if (!enabled || !context) return false;
    if (context.state === "running") return true;
    return (
      context.state === "suspended" &&
      now() - unlockRequestedAt < UNLOCK_GRACE_MS
    );
  }

  function unlock() {
    if (!enabled) return;
    const ctx = ensureContext();
    void load();
    if (!ctx || ctx.state === "running") return;
    unlockRequestedAt = now();
    ctx.resume().then(() => {
      if (ctx.state === "running") everRunning = true;
    }, noop);
  }

  function stopVoice(voice: Voice, at: number) {
    try {
      if (!context || voice.startsAt > context.currentTime) {
        voice.source.stop();
      } else {
        voice.gain.gain.cancelScheduledValues(at);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
        voice.gain.gain.linearRampToValueAtTime(0, at + FADE_S);
        voice.source.stop(at + FADE_S + 0.005);
      }
    } catch {
      /* already stopped */
    }
  }

  function stopAll() {
    const at = context?.currentTime ?? 0;
    for (const voice of voices) stopVoice(voice, at);
    voices = [];
  }

  function pickFile(cue: CueId): CueFileName {
    const files = cues[cue].files as readonly CueFileName[];
    if (files.length === 1) return files[0] as CueFileName;
    const next = ((roundRobin.get(cue) ?? -1) + 1) % files.length;
    roundRobin.set(cue, next);
    return files[next] as CueFileName;
  }

  /** Schedules one voice; returns it, or null when it cannot sound. */
  function start(
    cue: CueId,
    delayS: number,
    options: PlayOptions,
  ): Voice | null {
    const ctx = context;
    if (!ctx || !master) return null;
    const spec = cues[cue];
    const buffer = buffers.get(pickFile(cue));
    const bus = buses.get(spec.bus);
    if (!buffer || !bus) return null;
    const t = ctx.currentTime;
    voices = voices.filter((v) => v.endsAt > t);
    const same = voices.filter((v) => v.cue === cue);
    if (same.length >= spec.maxVoices) {
      const oldest = same[0] as Voice;
      stopVoice(oldest, t);
      voices = voices.filter((v) => v !== oldest);
    }
    if (voices.length >= MAX_VOICES) {
      const oldest = voices[0] as Voice;
      stopVoice(oldest, t);
      voices = voices.slice(1);
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const jitter = spec.rateJitter
        ? 1 + (random() * 2 - 1) * spec.rateJitter
        : 1;
      const rate = (options.rate ?? 1) * jitter;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = db(spec.gainDb + (options.gainDb ?? 0));
      source.connect(gain);
      gain.connect(bus);
      const startsAt = t + Math.max(0, delayS);
      source.start(startsAt);
      const voice: Voice = {
        source,
        gain,
        cue,
        bus: spec.bus,
        startsAt,
        endsAt: startsAt + buffer.duration / rate,
      };
      source.onended = () => {
        voices = voices.filter((v) => v !== voice);
        try {
          gain.disconnect();
        } catch {
          /* already detached */
        }
      };
      voices.push(voice);
      return voice;
    } catch {
      return null;
    }
  }

  function latency(): number {
    const ctx = context;
    const value = ctx ? ctx.outputLatency || ctx.baseLatency || 0 : 0;
    return Math.min(Math.max(value, 0), 0.06);
  }

  /** Cancels the sequence on `channel`, or on every channel. */
  function cancelSequence(channel?: SequenceChannel) {
    for (const key of channel ? [channel] : [...activeSequences.keys()]) {
      const active = activeSequences.get(key);
      if (!active) continue;
      activeSequences.delete(key);
      active.cancel();
      emit(SOUND_CANCEL_EVENT, { sequence: active.name });
    }
  }

  const engine: SoundEngine = {
    supported: true,
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      try {
        preferences.save(next);
      } catch {
        /* the preference simply lasts for this session */
      }
      if (!next) {
        cancelSequence();
        if (context && master) {
          const t = context.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(master.gain.value, t);
          master.gain.linearRampToValueAtTime(0, t + FADE_S);
        }
        stopAll();
      } else {
        // Switching sound on is itself an interaction: unlock now.
        unlock();
        if (context && master) {
          const t = context.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(MASTER_GAIN, t);
        }
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play(cue, options = {}) {
      if (!enabled) return;
      const t = now();
      const spec = cues[cue];
      const last = lastPlayed.get(cue);
      if (spec.cooldownMs && last !== undefined && t - last < spec.cooldownMs)
        return;
      if (spec.group) {
        const previous = groupPlayed.get(spec.group);
        if (previous !== undefined && t - previous < spec.groupGapMs) return;
        groupPlayed.set(spec.group, t);
      }
      lastPlayed.set(cue, t);
      const voice = audible()
        ? start(cue, (options.delayMs ?? 0) / 1000, options)
        : null;
      if (spec.bus === "milestone" && voice) {
        // The milestone owns the moment: routine voices give way.
        const at = context?.currentTime ?? 0;
        for (const v of voices)
          if (v !== voice && (v.bus === "ui" || v.bus === "model"))
            stopVoice(v, at);
      }
      emit(SOUND_CUE_EVENT, {
        cue,
        sequence: null,
        atMs: options.delayMs ?? 0,
        audible: voice !== null,
      } satisfies SoundCueEventDetail);
    },
    sequence(name, layers, origin = now(), channel = "main") {
      cancelSequence(channel);
      if (!enabled) return NO_SEQUENCE;
      let cancelled = false;
      const scheduled: Voice[] = [];
      const pending = new Set(layers);
      const schedule = () => {
        if (cancelled) return;
        const elapsed = now() - origin;
        const comp = latency() * 1000;
        for (const layer of [...pending]) {
          const remaining = layer.at - elapsed;
          if (remaining < -LATE_TOLERANCE_MS) {
            pending.delete(layer);
            continue;
          }
          if (!loaded) continue; // scheduled again once decoded
          pending.delete(layer);
          const voice = audible()
            ? start(layer.cue, Math.max(0, remaining - comp) / 1000, layer)
            : null;
          if (voice) scheduled.push(voice);
          emit(SOUND_CUE_EVENT, {
            cue: layer.cue,
            sequence: name,
            atMs: layer.at,
            audible: voice !== null,
          } satisfies SoundCueEventDetail);
        }
      };
      const ready = load();
      schedule();
      if (pending.size && !loaded) void ready.then(schedule);
      const handle = {
        name,
        cancel: () => {
          if (cancelled) return;
          cancelled = true;
          pending.clear();
          const at = context?.currentTime ?? 0;
          for (const voice of scheduled) stopVoice(voice, at);
          voices = voices.filter((v) => !scheduled.includes(v));
        },
      };
      activeSequences.set(channel, handle);
      return {
        cancel: () => {
          if (activeSequences.get(channel) === handle) cancelSequence(channel);
          else handle.cancel();
        },
      };
    },
    primeWithoutGesture() {
      if (!enabled) return false;
      const ctx = ensureContext();
      void load();
      return ctx?.state === "running";
    },
    connect() {
      connections += 1;
      if (connections === 1) {
        const onGesture = () => {
          unlock();
          if (context?.state === "running") release();
        };
        const onVisibility = () => {
          if (host.document.visibilityState === "hidden") {
            cancelSequence();
            stopAll();
            context?.suspend().then(noop, noop);
          } else if (enabled && everRunning && context) {
            context.resume().then(noop, arm);
          }
        };
        const onPageHide = () => {
          cancelSequence();
          stopAll();
        };
        let armed = false;
        function arm() {
          if (armed) return;
          armed = true;
          for (const type of UNLOCK_EVENTS)
            host.addEventListener(type, onGesture, {
              capture: true,
              passive: true,
            });
        }
        function release() {
          if (!armed) return;
          armed = false;
          for (const type of UNLOCK_EVENTS)
            host.removeEventListener(type, onGesture, { capture: true });
        }
        arm();
        host.document.addEventListener("visibilitychange", onVisibility);
        host.addEventListener("pagehide", onPageHide);
        // Decode quietly once the app has settled; no realtime context yet.
        const idle = host.setTimeout(() => void load(), 1200);
        detach = () => {
          release();
          host.clearTimeout(idle);
          host.document.removeEventListener("visibilitychange", onVisibility);
          host.removeEventListener("pagehide", onPageHide);
          cancelSequence();
          stopAll();
        };
      }
      let open = true;
      return () => {
        if (!open) return;
        open = false;
        connections -= 1;
        if (connections === 0) {
          detach?.();
          detach = null;
        }
      };
    },
  };
  return engine;
}
