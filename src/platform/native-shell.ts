/**
 * The Android shell around the unchanged web composition. Everything native
 * arrives through `NativeHost`, so this module stays testable without a
 * device and never decides navigation or Recovery policy itself.
 */

/** Structurally the Recovery checkpoint port: resolves on storage acknowledgment. */
export type CheckpointStorePort = Readonly<{
  load(): Promise<string | null>;
  replace(checkpoint: string): Promise<void>;
  clear(): Promise<void>;
}>;

export type NativeShell = Readonly<{
  /** Native key-value storage for the Recovery checkpoint. */
  checkpointStore: CheckpointStorePort;
  /** Takes over the hardware Back button; returns the release. */
  onHardwareBack(handler: () => void): () => void;
  /** Sends the app to the background, as Android does at an app's root. */
  minimize(): void;
}>;

type ListenerHandle = Readonly<{ remove(): Promise<void> }>;

export type NativeHost = Readonly<{
  preferences: Readonly<{
    get(options: { key: string }): Promise<{ value: string | null }>;
    set(options: { key: string; value: string }): Promise<void>;
    remove(options: { key: string }): Promise<void>;
  }>;
  addBackButtonListener(handler: () => void): Promise<ListenerHandle>;
  minimizeApp(): Promise<void>;
}>;

/** The same key the browser store uses; the Recovery envelope is unchanged. */
export const CHECKPOINT_KEY = "paid.recovery.checkpoint.v1";

const noop = () => undefined;

export function createNativeShell(host: NativeHost): NativeShell {
  const checkpointStore: CheckpointStorePort = Object.freeze({
    load() {
      return host.preferences
        .get({ key: CHECKPOINT_KEY })
        .then((result) => result.value);
    },
    replace(checkpoint: string) {
      return host.preferences.set({ key: CHECKPOINT_KEY, value: checkpoint });
    },
    clear() {
      return host.preferences.remove({ key: CHECKPOINT_KEY });
    },
  });
  return Object.freeze({
    checkpointStore,
    onHardwareBack(handler: () => void) {
      let released = false;
      let handle: ListenerHandle | null = null;
      host
        .addBackButtonListener(() => {
          if (!released) handler();
        })
        .then((registered) => {
          // A release that raced registration still removes the listener.
          if (released) registered.remove().catch(noop);
          else handle = registered;
        }, noop);
      return () => {
        if (released) return;
        released = true;
        handle?.remove().catch(noop);
        handle = null;
      };
    },
    minimize() {
      host.minimizeApp().catch(noop);
    },
  });
}
