import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExploreGlyph, ExploreHourMark } from "./ExploreGlyph";
import type { C03WorkRecordProjection } from "./public";
import { pesos } from "./WorkEvidence";
import explore from "./explore.module.css";
import { anchorInspection } from "./anchor-inspection";

export type TransferPart =
  "rate" | "hours" | "condition" | "multiplier" | "pay";
const Inspection = createContext<{
  open: (part: TransferPart, target: HTMLElement, pin?: boolean) => void;
  leave: () => void;
  active: TransferPart | null;
  id: string;
  blocked: boolean;
} | null>(null);
export function TransferInspectable({
  part,
  children,
  className,
}: {
  part: TransferPart;
  children: ReactNode;
  className?: string | undefined;
}) {
  const context = useContext(Inspection);
  return (
    <button
      type="button"
      disabled={context?.blocked}
      data-inspect={part}
      className={className ?? explore.proseTrigger}
      aria-expanded={context?.active === part}
      aria-controls={context?.id}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch")
          context?.open(part, event.currentTarget);
      }}
      onPointerLeave={() => context?.leave()}
      onFocus={(event) => context?.open(part, event.currentTarget)}
      onBlur={() => context?.leave()}
      onClick={(event) => context?.open(part, event.currentTarget, true)}
    >
      {children}
    </button>
  );
}

