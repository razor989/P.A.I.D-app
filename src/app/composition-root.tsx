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
