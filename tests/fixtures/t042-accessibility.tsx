import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/presentation/shell/public";
import type { Destination } from "@/presentation/shell/public";
import { AccessibilityCoordinator } from "@/presentation/accessibility/public";
import type {
  FocusEvent,
  SafeAnnouncement,
} from "@/presentation/accessibility/public";
import { ModalSurface } from "@/presentation/support/public";
import "@/presentation/styles/base.css";

function Fixture() {
  const [destination, setDestination] = useState<Destination>({
    kind: "library",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [event, setEvent] = useState<FocusEvent | null>(null);
  const [announcement, setAnnouncement] = useState<SafeAnnouncement | null>(
    null,
  );
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [invokerState, setInvokerState] = useState<
    "eligible" | "disconnected" | "disabled" | "inert"
  >("eligible");
  const [fallbacks, setFallbacks] = useState(0);
  const [closes, setCloses] = useState(0);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const invoker = useRef<HTMLButtonElement>(null);
  const capturedInvoker = useRef<HTMLButtonElement | null>(null);
  const source = useRef<HTMLParagraphElement>(null);
  const negativeSource = useRef<HTMLParagraphElement>(null);
  const [negativeMode, setNegativeMode] = useState("hidden");
  const [negativeAttempt, setNegativeAttempt] = useState(0);
  const [boundedText, setBoundedText] = useState<string | null>(null);
  const negativeFixture = new URLSearchParams(location.search).has("negative");
  const shellMode = new URLSearchParams(location.search).has("shell");
  if (shellMode)
    return (
      <>
        <AppShell
          destination={destination}
          competencies={[
            {
              id: "C04",
              label: "Synthetic competency",
              available: true,
              activities: [
                { id: "C04-A01", label: "Synthetic activity", available: true },
              ],
            },
          ]}
          blocked={false}
          notice={notice}
          canBack
          canReturn
          onBack={() => setDestination({ kind: "library" })}
          onReturn={() => setDestination({ kind: "library" })}
          onCompetency={(competencyId) =>
            setDestination({ kind: "competency", competencyId })
          }
          onActivity={(activityId) =>
            setDestination({ kind: "activity", activityId })
          }
          switchChoice={null}
        />
        <button
          onClick={() => {
            setDestination({ ...destination });
            setNotice("Synthetic independent notice.");
          }}
        >
          Same destination and notice
        </button>
      </>
    );
  const emit = (kind: "major-step" | "recovered-activity", identity: string) =>
    setEvent({ kind, identity, target: heading });
  return (
    <main className="paid-workspace paid-stack">
      <h1>T042 synthetic policy demonstrations</h1>
      <p>
        Test-only caller-authorized events. Not a production lesson or Recovery
        journey.
      </p>
      <h2 ref={heading} tabIndex={-1}>
        Synthetic orientation {step}
      </h2>
      <button
        onClick={() => {
          setStep((n) => n + 1);
          emit("major-step", `step-${step + 1}`);
        }}
      >
        Major step
      </button>
      <button onClick={() => emit("major-step", `step-${step}`)}>
        Same step
      </button>
      <button onClick={() => emit("recovered-activity", `recovery-${step}`)}>
        Recovered orientation
      </button>
      <label htmlFor="synthetic-response">Synthetic response</label>
      <input
        ref={input}
        id="synthetic-response"
        defaultValue="17"
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={invalid ? "syntax-explanation" : undefined}
      />
      {invalid && (
        <p id="syntax-explanation">
          Synthetic caller-authorized structure explanation.
        </p>
      )}
      <button
        onClick={() => {
          setInvalid(false);
          setEvent(null);
        }}
      >
        Check coherent incorrect response
      </button>
      <button
        onClick={() => {
          setInvalid(true);
          setEvent({
            kind: "invalid-response",
            identity: `syntax-${step}`,
            structurallyInvalid: true,
            target: input,
          });
        }}
      >
        Signal structural defect
      </button>
      {invokerState !== "disconnected" && (
        <button
          ref={invoker}
          disabled={invokerState === "disabled"}
          inert={invokerState === "inert"}
          onClick={() => {
            capturedInvoker.current = invoker.current;
            setOpen(true);
          }}
        >
          Open modal
        </button>
      )}
      <ModalSurface
        open={open}
        title="Synthetic modal"
        description="T041 owns containment and restoration."
        closeLabel="Close modal"
        invokingControlRef={invoker}
        onClose={() => {
          setOpen(false);
          setCloses((n) => n + 1);
          const captured = capturedInvoker.current;
          const unavailable =
            !captured?.isConnected ||
            captured.matches(":disabled") ||
            captured.closest("[inert]") !== null;
          if (unavailable) {
            setFallbacks((n) => n + 1);
            setEvent({
              kind: "post-modal",
              identity: `close-${closes + 1}`,
              closeCompleted: true,
              invokerUnavailable: true,
              target: heading,
            });
          }
        }}
      >
        {(["disconnected", "disabled", "inert"] as const).map((state) => (
          <button key={state} onClick={() => setInvokerState(state)}>
            Make captured invoker {state}
          </button>
        ))}
        <button onClick={() => emit("major-step", "blocked-step")}>
          Signal while modal open
        </button>
      </ModalSurface>
      <p>
        Close count: <output aria-label="Close count">{closes}</output>
      </p>
      <p>
        Fallback count: <output aria-label="Fallback count">{fallbacks}</output>
      </p>
      {message && (
        <p ref={source}>{boundedText ?? "Synthetic visible safe status."}</p>
      )}
      <button
        onClick={() => {
          setMessage(true);
          setBoundedText(null);
          setAnnouncement({
            identity: "status-a",
            text: "Synthetic visible safe status.",
            visibleSource: source,
          });
        }}
      >
        Announce safe status
      </button>
      <button
        onClick={() =>
          setAnnouncement({
            identity: "status-b",
            text: "Synthetic visible safe status.",
            visibleSource: source,
          })
        }
      >
        New equal-text event
      </button>
      <button
        onClick={() => {
          setMessage(false);
          setAnnouncement(null);
        }}
      >
        Clear status
      </button>
      {[280, 281].map((length) => (
        <button
          key={length}
          onClick={() => {
            const text = "x".repeat(length);
            setMessage(true);
            setBoundedText(text);
            setAnnouncement({
              identity: `bound-${length}`,
              text,
              visibleSource: source,
            });
          }}
        >
          Announce {length} characters
        </button>
      ))}
      {negativeFixture && (
        <section aria-label="Isolated synthetic hidden-descendant negative case">
          <h2>Noncanonical negative announcement fixture</h2>
          <p ref={negativeSource}>
            Synthetic visible prefix.
            <span
              hidden={negativeMode === "hidden"}
              aria-hidden={negativeMode === "aria-hidden" ? true : undefined}
              inert={negativeMode === "inert"}
              style={
                negativeMode === "display"
                  ? { display: "none" }
                  : negativeMode === "visibility"
                    ? { visibility: "hidden" }
                    : undefined
              }
            >
              SYNTHETIC_T042_HIDDEN_ONLY_MARKER
            </span>
          </p>
          {["hidden", "display", "visibility", "aria-hidden", "inert"].map(
            (mode) => (
              <button
                key={mode}
                onClick={() => {
                  setNegativeMode(mode);
                  setNegativeAttempt((n) => n + 1);
                  setAnnouncement({
                    identity: `negative-${mode}-${negativeAttempt}`,
                    text: "Synthetic visible prefix.SYNTHETIC_T042_HIDDEN_ONLY_MARKER",
                    visibleSource: negativeSource,
                  });
                }}
              >
                Attempt hidden descendant {mode}
              </button>
            ),
          )}
        </section>
      )}
      <AccessibilityCoordinator event={event} announcement={announcement} />
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("T042 fixture root missing");
createRoot(root).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
