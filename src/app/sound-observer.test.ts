import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSoundPreferenceStore } from "./browser-sound-preference-store";
import {
  createCheckObserver,
  createCompletionObserver,
  type CheckView,
} from "./sound-observer";

const view = (over: Partial<CheckView> = {}): CheckView => ({
  actor: 1,
  responseRevision: 1,
  checkedRevision: null,
  responseStage: null,
  outcome: null,
  ...over,
});

describe("authoritative check cue", () => {
  it("fires once when the actor's response becomes checked", () => {
    const observe = createCheckObserver();
    expect(observe(view())).toBeNull();
    const checked = view({ checkedRevision: 1, outcome: "CONFIRMED" });
    expect(observe(checked)).toBe("CONFIRMED");
    expect(observe(checked)).toBeNull(); // re-render, same result
    expect(observe({ ...checked })).toBeNull(); // new object, same result
  });

  it("is silent for a result that was already there (restore, review, re-entry)", () => {
    const observe = createCheckObserver();
    expect(
      observe(view({ checkedRevision: 1, outcome: "RECONSIDERATION" })),
    ).toBeNull();
    // A restored actor is a new instance with its own silent baseline.
    expect(
      observe(view({ actor: 2, checkedRevision: 1, outcome: "CONFIRMED" })),
    ).toBeNull();
  });

  it("fires again only for a new checked revision or stage", () => {
    const observe = createCheckObserver();
    observe(view());
    expect(
      observe(view({ checkedRevision: 1, outcome: "RECONSIDERATION" })),
    ).toBe("RECONSIDERATION");
    // Editing makes the check stale: silence, then a fresh check sounds.
    expect(
      observe(
        view({
          responseRevision: 2,
          checkedRevision: 1,
          outcome: "RECONSIDERATION",
        }),
      ),
    ).toBeNull();
    expect(
      observe(
        view({ responseRevision: 2, checkedRevision: 2, outcome: "CONFIRMED" }),
      ),
    ).toBe("CONFIRMED");
    expect(
      observe(
        view({
          responseRevision: 2,
          checkedRevision: 2,
          responseStage: "SECOND",
          outcome: "CONFIRMED",
        }),
      ),
    ).toBe("CONFIRMED");
  });

  it("never fires without an engine evaluation", () => {
    const observe = createCheckObserver();
    observe(view());
    expect(observe(view({ checkedRevision: 1 }))).toBeNull();
    expect(observe(null)).toBeNull();
  });
});

describe("authoritative completion cue", () => {
  it("fires once when the Session commits a new finalized completion", () => {
    const observe = createCompletionObserver();
    const initial = {};
    expect(observe({ lifecyclePhase: "active", completion: initial })).toBe(
      false,
    );
    expect(
      observe({
        lifecyclePhase: "finish-clear-in-flight",
        completion: initial,
      }),
    ).toBe(false);
    const finalized = {};
    expect(
      observe({ lifecyclePhase: "finalized", completion: finalized }),
    ).toBe(true);
    expect(
      observe({ lifecyclePhase: "finalized", completion: finalized }),
    ).toBe(false);
  });

  it("is silent on first observation, abandon and a failed clear", () => {
    const observe = createCompletionObserver();
    const done = {};
    // A session already finalized when observation begins stays quiet.
    expect(observe({ lifecyclePhase: "finalized", completion: done })).toBe(
      false,
    );
    // Abandoning keeps the record; a failed clear never reaches "finalized".
    expect(observe({ lifecyclePhase: "active", completion: done })).toBe(false);
    expect(observe({ lifecyclePhase: "finish-failed", completion: {} })).toBe(
      false,
    );
  });
});

describe("sound preference store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the learner's choice", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
      },
    });
    expect(createBrowserSoundPreferenceStore().load()).toBeNull();
    createBrowserSoundPreferenceStore().save(false);
    expect(createBrowserSoundPreferenceStore().load()).toBe(false);
    expect(JSON.parse(data.get("paid.preferences.sound.v1")!)).toEqual({
      enabled: false,
    });
  });

  it("ignores malformed data and survives blocked storage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "{nope",
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    const store = createBrowserSoundPreferenceStore();
    expect(store.load()).toBeNull();
    expect(() => store.save(true)).not.toThrow();
  });
});
