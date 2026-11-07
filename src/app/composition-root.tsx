import { isProviderRecordId } from "@/core/public";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { actualContentBank, validateContent } from "@/study/validation/public";
import { composeStudyCatalog } from "@/study/catalog/public";
import {
  createCanonicalC04Runtime,
  composeC04ActivityFrame,
  projectC04PrepareValues,
} from "@/engine/c04-activity-binding/public";
import { createRecoveryCheckpointQueue } from "@/recovery/store/public";
import type { RecoveryCheckpointStore } from "@/recovery/store/public";
import { recoverApplicationCheckpoint } from "@/recovery/rehydration/public";
import {
  projectC03ActivityFrame,
  checkC03ComparisonPart,
} from "@/engine/c03-activity-binding/public";
import {
  applySessionStartupClassification,
  beginSessionStartupReadRetry,
  createAppSessionActor,
  isExecutableActivity,
  selectSession,
  acquireSessionCheckpointProducer,
} from "@/session/app-machine/public";
import type { AppSessionActor } from "@/session/app-machine/public";
import { selectLearnerContinuation } from "@/session/completion/public";
import { detectNativeShell } from "@/platform/public";
import { createBrowserCheckpointStore } from "./browser-checkpoint-store";
import { projectC06ActivityFrame } from "@/engine/c06-activity-binding/public";
import { projectC04Reference } from "./c04-reference-projection";
import { projectC04Apply } from "./c04-apply-projection";
import { projectC04Transfer } from "./c04-transfer-projection";
import {
  projectC04CheckpointV1,
  projectC03CheckpointV3,
  projectC06CheckpointV4,
} from "@/recovery/projection/public";
import {
  createRecoveryCheckpointV1,
  createRecoveryCheckpointV3,
  createRecoveryCheckpointV4,
} from "@/recovery/checkpoint/public";
import { SessionProvider, useSessionSnapshot } from "./session-provider";
import { StartupRecoveryGateway } from "./startup-recovery-gateway";
import {
  AppShell,
  createSoundEngine,
  SoundProvider,
  StartupIdent,
  signalStartupSurface,
  useSound,
} from "@/presentation/shell/public";
import type {
  C04Presentation,
  C03PreparePresentation,
  C06PreparePresentation,
} from "@/presentation/shell/public";
import {
  LoadingPresentation,
  useDelayedLoading,
} from "@/presentation/technical/public";
import { navigate } from "@/session/navigation/public";
import {
  c04ResponseContracts,
  c04A01LegacyContract,
  c04A01V3Contract,
} from "@/study/competencies/c04/public";
import { constructC04Response } from "./c04-response-adapter";
import { createBrowserSoundPreferenceStore } from "./browser-sound-preference-store";
import {
  createCheckObserver,
  createCompletionObserver,
} from "./sound-observer";

