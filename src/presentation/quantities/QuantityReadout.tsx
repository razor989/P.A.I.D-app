import type { Quantity } from "@/core/public";
import styles from "./quantities.module.css";

export type QuantityReadoutProps = Readonly<{
  label: string;
  quantity: Quantity;
  condition?: string;
  provenance?: string;
}>;

export function QuantityReadout({
  label,
  quantity,
  condition,
  provenance,
}: QuantityReadoutProps) {
  return (
    <div className={styles.readout}>
      <p>{label}</p>
      <dl>
        <dt>Value</dt>
        <dd>{quantity.magnitude.toString()}</dd>
        <dt>Kind</dt>
        <dd>{quantity.kind}</dd>
        <dt>Unit</dt>
        <dd>{quantity.unit}</dd>
        {quantity.basis !== null && (
          <>
            <dt>Basis</dt>
            <dd>{quantity.basis}</dd>
          </>
        )}
        {condition !== undefined && (
          <>
            <dt>Condition</dt>
            <dd>{condition}</dd>
          </>
        )}
        {provenance !== undefined && (
          <>
            <dt>Provenance</dt>
            <dd>{provenance}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
