import { describe, expect, it } from "vitest";
import { createC06ActivityActor } from "@/engine/c06-activity-binding/public";
import { projectC06CheckpointV4 } from "../projection/public";
import {
  createRecoveryCheckpointV4,
  serializeRecoveryCheckpointV4,
  createRecoveryCheckpointV1,
} from "../checkpoint/public";
import { createRecoveryCheckpointQueue } from "./public";

function checkpoint() {
  const a = createC06ActivityActor("C06-A03");
  try {
    return createRecoveryCheckpointV4(projectC06CheckpointV4(a));
  } finally {
    a.stop();
  }
}
function old() {
  return createRecoveryCheckpointV1({
    competencyId: "C04",
    activityId: "C04-A03",
    scenarioId: "C04-S03",
    position: "ENTRY",
    response: null,
    responseRevision: 0,
    hasChecked: false,
    checkedResponse: null,
    checkedRevision: null,
    feedbackRevision: null,
    evaluation: null,
  });
}
function disk() {
  const calls: {
    operation: string;
    text?: string;
    resolve: () => void;
    reject: (e: unknown) => void;
  }[] = [];
  let saved: string | null = null;
  const mutation = (operation: string, text?: string) =>
    new Promise<void>((resolve, reject) =>
      calls.push({
        operation,
        ...(text === undefined ? {} : { text }),
        resolve: () => {
          saved = text ?? null;
          resolve();
        },
        reject,
      }),
    );
  const store = {
    load: () => Promise.resolve(saved),
    replace: (text: string) => mutation("replace", text),
    clear: () => mutation("clear"),
  };
  return { calls, store };
}
describe("C06 V4 existing queue/slot", () => {
  it("shares V1 lane, preserves V4 barrier and fences writes during clear", async () => {
    const d = disk();
    const q = createRecoveryCheckpointQueue(d.store);
    expect(createRecoveryCheckpointQueue(d.store)).toBe(q);
    const first = q.replace(old());
    const barrier = q.replaceBarrierV4(checkpoint());
    const pending = q.replaceV4(checkpoint());
    const clear = q.clear();
    expect(await pending).toMatchObject({ status: "superseded" });
    expect(await q.replaceV4(checkpoint())).toMatchObject({
      status: "blocked",
      reason: "clear-pending",
    });
    d.calls[0]!.resolve();
    expect(await first).toMatchObject({ status: "durable" });
    expect(d.calls[1]!.text).toBe(serializeRecoveryCheckpointV4(checkpoint()));
    d.calls[1]!.resolve();
    expect(await barrier).toMatchObject({ status: "durable" });
    expect(d.calls[2]!.operation).toBe("clear");
    d.calls[2]!.resolve();
    expect(await clear).toMatchObject({ status: "durable" });
    expect(await q.load()).toMatchObject({
      status: "loaded",
      checkpoint: null,
    });
  });
  it("retries exact V4 payload after uncertain write without changing failure behavior", async () => {
    const d = disk();
    const q = createRecoveryCheckpointQueue(d.store);
    const p = checkpoint();
    const first = q.replaceV4(p);
    const text = d.calls[0]!.text;
    d.calls[0]!.reject(new Error("unknown acknowledgment"));
    expect(await first).toMatchObject({ status: "technical-failure" });
    expect(await q.replaceBarrierV4(p)).toMatchObject({
      status: "blocked",
      reason: "paused",
    });
    const retry = q.retry();
    expect(d.calls[1]!.text).toBe(text);
    d.calls[1]!.resolve();
    expect(await retry).toMatchObject({ status: "durable" });
    expect(await q.load()).toMatchObject({ checkpoint: text });
  });
  it("rejects invalid V4 before accepting a mutation", () => {
    const d = disk();
    const q = createRecoveryCheckpointQueue(d.store);
    expect(() =>
      q.replaceV4({
        ...checkpoint(),
        schemaVersion: 3,
      } as unknown as ReturnType<typeof checkpoint>),
    ).toThrow();
    expect(d.calls).toHaveLength(0);
  });
});
