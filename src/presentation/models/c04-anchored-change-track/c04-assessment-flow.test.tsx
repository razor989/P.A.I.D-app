// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnchoredChangeTrack } from "./AnchoredChangeTrack";
import type { C04Presentation } from "./public";
afterEach(cleanup);
const presentation: C04Presentation = {
  frame: {
    activityId: "C04-A01",
    stateId: "CONFIRMATION",
    contentReferences: [],
    exposedModelFacts: [],
    exposedDerivedFacts: [],
    allowedLearnerIntents: [],
    feedbackState: {
      outcome: "CONFIRMED",
      content: { id: "approved", text: "Source-authored current feedback" },
    },
  },
  blocked: false,
  onIntent: vi.fn(),
  onSelect: vi.fn(),
};
it("calls presentation receipt only after authorized feedback exists in the connected DOM", () => {
  const presented = vi.fn((kind: string, element: HTMLElement) => {
    expect(kind).toBe("feedback");
    expect(element.isConnected).toBe(true);
    expect(element.textContent).toContain(
      presentation.frame.feedbackState!.content.text,
    );
  });
  render(<AnchoredChangeTrack {...presentation} onPresented={presented} />);
  expect(presented).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Finish activity" })).toBeNull();
});
it("does not issue a presentation callback under a blocking barrier", () => {
  const presented = vi.fn();
  render(
    <AnchoredChangeTrack {...presentation} blocked onPresented={presented} />,
  );
  expect(presented).not.toHaveBeenCalled();
});