const actorIdentities = new WeakMap<object, number>();
let nextActorIdentity = 0;
function actorIdentity(actor: object) {
  if (!actorIdentities.has(actor))
    actorIdentities.set(actor, ++nextActorIdentity);
  return actorIdentities.get(actor)!;
}

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
  const store = injectedStore ?? createBrowserCheckpointStore();
  const queue = createRecoveryCheckpointQueue(store);
  const session = createAppSessionActor({ catalog, c04Runtime, queue });
  let phase: "created" | "started" | "stopped" = "created";
  let attempt = 0;
  let pending = false;
  function classify() {
    if (pending || phase !== "started") return;
    pending = true;
    const token = ++attempt;
    void recoverApplicationCheckpoint(queue).then((result) => {
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

/** The lesson Back's availability; Android hardware Back obeys the same gate. */
function canSystemBack(session: AppSessionActor): boolean {
  const view = selectSession(session);
  if (view.decision === "activitySwitchChoice")
    return session
      .getSnapshot()
      .can({ type: "CANCEL_PENDING_ACTIVITY_SWITCH" });
  return !(
    view.technical !== "idle" ||
    view.lifecyclePhase === "failed" ||
    view.lifecyclePhase === "finish-clear-in-flight" ||
    view.lifecyclePhase === "abandon-clear-in-flight" ||
    view.decision !== "none"
  );
}

/** Android hardware Back is the lesson's own Back; at the Library root the
 * app goes to the background instead of closing, as Android does. */
export function handleHardwareBack(
  session: AppSessionActor,
  minimize: () => void,
) {
  if (!canSystemBack(session)) return "rejected" as const;
  const outcome = navigate(session, { type: "SYSTEM_BACK" });
  if (outcome === "platform-root") minimize();
  return outcome;
}

export function StartupShell({ root }: { root: ApplicationRoot }) {
  const [lifecycle] = useState(() => ({ mounted: false }));
  useLayoutEffect(() => {
    lifecycle.mounted = true;
    return () => {
      lifecycle.mounted = false;
    };
  }, [lifecycle]);
  useSessionSnapshot();
  const view = selectSession(root.session);
  // A reload with saved work lands in the Learning Library, which already
  // offers Resume (and the switch dialog to abandon): continue the recovered
  // activity, then leave it by the lesson's own path, before anything paints.
  const recoveryChoice = view.startup === "recovery-choice";
  useLayoutEffect(() => {
    if (!recoveryChoice || root.session.getSnapshot().status !== "active")
      return;
    root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
    const destination = selectSession(root.session).destination;
    if (destination?.kind !== "activity") return;
    const competencyId = root.catalog.activities.get(
      destination.activityId,
    )?.competencyId;
    if (
      competencyId &&
      navigate(root.session, { type: "SELECT_COMPETENCY", competencyId }) ===
        "destination-changed"
    )
      navigate(root.session, { type: "RETURN_TO_LIBRARY" });
  }, [recoveryChoice, root]);
  const retainedActivity = view.currentActivity;
  const actor =
    view.destination?.kind === "activity" &&
    (view.destination.activityId.startsWith("C04-") ||
      ["C06-A01", "C06-A02", "C06-A03", "C06-A04"].includes(
        view.destination.activityId,
      ) ||
      ["C03-A01", "C03-A02", "C03-A03", "C03-A04"].includes(
        view.destination.activityId,
      ))
      ? view.currentActivity
      : null;
  const subscribeActivity = useCallback(
    (notify: () => void) => {
      const subscription = actor?.subscribe(notify);
      return () => subscription?.unsubscribe();
    },
    [actor],
  );
  const getActivitySnapshot = useCallback(
    () => actor?.getSnapshot() ?? null,
    [actor],
  );
  useSyncExternalStore(
    subscribeActivity,
    getActivitySnapshot,
    getActivitySnapshot,
  );
  const activitySnapshot = getActivitySnapshot();
  // Sound only follows authoritative results: the actor's own check and the
  // Session's finalized completion. Presentation never decides either.
  const sound = useSound();
  const [observeCheck] = useState(createCheckObserver);
  const [observeCompletion] = useState(createCompletionObserver);
  useEffect(() => {
    if (!actor || !activitySnapshot || activitySnapshot.status !== "active")
      return;
    const context = activitySnapshot.context;
    const outcome = observeCheck({
      actor: actorIdentity(actor),
      responseRevision: context.responseRevision,
      checkedRevision: context.checkedRevision,
      responseStage: context.responseStage ?? null,
      outcome: context.evaluation?.outcome ?? null,
    });
    if (!outcome) return;
    // Prepare records participation; it never scores, so it never sounds
    // like a judgement either way.
    const prepare =
      root.catalog.activities.get(context.activityId)?.instructionalFamily ===
      "Prepare";
    sound.play(
      prepare
        ? "response.recorded"
        : outcome === "CONFIRMED"
          ? "feedback.affirm"
          : "feedback.reconsider",
    );
  }, [root, actor, activitySnapshot, observeCheck, sound]);
  useEffect(() => {
    if (
      !actor ||
      !activitySnapshot ||
      activitySnapshot.status !== "active" ||
      activitySnapshot.context.position === "COMPLETE"
    )
      return;
    const producer = acquireSessionCheckpointProducer(root.session);
    const checkpoint = ["C03-A01", "C03-A02", "C03-A03", "C03-A04"].includes(
      activitySnapshot.context.activityId,
    )
      ? createRecoveryCheckpointV3(projectC03CheckpointV3(actor))
      : ["C06-A01", "C06-A02", "C06-A03", "C06-A04"].includes(
            activitySnapshot.context.activityId,
          )
        ? createRecoveryCheckpointV4(projectC06CheckpointV4(actor))
        : createRecoveryCheckpointV1(projectC04CheckpointV1(actor));
    void producer.replace(checkpoint);
  }, [root, actor, activitySnapshot]);
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
  const clearingVisible = useDelayedLoading(
    snapshot.status === "active" && view.startup === "clear-pending",
    snapshot.context.startupTransaction,
  );
  useEffect(() => {
    if (
      observeCompletion({
        lifecyclePhase: view.lifecyclePhase,
        completion: view.completion,
      })
    )
      sound.play("activity.complete");
  }, [view.lifecyclePhase, view.completion, observeCompletion, sound]);
  // Display signal only: the startup ident may reveal once the authorised
  // startup surface (destination or recovery choice) is on screen.
  const startupSurface = settled || view.startup !== "pending";
  useEffect(() => {
    if (startupSurface) signalStartupSurface();
  }, [startupSurface]);
  const technicalPending =
    view.lifecyclePhase !== "failed" &&
    (view.technical === "idle" || view.technical === "loading") &&
    (view.technical === "loading" || view.lifecyclePhase.endsWith("in-flight"));
  const frame =
    actor &&
    actor.getSnapshot().status === "active" &&
    view.destination?.kind === "activity" &&
    view.destination.activityId.startsWith("C04-") &&
    actor.getSnapshot().context.activityId === view.destination.activityId
      ? composeC04ActivityFrame(actor)
      : null;
  const c03Projection =
    actor &&
    activitySnapshot &&
    ["C03-A01", "C03-A02", "C03-A03", "C03-A04"].includes(
      activitySnapshot.context.activityId,
    )
      ? projectC03ActivityFrame(actor)
      : null;
  function currentC03() {
    const live = selectSession(root.session);
    if (
      !actor ||
      !c03Projection ||
      !lifecycle.mounted ||
      blocked ||
      root.session.getSnapshot().status !== "active" ||
      live.currentActivity !== actor ||
      live.destination?.kind !== "activity" ||
      live.destination.activityId !== c03Projection.frame.activityId ||
      live.technical !== "idle" ||
      (live.lifecyclePhase !== "idle" && live.lifecyclePhase !== "finalized") ||
      live.decision !== "none" ||
      actor.getSnapshot() !== activitySnapshot
    )
      return null;
    return projectC03ActivityFrame(actor).frame;
  }
  const c03Presentation: C03PreparePresentation | undefined =
    c03Projection && actor
      ? {
          projection: c03Projection,
          blocked,
          onSelectCondition: (selectionId) => {
            const control = currentC03()?.modelSelectionControl;
            if (control?.options.some((option) => option.id === selectionId))
              actor.send({
                type: "SELECT_MODEL_CHILD",
                modelId: control.modelId,
                selectionId,
                revision: control.revision,
                position: control.position,
              });
          },
          onAction: (type) => {
            if (currentC03()?.allowedLearnerIntents.includes(type))
              actor.send({ type });
          },
          onResponse: (response) => {
            if (
              currentC03()?.allowedLearnerIntents.includes("RESPONSE_CHANGED")
            )
              actor.send({ type: "RESPONSE_CHANGED", response });
          },
          onCheckPart: (field) =>
            currentC03()?.allowedLearnerIntents.includes("RESPONSE_CHANGED")
              ? checkC03ComparisonPart(actor, field)
              : null,
          onHelp: () => {
            if (currentC03()?.allowedLearnerIntents.includes("OPEN_SUPPORT"))
              actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
          },
          onCloseHelp: () => {
            if (currentC03()?.allowedLearnerIntents.includes("CLOSE_SUPPORT"))
              actor.send({ type: "CLOSE_SUPPORT" });
          },
          onFeedbackPresented: (element) => {
            const latest = currentC03();
            const context = actor.getSnapshot().context;
            if (
              latest?.feedbackState &&
              element.isConnected &&
              !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
              getComputedStyle(element).display !== "none" &&
              getComputedStyle(element).visibility !== "hidden" &&
              context.origin === null &&
              context.feedbackRevision === null &&
              context.checkedRevision === context.responseRevision &&
              element.textContent?.includes(latest.feedbackState.content.text)
            )
              actor.send({
                type: "FEEDBACK_DELIVERED",
                revision: context.responseRevision,
              });
          },
          sessionContinuation: {
            available:
              !blocked &&
              c03Projection.frame.stateId === "COMPLETE" &&
              view.lifecyclePhase === "finalized" &&
              snapshot.can({ type: "SELECT_COMPETENCY", competencyId: "C03" }),
            onContinue: () => {
              if (
                currentC03()?.stateId === "COMPLETE" &&
                selectSession(root.session).lifecyclePhase === "finalized" &&
                root.session
                  .getSnapshot()
                  .can({ type: "SELECT_COMPETENCY", competencyId: "C03" })
              )
                navigate(root.session, {
                  type: "SELECT_COMPETENCY",
                  competencyId: "C03",
                });
            },
          },
        }
      : undefined;
  const c06Projection =
    actor &&
    ["C06-A01", "C06-A02", "C06-A03", "C06-A04"].includes(
      activitySnapshot?.context.activityId ?? "",
    )
      ? projectC06ActivityFrame(actor)
      : null;
  function currentC06() {
    const live = selectSession(root.session);
    if (
      !actor ||
      !c06Projection ||
      !lifecycle.mounted ||
      blocked ||
      root.session.getSnapshot().status !== "active" ||
      live.currentActivity !== actor ||
      live.destination?.kind !== "activity" ||
      live.destination.activityId !== c06Projection.frame.activityId ||
      live.technical !== "idle" ||
      live.decision !== "none" ||
      (live.lifecyclePhase !== "idle" && live.lifecyclePhase !== "finalized") ||
      actor.getSnapshot() !== activitySnapshot
    )
      return null;
    return projectC06ActivityFrame(actor).frame;
  }
  const c06Presentation: C06PreparePresentation | undefined =
    c06Projection && actor
      ? {
          projection: c06Projection,
          blocked,
          onResponse: (response) => {
            if (
              currentC06()?.allowedLearnerIntents.includes("RESPONSE_CHANGED")
            )
              actor.send({ type: "RESPONSE_CHANGED", response });
          },
          onAction: (type) => {
            if (currentC06()?.allowedLearnerIntents.includes(type))
              actor.send({ type });
          },
          onSelectWorker: (selectionId) => {
            const control = currentC06()?.modelSelectionControl;
            if (control?.options.some((option) => option.id === selectionId))
              actor.send({
                type: "SELECT_MODEL_CHILD",
                modelId: control.modelId,
                revision: control.revision,
                position: control.position,
                selectionId,
              });
          },
          onHelp: () => {
            if (currentC06()?.allowedLearnerIntents.includes("OPEN_SUPPORT"))
              actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
          },
          onCloseHelp: () => {
            if (currentC06()?.allowedLearnerIntents.includes("CLOSE_SUPPORT"))
              actor.send({ type: "CLOSE_SUPPORT" });
          },
          onPresented: (kind, element) => {
            const latest = currentC06();
            const context = actor.getSnapshot().context;
            if (
              !latest ||
              context.origin !== null ||
              !element.isConnected ||
              element.closest('[hidden], [inert], [aria-hidden="true"]') ||
              getComputedStyle(element).display === "none" ||
              getComputedStyle(element).visibility === "hidden" ||
              context.checkedRevision !== context.responseRevision
            )
              return;
            if (
              kind === "feedback" &&
              latest.feedbackState &&
              context.feedbackRevision === null &&
              element.textContent?.includes(latest.feedbackState.content.text)
            )
              actor.send({
                type: "FEEDBACK_DELIVERED",
                revision: context.responseRevision,
              });
            const contentId =
              latest.activityId === "C06-A04"
                ? "c06/S04/accessibility-summary"
                : "c06/S01/accessibility-summary";
            const teaching = latest.contentReferences.find(
              (item) => item.id === contentId,
            );
            if (
              kind === "teaching" &&
              latest.stateId === "POST_CONFIRMATION_EXPLANATION" &&
              teaching &&
              context.terminalTeachingRevision !== context.responseRevision &&
              element.textContent?.includes(teaching.text)
            )
              actor.send({
                type: "TERMINAL_TEACHING_DELIVERED",
                revision: context.responseRevision,
                contentId,
              });
          },
          sessionContinuation: {
            available:
              !blocked &&
              c06Projection.frame.stateId === "COMPLETE" &&
              view.lifecyclePhase === "finalized" &&
              snapshot.can({ type: "SELECT_COMPETENCY", competencyId: "C06" }),
            onContinue: () => {
              if (
                currentC06()?.stateId === "COMPLETE" &&
                selectSession(root.session).lifecyclePhase === "finalized" &&
                root.session
                  .getSnapshot()
                  .can({ type: "SELECT_COMPETENCY", competencyId: "C06" })
              )
                navigate(root.session, {
                  type: "SELECT_COMPETENCY",
                  competencyId: "C06",
                });
            },
          },
        }
      : undefined;
  const renderedContext = actor?.getSnapshot().context;
  const contract =
    frame?.activityId === "C04-A01" &&
    frame.responseContract.id === c04A01LegacyContract.contractId
      ? c04A01LegacyContract
      : frame?.activityId === "C04-A01" &&
          frame.responseContract.id === c04A01V3Contract.contractId
        ? c04A01V3Contract
        : c04ResponseContracts.find(
            (item) => item.activityId === frame?.activityId,
          );
  const fields = (frame?.responseControls ?? []).map((control) => ({
    ...contract!.fields.find((field) => field.role === control.role)!,
    ...control,
  }));
  function currentFrame() {
    const live = selectSession(root.session);
    const liveSnapshot = root.session.getSnapshot();
    if (
      !actor ||
      !lifecycle.mounted ||
      !frame ||
      root.session.getSnapshot().status !== "active" ||
      live.currentActivity !== actor ||
      actor.getSnapshot().status !== "active" ||
      live.destination?.kind !== "activity" ||
      live.destination.activityId !== frame.activityId ||
      live.technical !== "idle" ||
      live.lifecyclePhase !== "idle" ||
      live.decision !== "none" ||
      !liveSnapshot.matches("session")
    )
      return null;
    const latest = composeC04ActivityFrame(actor);
    if (
      latest.stateId !== frame.stateId ||
      actor.getSnapshot().context.responseRevision !==
        renderedContext?.responseRevision ||
      latest.responseStage !== frame.responseStage ||
      latest.modelSelectionControl?.revision !==
        frame.modelSelectionControl?.revision
    )
      return null;
    return latest;
  }
  const c04Presentation: C04Presentation | undefined = frame
    ? {
        frame,
        reference: projectC04Reference(frame),
        ...(frame.activityId === "C04-A01" && actor
          ? {
              prepare: projectC04PrepareValues(actor),
              prepareContractId: frame.responseContract.id,
              prepareStageIndex: contract!.stages.findIndex(
                (stage) => stage.id === frame.responseStage,
              ),
              prepareRecordedLabels: [
                ...(renderedContext?.guidedRecords ?? []).map(
                  (record) => record.response,
                ),
                ...(renderedContext?.feedbackRevision ===
                  renderedContext?.responseRevision &&
                renderedContext?.checkedResponse
                  ? [renderedContext.checkedResponse]
                  : []),
              ].flatMap((response) =>
                response.kind === "COMPOSITE"
                  ? response.parts.flatMap((part) => {
                      if (part.response.kind !== "SINGLE_SELECTION") return [];
                      const id = part.response.selectionId;
                      const text = contract!.choices
                        .find((choice) => choice.role === part.key)
                        ?.options.find((option) => option.id === id)?.text;
                      return text ? [{ role: part.key, text }] : [];
                    })
                  : [],
              ),
              prepareRecorded: [
                ...(renderedContext?.guidedRecords ?? []).map(
                  (record) => record.response,
                ),
                ...(renderedContext?.feedbackRevision ===
                  renderedContext?.responseRevision &&
                renderedContext?.checkedResponse
                  ? [renderedContext.checkedResponse]
                  : []),
              ].flatMap((response) =>
                response.kind === "COMPOSITE"
                  ? response.parts.flatMap((part) =>
                      part.response.kind === "SINGLE_SELECTION"
                        ? [
                            {
                              role: part.key,
                              selectionId: part.response.selectionId,
                            },
                          ]
                        : [],
                    )
                  : [],
              ),
              ...(frame.responseContract.id === c04A01LegacyContract.contractId
                ? {
                    prepareLegacyDraft:
                      renderedContext?.response?.kind === "COMPOSITE"
                        ? Object.fromEntries(
                            renderedContext.response.parts.flatMap((part) =>
                              part.response.kind === "SINGLE_SELECTION"
                                ? [[part.key, part.response.selectionId]]
                                : part.response.kind === "EXACT_QUANTITY"
                                  ? [
                                      [
                                        part.key,
                                        part.response.value.magnitude.toString(),
                                      ],
                                    ]
                                  : [],
                            ),
                          )
                        : {},
                  }
                : {}),
              prepareSelections:
                renderedContext?.response?.kind === "COMPOSITE"
                  ? Object.fromEntries(
                      renderedContext.response.parts.flatMap((part) =>
                        part.response.kind === "SINGLE_SELECTION"
                          ? [[part.key, part.response.selectionId]]
                          : [],
                      ),
                    )
                  : {},
            }
          : {}),
        blocked,
        onReturnToLibrary: () => {
          // Session authorizes Library from the competency intermediary, not
          // directly from an activity. Use its real navigation path and guards.
          if (
            navigate(root.session, {
              type: "SELECT_COMPETENCY",
              competencyId: "C04",
            }) === "destination-changed"
          ) {
            navigate(root.session, { type: "RETURN_TO_LIBRARY" });
          }
        },
        apply: projectC04Apply(frame),
        transfer: projectC04Transfer(frame),
        transferRecord:
          frame.activityId === "C04-A04" &&
          frame.stateId === "COMPLETE" &&
          frame.feedbackState &&
          renderedContext?.checkedRevision ===
            renderedContext?.responseRevision &&
          renderedContext?.feedbackRevision ===
            renderedContext?.responseRevision &&
          renderedContext?.terminalTeachingRevision ===
            renderedContext?.responseRevision &&
          renderedContext?.checkedResponse?.kind === "COMPOSITE"
            ? {
                primary: Object.fromEntries(
                  renderedContext.checkedResponse.parts.flatMap((part) =>
                    part.response.kind === "EXACT_QUANTITY"
                      ? [[part.key, part.response.value.magnitude.toString()]]
                      : part.response.kind === "SEMANTIC_BOUNDARY"
                        ? [[part.key, "UNDEFINED"]]
                        : [],
                  ),
                ),
                reasoning:
                  contract?.choices
                    .find((choice) => choice.role === "explanation")
                    ?.options.find(
                      (option) =>
                        renderedContext.checkedResponse?.kind === "COMPOSITE" &&
                        renderedContext.checkedResponse.parts.some(
                          (part) =>
                            part.key === "explanation" &&
                            part.response.kind === "SINGLE_SELECTION" &&
                            part.response.selectionId === option.id,
                        ),
                    )?.text ?? "Recorded reasoning is unavailable.",
                feedback: frame.feedbackState.content,
                outcome: frame.feedbackState.outcome,
              }
            : undefined,
        ...(frame.activityId === "C04-A03" || frame.activityId === "C04-A04"
          ? {
              responseConclusion:
                renderedContext?.response?.kind === "COMPOSITE"
                  ? (contract?.choices
                      .find((choice) => choice.role === "interpretation")
                      ?.options.find(
                        (option) =>
                          renderedContext.response?.kind === "COMPOSITE" &&
                          renderedContext.response.parts.some(
                            (part) =>
                              part.key === "interpretation" &&
                              part.response.kind === "SINGLE_SELECTION" &&
                              part.response.selectionId === option.id,
                          ),
                      )?.text ?? "")
                  : "",
              responseDraft:
                renderedContext?.response?.kind === "COMPOSITE"
                  ? Object.fromEntries(
                      renderedContext.response.parts.flatMap((part) =>
                        part.response.kind === "EXACT_QUANTITY"
                          ? [
                              [
                                part.key,
                                part.response.value.magnitude.toString(),
                              ],
                            ]
                          : part.response.kind === "SINGLE_SELECTION"
                            ? [[part.key, part.response.selectionId]]
                            : part.response.kind === "SEMANTIC_BOUNDARY"
                              ? [[part.key, "UNDEFINED"]]
                              : [],
                      ),
                    )
                  : {},
            }
          : {}),
        fields,
        ...(frame.activityId === "C04-A02" &&
        renderedContext?.response?.kind === "COMPOSITE" &&
        renderedContext.response.parts[0]?.response.kind === "SINGLE_SELECTION"
          ? {
              selectedGuidedOption:
                renderedContext.response.parts[0].response.selectionId,
            }
          : {}),
        draftIdentity: `${actorIdentity(actor!)}/${frame.stateId}/${frame.responseStage ?? "RESPONSE"}`,
        presentationIdentity: `${actorIdentity(actor!)}/${frame.stateId}/${renderedContext!.responseRevision}`,
        onDraft: (draft) => {
          const latest = currentFrame();
          if (
            !latest?.allowedLearnerIntents.includes("RESPONSE_CHANGED") ||
            !actor
          )
            return;
          const retained =
            latest.responseStage === "REASONING"
              ? actor.getSnapshot().context.response
              : null;
          const response = constructC04Response(
            latest.activityId === "C04-A01" &&
              latest.responseContract.id === "C04-A01-guided-prepare-v3"
              ? fields.map((field) => ({ ...field, required: false }))
              : fields,
            draft,
            retained,
          );
          if (response) actor.send({ type: "RESPONSE_CHANGED", response });
        },
        onCheckDraft: (draft) => {
          const latest = currentFrame();
          if (
            !actor ||
            latest?.activityId !== "C04-A03" ||
            !latest.allowedLearnerIntents.includes("RESPONSE_CHANGED")
          )
            return;
          const response = constructC04Response(fields, draft);
          if (!response) return;
          // Commit this exact visible draft, then ask the canonical actor to check it.
          // Do not depend on a prior React render's readiness projection.
          actor.send({ type: "RESPONSE_CHANGED", response });
          const event = {
            type: actor.getSnapshot().context.hasChecked
              ? "CHECK_AGAIN"
              : "CHECK_RESPONSE",
          } as const;
          if (actor.getSnapshot().can(event)) actor.send(event);
        },
        onPresented: (kind, element) => {
          const latest = currentFrame();
          if (
            !latest ||
            !actor ||
            latest.allowedLearnerIntents.includes("CLOSE_SUPPORT") ||
            !element.isConnected ||
            element
              .closest("[data-c04-track]")
              ?.getAttribute("data-c04-track") !== latest.activityId ||
            element.getAttribute("data-presentation-identity") !==
              `${actorIdentity(actor)}/${latest.stateId}/${actor.getSnapshot().context.responseRevision}` ||
            element.ownerDocument !== document ||
            element.closest('[inert], [hidden], [aria-hidden="true"]') ||
            document.querySelector("dialog[open]")
          )
            return;
          const context = actor.getSnapshot().context;
          if (
            context.checkedRevision !== context.responseRevision ||
            !context.evaluation
          )
            return;
          if (kind === "feedback") {
            const feedback = latest.feedbackState;
            if (
              (latest.stateId !== "CONFIRMATION" &&
                latest.stateId !== "RECONSIDERATION") ||
              context.feedbackRevision !== null ||
              !feedback ||
              feedback.outcome !== context.evaluation.outcome ||
              element.dataset.contentId !== feedback.content.id ||
              !element.textContent?.includes(feedback.content.text)
            )
              return;
            actor.send({
              type: "FEEDBACK_DELIVERED",
              revision: context.responseRevision,
              ...(latest.activityId === "C04-A02" ||
              latest.responseContract.id === "C04-A01-elicit-engage-v4"
                ? {
                    stage: context.responseStage as
                      | "PESO_COMPARISON"
                      | "REFERENCE_PAIR"
                      | "ORIGINAL"
                      | "NEW"
                      | "DIFFERENCE"
                      | "INTERPRETATION"
                      | "PERCENTAGE_COMPARISON",
                  }
                : {}),
            });
          } else {
            const passage = latest.contentReferences.find(
              (item) => item.id === "c04/S04/undefined-result",
            );
            if (
              latest.stateId !== "POST_CONFIRMATION_EXPLANATION" ||
              context.feedbackRevision !== context.responseRevision ||
              context.terminalTeachingRevision !== null ||
              !passage ||
              !element.textContent?.includes(passage.text)
            )
              return;
            actor.send({
              type: "TERMINAL_TEACHING_DELIVERED",
              revision: context.responseRevision,
              contentId: passage.id,
            });
          }
        },
        onSupport: (mode) => {
          const latest = currentFrame();
          if (!latest || !actor) return;
          if (
            mode === "CLOSE" &&
            latest.allowedLearnerIntents.includes("CLOSE_SUPPORT")
          )
            actor.send({ type: "CLOSE_SUPPORT" });
          if (
            mode !== "CLOSE" &&
            latest.allowedLearnerIntents.includes("OPEN_SUPPORT") &&
            (mode === "REVIEW"
              ? latest.reviewAvailability
              : latest.sourceReviewAvailability)
          )
            actor.send({ type: "OPEN_SUPPORT", mode });
        },
        canContinueSession:
          !blocked && snapshot.can({ type: "CONTINUE_COMPLETED_ACTIVITY" }),
        onContinueSession: () => {
          const live = selectSession(root.session);
          if (
            live.currentActivity === actor &&
            live.destination?.kind === "activity" &&
            live.destination.activityId === frame.activityId &&
            live.technical === "idle" &&
            live.decision === "none" &&
            root.session.getSnapshot().status === "active" &&
            root.session
              .getSnapshot()
              .can({ type: "CONTINUE_COMPLETED_ACTIVITY" })
          )
            root.session.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
        },
        onIntent: (intent) => {
          const latest = currentFrame();
          if (latest?.allowedLearnerIntents.includes(intent))
            actor?.send({ type: intent });
        },
        onSelect: (selectionId) => {
          const latest = currentFrame();
          const control = latest?.modelSelectionControl;
          if (
            !latest?.allowedLearnerIntents.includes("SELECT_MODEL_CHILD") ||
            !control?.options.some((option) => option.id === selectionId)
          )
            return;
          actor?.send({
            type: "SELECT_MODEL_CHILD",
            modelId: control.modelId,
            revision: control.revision,
            position: control.position,
            selectionId,
          });
        },
      }
    : undefined;
  if (settled && view.destination)
    return (
      <>
        <AppShell
          completedReview={view.completedReview}
          onReviewCompleted={
            snapshot.can({ type: "REVIEW_COMPLETED_ACTIVITY" }) && !blocked
              ? () => {
                  const live = selectSession(root.session);
                  if (
                    lifecycle.mounted &&
                    live.currentActivity === retainedActivity &&
                    root.session.getSnapshot().status === "active" &&
                    root.session
                      .getSnapshot()
                      .can({ type: "REVIEW_COMPLETED_ACTIVITY" })
                  ) {
                    navigate(root.session, {
                      type: "REVIEW_COMPLETED_ACTIVITY",
                    });
                  }
                }
              : undefined
          }
          c04Presentation={c04Presentation}
          c03Presentation={c03Presentation}
          c06Presentation={c06Presentation}
          destination={view.destination}
          competencies={Object.freeze(
            [...root.catalog.competencies.values()].map((c) =>
              Object.freeze({
                id: c.id,
                label: labels[c.id],
                available:
                  !blocked &&
                  snapshot.can({
                    type: "SELECT_COMPETENCY",
                    competencyId: c.id,
                  }),
                offered: c.activityIds.some((id) =>
                  isExecutableActivity(root.catalog, id),
                ),
                activities: Object.freeze(
                  c.activityIds.map((id) =>
                    Object.freeze({
                      id,
                      label:
                        root.catalog.activities.get(id)!.instructionalFamily,
                      available:
                        !blocked &&
                        snapshot.can({
                          type: "SELECT_ACTIVITY",
                          activityId: id,
                        }),
                    }),
                  ),
                ),
              }),
            ),
          )}
          continuation={selectLearnerContinuation(root.session)}
          blocked={blocked}
          notice={
            view.lifecyclePhase === "failed"
              ? "Saved work could not be cleared. Navigation remains unavailable."
              : view.technical !== "idle" && view.technical !== "loading"
                ? "A technical problem prevents navigation. Your current destination is preserved."
                : null
          }
          canBack={canSystemBack(root.session)}
          canReturn={!blocked && snapshot.can({ type: "RETURN_TO_LIBRARY" })}
          onBack={() => {
            navigate(root.session, { type: "SYSTEM_BACK" });
          }}
          onReturn={() => {
            navigate(root.session, { type: "RETURN_TO_LIBRARY" });
          }}
          canLeaveLesson={
            !blocked &&
            view.destination.kind === "activity" &&
            snapshot.can({
              type: "SELECT_COMPETENCY",
              competencyId: root.catalog.activities.get(
                view.destination.activityId,
              )!.competencyId,
            })
          }
          onLeaveLesson={() => {
            // Session authorizes the Library from the competency intermediary,
            // never directly from an activity: use its real path and guards.
            const destination = selectSession(root.session).destination;
            if (destination?.kind !== "activity") return;
            if (
              navigate(root.session, {
                type: "SELECT_COMPETENCY",
                competencyId: root.catalog.activities.get(
                  destination.activityId,
                )!.competencyId,
              }) === "destination-changed"
            )
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
                    root.session.send({
                      type: "RETURN_TO_UNFINISHED_ACTIVITY",
                    }),
                  onAbandon: () =>
                    root.session.send({
                      type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY",
                    }),
                  unfinishedActivityId:
                    view.currentActivity?.getSnapshot().context.activityId ??
                    null,
                  selectedActivityId: view.pendingTargetActivityId,
                }
              : null
          }
        />
        <LoadingPresentation
          pending={technicalPending}
          operationKey={view.lifecyclePhase}
          message="Please wait while the current operation finishes."
        />
      </>
    );
  return (
    <main>
      <h1>P.A.I.D.</h1>
      <StartupRecoveryGateway
        state={view.startup}
        clearingVisible={clearingVisible}
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
  // Decorative sound effects live for the page; their preference persists.
  const [sound] = useState(() =>
    createSoundEngine(createBrowserSoundPreferenceStore()),
  );
  // Android only: native checkpoint storage and hardware Back. Null in a browser.
  const [native] = useState(() => detectNativeShell());
  useEffect(() => {
    // A new effect setup owns fresh resources, never a restarted stopped actor.
    const current = createApplicationRoot(native?.checkpointStore);
    try {
      current.start();
      setRoot(current);
    } catch (error) {
      current.stop();
      throw error;
    }
    const shell = native;
    const releaseBack = shell
      ? shell.onHardwareBack(() => {
          handleHardwareBack(current.session, () => shell.minimize());
        })
      : null;
    return () => {
      releaseBack?.();
      current.stop();
    };
  }, [native]);
  return (
    <SoundProvider engine={sound}>
      {root ? (
        <SessionProvider session={root.session}>
          <StartupShell root={root} />
        </SessionProvider>
      ) : (
        <main>
          <h1>P.A.I.D.</h1>
          <p role="status">Starting application.</p>
        </main>
      )}
      <StartupIdent />
    </SoundProvider>
  );
}
