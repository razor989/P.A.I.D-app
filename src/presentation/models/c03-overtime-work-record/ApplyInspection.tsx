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

export type ApplyPart = "rate" | "hours" | "condition" | "multiplier" | "pay";
const Inspection = createContext<{
  open: (part: ApplyPart, target: HTMLElement, pin?: boolean) => void;
  leave: () => void;
  active: ApplyPart | null;
  id: string;
  blocked: boolean;
} | null>(null);
export function ApplyInspectable({
  part,
  children,
  className,
}: {
  part: ApplyPart;
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

export function ApplyInspection({
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
    part: ApplyPart;
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
  const facts: Record<ApplyPart, [string, string]> = {
    rate: [
      "Start with one hour",
      `${rate} is James’s regular pay for one hour. It is already an hourly rate, so there is nothing to convert. Carry this amount into the calculation.`,
    ],
    hours: [
      "Count the extra hours together",
      "Each mark stands for one overtime hour, not one workday. James worked 10 extra hours during the month. Use all 10 in the calculation; we do not need to know which dates he worked them.",
    ],
    condition: [
      "The day chooses the rule",
      "James worked these extra hours on ordinary working days. Recall the ordinary-day record from Explore and Learn. Would a rest-day multiplier fit this situation?",
    ],
    multiplier: [
      "A multiplier changes the pay, not the time",
      math
        ? `The ordinary-day multiplier is ${math.multiplier.magnitude.toString()}. Apply it to ${rate} per hour, then account for the overtime hours.`
        : "Use the multiplier for an ordinary working day. Enter it as a decimal, not a percentage. The ten extra hours do not choose the multiplier—the kind of day does.",
    ],
    pay: [
      "Extra hours, not the whole month",
      "Your answer pays for the overtime hours only. Do not add regular monthly earnings. Multiply the hourly rate by the applicable multiplier and by all 10 overtime hours.",
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
  function open(part: ApplyPart, target: HTMLElement, pin = false) {
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
                Array.from({ length: 10 }, (_, n) => (
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
                      ? "Ordinary working day"
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
                        ? "not total monthly earnings"
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
