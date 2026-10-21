import { isProviderRecordId } from "@/core/public";
import { useEffect, useState } from "react";
import { actualContentBank, validateContent } from "@/study/validation/public";
import { composeStudyCatalog } from "@/study/catalog/public";
import { createCanonicalC04Runtime } from "@/engine/c04-activity-binding/public";
import { createRecoveryCheckpointQueue } from "@/recovery/store/public";
import type { RecoveryCheckpointStore } from "@/recovery/store/public";
import { recoverCheckpoint } from "@/recovery/rehydration/public";
import {
  applySessionStartupClassification,
  beginSessionStartupReadRetry,
  createAppSessionActor,
  selectSession,
} from "@/session/app-machine/public";
import { createWebTestStore } from "./web-test-store";
import { SessionProvider, useSessionSnapshot } from "./session-provider";
import { StartupRecoveryGateway } from "./startup-recovery-gateway";
import { AppShell } from "@/presentation/shell/public";
import { navigate } from "@/session/navigation/public";

/** Source bank metadata is not executable availability. */
export function createApplicationCatalog() {
  validateContent(actualContentBank);
  const parts = actualContentBank.parts;
  const activities = parts.flatMap((part) => part.activities);
  return composeStudyCatalog({
    complete: true,
    competencies: parts.map((part) => part.competency),
    activities,
    scenarios: parts.flatMap((part) => part.scenarios),
    contentIds: [...new Set(parts.flatMap((part) => Object.keys(part.copy)))],
    responseContractIds: [
      ...new Set(activities.map((a) => a.responseContract.contractId)),
    ],
    modelProfileIds: [
      ...new Set(
        activities.flatMap((a) =>
          a.modelBinding ? [a.modelBinding.profileId] : [],
        ),
      ),
    ],
    interactionProfileIds: [
      ...new Set(
        activities.flatMap((a) =>
          a.modelBinding?.interactionProfileId
            ? [a.modelBinding.interactionProfileId]
            : [],
        ),
      ),
    ],
    oracleIds: [
      ...new Set(
        activities.flatMap((a) => (a.oracle ? [a.oracle.oracleId] : [])),
      ),
    ],
    providerRecordIds: [
      ...new Set(
        actualContentBank.providerDefinitions
          .map((definition) => definition.sourceRecordId)
          .filter(isProviderRecordId),
      ),
    ],
  });
}

export function createApplicationRoot(injectedStore?: RecoveryCheckpointStore) {
  const catalog = createApplicationCatalog();
  const c04Runtime = createCanonicalC04Runtime();
  const store = injectedStore ?? createWebTestStore();
  const queue = createRecoveryCheckpointQueue(store);
  const session = createAppSessionActor({ catalog, c04Runtime, queue });
  let phase: "created" | "started" | "stopped" = "created";
  let attempt = 0;
  let pending = false;
  function classify() {
    if (pending || phase !== "started") return;
    pending = true;
    const token = ++attempt;
    void recoverCheckpoint(queue).then((result) => {
      if (token !== attempt || phase !== "started") {
        if (result.status === "VALID_CHECKPOINT") result.actor.stop();
        return;
      }
      pending = false;
      if (
        applySessionStartupClassification(session, result) !== "accepted" &&
        result.status === "VALID_CHECKPOINT"
      )
        result.actor.stop();
    });
  }
  return Object.freeze({
    catalog,
    c04Runtime,
    store,
    queue,
    session,
    start() {
      if (phase === "stopped") throw new Error("Application root is disposed");
      if (phase === "started") return;
      try {
        session.start();
        phase = "started";
        classify();
      } catch (error) {
        phase = "stopped";
        session.stop();
        throw error;
      }
    },
    stop() {
      if (phase === "stopped") return;
      phase = "stopped";
      attempt++;
      session.stop();
    },
    retryStartupRead() {
      if (
        phase !== "started" ||
        pending ||
        !beginSessionStartupReadRetry(session)
      )
        return false;
      classify();
      return true;
    },
  });
}
export type ApplicationRoot = ReturnType<typeof createApplicationRoot>;

