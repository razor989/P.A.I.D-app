import { useEffect, useLayoutEffect, useRef } from "react";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import {
  FloatingLessonNav,
  LessonNavigationProvider,
  UnfinishedActivityDialog,
} from "@/presentation/navigation/public";
import type { ActivityName } from "@/presentation/navigation/public";
import { TransitionStage, worldOf } from "@/presentation/transitions/public";
import type { ActivityId } from "@/core/public";
import type { CompetencySummary, ShellProps } from "./public";
import { DestinationView } from "./DestinationView";
import { galleryCompetencies } from "./galleryCompetencies";
import styles from "./shell.module.css";

export function AppShell(props: ShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const wasCompletedReview = useRef(false);
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
  const referenceActivity =
    props.destination.kind === "activity" &&
    ((["C03-A01", "C03-A02", "C03-A03", "C03-A04"].includes(
      props.destination.activityId,
    ) &&
      props.c03Presentation?.projection.frame.activityId ===
        props.destination.activityId) ||
      (["C06-A01", "C06-A02", "C06-A03", "C06-A04"].includes(
        props.destination.activityId,
      ) &&
        props.c06Presentation?.projection.frame.activityId ===
          props.destination.activityId) ||
      props.destination.activityId === "C04-A02" ||
      (props.destination.activityId === "C04-A03" &&
        props.c04Presentation?.frame.activityId === "C04-A03") ||
      (props.destination.activityId === "C04-A04" &&
        props.c04Presentation?.frame.activityId === "C04-A04") ||
      (props.destination.activityId === "C04-A01" &&
        props.c04Presentation?.frame.activityId === "C04-A01" &&
        props.c04Presentation.prepareContractId ===
          "C04-A01-elicit-engage-v4"));
  useEffect(() => {
    if (wasCompletedReview.current && !props.completedReview) {
      if (
        !props.blocked &&
        props.destination.kind === "competency" &&
        (props.destination.competencyId === "C04" ||
          props.destination.competencyId === "C03") &&
        !document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        )
      ) {
        (
          document.querySelector<HTMLButtonElement>(
            "#review-completed-activity:not(:disabled)",
          ) ?? headingRef.current
        )?.focus();
      }
    }
    wasCompletedReview.current = props.completedReview === true;
  }, [
    props.completedReview,
    destinationIdentity,
    props.destination,
    props.blocked,
  ]);
  useEffect(() => {
    const previous = document.title;
    document.title = `P.A.I.D. — ${heading}`;
    return () => {
      document.title = previous;
    };
  }, [heading]);
  const layout =
    props.destination.kind === "library"
      ? "library"
      : props.destination.kind === "competency" &&
          galleryCompetencies.includes(props.destination.competencyId)
        ? "gallery"
        : undefined;
  // The Library and gallery are taller than one screen. Moving into or out of
  // them starts the next destination at the top instead of inheriting the
  // previous page's scroll offset. Runs before the coordinator moves focus.
  const previous = useRef({ identity: destinationIdentity, layout });
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { identity: destinationIdentity, layout };
    if (before.identity === destinationIdentity) return;
    if (before.layout === undefined && layout === undefined) return;
    const root = document.scrollingElement ?? document.documentElement;
    root.scrollTop = 0;
  }, [destinationIdentity, layout]);
  // The unfinished-activity decision is modal. When it closes without a
  // destination change (the pending switch was cancelled), focus returns to
  // whatever opened it; a destination change is handled by the coordinator.
  const choiceOpen = props.switchChoice !== null;
  const opener = useRef<{ element: Element | null; identity: string } | null>(
    null,
  );
  useLayoutEffect(() => {
    if (choiceOpen) {
      opener.current ??= {
        element: document.activeElement,
        identity: destinationIdentity,
      };
      return;
    }
    const before = opener.current;
    opener.current = null;
    if (!before || before.identity !== destinationIdentity) return;
    const target = before.element;
    (target instanceof HTMLElement &&
    target.isConnected &&
    !target.matches(":disabled")
      ? target
      : headingRef.current
    )?.focus();
  }, [choiceOpen, destinationIdentity]);
  const lesson = props.destination.kind === "activity";
  const position =
    competency && activity ? competency.activities.indexOf(activity) : -1;
  return (
    <TransitionStage
      destination={props.destination}
      competencies={props.competencies}
      shell={shellRef}
    >
      <div
        ref={shellRef}
        className={styles.shell}
        data-reference-activity={referenceActivity || undefined}
        data-destination={layout}
        data-lesson-nav={lesson || undefined}
      >
        <LessonNavigationProvider>
          <a
            inert={choiceOpen}
            className={styles.skip}
            href="#paid-main"
            onClick={() => document.getElementById("paid-main")?.focus()}
          >
            Skip to main content
          </a>
          {lesson ? (
            <FloatingLessonNav
              identity={destinationIdentity}
              place={{
                competency: competency?.label ?? null,
                activity: activity?.label ?? "Activity",
                number:
                  position >= 0 ? String(position + 1).padStart(2, "0") : null,
                world: worldOf(competency?.id ?? null),
              }}
              canBack={props.canBack}
              canReturn={props.canReturn}
              onBack={props.onBack}
              onReturn={props.onReturn}
              inert={choiceOpen}
            />
          ) : (
            <header className={styles.header} inert={choiceOpen}>
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
          )}
          <main
            id="paid-main"
            tabIndex={-1}
            className={styles.main}
            inert={choiceOpen}
          >
            <h1 ref={headingRef} tabIndex={-1}>
              {heading}
            </h1>
            {props.notice && !choiceOpen && <p role="status">{props.notice}</p>}
            <DestinationView {...props} />
          </main>
          {props.switchChoice && (
            <UnfinishedActivityDialog
              unfinished={nameOf(
                props.competencies,
                props.switchChoice.unfinishedActivityId,
              )}
              selected={nameOf(
                props.competencies,
                props.switchChoice.selectedActivityId,
              )}
              world={worldOf(
                competencyOf(
                  props.competencies,
                  props.switchChoice.unfinishedActivityId,
                ) ??
                  (props.destination.kind === "competency"
                    ? props.destination.competencyId
                    : null),
              )}
              canReturn={props.switchChoice.canReturn}
              canAbandon={props.switchChoice.canAbandon}
              canCancel={props.canBack}
              onReturn={props.switchChoice.onReturn}
              onAbandon={props.switchChoice.onAbandon}
              onCancel={props.onBack}
              notice={props.notice}
            />
          )}
          <AccessibilityCoordinator
            event={{
              kind: "destination",
              identity: destinationIdentity,
              target: headingRef,
            }}
            blocked={props.blocked}
          />
        </LessonNavigationProvider>
      </div>
    </TransitionStage>
  );
}

function competencyOf(
  competencies: readonly CompetencySummary[],
  id: ActivityId | null | undefined,
) {
  return id
    ? (competencies.find((c) => c.activities.some((a) => a.id === id))?.id ??
        null)
    : null;
}

function nameOf(
  competencies: readonly CompetencySummary[],
  id: ActivityId | null | undefined,
): ActivityName | null {
  if (!id) return null;
  for (const c of competencies) {
    const a = c.activities.find((item) => item.id === id);
    if (a) return { competency: c.label, activity: a.label };
  }
  return null;
}
