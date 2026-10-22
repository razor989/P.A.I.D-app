import { QuantityReadout } from "./QuantityReadout";
import type { QuantityReadoutProps } from "./QuantityReadout";
import styles from "./quantities.module.css";

/** Caller-authorized projection: a withheld case carries no hidden payload. */
export type BoundaryPresentation =
  | Readonly<{ kind: "KNOWN"; readout: QuantityReadoutProps }>
  | Readonly<{
      kind: "NOT_APPLICABLE" | "UNKNOWN" | "UNDEFINED";
      label: string;
      reason?: string;
    }>
  | Readonly<{ kind: "WITHHELD"; label: string }>;

export function SemanticBoundaryValue({
  value,
}: Readonly<{ value: BoundaryPresentation }>) {
  if (value.kind === "KNOWN") return <QuantityReadout {...value.readout} />;
  const state = {
    NOT_APPLICABLE: "Not Applicable",
    UNKNOWN: "Unknown",
    UNDEFINED: "Undefined",
    WITHHELD: "Withheld",
  }[value.kind];
  return (
    <div className={styles.readout}>
      <p>
        {value.label}: {state}
      </p>
      {value.kind !== "WITHHELD" && value.reason !== undefined && (
        <p>{value.reason}</p>
      )}
    </div>
  );
}
