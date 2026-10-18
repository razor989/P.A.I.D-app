import type { RecoveryCheckpointStore } from "@/recovery/store/public";

/** One ephemeral web-test target; not device persistence or startup policy. */
export function createWebTestStore(): RecoveryCheckpointStore {
  let checkpoint: string | null = null;
  return Object.freeze({
    load: () => Promise.resolve(checkpoint),
    replace: (value: string) => {
      checkpoint = value;
      return Promise.resolve();
    },
    clear: () => {
      checkpoint = null;
      return Promise.resolve();
    },
  });
}
