import { useEffect, useRef } from "react";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import type { ShellProps } from "./public";
import { DestinationView } from "./DestinationView";
import styles from "./shell.module.css";

export function AppShell(props: ShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const destinationIdentity = JSON.stringify([
    props.destination.kind,
    props.destination.kind === "competency"
      ? props.destination.competencyId
      : props.destination.kind === "activity"
        ? props.destination.activityId
        : null,
  ]);
  const competency = props.competencies.find((c) =>
    props.destination.kind === "competency"
      ? c.id === props.destination.competencyId
      : c.activities.some(
          (a) =>
            props.destination.kind === "activity" &&
            a.id === props.destination.activityId,
        ),
  );
  const activity = competency?.activities.find(
    (a) =>
      props.destination.kind === "activity" &&
      a.id === props.destination.activityId,
  );
  const heading =
    props.destination.kind === "library"
      ? "Learning Library"
      : props.destination.kind === "competency"
        ? (competency?.label ?? "Competency Overview")
        : `${competency?.label ?? "Activity"} — ${activity?.label ?? "Activity"}`;
  useEffect(() => {
    const previous = document.title;
    document.title = `P.A.I.D. — ${heading}`;
    return () => {
      document.title = previous;
    };
  }, [heading]);
  return (
    <div className={styles.shell}>
      <a
        className={styles.skip}
        href="#paid-main"
        onClick={() => document.getElementById("paid-main")?.focus()}
      >
        Skip to main content
      </a>
      <header className={styles.header}>
        <p className={styles.brand}>P.A.I.D.</p>
        <nav aria-label="Application navigation">
          {props.destination.kind !== "library" && (
            <>
              <button
                type="button"
                disabled={!props.canBack}
                onClick={props.onBack}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!props.canReturn}
                onClick={props.onReturn}
              >
                Learning Library
              </button>
            </>
          )}
        </nav>
      </header>
      <main id="paid-main" tabIndex={-1} className={styles.main}>
        <h1 ref={headingRef} tabIndex={-1}>
          {heading}
        </h1>
        {props.notice && <p role="status">{props.notice}</p>}
        {props.switchChoice && (
          <section aria-labelledby="switch-heading">
            <h2 id="switch-heading">Unfinished activity</h2>
            <p>
              Choose whether to return to your unfinished activity or abandon it
              before opening the selected activity.
            </p>
            <button
              type="button"
              disabled={!props.switchChoice.canReturn}
              onClick={props.switchChoice.onReturn}
            >
              Return to unfinished activity
            </button>
            <button
              type="button"
              disabled={!props.switchChoice.canAbandon}
              onClick={props.switchChoice.onAbandon}
            >
              Abandon and open selected activity
            </button>
          </section>
        )}
        <DestinationView {...props} />
      </main>
      <AccessibilityCoordinator
        event={{
          kind: "destination",
          identity: destinationIdentity,
          target: headingRef,
        }}
        blocked={props.blocked}
      />
    </div>
  );
}
