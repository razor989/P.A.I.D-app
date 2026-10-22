import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ExactDecimal, quantity } from "@/core/public";
import { ResponseRegion } from "@/presentation/activity/public";
import { SemanticBoundaryValue } from "@/presentation/quantities/public";
import "@/presentation/styles/base.css";

function Fixture() {
  const [draft, setDraft] = useState("");
  const [single, setSingle] = useState("synthetic-a");
  const [multiple, setMultiple] = useState<readonly string[]>([]);
  const [actions, setActions] = useState(0);
  const [intent, setIntent] = useState("None");
  return (
    <main style={{ maxWidth: "65ch", margin: "auto", padding: "1rem" }}>
      <h1>T040 synthetic shared-control test fixture</h1>
      <p>
        Test-only synthetic content. Not a lesson, assessment or production
        route.
      </p>
      <ResponseRegion
        legend="Synthetic response controls"
        controls={[
          {
            id: "action",
            kind: "action",
            props: {
              label: "Synthetic action",
              onAction: () => setActions((count) => count + 1),
            },
          },
          {
            id: "disabled",
            kind: "action",
            props: {
              label: "Disabled action",
              disabled: true,
              onAction: () => setActions((count) => count + 1),
            },
          },
          {
            id: "radio",
            kind: "choice",
            props: {
              mode: "single",
              legend: "Synthetic single choice",
              options: [
                {
                  id: "synthetic-a",
                  label: "Synthetic alpha",
                  checked: single === "synthetic-a",
                },
                {
                  id: "synthetic-b",
                  label: "Synthetic beta",
                  checked: single === "synthetic-b",
                },
                {
                  id: "synthetic-c",
                  label: "Synthetic disabled",
                  checked: false,
                  disabled: true,
                },
              ],
              onChoice: ({ optionId }) => {
                setSingle(optionId);
                setIntent(optionId);
              },
            },
          },
          {
            id: "checks",
            kind: "choice",
            props: {
              mode: "multiple",
              legend: "Synthetic multiple choice",
              options: ["first", "second"].map((id) => ({
                id,
                label: `Synthetic ${id}`,
                checked: multiple.includes(id),
              })),
              onChoice: ({ optionId, checked }) => {
                setMultiple((previous) =>
                  checked
                    ? [...previous, optionId]
                    : previous.filter((id) => id !== optionId),
                );
                setIntent(optionId);
              },
            },
          },
          {
            id: "decimal",
            kind: "decimal",
            props: {
              label: "Synthetic exact decimal",
              draft,
              required: true,
              descriptions: {
                empty: "Enter a finite decimal value.",
                incomplete: "Incomplete decimal: finish the digits.",
                malformed:
                  "Malformed decimal: use digits and an optional sign and decimal point.",
                valid:
                  "Structurally valid decimal. This is not a correctness judgment.",
                composing: "Text composition in progress.",
              },
              onDraftChange: (next) => setDraft(next.draft),
            },
          },
        ]}
      />
      <p>
        Action count: <output aria-label="Action count">{actions}</output>
      </p>
      <p>
        Last synthetic choice:{" "}
        <output aria-label="Last choice">{intent}</output>
      </p>
      <h2>Synthetic quantity states</h2>
      <SemanticBoundaryValue
        value={{
          kind: "KNOWN",
          readout: {
            label: "Synthetic zero",
            quantity: quantity(
              ExactDecimal.from("0"),
              "count",
              "items",
              "synthetic basis",
            ),
            provenance: "Synthetic provenance",
            condition: "Synthetic condition",
          },
        }}
      />
      <SemanticBoundaryValue
        value={{
          kind: "KNOWN",
          readout: {
            label: "Synthetic precise quantity",
            quantity: quantity(
              ExactDecimal.from("123.4567890123456789"),
              "rate",
              "synthetic unit",
              "per synthetic interval",
            ),
          },
        }}
      />
      <SemanticBoundaryValue
        value={{ kind: "NOT_APPLICABLE", label: "Synthetic not applicable" }}
      />
      <SemanticBoundaryValue
        value={{
          kind: "UNKNOWN",
          label: "Synthetic unknown",
          reason: "Synthetic source input absent",
        }}
      />
      <SemanticBoundaryValue
        value={{
          kind: "UNDEFINED",
          label: "Synthetic undefined",
          reason: "Synthetic operation undefined",
        }}
      />
      <SemanticBoundaryValue
        value={{ kind: "WITHHELD", label: "Synthetic withheld" }}
      />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Synthetic fixture root missing");
createRoot(root).render(<Fixture />);
