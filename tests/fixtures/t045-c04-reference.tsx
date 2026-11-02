import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationRoot, StartupShell } from "@/app/composition-root";
import { SessionProvider } from "@/app/session-provider";
import { selectSession } from "@/session/app-machine/public";
import "@/presentation/styles/base.css";

const receipts: {
  type: string;
  visible: boolean;
  phase: string;
  revision: number;
}[] = [];
let clears = 0;
const root = createApplicationRoot({
  load: async () => null,
  replace: async () => {},
  clear: async () => {
    clears++;
  },
});
root.start();
let observed: object | null = null;
const subscription = root.session.subscribe(() => {
  const actor = selectSession(root.session).currentActivity;
  if (!actor || observed === actor) return;
  observed = actor;
  const send = actor.send.bind(actor);
  actor.send = (event) => {
    if (
      event.type === "FEEDBACK_DELIVERED" ||
      event.type === "TERMINAL_TEACHING_DELIVERED"
    ) {
      const context = actor.getSnapshot().context;
      const element = document.querySelector(
        event.type === "FEEDBACK_DELIVERED" ? ".feedback" : "[data-terminal]",
      );
      receipts.push({
        type: event.type,
        visible:
          element instanceof HTMLElement &&
          element.getClientRects().length > 0 &&
          Boolean(element.textContent?.trim()),
        phase: context.position,
        revision: context.responseRevision,
      });
    }
    send(event);
  };
});
Object.assign(window, {
  t045: {
    inspect: () => {
      const context = selectSession(root.session).currentActivity?.getSnapshot()
        .context;
      return {
        activityId: context?.activityId,
        phase: context?.position,
        responseRevision: context?.responseRevision,
        feedbackRevision: context?.feedbackRevision,
        terminalTeachingRevision: context?.terminalTeachingRevision,
        responseStage: context?.responseStage,
        response: context?.response,
        commitmentSequence: context?.commitmentSequence,
        firstPrimaryCommitment: context?.firstPrimaryCommitment,
        receipts,
        clears,
      };
    },
    block: () => root.session.send({ type: "TECHNICAL_STARTED" }),
    unblock: () => root.session.send({ type: "TECHNICAL_SUCCEEDED" }),
  },
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <StrictMode>
    <SessionProvider session={root.session}>
      <StartupShell root={root} />
    </SessionProvider>
  </StrictMode>,
);
window.addEventListener(
  "pagehide",
  () => {
    subscription.unsubscribe();
    reactRoot.unmount();
    root.stop();
  },
  { once: true },
);
