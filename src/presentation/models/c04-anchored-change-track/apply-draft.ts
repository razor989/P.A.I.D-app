/** A03 entry syntax only. No calculation, answer inference or correctness checks. */
export function normalizeApplyNumber(input: string): string {
  if (input === "UNDEFINED") return input;
  const value = input.trim().replace(/−/g, "-");
  const unwrapped = value.replace(/^(?:₱|PHP\s*)\s*/i, "").replace(/\s*%$/, "");
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(unwrapped))
    return unwrapped.replace(/,/g, "");
  return unwrapped;
}
