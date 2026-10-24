import { useEffect, useState } from "react";

/** Presentation only: never starts, settles, or retries the caller's operation. */
export function useDelayedLoading(
  pending: boolean,
  operationKey: unknown = null,
) {
  const [gate, setGate] = useState({ pending, operationKey, visible: false });
  const current =
    gate.pending === pending && gate.operationKey === operationKey;
  // Reset during render so a completed/replaced operation cannot expose stale status.
  if (!current) setGate({ pending, operationKey, visible: false });
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setGate((previous) =>
        previous.pending && previous.operationKey === operationKey
          ? { ...previous, visible: true }
          : previous,
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [pending, operationKey]);
  return pending && current && gate.visible;
}