export function TransferInspection({
  projection,
  blocked,
  onInspect,
  children,
}: {
  projection: C03WorkRecordProjection;
  blocked: boolean;
  onInspect?: () => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState<{
    part: TransferPart;
    target: HTMLElement;
    pinned: boolean;
    left: number;
    top: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressFocus = useRef(false);
  const dismissed = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const math = projection.mathematicalExplanation;
  const rate = pesos(projection.workEvidence.rate.magnitude.toString());
  const facts: Record<TransferPart, [string, string]> = {
    rate: [
      "Already an hourly rate",
      `${rate} is Mara’s regular pay for one hour. The rate has already been established. No daily or monthly wage conversion belongs in this task.`,
    ],
    hours: [
      "Only the three extra hours",
      "The first eight hours have been completed. Each gold mark represents one of the three overtime hours. Do not use all eleven hours in the overtime calculation.",
    ],
    condition: [
      "Read the day before the numbers",
      "The scenario explicitly establishes a regular holiday. You do not need a calendar or a guessed date. Identify that condition, then find the multiplier linked to it in the relationship reference.",
    ],
    multiplier: [
      "A rule linked to the day",
      math
        ? `Regular-holiday overtime uses ${math.multiplier.magnitude.toString()}. The multiplier follows from the condition; it does not change the number of hours.`
        : "Your multiplier is your proposed application of the day’s rule, not a free setting that changes the work record. Open the relationship reference if you need the approved regular-holiday rule.",
    ],
    pay: [
      "Overtime pay—not all holiday earnings",
      "Multiply the established hourly rate by the applicable multiplier and by three overtime hours. The result covers only those extra hours. The first eight hours, gross income and net pay are outside this calculation.",
    ],
  };
  function close(restore = false) {
    clearTimeout(timer.current);
    dismissed.current = active?.target ?? null;
    if (restore) {
      suppressFocus.current = true;
      active?.target.focus({ preventScroll: true });
      suppressFocus.current = false;
    }
    setActive(null);
  }
  function leave() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setActive((current) =>
        current?.pinned ||
        panel.current?.matches(":hover") ||
        panel.current?.contains(document.activeElement) ||
        current?.target === document.activeElement
          ? current
          : null,
      );
    }, 280);
  }
  function open(part: TransferPart, target: HTMLElement, pin = false) {
    if (blocked || suppressFocus.current) return;
    if (!pin && dismissed.current === target) return;
    dismissed.current = null;
    if (active?.pinned && !pin) return;
    clearTimeout(timer.current);
    const show = () => {
      const box = target.getBoundingClientRect();
      setActive((current) => ({
        part,
        target,
        pinned: pin || (current?.target === target && current.pinned),
        ...anchorInspection(box, panel.current?.offsetHeight),
      }));
      onInspect?.();
    };
    if (pin || target === document.activeElement) show();
    else timer.current = setTimeout(show, 180);
  }
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimeout(timer.current);
        dismissed.current = document.querySelector<HTMLElement>(
          `[aria-controls="${id}"][aria-expanded="true"]`,
        );
        if (panel.current?.contains(document.activeElement)) {
          suppressFocus.current = true;
          const source = document.querySelector<HTMLElement>(
            `[aria-controls="${id}"][aria-expanded="true"]`,
          );
          source?.focus({ preventScroll: true });
          suppressFocus.current = false;
        }
        setActive(null);
      }
    };
    const outside = (event: PointerEvent) =>
      setActive((current) =>
        current &&
        !panel.current?.contains(event.target as Node) &&
        !current.target.contains(event.target as Node)
          ? null
          : current,
      );
    const reposition = () =>
      setActive((current) => {
        if (!current) return null;
        const box = current.target.getBoundingClientRect();
        return {
          ...current,
          ...anchorInspection(box, panel.current?.offsetHeight),
        };
      });
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [id]);
  // Once the panel has rendered, place it by its real height so it sits
  // beside its trigger rather than over it.
  useLayoutEffect(() => {
    if (!active || !panel.current) return;
    const placed = anchorInspection(
      active.target.getBoundingClientRect(),
      panel.current.offsetHeight,
    );
    if (
      Math.abs(placed.top - active.top) > 0.5 ||
      Math.abs(placed.left - active.left) > 0.5
    )
      setActive((current) =>
        current?.target === active.target ? { ...current, ...placed } : current,
      );
  }, [active]);
  return (
    <Inspection.Provider
      value={{
        open,
        leave,
        active: blocked ? null : (active?.part ?? null),
        id,
        blocked,
      }}
    >
      {children}
      {active &&
        !blocked &&
        createPortal(
          <aside
            ref={panel}
            id={id}
            role="region"
            aria-label={facts[active.part][0]}
            className={explore.popover}
            style={{ left: active.left, top: active.top }}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={leave}
            onBlur={leave}
          >
            <header>
              <h3>{facts[active.part][0]}</h3>
              <button aria-label="Close inspection" onClick={() => close(true)}>
                <ExploreGlyph name="close" />
              </button>
            </header>
            <svg
              viewBox="0 0 300 100"
              role="img"
              aria-label={facts[active.part][0]}
            >
              {active.part === "hours" ? (
                Array.from({ length: 3 }, (_, n) => (
                  <g
                    key={n}
                    transform={`translate(${32 + (n % 5) * 58} ${25 + Math.floor(n / 5) * 49}) scale(.8)`}
                  >
                    <ExploreHourMark />
                  </g>
                ))
              ) : (
                <>
                  <rect
                    x="12"
                    y="12"
                    width="276"
                    height="70"
                    rx="9"
                    fill="#e7edda"
                    stroke="#879d65"
                  />
                  <text
                    x="150"
                    y="39"
                    textAnchor="middle"
                    fill="#203c33"
                    fontSize="14"
                  >
                    {active.part === "condition"
                      ? "Regular holiday"
                      : active.part === "pay"
                        ? "Overtime pay only"
                        : "Hourly rate × multiplier"}
                  </text>
                  <text
                    x="150"
                    y="65"
                    textAnchor="middle"
                    fill="#71531d"
                    fontSize="20"
                  >
                    {active.part === "condition"
                      ? "day → multiplier → pay"
                      : active.part === "pay"
                        ? "not total holiday earnings"
                        : `${rate} × ${math?.multiplier.magnitude.toString() ?? "?"}`}
                  </text>
                </>
              )}{" "}
            </svg>
            <p>{facts[active.part][1]}</p>
            <footer>
              <button
                aria-pressed={active.pinned}
                onClick={() => setActive({ ...active, pinned: !active.pinned })}
              >
                {active.pinned ? "Unpin" : "Keep open"}
              </button>
            </footer>
          </aside>,
          document.body,
        )}
    </Inspection.Provider>
  );
}
