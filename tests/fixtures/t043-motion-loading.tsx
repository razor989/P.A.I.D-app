import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoadingPresentation } from "@/presentation/technical/public";
import { createApplicationRoot, StartupShell } from "@/app/composition-root";
import { SessionProvider } from "@/app/session-provider";
import "@/presentation/styles/base.css";

// Test-only controls wrap the real root, Session actor and Recovery queue.
// No fixture path or operation control is imported by production.
const mode = new URLSearchParams(location.search).get("mode");
let resolveClear: (() => void) | undefined;
let rejectClear: ((error: unknown) => void) | undefined;
const production = createApplicationRoot({
  load: () => Promise.resolve(mode === "clearing" ? "{" : null),
  replace: () => Promise.resolve(),
  clear: () =>
    new Promise<void>((resolve, reject) => {
      resolveClear = resolve;
      rejectClear = reject;
    }),
});

function ProductionFixture() {
  useEffect(() => {
    production.start();
    return () => production.stop();
  }, []);
  Object.assign(window, {
    t043: {
      start: () => production.session.send({ type: "TECHNICAL_STARTED" }),
      finish: () => production.session.send({ type: "TECHNICAL_SUCCEEDED" }),
      fail: () =>
        production.session.send({
          type: "TECHNICAL_FAILED",
          recoverable: true,
          error: new Error("synthetic storage failure"),
        }),
      resolveClear: () => resolveClear?.(),
      rejectClear: () => rejectClear?.(new Error("synthetic clear failure")),
      stop: () => production.stop(),
      snapshot: () => ({
        value: production.session.getSnapshot().value,
        context: {
          destination: production.session.getSnapshot().context.destination,
        },
      }),
    },
  });
  return (
    <SessionProvider session={production.session}>
      <StartupShell root={production} />
    </SessionProvider>
  );
}

function SyntheticFixture() {
  const [pending, setPending] = useState(false);
  const [identity, setIdentity] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [step, setStep] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [failure, setFailure] = useState(false);
  return (
    <main className="paid-workspace paid-stack">
      <h1>T043 synthetic presentation contract</h1>
      <p>
        Test-only authorized content. Not an instructional Activity or
        assessment.
      </p>
      <button
        className="motion-fast"
        onClick={() => {
          setPending(true);
          setFailure(false);
        }}
      >
        Start technical operation
      </button>
      <button className="motion-standard" onClick={() => setPending(false)}>
        Complete technical operation
      </button>
      <button
        className="motion-model"
        onClick={() => {
          setIdentity((x) => x + 1);
          setPending(true);
        }}
      >
        Replace technical operation
      </button>
      <button
        onClick={() => {
          setPending(false);
          setFailure(true);
        }}
      >
        Fail technical operation
      </button>
      <button onClick={() => setMounted((x) => !x)}>
        Toggle Loading owner
      </button>
      {mounted && (
        <LoadingPresentation
          pending={pending && !failure}
          operationKey={identity}
          message="Synthetic authorized technical operation pending."
        />
      )}
      {failure && (
        <p role="status">
          Synthetic technical failure. Retry is an explicit action.
        </p>
      )}
      <section aria-labelledby="step">
        <h2 id="step">Synthetic explanation step {step}</h2>
        <p>Explanation remains until the learner chooses Next.</p>
        <button onClick={() => setStep((x) => x + 1)}>
          Next synthetic step
        </button>
        <button onClick={() => setRevealed(true)}>
          Explicit synthetic reveal
        </button>
        {revealed && (
          <p>Synthetic authorized reveal and reinforcement remain available.</p>
        )}
      </section>
    </main>
  );
}
const element = document.getElementById("root");
if (!element) throw new Error("T043 fixture root missing");
// StrictMode synthetic replay and real-root replay are tested separately. A stopped
// real root must never be restarted by a fixture effect replay.
createRoot(element).render(
  mode ? (
    <ProductionFixture />
  ) : (
    <StrictMode>
      <SyntheticFixture />
    </StrictMode>
  ),
);
