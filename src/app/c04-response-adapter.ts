import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";

/** Only public role metadata is needed here. Correctness never enters this adapter. */
export type ResponseField = Readonly<{
  role: string;
  required: boolean;
  acceptedKinds: readonly string[];
  quantityKind?: string;
  unit?: string;
  basis?: string | null;
  options?: readonly Readonly<{ id: string; text: string }>[];
}>;
export type ResponseDraft = Readonly<Record<string, string>>;

/** Syntax and identity construction only; canonical ports own readiness/evaluation. */
export function constructC04Response(
  fields: readonly ResponseField[],
  draft: ResponseDraft,
  retained: LearnerResponse | null = null,
): LearnerResponse | null {
  type Atomic = Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>;
  const parts: { key: string; response: Atomic }[] =
    retained?.kind === "COMPOSITE"
      ? retained.parts.filter(
          (part) => !fields.some((f) => f.role === part.key),
        )
      : [];
  for (const field of fields) {
    const raw = draft[field.role] ?? "";
    if (!raw) {
      if (field.required) return null;
      continue;
    }
    let response: Atomic;
    if (field.acceptedKinds.includes("SINGLE_SELECTION")) {
      if (!field.options?.some((option) => option.id === raw)) return null;
      response = { kind: "SINGLE_SELECTION", selectionId: raw };
    } else if (raw === "UNDEFINED") {
      if (!field.acceptedKinds.includes("SEMANTIC_BOUNDARY")) return null;
      response = {
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
      };
    } else {
      if (
        !field.acceptedKinds.includes("EXACT_QUANTITY") ||
        !field.quantityKind ||
        !field.unit ||
        field.basis === undefined ||
        !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)
      )
        return null;
      try {
        response = {
          kind: "EXACT_QUANTITY",
          value: quantity(
            ExactDecimal.from(raw),
            field.quantityKind,
            field.unit,
            field.basis,
          ),
        };
      } catch {
        return null;
      }
    }
    parts.push({ key: field.role, response });
  }
  return parts.length ? { kind: "COMPOSITE", parts } : null;
}
