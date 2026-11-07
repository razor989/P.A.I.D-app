import { useEffect, useId, useRef, useState } from "react";
import { useSound } from "../../audio/public";
import { useWorkRecordMotion } from "./use-commission-motion";
import t from "./transfer.module.css";

const readings = {
  sales: [
    "The reference, not the payment",
    "Sales records the value sold in this record. It supplies the base for the percentage; it is not added to the worker’s compensation.",
  ],
  rate: [
    "A rate attached to sales",
    "The agreed percentage acts on sales. The salary is not the base of this percentage.",
  ],
  commission: [
    "The sales-linked payment",
    "Sales multiplied by the agreed rate determines commission. This amount can join the salary, but it remains a distinct pay component.",
  ],
  salary: [
    "A separate fixed promise",
    "The monthly salary belongs to the agreement independently of June sales. Add it once, after determining commission.",
  ],
  total: [
    "Two pay components, one total",
    "Base salary plus commission determines this compensation total. Sales proceeds are not an additional component.",
  ],
} as const;
type Part = keyof typeof readings;

/** A single visual grammar for evidence, guidance, reference and worked teaching. */
export function TransferDiagram({
  solved = false,
  reference = false,
  focus = "all",
  blocked = false,
  commission = "₱3,600",
  total = "₱18,600",
  sales = "₱120,000",
  rate = "3%",
  salary = "₱15,000",
  straight = false,
  entered = {},
}: {
  solved?: boolean;
  reference?: boolean;
  focus?: string;
  blocked?: boolean;
  commission?: string;
  total?: string;
  sales?: string;
  rate?: string;
  salary?: string;
  straight?: boolean;
  /** The learner’s own amounts, shown in their slots before checking. */
  entered?: { commission?: string | undefined; total?: string | undefined };
}) {
  const [selected, setSelected] = useState<Part | null>(null);
  // Choosing a part reveals it; moving to another ticks; letting go closes.
  const sound = useSound();
  const shown = useRef(selected);
  useEffect(() => {
    const before = shown.current;
    shown.current = selected;
    if (before === selected) return;
    sound.play(
      before === null
        ? "model.reveal"
        : selected === null
          ? "inspect.close"
          : "inspect.switch",
    );
  }, [selected, sound]);
  const id = useId();
  const surface = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useWorkRecordMotion(
    surface,
    `${focus}/${solved}/${sales}/${straight}`,
    blocked,
  );
  function node(part: Part, label: string, amount: string, caption: string) {
    return (
      <button
        type="button"
        className={t.modelNode}
        data-part={part}
        data-motion={focus === part ? "emphasis" : "scene"}
        data-highlight={focus === part || undefined}
        disabled={blocked}
        aria-expanded={selected === part}
        aria-controls={id}
        onClick={(event) => {
          trigger.current = event.currentTarget;
          setSelected(selected === part ? null : part);
        }}
      >
        <svg className={t.nodeGlyph} viewBox="0 0 64 48" aria-hidden="true">
          {part === "sales" ? (
            <>
              <path d="M12 6h40v36H12zM20 16h24M20 24h24M20 32h12" />
            </>
          ) : part === "rate" ? (
            <>
              <circle cx="20" cy="14" r="6" />
              <circle cx="44" cy="34" r="6" />
              <path d="M17 40 47 8" />
            </>
          ) : part === "salary" ? (
            <>
              <path d="M8 10h48v30H8zM8 18h48" />
              <circle cx="32" cy="29" r="6" />
            </>
          ) : part === "commission" ? (
            <>
              <circle cx="32" cy="24" r="18" />
              <path d="M24 29q16 8 16-3t-16-7q0-7 16-2M32 10v28" />
            </>
          ) : (
            <>
              <path d="M8 12h18v26H8zM38 12h18v26H38zM28 25h8M32 21v8" />
            </>
          )}
        </svg>
        <span>{label}</span>
        <strong>{amount}</strong>
        <small>{caption}</small>
      </button>
    );
  }
  return (
    <div
      ref={surface}
      className={t.payModel}
      data-focus={focus}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          setSelected(null);
          trigger.current?.focus();
        }
      }}
    >
      <div className={t.salesLane}>
        {node(
          "sales",
          "SALES REFERENCE",
          reference ? "Sales" : sales,
          "Value sold · not pay",
        )}
        <span className={t.operator} aria-hidden="true">
          ×
        </span>
        {node(
          "rate",
          "AGREED RATE",
          reference ? "Rate" : rate,
          "Applies to sales",
        )}
      </div>
      <div className={t.modelConnector}>
        <span aria-hidden="true">↓</span>
        <small>determines</small>
      </div>
      {node(
        "commission",
        "COMMISSION",
        solved
          ? commission
          : reference
            ? "Sales × rate"
            : (entered.commission ?? "Your result"),
        !solved && !reference && entered.commission
          ? "Your entry · not yet checked"
          : "The sales-linked payment",
      )}
      {!straight && (
        <>
          <div className={t.salaryLane}>
            <span className={t.operator} aria-hidden="true">
              +
            </span>
            {node(
              "salary",
              "BASE SALARY",
              reference ? "Salary" : salary,
              "Fixed · added once",
            )}
          </div>
          <div className={t.modelConnector}>
            <span aria-hidden="true">↓</span>
            <small>together become</small>
          </div>
          {node(
            "total",
            "TOTAL COMPENSATION",
            solved
              ? total
              : reference
                ? "Salary + commission"
                : (entered.total ?? "Your result"),
            !solved && !reference && entered.total
              ? "Your entry · not yet checked"
              : "For this agreement only",
          )}
        </>
      )}
      <p className={t.inspectHint}>Select a part to inspect its role.</p>
      <div id={id} className={t.modelInspection} hidden={!selected}>
        {selected && (
          <>
            <strong>{readings[selected][0]}</strong>
            <p>
              {readings[selected][1]}
              {selected === "rate" && !reference
                ? ` Here the agreed rate is ${rate}.`
                : ""}
            </p>
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                setSelected(null);
                trigger.current?.focus();
              }}
            >
              Close explanation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
