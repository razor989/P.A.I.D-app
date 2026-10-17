import { describe, expect, it } from "vitest";
import {
  createRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
} from "../checkpoint/public";
import { createRecoveryCheckpointQueue } from "./public";
import type { RecoveryCheckpointStore } from "./public";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function checkpoint(position: "ENTRY" | "ACTIVE" | "OTHER" = "ENTRY") {
  return createRecoveryCheckpointV1({
    competencyId: "C04",
    activityId: position === "OTHER" ? "C04-A03" : "C04-A01",
    scenarioId: position === "OTHER" ? "C04-S03" : "C04-S01",
    position: position === "OTHER" ? "ENTRY" : position,
    response: null,
    responseRevision: 0,
    hasChecked: false,
    checkedResponse: null,
    checkedRevision: null,
    feedbackRevision: null,
    evaluation: null,
  });
}

/** No timers. Each backing operation begins immediately but remains gated until
 * the test explicitly acknowledges success/failure. Only the owned slot mutates. */
function controlledStore() {
  const calls: {
    operation: "replace" | "clear" | "load";
    value?: string;
    gate: ReturnType<typeof deferred<void>>;
  }[] = [];
  const trace: string[] = [];
  const storage = new Map<string, string>([["unrelated", "untouched"]]);
  let active = 0;
  let maxActive = 0;
  async function call(operation: "replace" | "clear" | "load", next?: string) {
    const gate = deferred<void>();
    calls.push({
      operation,
      ...(next === undefined ? {} : { value: next }),
      gate,
    });
    trace.push(`begin:${operation}`);
    active++;
    maxActive = Math.max(active, maxActive);
    try {
      await gate.promise;
      if (operation === "replace") storage.set("checkpoint", next!);
      if (operation === "clear") storage.delete("checkpoint");
      trace.push(`success:${operation}`);
      return storage.get("checkpoint") ?? null;
    } finally {
      active--;
      trace.push(`end:${operation}`);
    }
  }
  const store: RecoveryCheckpointStore = {
    load: () => call("load"),
    replace: async (next) => {
      await call("replace", next);
    },
    clear: async () => {
      await call("clear");
    },
  };
  return {
    store,
    calls,
    trace,
    get value() {
      return storage.get("checkpoint") ?? null;
    },
    get maxActive() {
      return maxActive;
    },
    get unrelated() {
      return storage.get("unrelated");
    },
  };
}

