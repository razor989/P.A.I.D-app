import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { acquireSessionCheckpointProducer } from "@/session/app-machine/public";
import type { AppSessionActor } from "@/session/app-machine/public";

const SessionContext = createContext<AppSessionActor | null>(null);

/** The actor owns semantic state. No store/queue writer is in this context. */
export function SessionProvider({
  session,
  children,
}: {
  session: AppSessionActor;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSessionActor(): AppSessionActor {
  const actor = useContext(SessionContext);
  if (!actor) throw new Error("SessionProvider is required");
  return actor;
}
export function useSessionSnapshot() {
  const actor = useSessionActor();
  return useSyncExternalStore(
    (notify) => {
      const subscription = actor.subscribe(notify);
      return () => subscription.unsubscribe();
    },
    () => actor.getSnapshot(),
    () => actor.getSnapshot(),
  );
}
export function useSessionCheckpointProducer() {
  return acquireSessionCheckpointProducer(useSessionActor());
}
