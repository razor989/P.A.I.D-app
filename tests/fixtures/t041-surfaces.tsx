import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionButton,
  ExactDecimalInput,
} from "@/presentation/controls/public";
import {
  FeedbackSurface,
  InformationNeededSurface,
} from "@/presentation/feedback/public";
import type { CurrentFeedback } from "@/presentation/feedback/public";
import {
  SupportRegion,
  SystemRecoverySurface,
} from "@/presentation/support/public";
import type {
  SupportContent,
  SupportCloseRequest,
} from "@/presentation/support/public";
import "@/presentation/styles/base.css";

const origin = {
  receivingActivityId: "C04-A01",
  invokingPhase: "REVISION",
  returnTo: "REVISION",
} as const;
const review: SupportContent = {
  mode: "REVIEW",
  content: {
    origin,
    relationships: [
      {
        id: "synthetic-relation",
        text: "Synthetic trusted relationship for read-only inspection.",
      },
    ],
  },
};
// The only source field passed to production is already whitelisted by this test caller.
const source: SupportContent = {
  mode: "SOURCE_REVIEW",
  content: {
    origin,
    sourceRecordId: "synthetic-record-041",
    providerCompetencyId: "synthetic-provider-041",
    exposedFields: [
      { id: "synthetic-approved", text: "Synthetic approved source field." },
    ],
  },
};

function Fixture() {
  const [feedback, setFeedback] = useState<CurrentFeedback | null>(null);
  const [draft, setDraft] = useState("17");
  const [information, setInformation] = useState(false);
  const [support, setSupport] = useState<SupportContent | null>(null);
  const [presentation, setPresentation] = useState<"compact" | "expanded">(
    "compact",
  );
  const [closes, setCloses] = useState(0);
  const [lastClose, setLastClose] = useState("None");
  const [background, setBackground] = useState(0);
  const [retry, setRetry] = useState(0);
  const [destructive, setDestructive] = useState(0);
  const invoking = useRef<HTMLElement | null>(null);
  const open = (next: SupportContent, form: "compact" | "expanded") => {
    invoking.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPresentation(form);
    setSupport(next);
  };
  const close = (request: SupportCloseRequest) => {
    setCloses((n) => n + 1);
    setLastClose(
      `${request.mode}:${request.origin.receivingActivityId}:${request.origin.invokingPhase}:${request.origin.returnTo}`,
    );
    setSupport(null);
  };
  return (
    <main className="paid-workspace paid-stack">
      <h1>T041 synthetic support surfaces</h1>
      <p>
        Test-only synthetic content. No canonical lesson answers or production
        route.
      </p>
      <p>
        Receiving activity:{" "}
        <output aria-label="Receiving activity">
          {origin.receivingActivityId}
        </output>
      </p>
      <ExactDecimalInput
        label="Synthetic response"
        draft={draft}
        descriptions={{
          empty: "Synthetic empty draft",
          incomplete: "Synthetic incomplete draft",
          malformed: "Synthetic malformed draft",
          valid: "Structurally valid, not graded",
          composing: "Synthetic composition",
        }}
        onDraftChange={(next) => {
          setDraft(next.draft);
          setFeedback(null);
        }}
      />
      <div className="paid-stack">
        <ActionButton
          label="Supply Confirmation"
          onAction={() =>
            setFeedback({
              outcome: "CONFIRMED",
              content: "Synthetic current confirmation content.",
            })
          }
        />
        <ActionButton
          label="Supply Reconsideration"
          onAction={() =>
            setFeedback({
              outcome: "RECONSIDERATION",
              content: "Synthetic current reconsideration content.",
            })
          }
        />
        <ActionButton
          label="Authorize Information Needed"
          onAction={() => setInformation(true)}
        />
      </div>
      <FeedbackSurface feedback={feedback} />
      <InformationNeededSurface
        information={
          information
            ? {
                explanation:
                  "Synthetic caller-authorized missing information explanation.",
                returnLabel: "Return from Information Needed",
                onReturn: () => setInformation(false),
              }
            : null
        }
      />
      <section aria-label="Synthetic support controls" className="paid-stack">
        <h2>Support controls</h2>
        <ActionButton
          label="Open compact Review"
          onAction={() => open(review, "compact")}
        />
        <ActionButton
          label="Open expanded Review"
          onAction={() => open(review, "expanded")}
        />
        <ActionButton
          label="Open compact Source Review"
          onAction={() => open(source, "compact")}
        />
        <ActionButton
          label="Open expanded Source Review"
          onAction={() => open(source, "expanded")}
        />
        <ActionButton
          label="Background action"
          onAction={() => setBackground((n) => n + 1)}
        />
      </section>
      <SupportRegion
        presentation={presentation}
        support={support}
        title="Synthetic read-only support"
        description="Synthetic support, preserving the receiving response and origin."
        closeLabel="Close support"
        onClose={close}
        invokingControlRef={invoking}
      />
      <SystemRecoverySurface
        title="Synthetic technical status"
        status="Synthetic technical interruption"
        explanation="Synthetic safe technical explanation; not instructional feedback."
        actions={[
          {
            id: "retry",
            label: "Synthetic retry",
            onAction: () => setRetry((n) => n + 1),
          },
          {
            id: "reset",
            label: "Synthetic destructive action",
            onAction: () => setDestructive((n) => n + 1),
          },
        ]}
      />
      <section aria-label="Synthetic observations">
        <h2>Observations</h2>
        <p>
          Close count: <output aria-label="Close count">{closes}</output>
        </p>
        <p>
          Last close: <output aria-label="Last close">{lastClose}</output>
        </p>
        <p>
          Background count:{" "}
          <output aria-label="Background count">{background}</output>
        </p>
        <p>
          Retry count: <output aria-label="Retry count">{retry}</output>
        </p>
        <p>
          Destructive count:{" "}
          <output aria-label="Destructive count">{destructive}</output>
        </p>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Synthetic T041 fixture root missing");
createRoot(root).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
