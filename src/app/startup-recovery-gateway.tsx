import { useEffect, useRef } from "react";

export type StartupRecoveryGatewayProps = Readonly<{
  state:
    | "pending"
    | "library-ready"
    | "recovery-choice"
    | "recovery-failure"
    | "read-failure"
    | "clear-pending"
    | "clear-failed"
    | "resumed";
  active: boolean;
  canRetryClear: boolean;
  canConfirmClear: boolean;
  onContinue: () => void;
  onAbandon: () => void;
  onDiscard: () => void;
  onRetryRead: () => void;
  onRetryClear: () => void;
  onConfirmClear: () => void;
}>;

/** Display only: Session supplies every semantic state and permitted action. */
export function StartupRecoveryGateway(props: StartupRecoveryGatewayProps) {
  const status = useRef<HTMLParagraphElement>(null);
  const previous = useRef(props.state);
  useEffect(() => {
    if (previous.current !== props.state) status.current?.focus();
    previous.current = props.state;
  }, [props.state]);
  const messages = {
    pending: "Startup is unresolved. Checking saved work availability.",
    "library-ready": "Library is ready.",
    "recovery-choice":
      "An unfinished activity is available. Choose whether to continue or abandon it.",
    "recovery-failure":
      "Saved work could not be restored. You may explicitly discard the unusable saved work.",
    "read-failure":
      "Saved work could not be checked because storage is unavailable. You may retry the storage read.",
    "clear-pending":
      "Clearing saved work. Please wait for storage confirmation.",
    "clear-failed":
      "Saved work could not yet be cleared. Library is not available.",
    resumed:
      "The activity session is ready. Instructional presentation is not part of this startup gateway.",
  };
  const button = (label: string, action: () => void) => (
    <button
      type="button"
      disabled={!props.active}
      onClick={() => {
        if (props.active) action();
      }}
    >
      {label}
    </button>
  );
  return (
    <section aria-label="Startup and saved work">
      <p role="status" tabIndex={-1} ref={status}>
        {messages[props.state]}
      </p>
      {props.state === "recovery-choice" && (
        <>
          {button("Continue unfinished activity", props.onContinue)}
          {button("Abandon unfinished activity", props.onAbandon)}
        </>
      )}
      {props.state === "recovery-failure" &&
        button("Discard unusable saved work", props.onDiscard)}
      {props.state === "read-failure" &&
        button("Retry storage read", props.onRetryRead)}
      {props.state === "clear-failed" && (
        <>
          {props.canRetryClear && button("Retry clearing", props.onRetryClear)}
          {props.canConfirmClear &&
            button("Confirm clearing saved work", props.onConfirmClear)}
        </>
      )}
    </section>
  );
}
