import { describe, expect, it } from "vitest";
import { recoverCheckpoint } from "./public";
import {
  createRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
} from "../checkpoint/public";
import { projectC04CheckpointV1 } from "../projection/public";
import { createRecoveryCheckpointQueue } from "../store/public";
import {
  composeC04ActivityFrame,
  createC04ActivityActor,
  createC04ActivityBindings,
  createC04RestoredActivityActor,
  projectC04CheckpointModelV1,
} from "@/engine/c04-activity-binding/public";
import type { C04Restoration } from "@/engine/c04-activity-binding/public";
import { ExactDecimal, quantity } from "@/core/public";

type Actor = ReturnType<typeof createC04ActivityActor>;
type Response = NonNullable<C04Restoration["context"]["response"]>;
const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"];
const money = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "MONETARY_AMOUNT", "PHP", "per month"),
});
const percent = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "PERCENTAGE_CHANGE", "%", null),
});
const boundary = {
  kind: "SEMANTIC_BOUNDARY" as const,
  resolution: { kind: "UNDEFINED" as const, reason: "Original value is zero" },
};
const composite = (
  fields: Record<
    string,
    Exclude<Response, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): Response => ({
  kind: "COMPOSITE",
  parts: Object.entries(fields).map(([key, response]) => ({ key, response })),
});
function active(id: string) {
  const actor = createC04ActivityActor(id).start();
  for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++)
    actor.send({ type: "CONTINUE" });
  return actor;
}
async function load(raw: string | null) {
  const calls: string[] = [];
  const queue = createRecoveryCheckpointQueue({
    load: () => {
      calls.push("load");
      return Promise.resolve(raw);
    },
    replace: () => {
      calls.push("replace");
      return Promise.resolve();
    },
    clear: () => {
      calls.push("clear");
      return Promise.resolve();
    },
  });
  const result = await recoverCheckpoint(queue);
  expect(calls).toEqual(["load"]);
  return result;
}
async function roundTrip(original: Actor) {
  const checkpoint = projectC04CheckpointV1(original);
  const envelope = createRecoveryCheckpointV1(checkpoint);
  let raw: string | null = null;
  const queue = createRecoveryCheckpointQueue({
    load: () => Promise.resolve(raw),
    replace: (data) => {
      raw = data;
      return Promise.resolve();
    },
    clear: () => {
      raw = null;
      return Promise.resolve();
    },
  });
  expect((await queue.replace(envelope)).status).toBe("durable");
  const result = await recoverCheckpoint(queue);
  expect(result.status).toBe("VALID_CHECKPOINT");
  if (result.status !== "VALID_CHECKPOINT")
    throw new Error("Restoration failed");
  const restored = result.actor;
  expect(restored).not.toBe(original);
  expect(restored.getSnapshot().value).toEqual({
    instructional: checkpoint.position.startsWith("EXP-")
      ? "exp"
      : (
          {
            ENTRY: "entry",
            ACTIVE: "active",
            REVISION: "revision",
            CONFIRMATION: "confirmation",
            RECONSIDERATION: "reconsideration",
            POST_CONFIRMATION_EXPLANATION: "postConfirmationExplanation",
          } as Record<string, string>
        )[checkpoint.position],
    support: "none",
  });
  expect(projectC04CheckpointV1(restored)).toEqual(checkpoint);
  expect(restored.getSnapshot().context.origin).toBeNull();
  expect(restored.getSnapshot().context.infoOrigin).toBeNull();
  expect(composeC04ActivityFrame(restored)).toEqual(
    composeC04ActivityFrame(original),
  );
  restored.start();
  expect(projectC04CheckpointV1(restored)).toEqual(checkpoint);
  return restored;
}
function submit(actor: Actor, wrong: boolean) {
  const id = actor.getSnapshot().context.activityId;
  const primary = {
    difference: money(wrong ? "0" : "1500"),
    percentage: wrong ? percent("100") : boundary,
  };
  if (id === "C04-A04") {
    actor.send({ type: "RESPONSE_CHANGED", response: composite(primary) });
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
  }
  const role =
    id === "C04-A02"
      ? "comparison"
      : id === "C04-A04"
        ? "explanation"
        : "interpretation";
  const selection = {
    kind: "SINGLE_SELECTION" as const,
    selectionId: composeC04ActivityFrame(actor).responseControls!.find(
      (c) => c.role === role,
    )!.options![wrong ? 1 : 0]!.id,
  };
  const response =
    id === "C04-A01"
      ? composite({
          original: money("18000"),
          new: money("18000"),
          difference: money("0"),
          percentage: percent("0"),
          interpretation: selection,
        })
      : id === "C04-A02"
        ? composite({
            originalA: money("20000"),
            originalB: money("10000"),
            differenceA: money("2000"),
            differenceB: money("2000"),
            percentageA: percent("10"),
            percentageB: percent("20"),
            comparison: selection,
          })
        : id === "C04-A03"
          ? composite({
              original: money("30000"),
              new: money("27000"),
              difference: money("-3000"),
              percentage: percent("-10"),
              interpretation: selection,
            })
          : composite({ ...primary, explanation: selection });
  actor.send({ type: "RESPONSE_CHANGED", response });
}
function select(actor: Actor, child: "C04-S02-A" | "C04-S02-B") {
  const c = actor.getSnapshot().context;
  actor.send({
    type: "SELECT_MODEL_CHILD",
    modelId: c.model!.modelId,
    selectionId: child,
    revision: c.model!.revision,
    position: c.position,
  });
}

