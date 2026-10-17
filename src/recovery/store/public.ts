import { serializeRecoveryCheckpointV1 } from "../checkpoint/public";
import type { RecoveryCheckpointEnvelopeV1 } from "../checkpoint/public";

/** One owned checkpoint target, not a general key/value store. An adapter must
 * resolve mutations only on storage acknowledgment and reject unavailable or
 * uncertain operations. load returns raw serialized data; classification is T031.
 */
export interface RecoveryCheckpointStore {
  load(): Promise<string | null>;
  replace(checkpoint: string): Promise<void>;
  clear(): Promise<void>;
}

type Mutation =
  | Readonly<{ operation: "replace"; checkpoint: string; barrier: boolean }>
  | Readonly<{ operation: "clear" }>;
type Identity = Readonly<{ requestId: number; operation: "replace" | "clear" }>;
export type RecoveryMutationResult = Identity &
  (
    | Readonly<{ status: "durable" }>
    | Readonly<{ status: "superseded"; supersededBy: number }>
    | Readonly<{ status: "technical-failure"; error: unknown }>
    | Readonly<{
        status: "blocked";
        reason: "paused" | "clear-pending" | "recovery-unavailable";
      }>
  );
export type RecoveryReadResult = Readonly<{
  requestId: number;
  operation: "load";
}> &
  (
    | Readonly<{ status: "loaded"; checkpoint: string | null }>
    | Readonly<{ status: "technical-failure"; error: unknown }>
  );

export interface RecoveryCheckpointQueue {
  /** Ordered raw read, never a startup classification or durability barrier. */
  load(): Promise<RecoveryReadResult>;
  /** Validation errors throw before acceptance. Accepted data is captured as
   * immutable canonical T029 JSON, including for later same-payload retry. */
  replace(
    checkpoint: RecoveryCheckpointEnvelopeV1,
  ): Promise<RecoveryMutationResult>;
  replaceBarrier(
    checkpoint: RecoveryCheckpointEnvelopeV1,
  ): Promise<RecoveryMutationResult>;
  clear(): Promise<RecoveryMutationResult>;
  retry(): Promise<RecoveryMutationResult>;
  /** Explicit downstream authorization is the caller's responsibility. This
   * route is available only after a failed replace, never after a failed clear. */
  recoveryClear(): Promise<RecoveryMutationResult>;
}

type WriteEntry = {
  kind: "mutation";
  requestId: number;
  mutation: Mutation;
  recovery: boolean;
  settle: (result: RecoveryMutationResult) => void;
};
type ReadEntry = {
  kind: "read";
  requestId: number;
  settle: (result: RecoveryReadResult) => void;
};
type Entry = WriteEntry | ReadEntry;

const queues = new WeakMap<RecoveryCheckpointStore, RecoveryCheckpointQueue>();

/** Reuses the execution lane for the same injected store object. Composition
 * must supply one port object per physical target; separate adapters to the same
 * key cannot be detected here. There is no cross-target ordering guarantee. */
