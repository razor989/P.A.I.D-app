/**
 * Shows a recorded learner number the way the lesson writes amounts:
 * grouped thousands, the peso sign or percent, and a true minus sign.
 * Display only — the recorded value itself is never changed.
 */
export function recordedNumber(value: string, unit: "₱" | "%"): string {
  const match = /^([+-]?)(\d+)(\.\d+)?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, whole, fraction = ""] = match;
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction;
  const minus = sign === "-" && Number(whole + fraction) !== 0 ? "−" : "";
  return unit === "₱" ? `${minus}₱${grouped}` : `${minus}${grouped}%`;
}