describe("T030 deterministic request settlement", () => {
  it("failure before a queued clear blocks it; recovery clear must be explicit", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const b = q.replace(checkpoint("ACTIVE"));
    const clear = q.clear();
    expect(await b).toMatchObject({ status: "superseded", supersededBy: 3 });
    disk.calls[0]!.gate.reject("write failure");
    expect(await a).toMatchObject({ status: "technical-failure" });
    expect(await clear).toMatchObject({
      status: "blocked",
      operation: "clear",
    });
    expect(disk.calls).toHaveLength(1);
    const recovery = q.recoveryClear();
    disk.calls[1]!.gate.resolve();
    expect(await recovery).toMatchObject({
      status: "durable",
      operation: "clear",
    });
    const fresh = q.replace(checkpoint("OTHER"));
    disk.calls[2]!.gate.resolve();
    expect(await fresh).toMatchObject({ status: "durable" });
    expect(disk.maxActive).toBe(1);
  });

  it("read rejection does not drop the already queued mutation", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const read = q.load();
    const write = q.replace(checkpoint());
    disk.calls[0]!.gate.reject("read failure");
    expect(await read).toMatchObject({
      status: "technical-failure",
      operation: "load",
    });
    disk.calls[1]!.gate.resolve();
    expect(await write).toMatchObject({ status: "durable" });
    const clear = q.clear();
    const after = q.load();
    disk.calls[2]!.gate.resolve();
    await clear;
    disk.calls[3]!.gate.resolve();
    expect(await after).toMatchObject({ status: "loaded", checkpoint: null });
  });

  it("A in flight; B pending; C supersedes B without aliasing C durability", async () => {
    const disk = controlledStore();
    const queue = createRecoveryCheckpointQueue(disk.store);
    const a = queue.replace(checkpoint());
    const b = queue.replace(checkpoint("ACTIVE"));
    const c = queue.replace(checkpoint("OTHER"));
    expect(await b).toEqual({
      requestId: 2,
      operation: "replace",
      status: "superseded",
      supersededBy: 3,
    });
    expect(disk.calls).toHaveLength(1);
    let cSettled = false;
    void c.then(() => {
      cSettled = true;
    });
    expect(cSettled).toBe(false);
    disk.calls[0]!.gate.resolve();
    expect(await a).toEqual({
      requestId: 1,
      operation: "replace",
      status: "durable",
    });
    expect(disk.calls).toHaveLength(2);
    expect(disk.value).toBe(serializeRecoveryCheckpointV1(checkpoint()));
    expect(cSettled).toBe(false);
    disk.calls[1]!.gate.resolve();
    expect(await c).toEqual({
      requestId: 3,
      operation: "replace",
      status: "durable",
    });
    expect(disk.value).toBe(serializeRecoveryCheckpointV1(checkpoint("OTHER")));
    expect(disk.maxActive).toBe(1);
    expect(disk.trace).toEqual([
      "begin:replace",
      "success:replace",
      "end:replace",
      "begin:replace",
      "success:replace",
      "end:replace",
    ]);
  });

  it("never coalesces barrier replacements or crosses their segments", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const b = q.replace(checkpoint("ACTIVE"));
    const d = q.replaceBarrier(checkpoint("OTHER"));
    const e = q.replace(checkpoint());
    const f = q.replace(checkpoint("ACTIVE"));
    expect(await e).toMatchObject({ status: "superseded", supersededBy: 5 });
    for (const [index, promise] of [a, b, d, f].entries()) {
      expect(disk.calls).toHaveLength(index + 1);
      disk.calls[index]!.gate.resolve();
      expect(await promise).toMatchObject({ status: "durable" });
    }
    expect(disk.calls.map((call) => call.value)).toEqual(
      [
        checkpoint(),
        checkpoint("ACTIVE"),
        checkpoint("OTHER"),
        checkpoint("ACTIVE"),
      ].map(serializeRecoveryCheckpointV1),
    );
    expect(disk.maxActive).toBe(1);
  });

  it("clear supersedes pending routines but waits for in-flight and earlier barriers", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const b = q.replace(checkpoint("ACTIVE"));
    const barrier = q.replaceBarrier(checkpoint("OTHER"));
    const c = q.replace(checkpoint());
    const clear = q.clear();
    expect(await b).toMatchObject({ status: "superseded", supersededBy: 5 });
    expect(await c).toMatchObject({ status: "superseded", supersededBy: 5 });
    expect(await q.replace(checkpoint())).toMatchObject({
      status: "blocked",
      reason: "clear-pending",
    });
    expect(await q.replaceBarrier(checkpoint())).toMatchObject({
      status: "blocked",
    });
    let cleared = false;
    void clear.then((result) => {
      cleared = result.status === "durable";
    });
    disk.calls[0]!.gate.resolve();
    await a;
    expect(cleared).toBe(false);
    expect(disk.calls[1]!.operation).toBe("replace");
    disk.calls[1]!.gate.resolve();
    await barrier;
    expect(disk.calls[2]!.operation).toBe("clear");
    expect(cleared).toBe(false);
    disk.calls[2]!.gate.resolve();
    expect(await clear).toMatchObject({
      requestId: 5,
      status: "durable",
      operation: "clear",
    });
    expect(disk.value).toBeNull();
    expect(disk.calls).toHaveLength(3);
    const fresh = q.replace(checkpoint("ACTIVE"));
    disk.calls[3]!.gate.resolve();
    expect(await fresh).toMatchObject({ status: "durable" });
    expect(disk.maxActive).toBe(1);
  });

  it("multiple clears each await their own idempotent owned-slot removal", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const first = q.clear();
    const second = q.clear();
    expect(disk.calls).toHaveLength(1);
    disk.calls[0]!.gate.resolve();
    expect(await first).toMatchObject({ requestId: 1, status: "durable" });
    expect(await q.replace(checkpoint())).toMatchObject({
      reason: "clear-pending",
    });
    disk.calls[1]!.gate.resolve();
    expect(await second).toMatchObject({ requestId: 2, status: "durable" });
    expect(disk.value).toBeNull();
    expect(disk.unrelated).toBe("untouched");
    expect(disk.calls.map((call) => call.operation)).toEqual([
      "clear",
      "clear",
    ]);
  });

  it("failed replace pauses, blocks every pending type, retries only the captured payload", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const seed = q.replace(checkpoint());
    disk.calls[0]!.gate.resolve();
    await seed;
    const live = structuredClone(checkpoint("ACTIVE"));
    const captured = serializeRecoveryCheckpointV1(live);
    const a = q.replace(live);
    live.checkpoint.position = "ENTRY";
    const b = q.replaceBarrier(checkpoint("OTHER"));
    const read = q.load();
    const clear = q.clear();
    const error = new Error("disk failure");
    disk.calls[1]!.gate.reject(error);
    expect(await a).toMatchObject({
      status: "technical-failure",
      operation: "replace",
      error,
    });
    expect(await b).toMatchObject({ status: "blocked", reason: "paused" });
    expect(await clear).toMatchObject({ status: "blocked" });
    expect(await read).toMatchObject({
      status: "technical-failure",
      operation: "load",
    });
    expect(disk.value).toBe(serializeRecoveryCheckpointV1(checkpoint()));
    expect(live.checkpoint.position).toBe("ENTRY");
    expect(await q.replace(checkpoint())).toMatchObject({ status: "blocked" });
    expect(await q.clear()).toMatchObject({ status: "blocked" });
    expect(await q.load()).toMatchObject({ status: "technical-failure" });
    expect(disk.calls).toHaveLength(2);
    const retry = q.retry();
    expect(disk.calls[2]!.value).toBe(captured);
    expect(await q.retry()).toMatchObject({ status: "blocked" });
    expect(await q.recoveryClear()).toMatchObject({ status: "blocked" });
    disk.calls[2]!.gate.resolve();
    expect(await retry).toMatchObject({
      status: "durable",
      operation: "replace",
    });
    expect(await a).toMatchObject({ status: "technical-failure" });
    expect(disk.value).toBe(captured);
    expect(disk.calls).toHaveLength(3);
    expect(disk.maxActive).toBe(1);
  });

  it("routine pending data is blocked on failure, never automatically replayed", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const b = q.replace(checkpoint("ACTIVE"));
    const c = q.replace(checkpoint("OTHER"));
    expect(await b).toMatchObject({ status: "superseded" });
    disk.calls[0]!.gate.reject("offline");
    expect(await a).toMatchObject({
      status: "technical-failure",
      error: "offline",
    });
    expect(await c).toMatchObject({ status: "blocked" });
    const retry = q.retry();
    disk.calls[1]!.gate.resolve();
    await retry;
    expect(disk.calls).toHaveLength(2);
    const fresh = q.replace(checkpoint("OTHER"));
    disk.calls[2]!.gate.resolve();
    expect(await fresh).toMatchObject({ status: "durable" });
  });

  it.each(["replace", "clear"] as const)(
    "repeated failed %s retries remain paused until success",
    async (operation) => {
      const disk = controlledStore();
      const q = createRecoveryCheckpointQueue(disk.store);
      const initial =
        operation === "clear" ? q.clear() : q.replaceBarrier(checkpoint());
      disk.calls[0]!.gate.reject("first");
      await initial;
      const retry = q.retry();
      disk.calls[1]!.gate.reject("again");
      expect(await retry).toMatchObject({
        status: "technical-failure",
        operation,
      });
      expect(await q.replace(checkpoint())).toMatchObject({
        status: "blocked",
      });
      const success = q.retry();
      expect(disk.calls[2]!.operation).toBe(operation);
      disk.calls[2]!.gate.resolve();
      expect(await success).toMatchObject({ status: "durable", operation });
      expect(await q.retry()).toMatchObject({
        status: "blocked",
        reason: "recovery-unavailable",
      });
    },
  );

  it("failed clear cannot be bypassed; its retry alone permits finalization", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const clear = q.clear();
    const other = q.clear();
    disk.calls[0]!.gate.reject("remove failed");
    expect(await clear).toMatchObject({
      status: "technical-failure",
      operation: "clear",
    });
    expect(await other).toMatchObject({ status: "blocked" });
    expect(await q.recoveryClear()).toMatchObject({ status: "blocked" });
    expect(await q.replaceBarrier(checkpoint())).toMatchObject({
      status: "blocked",
    });
    const retry = q.retry();
    let finalized = false;
    void retry.then((result) => {
      finalized = result.status === "durable";
    });
    expect(finalized).toBe(false);
    disk.calls[1]!.gate.resolve();
    expect(await retry).toMatchObject({
      status: "durable",
      operation: "clear",
    });
    expect(finalized).toBe(true);
    expect(disk.calls).toHaveLength(2);
  });

  it.each([false, true])(
    "explicit recovery clear revokes failed replacement, clear failure=%s",
    async (failClear) => {
      const disk = controlledStore();
      const q = createRecoveryCheckpointQueue(disk.store);
      const a = q.replace(checkpoint());
      disk.calls[0]!.gate.reject("write failed");
      await a;
      const clear = q.recoveryClear();
      expect(disk.calls[1]!.operation).toBe("clear");
      expect(await q.replace(checkpoint())).toMatchObject({
        status: "blocked",
      });
      if (failClear) {
        disk.calls[1]!.gate.reject("clear failed");
        expect(await clear).toMatchObject({
          status: "technical-failure",
          operation: "clear",
        });
        expect(await q.recoveryClear()).toMatchObject({ status: "blocked" });
        const retry = q.retry();
        expect(disk.calls[2]!.operation).toBe("clear");
        disk.calls[2]!.gate.resolve();
        await retry;
      } else {
        disk.calls[1]!.gate.resolve();
        expect(await clear).toMatchObject({
          status: "durable",
          operation: "clear",
        });
      }
      expect(disk.value).toBeNull();
      expect(
        disk.calls.slice(1).every((call) => call.operation === "clear"),
      ).toBe(true);
      expect(await q.retry()).toMatchObject({ status: "blocked" });
    },
  );

  it("reads are ordered after active writes and before later mutations", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const read = q.load();
    const c = q.replace(checkpoint("ACTIVE"));
    expect(disk.calls).toHaveLength(1);
    disk.calls[0]!.gate.resolve();
    await a;
    expect(disk.calls[1]!.operation).toBe("load");
    disk.calls[1]!.gate.resolve();
    expect(await read).toMatchObject({
      status: "loaded",
      checkpoint: serializeRecoveryCheckpointV1(checkpoint()),
    });
    disk.calls[2]!.gate.resolve();
    await c;
    expect(disk.maxActive).toBe(1);
  });

  it("reads distinguish successful absence, raw data and technical errors", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const empty = q.load();
    disk.calls[0]!.gate.resolve();
    expect(await empty).toMatchObject({ status: "loaded", checkpoint: null });
    const bad = q.load();
    const error = new Error("read failed");
    disk.calls[1]!.gate.reject(error);
    expect(await bad).toMatchObject({
      status: "technical-failure",
      operation: "load",
      error,
    });
    const retry = q.load();
    disk.calls[2]!.gate.resolve();
    expect(await retry).toMatchObject({ status: "loaded", checkpoint: null });
    const raw = createRecoveryCheckpointQueue({
      load: () => Promise.resolve("not validated here"),
      replace: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    });
    expect(await raw.load()).toMatchObject({
      status: "loaded",
      checkpoint: "not validated here",
    });
  });

  it("coalesces routine writes across reads but not across mutation barriers", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const a = q.replace(checkpoint());
    const b = q.replace(checkpoint("ACTIVE"));
    const read = q.load();
    const c = q.replace(checkpoint("OTHER"));
    expect(await b).toMatchObject({ status: "superseded" });
    disk.calls[0]!.gate.resolve();
    await a;
    disk.calls[1]!.gate.resolve();
    await read;
    disk.calls[2]!.gate.resolve();
    await c;
    expect(disk.calls.map((call) => call.operation)).toEqual([
      "replace",
      "load",
      "replace",
    ]);
  });

  it("same store object shares one queue and queue-local request sequence", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    expect(createRecoveryCheckpointQueue(disk.store)).toBe(q);
    const a = q.clear();
    const b = createRecoveryCheckpointQueue(disk.store).clear();
    disk.calls[0]!.gate.resolve();
    await a;
    disk.calls[1]!.gate.resolve();
    expect(await b).toMatchObject({ requestId: 2, status: "durable" });
    expect(disk.maxActive).toBe(1);
  });

  it("synchronous adapter throws are technical failures, not orphaned callers", async () => {
    const error = new Error("unavailable");
    const q = createRecoveryCheckpointQueue({
      load() {
        throw error;
      },
      replace() {
        throw error;
      },
      clear() {
        throw error;
      },
    });
    expect(await q.load()).toMatchObject({
      status: "technical-failure",
      error,
    });
    expect(await q.replace(checkpoint())).toMatchObject({
      status: "technical-failure",
      error,
    });
    expect(await q.retry()).toMatchObject({
      status: "technical-failure",
      error,
    });
    expect(await q.recoveryClear()).toMatchObject({
      status: "technical-failure",
      operation: "clear",
    });
  });

  it("ambiguous partial side effects never become false durability or cached read success", async () => {
    let physical: string | null = null;
    const q = createRecoveryCheckpointQueue({
      load: () => Promise.resolve(physical),
      replace: (value) => {
        physical = value;
        return Promise.reject(new Error("uncertain acknowledgment"));
      },
      clear: () => Promise.resolve(),
    });
    expect(await q.replace(checkpoint())).toMatchObject({
      status: "technical-failure",
    });
    expect(physical).not.toBeNull();
    expect(await q.load()).toMatchObject({ status: "technical-failure" });
  });

  it("invalid checkpoint fails before acceptance without changing T029 validation", async () => {
    const disk = controlledStore();
    const q = createRecoveryCheckpointQueue(disk.store);
    const invalid = { ...checkpoint(), schemaVersion: 2 as const };
    // Runtime invalid input probe, not a production boundary bypass.
    // @ts-expect-error Intentionally wrong schema discriminator.
    expect(() => q.replace(invalid)).toThrow();
    expect(disk.calls).toHaveLength(0);
    expect(await q.retry()).toMatchObject({ status: "blocked" });
    expect(await q.recoveryClear()).toMatchObject({ status: "blocked" });
  });
});
