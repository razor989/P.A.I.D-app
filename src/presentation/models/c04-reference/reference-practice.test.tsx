// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReferenceRenderer } from "./reference-renderer";
import type { C04Presentation } from "../c04-anchored-change-track/public";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const stages = [
  "PESO_COMPARISON",
  "REFERENCE_PAIR",
  "PERCENTAGE_COMPARISON",
] as const;
describe("PRACTICE-01 presentation feedback sequencing", () => {
  it.each([0, 1, 2])(
    "delivers canonical success before optional formative participation Q%s",
    (q) => {
      const host = document.createElement("div");
      document.body.append(host);
      const delivered = vi.fn();
      const renderer = createReferenceRenderer(host, vi.fn());
      const frame: C04Presentation["frame"] = {
        activityId: "C04-A02",
        stateId: "CONFIRMATION",
        responseStage: stages[q]!,
        contentReferences: [],
        exposedModelFacts: [],
        exposedDerivedFacts: [],
        allowedLearnerIntents: ["FINISH_ACTIVITY"],
        feedbackState: {
          outcome: "CONFIRMED",
          content: {
            id: "fixture-feedback",
            text: "Presentation fixture: checked feedback.",
          },
        },
      };
      const props: C04Presentation = {
        frame,
        blocked: false,
        onIntent: vi.fn(),
        onSelect: vi.fn(),
        onPresented: delivered,
        draftIdentity: `actor/${frame.stateId}/${frame.responseStage}`,
        presentationIdentity: "actor/current/1",
        fields: [],
        reference: {
          A: {
            original: "20000",
            next: "22000",
            difference: "2000",
            percentage: "10",
            relative: "0.1",
          },
          B: {
            original: "10000",
            next: "12000",
            difference: "2000",
            percentage: "20",
            relative: "0.2",
          },
        },
      };
      renderer.update(props);
      expect(
        host.querySelector("#feedback[data-content-id]")?.textContent,
      ).toContain(frame.feedbackState!.content.text);
      expect(delivered).toHaveBeenCalledOnce();
      delivered.mockClear();
      host
        .querySelector<HTMLButtonElement>(
          q === 0
            ? '[data-q1-mode="shares"]'
            : q === 1
              ? '[data-q2-choice="own"]'
              : '[data-q3-choice="smaller"]',
        )!
        .click();
      expect(host.querySelector("#feedback")?.textContent).toContain(
        frame.feedbackState!.content.text,
      );
      expect(delivered).not.toHaveBeenCalled();
      if (q === 2) {
        const model = host.querySelector(".q3-pair svg");
        const control = host.querySelector<HTMLButtonElement>(
          '[data-q3-choice="smaller"]',
        )!;
        renderer.update({ ...props, blocked: true });
        expect(host.querySelector(".q3-pair svg")).toBe(model);
        expect(host.querySelector('[data-q3-choice="smaller"]')).toBe(control);
        expect(control.disabled).toBe(true);
        expect(control.getAttribute("aria-pressed")).toBe("true");
        renderer.update(props);
        expect(control.disabled).toBe(false);
        expect(delivered).toHaveBeenCalledOnce();
        const { feedbackState: omittedFeedback, ...revisionFrame } = frame;
        expect(omittedFeedback).toBeDefined();
        renderer.update({ ...props, frame: revisionFrame });
        expect(host.querySelector(".q3-laboratory")).toBeNull();
        renderer.update(props);
        expect(host.querySelector<HTMLElement>(".q3-pair")!.hidden).toBe(true);
      }
      if (q === 1) {
        const model = host.querySelector(".q2-pair svg");
        const control = host.querySelector<HTMLButtonElement>(
          '[data-q2-choice="own"]',
        )!;
        renderer.update({ ...props, blocked: true });
        expect(host.querySelector(".q2-pair svg")).toBe(model);
        expect(host.querySelector('[data-q2-choice="own"]')).toBe(control);
        expect(control.getAttribute("aria-pressed")).toBe("true");
        expect(control.disabled).toBe(true);
        renderer.update(props);
        expect(control.disabled).toBe(false);
        expect(delivered).toHaveBeenCalledOnce();
      }
      if (q === 0) {
        const svg = host.querySelector(".q1-pair svg");
        const control = host.querySelector('[data-q1-mode="shares"]');
        renderer.update({ ...props, blocked: true });
        expect(host.querySelector(".q1-pair svg")).toBe(svg);
        expect(host.querySelector('[data-q1-mode="shares"]')).toBe(control);
        expect(control?.getAttribute("aria-pressed")).toBe("true");
        expect((control as HTMLButtonElement).disabled).toBe(true);
        renderer.update(props);
        expect((control as HTMLButtonElement).disabled).toBe(false);
      }
      renderer.dispose();
    },
  );
});
