import type { RecoveryCheckpointStore } from "@/recovery/store/public";

/** The established Recovery queue owns serialization, ordering and failure policy. */
export function createBrowserCheckpointStore(): RecoveryCheckpointStore {
  const key = "paid.recovery.checkpoint.v1";
  return Object.freeze({
    load() {
      return Promise.resolve().then(() => window.localStorage.getItem(key));
    },
    replace(checkpoint: string) {
      return Promise.resolve().then(() => {
        window.localStorage.setItem(key, checkpoint);
      });
    },
    clear() {
      return Promise.resolve().then(() => {
        window.localStorage.removeItem(key);
      });
    },
  });
}
