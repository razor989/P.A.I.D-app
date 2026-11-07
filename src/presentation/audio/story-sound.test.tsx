// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CueId } from "./cues";
import { silentEngine, type SoundEngine } from "./engine";
import { createInspectionSound } from "./inspection";
import {
  SoundProvider,
  useStoryAccents,
  useStoryCues,
  type StoryAccent,
} from "./SoundProvider";
import { useInspectionCues } from "./inspection";

afterEach(cleanup);

function fake() {
  const played: { cue: CueId; rate?: number }[] = [];
  const engine: SoundEngine = {
    ...silentEngine,
    connect: () => () => {},
    play: (cue, options) => {
      played.push(
        options?.rate !== undefined ? { cue, rate: options.rate } : { cue },
      );
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SoundProvider engine={engine}>{children}</SoundProvider>
  );
  return { engine, played, cues: () => played.map((p) => p.cue), wrapper };
}

describe("story cues", () => {
  it("turns a page only when playback advances by itself, and settles at the end", () => {
    const { cues, wrapper } = fake();
    const view = renderHook(
      (p: { moment: number; playing: boolean; ended: boolean }) =>
        useStoryCues(p.moment, p),
      { wrapper, initialProps: { moment: 0, playing: false, ended: false } },
    );
    expect(cues()).toEqual([]);
    view.rerender({ moment: 1, playing: true, ended: false });
    expect(cues()).toEqual(["story.moment"]);
    view.rerender({ moment: 2, playing: true, ended: true });
    expect(cues()).toEqual(["story.moment", "story.moment", "story.end"]);
    // Replaying from the start is the Play press's own sound.
    view.rerender({ moment: 0, playing: true, ended: false });
    expect(cues()).toHaveLength(3);
  });

  it("never doubles a step or a scrub with a page turn", () => {
    const { cues, wrapper } = fake();
    const view = renderHook(
      (p: { moment: number }) => useStoryCues(p.moment, { playing: false }),
      { wrapper, initialProps: { moment: 0 } },
    );
    view.result.current.stepped();
    view.rerender({ moment: 1 });
    view.result.current.scrubbing();
    view.rerender({ moment: 2 });
    view.result.current.toggled(true);
    view.result.current.toggled(false);
    expect(cues()).toEqual([
      "model.step",
      "model.tick",
      "ui.toggle.on",
      "ui.toggle.off",
    ]);
  });
});

describe("story accents", () => {
  const accents: StoryAccent[] = [
    { at: 0.5, cue: "story.grow" },
    { at: 1, cue: "story.appear" },
    { at: 1.5, cue: "story.piece", rate: 1.04 },
  ];
  type P = { at: number; playing: boolean; reduced?: boolean };
  const mount = (initial: P) => {
    const sound = fake();
    const view = renderHook(
      (p: P) => useStoryAccents(p.at, p.playing, p.reduced ?? false, accents),
      { wrapper: sound.wrapper, initialProps: initial },
    );
    return { ...sound, view };
  };

  it("sounds each accent once as playback passes it, with its rate", () => {
    const { played, view } = mount({ at: 0, playing: true });
    view.rerender({ at: 0.4, playing: true });
    view.rerender({ at: 1, playing: true });
    view.rerender({ at: 1, playing: true });
    view.rerender({ at: 2, playing: true });
    expect(played).toEqual([
      { cue: "story.grow" },
      { cue: "story.appear" },
      { cue: "story.piece", rate: 1.04 },
    ]);
  });

  it("stays silent on a seek, a pause or a jump back", () => {
    const { cues, view } = mount({ at: 0, playing: true });
    view.rerender({ at: 2, playing: false }); // seek: paused
    view.rerender({ at: 0, playing: true }); // jump back
    view.rerender({ at: 0.6, playing: true });
    expect(cues()).toEqual(["story.grow"]);
  });

  it("skips motion when motion is reduced, keeping what appears", () => {
    const { cues, view } = mount({ at: 0, playing: true, reduced: true });
    view.rerender({ at: 2, playing: true, reduced: true });
    expect(cues()).toEqual(["story.appear"]);
  });
});

describe("inspection sound", () => {
  it("maps pop-up events onto their cues, rising piece by piece", () => {
    const { engine, played } = fake();
    const sound = createInspectionSound(engine);
    sound("open");
    sound("switch");
    sound("pin");
    sound("piece", { index: 0 });
    sound("piece", { index: 2 });
    sound("grow");
    sound("draw");
    sound("close");
    expect(played.map((p) => p.cue)).toEqual([
      "inspect.open",
      "inspect.switch",
      "model.reveal",
      "story.piece",
      "story.piece",
      "story.grow",
      "story.draw",
      "inspect.close",
    ]);
    expect(played[4]?.rate).toBeCloseTo(1.04, 5);
  });

  it("follows React pop-up state: open, switch, close, and a pin plays nothing extra", () => {
    const { cues, wrapper } = fake();
    const view = renderHook(
      (p: { part: string | null; pinned: boolean }) =>
        useInspectionCues(p.part, p.pinned),
      { wrapper, initialProps: { part: null as string | null, pinned: false } },
    );
    view.rerender({ part: "rate", pinned: false });
    view.rerender({ part: "hours", pinned: false });
    view.rerender({ part: null, pinned: false });
    view.rerender({ part: "rate", pinned: true });
    expect(cues()).toEqual(["inspect.open", "inspect.switch", "inspect.close"]);
  });
});