describe("T031 authentic semantic recovery", () => {
  it("preserves A04 primary drafts, first commitment, reasoning exposure and a second genuine commitment", async () => {
    const actor = active("C04-A04");
    const primary = composite({
      difference: money("1500"),
      percentage: boundary,
    });
    actor.send({ type: "RESPONSE_CHANGED", response: primary });
    let restored = await roundTrip(actor);
    restored.stop();
    expect(composeC04ActivityFrame(actor).completionActionAvailability).toBe(
      false,
    );
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    restored = await roundTrip(actor);
    expect(restored.getSnapshot().context.responseStage).toBe("REASONING");
    expect(
      restored.getSnapshot().context.explanationCommitmentSequence,
    ).toBeNull();
    restored.send({ type: "CHECK_RESPONSE" });
    expect(restored.getSnapshot().context.evaluation).toBeNull();
    restored.stop();
    const first = actor.getSnapshot().context.firstPrimaryCommitment;
    actor.send({ type: "RETURN_TO_PRIMARY" });
    restored = await roundTrip(actor);
    restored.stop();
    actor.send({ type: "RESPONSE_CHANGED", response: primary });
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    restored = await roundTrip(actor);
    expect(restored.getSnapshot().context.firstPrimaryCommitment).toEqual(
      first,
    );
    expect(
      restored.getSnapshot().context.currentPrimaryCommitment?.sequence,
    ).toBe(2);
    expect(
      restored.getSnapshot().context.currentPrimaryCommitment
        ?.reasoningPreviouslyExposed,
    ).toBe(true);
    restored.stop();
    actor.stop();
  });
  it.each(["UNKNOWN", "UNDEFINED", "NOT_APPLICABLE"] as const)(
    "restores exact %s semantic boundary without deriving an answer",
    async (kind) => {
      const actor = active("C04-A01");
      const resolution =
        kind === "NOT_APPLICABLE"
          ? { kind }
          : { kind, reason: "Unresolved draft" };
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          difference: { kind: "SEMANTIC_BOUNDARY", resolution },
        }),
      });
      const restored = await roundTrip(actor);
      expect(
        composeC04ActivityFrame(restored).completionActionAvailability,
      ).toBe(false);
      expect(restored.getSnapshot().context.responseRevision).toBe(1);
      expect(restored.getSnapshot().context.hasChecked).toBe(false);
      restored.stop();
      actor.stop();
    },
  );
  it("classifies missing storage without mutations", async () => {
    expect(await load(null)).toEqual({ status: "NO_CHECKPOINT" });
  });
  it.each(["reject", "queue"])(
    "keeps %s read failure technical",
    async (mode) => {
      const error = new Error("storage offline");
      const result =
        mode === "reject"
          ? await recoverCheckpoint({
              load: () => Promise.reject(error),
            })
          : await recoverCheckpoint(
              createRecoveryCheckpointQueue({
                load: () => Promise.reject(error),
                replace: () => Promise.resolve(),
                clear: () => Promise.resolve(),
              }),
            );
      expect(result).toEqual({ status: "technical-failure", error });
    },
  );
  it.each(ids)(
    "restores unchanged ENTRY and exact partial drafts %s",
    async (id) => {
      const actor = createC04ActivityActor(id).start();
      let restored = await roundTrip(actor);
      restored.stop();
      for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++)
        actor.send({ type: "CONTINUE" });
      restored = await roundTrip(actor);
      restored.stop();
      const key = id === "C04-A02" ? "differenceA" : "difference";
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          [key]: money("9007199254740993.1234567890123456789"),
        }),
      });
      restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.responseRevision).toBe(1);
      restored.send({ type: "CHECK_RESPONSE" });
      expect(restored.getSnapshot().context.evaluation).toBeNull();
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("ACTIVE");
      restored.stop();
      actor.stop();
    },
  );
  it.each(ids.flatMap((id) => [false, true].map((wrong) => ({ id, wrong }))))(
    "round trips $id checked/revision/delivery wrong=$wrong",
    async ({ id, wrong }) => {
      const actor = active(id);
      submit(actor, wrong);
      let restored = await roundTrip(actor);
      restored.stop();
      actor.send({ type: "CHECK_RESPONSE" });
      expect(actor.getSnapshot().context.evaluation?.outcome).toBe(
        wrong ? "RECONSIDERATION" : "CONFIRMED",
      );
      restored = await roundTrip(actor);
      restored.stop();
      const revision = actor.getSnapshot().context.responseRevision;
      actor.send({ type: "FEEDBACK_DELIVERED", revision });
      restored = await roundTrip(actor);
      restored.stop();
      actor.send({ type: "REVISE" });
      restored = await roundTrip(actor);
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("REVISION");
      restored.stop();
      actor.send({
        type: "RESPONSE_CHANGED",
        response: actor.getSnapshot().context.response!,
      });
      restored = await roundTrip(actor);
      restored.stop();
      if (id === "C04-A04") {
        actor.send({ type: "RETURN_TO_PRIMARY" });
        restored = await roundTrip(actor);
        restored.stop();
        actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
        restored = await roundTrip(actor);
        restored.stop();
        submit(actor, wrong);
      }
      actor.send({ type: "CHECK_AGAIN" });
      restored = await roundTrip(actor);
      restored.stop();
      actor.stop();
    },
  );
  it("restores all A02 explanation positions, Previous/reentry, and model selection without new engagement", async () => {
    const actor = createC04ActivityActor("C04-A02").start();
    for (let i = 1; i <= 5; i++) {
      actor.send({ type: "CONTINUE" });
      if (i === 2) select(actor, "C04-S02-A");
      if (i === 3) select(actor, "C04-S02-B");
      const restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.position).toBe(`EXP-0${i}`);
      expect(
        projectC04CheckpointModelV1(
          restored.getSnapshot().context.model!.value.state,
        ),
      ).toEqual(
        projectC04CheckpointModelV1(
          actor.getSnapshot().context.model!.value.state,
        ),
      );
      expect(restored.getSnapshot().context.model!.value.state).not.toBe(
        actor.getSnapshot().context.model!.value.state,
      );
      if (i > 1) {
        actor.send({ type: "PREVIOUS" });
        restored.send({ type: "PREVIOUS" });
        expect(projectC04CheckpointV1(restored)).toEqual(
          projectC04CheckpointV1(actor),
        );
        actor.send({ type: "CONTINUE" });
        restored.send({ type: "CONTINUE" });
        expect(projectC04CheckpointV1(restored)).toEqual(
          projectC04CheckpointV1(actor),
        );
      }
      restored.stop();
    }
    actor.stop();
  });
  it("preserves two distinct A02 histories with equal selection/revision/position", async () => {
    const actors = [
      createC04ActivityActor("C04-A02").start(),
      createC04ActivityActor("C04-A02").start(),
    ];
    for (const [index, actor] of actors.entries()) {
      actor.send({ type: "CONTINUE" });
      actor.send({ type: "CONTINUE" });
      if (index === 0) select(actor, "C04-S02-A");
      actor.send({ type: "CONTINUE" });
      select(actor, "C04-S02-B");
      if (index === 1) select(actor, "C04-S02-B");
      actor.send({ type: "CONTINUE" });
    }
    const left = await roundTrip(actors[0]!);
    const right = await roundTrip(actors[1]!);
    expect(left.getSnapshot().context.model!.revision).toBe(
      right.getSnapshot().context.model!.revision,
    );
    expect(left.getSnapshot().context.c04A02StageEngagement).not.toEqual(
      right.getSnapshot().context.c04A02StageEngagement,
    );
    for (const actor of [...actors, left, right]) actor.stop();
  });
  it.each([false, true])(
    "preserves A04 mandatory teaching/Finish wrong=%s",
    async (wrong) => {
      const actor = active("C04-A04");
      submit(actor, wrong);
      actor.send({ type: "CHECK_RESPONSE" });
      const revision = actor.getSnapshot().context.responseRevision;
      actor.send({ type: "FEEDBACK_DELIVERED", revision });
      actor.send({ type: "CONTINUE" });
      let restored = await roundTrip(actor);
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      restored.stop();
      const bindingFrame = composeC04ActivityFrame(actor);
      expect(bindingFrame).toBeDefined();
      actor.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: createC04ActivityBindings().find(
          (b) => b.activityId === "C04-A04",
        )!.definition.terminalTeaching!.contentId,
      });
      restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.terminalTeachingRevision).toBe(
        revision,
      );
      actor.send({ type: "FINISH_ACTIVITY" });
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("COMPLETE");
      expect(restored.getSnapshot().value).toEqual(actor.getSnapshot().value);
      restored.stop();
      actor.stop();
    },
  );
  it.each(["REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"] as const)(
    "normalizes %s support intent without changing underlying semantic evidence",
    async (mode) => {
      const actor = active("C04-A01");
      const before = projectC04CheckpointV1(actor);
      actor.send({ type: "OPEN_SUPPORT", mode });
      const result = await load(
        serializeRecoveryCheckpointV1(
          createRecoveryCheckpointV1(projectC04CheckpointV1(actor)),
        ),
      );
      expect(result.status).toBe("VALID_CHECKPOINT");
      if (result.status === "VALID_CHECKPOINT") {
        expect(result.actor.getSnapshot().value).toEqual({
          instructional: "active",
          support: "none",
        });
        expect(projectC04CheckpointV1(result.actor)).toEqual(before);
        result.actor.stop();
      }
      actor.stop();
    },
  );
  it("isolates two restores, retains immutable responses and genuine independent models", async () => {
    const actor = active("C04-A02");
    select(actor, "C04-S02-B");
    const left = await roundTrip(actor),
      right = await roundTrip(actor);
    expect(left.getSnapshot().context.model!.value.state).not.toBe(
      right.getSnapshot().context.model!.value.state,
    );
    select(left, "C04-S02-A");
    expect(
      projectC04CheckpointModelV1(
        right.getSnapshot().context.model!.value.state,
      ).selectedChildId,
    ).toBe("C04-S02-B");
    expect(projectC04CheckpointV1(right)).toEqual(
      projectC04CheckpointV1(actor),
    );
    for (const a of [actor, left, right]) a.stop();
  });
  it.each([
    "schema",
    "revision",
    "scenario",
    "activity",
    "complete",
    "quantity",
    "diagnostic",
    "checked",
    "extra",
    "staging",
    "engagement",
    "model",
  ])(
    "rejects %s corruption without actor or storage mutation",
    async (kind) => {
      const actor = active(
        kind === "staging"
          ? "C04-A04"
          : kind === "engagement" || kind === "model"
            ? "C04-A02"
            : "C04-A01",
      );
      submit(actor, false);
      actor.send({ type: "CHECK_RESPONSE" });
      const envelope = createRecoveryCheckpointV1(
        projectC04CheckpointV1(actor),
      );
      const bad = JSON.parse(serializeRecoveryCheckpointV1(envelope)) as {
        schemaVersion: number;
        studyDefinitionRevision: string;
        checkpoint: Record<string, unknown>;
      };
      const c = bad.checkpoint;
      if (kind === "schema") bad.schemaVersion = 2;
      if (kind === "revision") bad.studyDefinitionRevision = "obsolete";
      if (kind === "scenario") c.scenarioId = "C04-S04";
      if (kind === "activity") c.activityId = "C05-A01";
      if (kind === "complete") c.position = "COMPLETE";
      if (kind === "quantity")
        c.response = {
          kind: "COMPOSITE",
          parts: [
            {
              key: "difference",
              response: {
                kind: "EXACT_QUANTITY",
                value: {
                  magnitude: "01",
                  kind: "MONETARY_AMOUNT",
                  unit: "PHP",
                  basis: "per month",
                },
              },
            },
          ],
        };
      if (kind === "diagnostic")
        c.evaluation = { outcome: "CONFIRMED", diagnostic: "forged" };
      if (kind === "checked") c.checkedRevision = 999;
      if (kind === "extra") c.attempts = 0;
      if (kind === "staging") c.staging = { responseStage: "PRIMARY" };
      if (kind === "engagement")
        c.model = {
          evidence: {
            activityId: "C04-A02",
            scenarioId: "C04-S02",
            selectedChildId: "C04-S02-A",
          },
          revision: 0,
          engagement: {
            "EXP-02": { "C04-S02-A": true },
            "EXP-03": { "C04-S02-B": true },
          },
        };
      if (kind === "model")
        c.model = {
          evidence: {
            activityId: "C04-A02",
            scenarioId: "C04-S02",
            selectedChildId: "forged",
          },
          revision: 1,
          engagement: {
            "EXP-02": { "C04-S02-A": false },
            "EXP-03": { "C04-S02-B": false },
          },
        };
      expect(await load(JSON.stringify(bad))).toEqual({
        status: "UNUSABLE_CHECKPOINT",
      });
      expect(projectC04CheckpointV1(actor)).toEqual(envelope.checkpoint);
      actor.stop();
    },
  );
  it.each(["", "null", "{", "[]"])("rejects malformed raw %j", async (raw) => {
    expect(await load(raw)).toEqual({ status: "UNUSABLE_CHECKPOINT" });
  });
  it("rejects binding source spoofing, actor context forgery and model injection", () => {
    const actor = createC04ActivityActor("C04-A01");
    const context = actor.getSnapshot().context as C04Restoration["context"];
    expect(() =>
      createC04RestoredActivityActor({ scenarioId: "C04-S02", context }),
    ).toThrow();
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S01",
        context: { ...context, position: "COMPLETE" },
      }),
    ).toThrow();
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S01",
        context: Object.create(context) as typeof context,
      }),
    ).toThrow();
    actor.stop();
    const modelActor = createC04ActivityActor("C04-A02");
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S02",
        context: modelActor.getSnapshot()
          .context as unknown as C04Restoration["context"],
        modelEvidence: projectC04CheckpointModelV1(
          modelActor.getSnapshot().context.model!.value.state,
        ),
      }),
    ).toThrow();
    modelActor.stop();
  });
});
