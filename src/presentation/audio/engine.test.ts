import { describe, expect, it } from "vitest";
import {
  createSoundEngine,
  silentEngine,
  SOUND_CANCEL_EVENT,
  SOUND_CUE_EVENT,
  type SoundCueEventDetail,
  type SoundPreferences,
} from "./engine";

/* A small, deterministic stand-in for Web Audio: enough surface for the
 * engine, with every scheduled start/stop recorded. */
class Param {
  constructor(public value: number) {}
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
}
class Node_ {
  connect() {}
  disconnect() {}
}
class Gain extends Node_ {
  gain = new Param(1);
}
type Started = { at: number; stoppedAt: number | null; rate: number };
class Source extends Node_ {
  buffer: unknown = null;
  playbackRate = new Param(1);
  onended: (() => void) | null = null;
  record: Started = { at: -1, stoppedAt: null, rate: 1 };
  constructor(private log: Started[]) {
    super();
  }
  start(at = 0) {
    this.record = { at, stoppedAt: null, rate: this.playbackRate.value };
    this.log.push(this.record);
  }
  stop(at = 0) {
    this.record.stoppedAt = at;
  }
}
const decode = (
  _data: ArrayBuffer,
  ok: (buffer: AudioBuffer) => void,
): Promise<AudioBuffer> => {
  const buffer = { duration: 0.2 } as AudioBuffer;
  ok(buffer);
  return Promise.resolve(buffer);
};

function harness(
  options: { saved?: boolean | null; resumeWorks?: boolean } = {},
) {
  let clock = 0;
  const started: Started[] = [];
  const contexts: FakeContext[] = [];
  const saved: boolean[] = [];
  class FakeContext {
    state: AudioContextState = "suspended";
    currentTime = 0;
    destination = new Node_();
    outputLatency = 0;
    baseLatency = 0;
    constructor() {
      contexts.push(this);
    }
    createGain() {
      return new Gain();
    }
    createBufferSource() {
      return new Source(started);
    }
    resume() {
      if (options.resumeWorks === false) return Promise.reject(new Error());
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
    addEventListener() {}
    decodeAudioData = decode;
  }
  class FakeOffline {
    decodeAudioData = decode;
  }
  const target = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const events: SoundCueEventDetail[] = [];
  const cancels: string[] = [];
  target.addEventListener(SOUND_CUE_EVENT, (e) =>
    events.push((e as CustomEvent<SoundCueEventDetail>).detail),
  );
  target.addEventListener(SOUND_CANCEL_EVENT, (e) =>
    cancels.push((e as CustomEvent<{ sequence: string }>).detail.sequence),
  );
  const win = Object.assign(target, {
    document,
    fetch: () =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }),
    setTimeout: () => 0,
    clearTimeout: () => {},
    performance: { now: () => clock },
  });
  const preferences: SoundPreferences = {
    load: () => options.saved ?? null,
    save: (enabled) => saved.push(enabled),
  };
  const engine = createSoundEngine(preferences, {
    window: win as unknown as Window & typeof globalThis,
    AudioContext: FakeContext as unknown as typeof AudioContext,
    OfflineAudioContext: FakeOffline as unknown as typeof OfflineAudioContext,
    now: () => clock,
    random: () => 0.5,
  });
  const flush = async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  };
  return {
    engine,
    started,
    contexts,
    saved,
    events,
    cancels,
    document,
    gesture: async () => {
      win.dispatchEvent(new Event("pointerdown"));
      await flush();
    },
    advance: (ms: number) => {
      clock += ms;
    },
    flush,
  };
}

