import { expect, it } from "vitest";
import { eventKey, shouldFocus } from "./focusPolicy";
import type { FocusEvent } from "./public";

const base = { identity: "current", target: { current: null } };
it("ignores initial destination, duplicates and blocked events", () => {
  const event: FocusEvent = { ...base, kind: "destination" };
  expect(shouldFocus(event, null, true, false)).toBe(false);
  expect(shouldFocus(event, null, false, false)).toBe(true);
  expect(shouldFocus(event, eventKey(event), false, false)).toBe(false);
  expect(shouldFocus(event, null, false, true)).toBe(false);
});
it("requires structural invalidity and an explicit completed safe fallback", () => {
  for (const structurallyInvalid of [true, false])
    expect(
      shouldFocus(
        { ...base, kind: "invalid-response", structurallyInvalid },
        null,
        false,
        false,
      ),
    ).toBe(structurallyInvalid);
  for (const closeCompleted of [true, false])
    for (const invokerUnavailable of [true, false])
      expect(
        shouldFocus(
          { ...base, kind: "post-modal", closeCompleted, invokerUnavailable },
          null,
          false,
          false,
        ),
      ).toBe(closeCompleted && invokerUnavailable);
});
it("supports fresh step/recovery identities without conflating event kinds", () => {
  const step: FocusEvent = { ...base, kind: "major-step" };
  const recovery: FocusEvent = { ...base, kind: "recovered-activity" };
  expect(eventKey(step)).not.toBe(eventKey(recovery));
  expect(shouldFocus(step, null, true, false)).toBe(true);
  expect(shouldFocus(recovery, eventKey(step), false, false)).toBe(true);
  expect(shouldFocus({ ...step, identity: "" }, null, false, false)).toBe(
    false,
  );
});
