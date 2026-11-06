import { useId, useRef } from "react";
import type { Quantity } from "@/core/public";
import type { C06CommissionProjection } from "./public";
import styles from "./commission.module.css";
import { useWorkRecordMotion } from "./use-commission-motion";
import { CommissionInspection } from "./CommissionInspection";

/** Display formatting only: never derive a mathematical result in presentation. */
export function displayQuantity(value: Quantity): string {
  const [whole, fraction] = value.magnitude.toString().split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value.unit === "PHP" ? "₱" : ""}${grouped}${fraction ? `.${fraction}` : ""}${value.unit === "%" ? "%" : ""}${value.basis ? ` ${value.basis}` : ""}`;
}

function Connector({ operation }: { operation: "×" | "→" | "+" | "=" }) {
  return (
    <span className={styles.connector} aria-hidden="true">
      <svg viewBox="0 0 48 20" focusable="false">
        <path d="M2 10H46" />
      </svg>
      <b>{operation}</b>
    </span>
  );
}

export function CommissionMachine({
  model,
  worker,
  open = false,
}: {
  model: C06CommissionProjection["model"];
  worker: string;
  /** Prepare: show each agreement’s structure and given facts, leaving
   * commission and total pay as questions for Explore and Learn. */
  open?: boolean;
}) {
  const id = useId();
  const surface = useRef<HTMLElement>(null);
  useWorkRecordMotion(
    surface,
    `${model.arrangement}/${model.commission?.resolution.kind}`,
    false,
  );
  const basePlus = model.arrangement === "BASE_PLUS_COMMISSION";
  const result = (value: typeof model.commission) =>
    open && value
      ? "Still to find out"
      : value?.resolution.kind === "KNOWN"
        ? displayQuantity(value.resolution.value)
        : value
          ? "Information needed"
          : "Not revealed yet";
  return (
    <CommissionInspection
      facts={[
        {
          id: "sales",
          title: "Start with what was sold",
          copy: "Sales records the value of goods sold. It is the starting amount for commission, not the worker’s earnings. The sales record is not reduced when commission is calculated.",
        },
        {
          id: "rate",
          title: "Follow the commission promise",
          copy: "Both workers have a 5% commission rate. Five out of every hundred describes the relationship between Sales and Commission. The fixed monthly salary is outside this relationship.",
        },
        {
          id: "terms",
          title: "Does the agreement promise anything else?",
          copy: basePlus
            ? "Worker B’s agreement includes a fixed monthly salary as well as commission. Follow the separate salary branch: it joins Commission only after commission has been determined."
            : "Worker A’s agreement promises commission, with no fixed salary alongside it. This machine ends at Commission. There is no base-salary branch—not a branch holding zero.",
        },
      ]}
    >
      {(target) => (
        <figure ref={surface} className={styles.machine} aria-labelledby={id}>
          <figcaption id={id}>
            <span className={styles.eyebrow}>
              {worker} · Commission Machine
            </span>
            <h3>{basePlus ? "Base-plus-commission" : "Straight commission"}</h3>
          </figcaption>
          <div className={styles.derivation}>
            <button
              type="button"
              {...target("sales")}
              className={styles.module}
              data-motion="hour"
              data-order="0"
            >
              <span>Sales input</span>
              <strong>
                {model.sales.kind === "KNOWN"
                  ? displayQuantity(model.sales.value)
                  : "Information needed"}
              </strong>
            </button>
            <Connector operation="×" />
            <button
              type="button"
              {...target("rate")}
              className={`${styles.module} ${styles.gate}`}
              data-motion="hour"
              data-order="1"
            >
              <span>Commission rate</span>
              <strong>
                {model.commissionRate.kind === "KNOWN"
                  ? displayQuantity(model.commissionRate.value)
                  : "Information needed"}
              </strong>
            </button>
            <Connector operation="→" />
            <button
              type="button"
              {...target("rate")}
              className={`${styles.module} ${styles.output}`}
              data-motion="hour"
              data-order="2"
            >
              <span>Commission output</span>
              <strong>{result(model.commission)}</strong>
            </button>
          </div>
          <p className={styles.relationship}>
            Sales × Commission Rate determines Commission.
          </p>
          {basePlus ? (
            <section
              className={styles.assembly}
              data-motion="emphasis"
              aria-label="Then assemble Total Compensation"
            >
              <p className={styles.eyebrow}>Then, a separate step</p>
              <div className={styles.derivation}>
                <button
                  type="button"
                  {...target("terms")}
                  className={styles.module}
                >
                  <span>Base Salary</span>
                  <strong>
                    {model.baseSalary?.kind === "KNOWN"
                      ? displayQuantity(model.baseSalary.value)
                      : "Information needed"}
                  </strong>
                </button>
                <Connector operation="+" />
                <button
                  type="button"
                  {...target("rate")}
                  className={styles.module}
                >
                  <span>Commission, already derived</span>
                  <strong>{result(model.commission)}</strong>
                </button>
                <Connector operation="=" />
                <button
                  type="button"
                  {...target("terms")}
                  className={`${styles.module} ${styles.output}`}
                >
                  <span>Total Compensation</span>
                  <strong>{result(model.totalCompensation)}</strong>
                </button>
              </div>
              <p className={styles.relationship}>
                Base Salary + Commission determines Total Compensation. Base
                Salary is not multiplied by the rate.
              </p>
            </section>
          ) : (
            <p className={styles.terminus}>
              <strong>Ends at Commission.</strong> A base-salary branch does not
              apply to this arrangement.
            </p>
          )}
          <button
            type="button"
            className={styles.textButton}
            {...target("terms")}
          >
            Follow {worker}’s agreement ↗
          </button>
        </figure>
      )}
    </CommissionInspection>
  );
}