describe("sound engine", () => {
  it("is a silent no-op where Web Audio is unavailable", () => {
    const engine = createSoundEngine(
      { load: () => null, save: () => {} },
      { AudioContext: undefined },
    );
    expect(engine).toBe(silentEngine);
    expect(engine.supported).toBe(false);
    expect(() => engine.play("ui.select")).not.toThrow();
    expect(() =>
      engine.sequence("x", [{ cue: "nav.tick", at: 0 }]).cancel(),
    ).not.toThrow();
  });

  it("defaults on and honours a saved preference", () => {
    expect(harness().engine.enabled).toBe(true);
    expect(harness({ saved: false }).engine.enabled).toBe(false);
  });

  it("drops cues before the platform allows sound, never queuing them", async () => {
    const h = harness();
    h.engine.connect();
    h.engine.play("ui.select");
    expect(h.contexts).toHaveLength(0);
    expect(h.events[h.events.length - 1]).toMatchObject({
      cue: "ui.select",
      audible: false,
    });
    await h.gesture();
    expect(h.started).toHaveLength(0); // the dropped cue never plays late
    h.advance(500);
    h.engine.play("ui.select");
    expect(h.started).toHaveLength(1);
    expect(h.events[h.events.length - 1]).toMatchObject({ audible: true });
  });

  it("never creates or resumes a context without a gesture at startup", () => {
    const h = harness();
    h.engine.connect();
    expect(h.engine.primeWithoutGesture()).toBe(false);
    expect(h.contexts[0]?.state).toBe("suspended");
  });

  it("mutes immediately, persists, and never replays on unmute", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.engine.play("feedback.affirm");
    expect(h.started[0]?.stoppedAt).toBeNull();
    h.engine.setEnabled(false);
    expect(h.saved).toEqual([false]);
    expect(h.started[0]?.stoppedAt).not.toBeNull();
    const before = h.events.length;
    h.advance(1000);
    h.engine.play("feedback.affirm");
    expect(h.events.length).toBe(before);
    h.engine.setEnabled(true);
    expect(h.saved).toEqual([false, true]);
    expect(h.started).toHaveLength(1);
  });

  it("applies per-cue cooldowns", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.engine.play("model.tick");
    h.advance(30);
    h.engine.play("model.tick");
    h.advance(100);
    h.engine.play("model.tick");
    expect(h.started).toHaveLength(2);
  });

  it("caps simultaneous voices", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    const cues = [
      "ui.select",
      "ui.toggle.on",
      "ui.toggle.off",
      "ui.open",
      "ui.close",
      "model.step",
      "model.select",
      "model.snap",
      "model.reveal",
      "nav.fallback",
    ] as const;
    for (const cue of cues) h.engine.play(cue);
    const sounding = h.started.filter((s) => s.stoppedAt === null);
    expect(sounding.length).toBeLessThanOrEqual(8);
  });

  it("schedules sequence layers relative to their origin", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.advance(1000);
    h.engine.sequence(
      "accordion.forward",
      [
        { cue: "nav.air.rise", at: 0 },
        { cue: "nav.tick", at: 200, rate: 1.05 },
      ],
      1000,
    );
    expect(h.started.map((s) => s.at)).toEqual([0, 0.2]);
    expect(h.started[1]?.rate).toBeCloseTo(1.05, 5);
    expect(h.events.map((e) => e.sequence)).toContain("accordion.forward");
  });

  it("skips layers whose moment has already passed", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.advance(1000);
    h.engine.sequence(
      "chapter.forward",
      [
        { cue: "chapter.slide", at: 0 },
        { cue: "chapter.seal", at: 600 },
      ],
      500, // origin 500 ms ago: the slide is stale, the seal still ahead
    );
    expect(h.events.map((e) => e.cue)).toEqual(["chapter.seal"]);
  });

  it("cancels pending and sounding layers, and a new sequence replaces the old", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    const first = h.engine.sequence("a", [{ cue: "nav.settle", at: 300 }]);
    h.engine.sequence("b", [{ cue: "nav.land", at: 0 }]);
    expect(h.cancels).toEqual(["a"]);
    expect(h.started[0]?.stoppedAt).not.toBeNull();
    first.cancel(); // stale handle: harmless
    expect(h.cancels).toEqual(["a"]);
  });

  it("keeps channels apart: pop-up and story sequences never cancel navigation", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.engine.sequence("nav", [{ cue: "nav.settle", at: 300 }]);
    h.engine.sequence(
      "pop",
      [{ cue: "story.grow", at: 100 }],
      undefined,
      "inspection",
    );
    h.engine.sequence(
      "story",
      [{ cue: "story.appear", at: 100 }],
      undefined,
      "story",
    );
    h.engine.sequence(
      "pop.again",
      [{ cue: "story.grow", at: 100 }],
      undefined,
      "inspection",
    );
    expect(h.cancels).toEqual(["pop"]);
    h.engine.setEnabled(false); // one switch silences every channel
    expect([...h.cancels].sort()).toEqual(
      ["nav", "pop", "pop.again", "story"].sort(),
    );
  });

  it("spaces story accents apart but lets placement ticks cascade", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.engine.play("story.grow");
    h.advance(100);
    h.engine.play("story.appear"); // within 220 ms of the last accent
    h.advance(150);
    h.engine.play("story.stamp");
    expect(h.events.map((e) => e.cue)).toEqual(["story.grow", "story.stamp"]);
    h.engine.play("story.piece");
    h.advance(40);
    h.engine.play("story.piece");
    expect(h.events.filter((e) => e.cue === "story.piece")).toHaveLength(2);
  });

  it("suspends when hidden and stops everything on pagehide", async () => {
    const h = harness();
    h.engine.connect();
    await h.gesture();
    h.engine.play("activity.complete");
    h.document.visibilityState = "hidden";
    h.document.dispatchEvent(new Event("visibilitychange"));
    await h.flush();
    expect(h.contexts[0]?.state).toBe("suspended");
    expect(h.started[0]?.stoppedAt).not.toBeNull();
    h.document.visibilityState = "visible";
    h.document.dispatchEvent(new Event("visibilitychange"));
    await h.flush();
    expect(h.contexts[0]?.state).toBe("running");
  });

  it("keeps working when storage fails", () => {
    const engine = createSoundEngine(
      {
        load: () => {
          throw new Error("blocked");
        },
        save: () => {
          throw new Error("blocked");
        },
      },
      harnessEnvironment(),
    );
    expect(engine.enabled).toBe(true);
    expect(() => engine.setEnabled(false)).not.toThrow();
    expect(engine.enabled).toBe(false);
  });
});

function harnessEnvironment() {
  class Ctx {}
  return {
    window: Object.assign(new EventTarget(), {
      document: new EventTarget(),
    }) as unknown as Window & typeof globalThis,
    AudioContext: Ctx as unknown as typeof AudioContext,
    OfflineAudioContext: undefined,
  };
}
