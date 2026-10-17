import { createActor } from "xstate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import { composeStudyCatalog } from "@/study/catalog/public";
import { createActivityMachine } from "@/engine/activity-machine/public";
import type {
  ActivityDefinition,
  ActivityPorts,
} from "@/engine/activity-machine/public";
import { createAppSessionActor, selectSession } from "../app-machine/public";
import type { AppSessionActor } from "../app-machine/public";
import { isNavigationIntent, navigate, resolveActivityBack } from "./public";

const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const;
function catalog() {
  return composeStudyCatalog({
    complete: false,
    competencies: [
      { id: "C04", activityIds: ids },
      { id: "C01", activityIds: ["C01-A01"] },
    ],
    activities: [...ids, "C01-A01"].map((id) => ({
      id,
      competencyId: id.slice(0, 3),
      scenarioIds: [id.replace("-A", "-S")],
      instructionalFamily: "Navigation membership fixture",
      contentReferences: [{ contentId: "navigation-fixture", variableIds: [] }],
      responseContract: { contractId: "navigation-fixture" },
    })),
    scenarios: ids.map((id) => ({
      id: id.replace("-A", "-S"),
      activityId: id,
      competencyId: "C04",
      facts: [],
      variants: [],
    })),
    contentIds: [],
    responseContractIds: [],
    modelProfileIds: [],
    interactionProfileIds: [],
    oracleIds: [],
  });
}
const sessions: AppSessionActor[] = [];
afterEach(() => {
  sessions.splice(0).forEach((actor) => actor.stop());
  vi.restoreAllMocks();
});
function session() {
  const actor = createAppSessionActor({
    catalog: catalog(),
    recovery: { status: "NO_CHECKPOINT" },
  });
  sessions.push(actor);
  return actor.start();
}
function open(s: AppSessionActor, id: (typeof ids)[number] = "C04-A02") {
  expect(navigate(s, { type: "SELECT_ACTIVITY", activityId: id })).toBe(
    "destination-changed",
  );
  return selectSession(s).currentActivity!;
}
const back = (s: AppSessionActor) => navigate(s, { type: "SYSTEM_BACK" });