export function createRecoveryCheckpointQueue(
  store: RecoveryCheckpointStore,
): RecoveryCheckpointQueue {
  const existing = queues.get(store);
  if (existing) return existing;
  let sequence = 0;
  let busy = false;
  let paused = false;
  let failed: Mutation | undefined;
  let clearFences = 0;
  const pending: Entry[] = [];

  function block(entry: Entry): void {
    if (entry.kind === "read") {
      entry.settle({
        requestId: entry.requestId,
        operation: "load",
        status: "technical-failure",
        error: new Error("Checkpoint read unavailable during failure pause"),
      });
    } else {
      entry.settle({
        requestId: entry.requestId,
        operation: entry.mutation.operation,
        status: "blocked",
        reason: "paused",
      });
    }
  }

  function supersede(entry: WriteEntry, supersededBy: number): void {
    entry.settle({
      requestId: entry.requestId,
      operation: entry.mutation.operation,
      status: "superseded",
      supersededBy,
    });
  }

  async function execute(entry: Entry): Promise<void> {
    if (entry.kind === "read") {
      try {
        const checkpoint = await store.load();
        entry.settle({
          requestId: entry.requestId,
          operation: "load",
          status: "loaded",
          checkpoint,
        });
      } catch (error) {
        entry.settle({
          requestId: entry.requestId,
          operation: "load",
          status: "technical-failure",
          error,
        });
      }
    } else {
      const identity = {
        requestId: entry.requestId,
        operation: entry.mutation.operation,
      };
      try {
        if (entry.mutation.operation === "replace") {
          await store.replace(entry.mutation.checkpoint);
        } else {
          await store.clear();
          clearFences--;
        }
        if (entry.recovery) {
          paused = false;
          failed = undefined;
        }
        entry.settle({ ...identity, status: "durable" });
      } catch (error) {
        failed = entry.mutation;
        paused = true;
        clearFences = 0;
        entry.settle({ ...identity, status: "technical-failure", error });
        for (const waiting of pending.splice(0)) block(waiting);
      }
    }
    busy = false;
    start();
  }

  function start(): void {
    if (busy || paused) return;
    const entry = pending.shift();
    if (!entry) return;
    busy = true;
    void execute(entry);
  }

  function submit(
    mutation: Mutation,
    recovery = false,
  ): Promise<RecoveryMutationResult> {
    const requestId = ++sequence;
    return new Promise((settle) => {
      const identity = { requestId, operation: mutation.operation };
      if (
        !recovery &&
        (paused || (mutation.operation === "replace" && clearFences > 0))
      ) {
        settle({
          ...identity,
          status: "blocked",
          reason: paused ? "paused" : "clear-pending",
        });
        return;
      }
      const entry: WriteEntry = {
        kind: "mutation",
        requestId,
        mutation,
        recovery,
        settle,
      };
      if (mutation.operation === "clear") {
        clearFences++;
        for (let index = pending.length - 1; index >= 0; index--) {
          const waiting = pending[index]!;
          if (
            waiting.kind === "mutation" &&
            waiting.mutation.operation === "replace" &&
            !waiting.mutation.barrier
          ) {
            pending.splice(index, 1);
            supersede(waiting, requestId);
          }
        }
      } else if (!mutation.barrier) {
        for (let index = pending.length - 1; index >= 0; index--) {
          const waiting = pending[index]!;
          if (waiting.kind === "read") continue;
          if (
            waiting.mutation.operation === "replace" &&
            !waiting.mutation.barrier
          ) {
            pending.splice(index, 1);
            supersede(waiting, requestId);
          }
          break;
        }
      }
      if (recovery) {
        // Only explicit recovery may run while paused. Reentrant requests stay
        // blocked until its awaited storage outcome has been processed.
        busy = true;
        void execute(entry);
      } else {
        pending.push(entry);
        start();
      }
    });
  }

  function recover(clear: boolean): Promise<RecoveryMutationResult> {
    if (
      !paused ||
      busy ||
      !failed ||
      (clear && failed.operation !== "replace")
    ) {
      return Promise.resolve({
        requestId: ++sequence,
        operation: clear ? "clear" : (failed?.operation ?? "replace"),
        status: "blocked",
        reason: "recovery-unavailable",
      });
    }
    const mutation: Mutation = clear ? { operation: "clear" } : failed;
    if (clear) failed = mutation; // Revoke the abandoned replacement before I/O.
    return submit(mutation, true);
  }

  const queue: RecoveryCheckpointQueue = Object.freeze({
    load(): Promise<RecoveryReadResult> {
      const requestId = ++sequence;
      return new Promise((settle) => {
        const entry: ReadEntry = { kind: "read", requestId, settle };
        if (paused) block(entry);
        else {
          pending.push(entry);
          start();
        }
      });
    },
    replace: (checkpoint: RecoveryCheckpointEnvelopeV1) =>
      submit({
        operation: "replace",
        checkpoint: serializeRecoveryCheckpointV1(checkpoint),
        barrier: false,
      }),
    replaceBarrier: (checkpoint: RecoveryCheckpointEnvelopeV1) =>
      submit({
        operation: "replace",
        checkpoint: serializeRecoveryCheckpointV1(checkpoint),
        barrier: true,
      }),
    clear: () => submit({ operation: "clear" }),
    retry: () => recover(false),
    recoveryClear: () => recover(true),
  });
  queues.set(store, queue);
  return queue;
}