export function StartupShell({ root }: { root: ApplicationRoot }) {
  useSessionSnapshot();
  const view = selectSession(root.session);
  const snapshot = root.session.getSnapshot();
  // Pass 9 §2 canonical learner-facing labels; catalog remains ID authority.
  const labels = {
    C01: "Gross Income",
    C02: "Net Pay and Statutory Deductions",
    C03: "Overtime Pay",
    C04: "Percentage Change",
    C05: "Wage and Salary Representation and Conversion",
    C06: "Commission",
  };
  const settled =
    snapshot.status === "active" &&
    snapshot.matches("session") &&
    view.destination !== null;
  const blocked =
    view.technical !== "idle" ||
    view.lifecyclePhase === "failed" ||
    view.lifecyclePhase === "finish-clear-in-flight" ||
    view.lifecyclePhase === "abandon-clear-in-flight" ||
    view.decision !== "none";
  if (settled && view.destination)
    return (
      <AppShell
        destination={view.destination}
        competencies={Object.freeze(
          [...root.catalog.competencies.values()].map((c) =>
            Object.freeze({
              id: c.id,
              label: labels[c.id],
              available:
                !blocked &&
                snapshot.can({ type: "SELECT_COMPETENCY", competencyId: c.id }),
              activities: Object.freeze(
                c.activityIds.map((id) =>
                  Object.freeze({
                    id,
                    label: root.catalog.activities.get(id)!.instructionalFamily,
                    available:
                      !blocked &&
                      snapshot.can({ type: "SELECT_ACTIVITY", activityId: id }),
                  }),
                ),
              ),
            }),
          ),
        )}
        blocked={blocked}
        notice={
          view.lifecyclePhase === "failed"
            ? "Saved work could not be cleared. Navigation remains unavailable."
            : view.technical === "loading" ||
                view.lifecyclePhase.endsWith("in-flight")
              ? "Please wait while the current operation finishes."
              : view.technical !== "idle"
                ? "A technical problem prevents navigation. Your current destination is preserved."
                : null
        }
        canBack={
          view.decision === "activitySwitchChoice"
            ? snapshot.can({ type: "CANCEL_PENDING_ACTIVITY_SWITCH" })
            : !blocked
        }
        canReturn={!blocked && snapshot.can({ type: "RETURN_TO_LIBRARY" })}
        onBack={() => {
          navigate(root.session, { type: "SYSTEM_BACK" });
        }}
        onReturn={() => {
          navigate(root.session, { type: "RETURN_TO_LIBRARY" });
        }}
        onCompetency={(competencyId) => {
          navigate(root.session, { type: "SELECT_COMPETENCY", competencyId });
        }}
        onActivity={(activityId) => {
          navigate(root.session, { type: "SELECT_ACTIVITY", activityId });
        }}
        switchChoice={
          view.decision === "activitySwitchChoice"
            ? {
                canReturn: snapshot.can({
                  type: "RETURN_TO_UNFINISHED_ACTIVITY",
                }),
                canAbandon: snapshot.can({
                  type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY",
                }),
                onReturn: () =>
                  root.session.send({ type: "RETURN_TO_UNFINISHED_ACTIVITY" }),
                onAbandon: () =>
                  root.session.send({
                    type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY",
                  }),
              }
            : null
        }
      />
    );
  return (
    <main>
      <h1>P.A.I.D.</h1>
      <StartupRecoveryGateway
        state={view.startup}
        active={root.session.getSnapshot().status === "active"}
        canRetryClear={view.canRetryRecoveryClear}
        canConfirmClear={view.canConfirmRecoveryClear}
        onContinue={() =>
          root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" })
        }
        onAbandon={() =>
          root.session.send({ type: "ABANDON_RECOVERED_ACTIVITY" })
        }
        onDiscard={() =>
          root.session.send({ type: "DISCARD_UNUSABLE_CHECKPOINT" })
        }
        onRetryRead={() => {
          root.retryStartupRead();
        }}
        onRetryClear={() => root.session.send({ type: "RETRY_RECOVERY_CLEAR" })}
        onConfirmClear={() =>
          root.session.send({ type: "CONFIRM_RECOVERY_CLEAR" })
        }
      />
    </main>
  );
}

export function CompositionRoot() {
  const [root, setRoot] = useState<ApplicationRoot | null>(null);
  useEffect(() => {
    // A new effect setup owns fresh resources, never a restarted stopped actor.
    const current = createApplicationRoot();
    try {
      current.start();
      setRoot(current);
    } catch (error) {
      current.stop();
      throw error;
    }
    return () => current.stop();
  }, []);
  return root ? (
    <SessionProvider session={root.session}>
      <StartupShell root={root} />
    </SessionProvider>
  ) : (
    <main>
      <h1>P.A.I.D.</h1>
      <p role="status">Starting application.</p>
    </main>
  );
}