describe("T033 real C04 Session semantic navigation", () => {
  it("closes Review before Previous and routes, preserving exact underlying state", () => {
    const s = session();
    const a = open(s);
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    const model = a.getSnapshot().context.model!;
    a.send({
      type: "SELECT_MODEL_CHILD",
      modelId: model.modelId,
      selectionId: "C04-S02-A",
      revision: model.revision,
      position: "EXP-02",
    });
    const before = a.getSnapshot().context;
    expect(before.c04A02StageEngagement!["EXP-02"]["C04-S02-A"]).toBe(true);
    const destination = selectSession(s).destination;
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const send = vi.spyOn(a, "send");
    expect(back(s)).toBe("support-closed");
    expect(send.mock.calls).toEqual([[{ type: "CLOSE_SUPPORT" }]]);
    expect(a.getSnapshot().context).toEqual(before);
    expect(selectSession(s).destination).toBe(destination);
    expect(selectSession(s).currentActivity).toBe(a);
    send.mockClear();
    expect(back(s)).toBe("explanation-previous");
    expect(send.mock.calls).toEqual([[{ type: "PREVIOUS" }]]);
    expect(a.getSnapshot().context.position).toBe("EXP-01");
    expect(a.getSnapshot().context.model).toBe(before.model);
    expect(a.getSnapshot().context.c04A02StageEngagement).toEqual(
      before.c04A02StageEngagement,
    );
    expect(a.getSnapshot().context.response).toBeNull();
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.c04A02StageEngagement).toEqual(
      before.c04A02StageEngagement,
    );
    expect(back(s)).toBe("explanation-previous");
    expect(selectSession(s).destination).toBe(destination);
    expect(back(s)).toBe("destination-changed");
    expect(selectSession(s).destination).toEqual({
      kind: "competency",
      competencyId: "C04",
    });
  });

  it.each(ids)(
    "preserves unfinished %s through Activity→Competency→Library and re-entry",
    (id) => {
      const s = session();
      const a = open(s, id);
      const stop = vi.spyOn(a, "stop");
      const start = vi.spyOn(a, "start");
      const before = a.getSnapshot();
      const initial = selectSession(s);
      expect(back(s)).toBe("destination-changed");
      expect(selectSession(s).destination).toEqual({
        kind: "competency",
        competencyId: "C04",
      });
      expect(back(s)).toBe("destination-changed");
      expect(selectSession(s).destination).toEqual({ kind: "library" });
      expect(back(s)).toBe("platform-root");
      expect(a.getSnapshot()).toBe(before);
      expect(selectSession(s).currentActivity).toBe(a);
      expect(selectSession(s).completion).toBe(initial.completion);
      expect(selectSession(s).recovery).toBe(initial.recovery);
      expect(stop).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(open(s, id)).toBe(a);
      expect(a.getSnapshot()).toBe(before);
    },
  );

  it("preserves real draft mathematics without inferred feedback through Review, browsing and re-entry", () => {
    const s = session();
    const a = open(s, "C04-A01");
    a.send({ type: "CONTINUE" });
    const money = (value: string) => ({
      kind: "EXACT_QUANTITY" as const,
      value: quantity(
        ExactDecimal.from(value),
        "MONETARY_AMOUNT",
        "PHP",
        "per month",
      ),
    });
    const response = {
      kind: "COMPOSITE" as const,
      parts: [
        { key: "original", response: money("18000") },
        { key: "new", response: money("18000") },
        { key: "difference", response: money("0") },
        {
          key: "percentage",
          response: {
            kind: "EXACT_QUANTITY" as const,
            value: quantity(
              ExactDecimal.from("0"),
              "PERCENTAGE_CHANGE",
              "%",
              null,
            ),
          },
        },
      ],
    };
    // A real draft is retained even before its required interpretation is supplied.
    a.send({ type: "RESPONSE_CHANGED", response });
    const draft = a.getSnapshot();
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(back(s)).toBe("support-closed");
    expect(a.getSnapshot().context).toEqual(draft.context);
    expect(back(s)).toBe("destination-changed");
    expect(back(s)).toBe("destination-changed");
    expect(open(s, "C04-A01")).toBe(a);
    expect(a.getSnapshot().context).toEqual(draft.context);
    expect(a.getSnapshot().context.response).not.toBeNull();
    expect(a.getSnapshot().context.evaluation).toBeNull();
  });

  it("uses hierarchy rather than previously visited competency or independent history", () => {
    const s = session();
    const a = open(s, "C04-A01");
    navigate(s, { type: "SELECT_COMPETENCY", competencyId: "C01" });
    open(s, "C04-A01");
    expect(back(s)).toBe("destination-changed");
    expect(selectSession(s).destination).toEqual({
      kind: "competency",
      competencyId: "C04",
    });
    back(s);
    const root = s.getSnapshot();
    for (let i = 0; i < 5; i++) expect(back(s)).toBe("platform-root");
    expect(s.getSnapshot()).toBe(root);
    expect(selectSession(s).currentActivity).toBe(a);
  });

  it.each(["loading", "recoverable", "unrecoverable"] as const)(
    "Back preserves separate technical %s and exact learner state",
    (technical) => {
      const s = session();
      const a = open(s);
      a.send({ type: "CONTINUE" });
      const before = a.getSnapshot();
      s.send({ type: "TECHNICAL_STARTED" });
      if (technical !== "loading")
        s.send({
          type: "TECHNICAL_FAILED",
          recoverable: technical === "recoverable",
          error: "controlled",
        });
      const state = selectSession(s);
      back(s);
      back(s);
      expect(a.getSnapshot()).toBe(before);
      expect(selectSession(s)).toMatchObject({
        technical,
        technicalError: state.technicalError,
        completion: { kind: "unknown" },
      });
    },
  );

  it("rejects conflicts without switching, resetting, completing or revealing answers", () => {
    const s = session();
    const a = open(s);
    const before = a.getSnapshot();
    expect(before.context).toMatchObject({
      response: null,
      checkedResponse: null,
      evaluation: null,
      hasChecked: false,
    });
    for (const id of ["C01-A01", "C04-A05", "C99-A01"])
      expect(navigate(s, { type: "SELECT_ACTIVITY", activityId: id })).toBe(
        "rejected",
      );
    expect(selectSession(s).currentActivity).toBe(a);
    expect(a.getSnapshot()).toBe(before);
    expect(selectSession(s).decision).toBe("none");
    expect(
      navigate(s, { type: "SELECT_ACTIVITY", activityId: "C04-A01" }),
    ).toBe("destination-changed");
    expect(selectSession(s).decision).toBe("activitySwitchChoice");
    expect(back(s)).toBe("destination-changed");
    expect(selectSession(s).currentActivity).toBe(a);
    expect(a.getSnapshot()).toBe(before);
  });

  it("keeps independent Sessions isolated", () => {
    const left = session();
    const right = session();
    const a = open(left);
    const b = open(right);
    const before = b.getSnapshot();
    a.send({ type: "CONTINUE" });
    back(left);
    back(left);
    expect(a).not.toBe(b);
    expect(b.getSnapshot()).toBe(before);
    expect(selectSession(right).destination).toEqual({
      kind: "activity",
      activityId: "C04-A02",
    });
  });

  it.each([
    undefined,
    null,
    {},
    [],
    { type: "SYSTEM_BACK", extra: true },
    { type: "RETURN_TO_LIBRARY", extra: true },
    { type: "TECHNICAL_STARTED" },
    { type: "SELECT_COMPETENCY", competencyId: "C99" },
    { type: "PREVIOUS" },
  ])("rejects malformed/unsupported intent %j", (event) => {
    const s = session();
    const before = s.getSnapshot();
    expect(navigate(s, event)).toBe("rejected");
    expect(s.getSnapshot()).toBe(before);
  });

  it("rejects accessor, symbol and prototyped intents without executing getters", () => {
    const get = vi.fn(() => "SYSTEM_BACK");
    for (const event of [
      Object.create({ type: "SYSTEM_BACK" }) as unknown,
      Object.defineProperty({}, "type", { get }),
      { type: "SYSTEM_BACK", [Symbol()]: true },
    ])
      expect(isNavigationIntent(event)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects Back during unresolved startup without discarding evidence", () => {
    const s = createAppSessionActor({ catalog: catalog() });
    sessions.push(s);
    s.start();
    const before = s.getSnapshot();
    expect(back(s)).toBe("rejected");
    expect(s.getSnapshot()).toBe(before);
  });

  it.each(["UNUSABLE_CHECKPOINT", "technical-failure"] as const)(
    "refuses navigation through unresolved %s recovery",
    (status) => {
      const recovery =
        status === "UNUSABLE_CHECKPOINT"
          ? { status, reason: "controlled" }
          : { status, error: "controlled" };
      const s = createAppSessionActor({ catalog: catalog(), recovery });
      sessions.push(s);
      s.start();
      const before = s.getSnapshot();
      for (const event of [
        { type: "SYSTEM_BACK" },
        { type: "RETURN_TO_LIBRARY" },
        { type: "SELECT_COMPETENCY", competencyId: "C04" },
      ])
        expect(navigate(s, event)).toBe("rejected");
      expect(s.getSnapshot()).toBe(before);
    },
  );

  it("refuses direct Library-return from Activity/root and all navigation after Session stop", () => {
    const s = session();
    expect(navigate(s, { type: "RETURN_TO_LIBRARY" })).toBe("rejected");
    const a = open(s);
    const before = a.getSnapshot();
    expect(navigate(s, { type: "RETURN_TO_LIBRARY" })).toBe("rejected");
    expect(a.getSnapshot()).toBe(before);
    s.stop();
    expect(back(s)).toBe("rejected");
  });

  it("walks each real C04 authored Previous edge without inventing engagement", () => {
    const s = session();
    const a = open(s);
    a.send({ type: "CONTINUE" });
    for (let step = 1; step < 5; step++) {
      const context = a.getSnapshot().context;
      if (context.position === "EXP-02" || context.position === "EXP-03") {
        a.send({
          type: "SELECT_MODEL_CHILD",
          modelId: context.model!.modelId,
          selectionId:
            context.position === "EXP-02" ? "C04-S02-A" : "C04-S02-B",
          revision: context.model!.revision,
          position: context.position,
        });
      }
      a.send({ type: "CONTINUE" });
    }
    expect(a.getSnapshot().context.position).toBe("EXP-05");
    const model = a.getSnapshot().context.model;
    const engagement = a.getSnapshot().context.c04A02StageEngagement;
    for (const position of ["EXP-04", "EXP-03", "EXP-02", "EXP-01"]) {
      expect(back(s)).toBe("explanation-previous");
      expect(a.getSnapshot().context.position).toBe(position);
      expect(a.getSnapshot().context.model).toBe(model);
      expect(a.getSnapshot().context.c04A02StageEngagement).toEqual(engagement);
    }
    expect(back(s)).toBe("destination-changed");
  });
});

