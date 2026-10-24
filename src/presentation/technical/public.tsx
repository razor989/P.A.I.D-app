export { LoadingPresentation } from "./LoadingPresentation";
export { useDelayedLoading } from "./useDelayedLoading";

/** Caller supplies authorized technical meaning, never private result payloads. */
export type LoadingPresentationProps = Readonly<{
  pending: boolean;
  message: string;
  operationKey?: unknown;
}>;
