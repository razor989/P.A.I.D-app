import { createRoot } from "react-dom/client";
import { createApplicationRoot, StartupShell } from "@/app/composition-root";
import { SessionProvider } from "@/app/session-provider";
import { selectSession } from "@/session/app-machine/public";
import "@/presentation/styles/base.css";

const root = createApplicationRoot({
  load: async () => null,
  replace: async () => {},
  clear: async () => {},
});
root.start();
// Test-only observations/control over the real composition, not a parallel UI.
Object.assign(window, {
  t044: {
    phase: () =>
      selectSession(root.session).currentActivity?.getSnapshot().context
        .position,
    block: () => root.session.send({ type: "TECHNICAL_STARTED" }),
    unblock: () => root.session.send({ type: "TECHNICAL_SUCCEEDED" }),
  },
});
createRoot(document.getElementById("root")!).render(
  <SessionProvider session={root.session}>
    <StartupShell root={root} />
  </SessionProvider>,
);
window.addEventListener("pagehide", () => root.stop(), { once: true });
