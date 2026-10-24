import type { LoadingPresentationProps } from "./public";
import { useDelayedLoading } from "./useDelayedLoading";

export function LoadingPresentation({
  pending,
  message,
  operationKey,
}: LoadingPresentationProps) {
  const visible = useDelayedLoading(pending, operationKey);
  return visible ? (
    <p
      className="paid-loading paid-workspace"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </p>
  ) : null;
}