describe("D035/S1 layered generic Engine Source Review — same production local Back path", () => {
  const definition: ActivityDefinition = {
    activityId: "C04-A01",
    edges: {
      ENTRY: { CONTINUE: "EXP-01" },
      "EXP-01": { CONTINUE: "EXP-02" },
      "EXP-02": { PREVIOUS: "EXP-01", CONTINUE: "ACTIVE" },
    },
    support: { "EXP-02": ["SOURCE_REVIEW"], REVISION: ["SOURCE_REVIEW"] },
  };
  const ports: ActivityPorts = {
    ready: () => true,
    evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
    completionEligible: () => false,
    sourceReviewAvailable: (id, origin) =>
      id === "C04-A01" && (origin === "EXP-02" || origin === "REVISION"),
    informationNeeded: () => false,
    informationReturn: () => false,
  };
  it("closes genuine Source Review before Previous with exact origin and one dispatch", () => {
    const a = createActor(createActivityMachine(definition, ports)).start();
    try {
      a.send({ type: "CONTINUE" });
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().can({ type: "PREVIOUS" })).toBe(true);
      const before = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      expect(a.getSnapshot().matches({ support: "sourceReview" })).toBe(true);
      const send = vi.spyOn(a, "send");
      expect(resolveActivityBack(a)).toBe("support-closed");
      expect(send.mock.calls).toEqual([[{ type: "CLOSE_SUPPORT" }]]);
      expect(a.getSnapshot().context).toEqual(before);
      expect(a.getSnapshot().value).toEqual({
        instructional: "exp",
        support: "none",
      });
      expect(resolveActivityBack(a)).toBe("explanation-previous");
      expect(a.getSnapshot().context.position).toBe("EXP-01");
    } finally {
      a.stop();
    }
  });
  it("preserves genuine checked state on Source Review close at revision", () => {
    const a = createActor(createActivityMachine(definition, ports)).start();
    try {
      for (let i = 0; i < 3; i++) a.send({ type: "CONTINUE" });
      a.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "SINGLE_SELECTION",
          selectionId: "receiver-response",
        },
      });
      a.send({ type: "CHECK_RESPONSE" });
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      a.send({ type: "REVISE" });
      const before = a.getSnapshot().context;
      expect(before.hasChecked).toBe(true);
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      expect(a.getSnapshot().matches({ support: "sourceReview" })).toBe(true);
      expect(resolveActivityBack(a)).toBe("support-closed");
      expect(a.getSnapshot().context).toEqual(before);
    } finally {
      a.stop();
    }
  });
  it("denies Source Review without availability and never fabricates Previous", () => {
    const a = createActor(
      createActivityMachine(definition, {
        ...ports,
        sourceReviewAvailable: () => false,
      }),
    ).start();
    try {
      a.send({ type: "CONTINUE" });
      const before = a.getSnapshot();
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      expect(a.getSnapshot().context).toEqual(before.context);
      expect(resolveActivityBack(a)).toBe("unavailable");
      a.stop();
      expect(resolveActivityBack(a)).toBe("rejected");
    } finally {
      a.stop();
    }
  });

  it("does not reinterpret Information Needed Previous as Explanation or bypass reinforcement", () => {
    const info = createActor(
      createActivityMachine(
        {
          activityId: "C04-A01",
          edges: {
            ENTRY: { CONTINUE: "ACTIVE", INFO_NEEDED: "INFO_NEEDED" },
            INFO_NEEDED: { PREVIOUS: "ENTRY" },
          },
          support: {},
        },
        {
          ...ports,
          informationNeeded: () => true,
          informationReturn: () => true,
        },
      ),
    ).start();
    const reinforcement = createActor(
      createActivityMachine(
        { ...definition, support: { "EXP-02": ["REINFORCEMENT"] } },
        ports,
      ),
    ).start();
    try {
      info.send({ type: "INFO_NEEDED" });
      expect(info.getSnapshot().can({ type: "PREVIOUS" })).toBe(true);
      const before = info.getSnapshot();
      expect(resolveActivityBack(info)).toBe("unavailable");
      expect(info.getSnapshot()).toBe(before);
      reinforcement.send({ type: "CONTINUE" });
      reinforcement.send({ type: "CONTINUE" });
      reinforcement.send({ type: "OPEN_SUPPORT", mode: "REINFORCEMENT" });
      const supported = reinforcement.getSnapshot();
      expect(resolveActivityBack(reinforcement)).toBe("rejected");
      expect(reinforcement.getSnapshot()).toBe(supported);
    } finally {
      info.stop();
      reinforcement.stop();
    }
  });
});
