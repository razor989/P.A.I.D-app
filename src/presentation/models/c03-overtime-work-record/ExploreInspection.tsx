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

export type ExplorePart = "rate" | "hours" | "condition" | "multiplier" | "pay";
const Inspection = createContext<{
  open: (part: ExplorePart, target: HTMLElement, pin?: boolean) => void;
  leave: () => void;
  active: ExplorePart | null;
  id: string;
} | null>(null);
export function Inspectable({
  part,
  children,
  className,
}: {
  part: ExplorePart;
  children: ReactNode;
  className?: string | undefined;
}) {
  const context = useContext(Inspection);
  return (
    <button
      type="button"
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

export function ExploreInspection({
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
    part: ExplorePart;
    target: HTMLElement;
    pinned: boolean;
    left: number;
    top: number;
  } | null>(null);
  const [replay, setReplay] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressFocus = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const math = projection.mathematicalExplanation;
  const rate = pesos(projection.workEvidence.rate.magnitude.toString());
  const facts: Record<ExplorePart, [string, string]> = {
    rate: [
      "The same starting rate",
      `${rate} per hour stays the same in both records. Changing the day does not change this rate.`,
    ],
    hours: [
      "Two extra hours",
      "Each mark is one overtime hour. Both records have two; neither employee works longer in this comparison.",
    ],
    condition: [
      "Which kind of day?",
      "The calendar decides which approved overtime multiplier applies. Change the day and follow its effect on the pay.",
    ],
    multiplier: [
      "Pay for one extra hour",
      math
        ? `For ${math.condition}, multiply the regular hourly rate by ${math.multiplier.magnitude.toString()}. The extra width represents pay, not extra time.`
        : "Identify the kind of day first. Its approved multiplier tells us how overtime pay relates to the regular hourly rate.",
    ],
    pay: [
      "Compare overtime pay",
      "The two bars show payment for the extra hours only. Align their starts, then look at the part extending beyond the shorter bar.",
    ],
  };
  function close(restore = false) {
    clearTimeout(timer.current);
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
  function open(part: ExplorePart, target: HTMLElement, pin = false) {
    if (blocked || suppressFocus.current) return;
    if (active?.pinned && !pin) return;
    clearTimeout(timer.current);
    const show = () => {
      const box = target.getBoundingClientRect();
      setActive({
        part,
        target,
        pinned: pin,
        ...anchorInspection(box, panel.current?.offsetHeight),
      });
      onInspect?.();
    };
    if (pin || target === document.activeElement) show();
    else timer.current = setTimeout(show, 180);
  }
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimeout(timer.current);
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
          >
            <header>
              <h3>{facts[active.part][0]}</h3>
              <button aria-label="Close inspection" onClick={() => close(true)}>
                <ExploreGlyph name="close" />
              </button>
            </header>
            <svg
              key={`${active.part}/${replay}`}
              viewBox="0 0 300 100"
              role="img"
              aria-label={facts[active.part][0]}
            >
              {active.part === "hours" ? (
                [0, 1, 2, 3].map((n) => (
                  <g
                    key={n}
                    transform={`translate(${105 + (n % 2) * 90} ${26 + Math.floor(n / 2) * 48}) scale(.85)`}
                  >
                    <ExploreHourMark />
                  </g>
                ))
              ) : (
                <>
                  <rect
                    x="16"
                    y="20"
                    width="160"
                    height="24"
                    rx="3"
                    fill="#879d65"
                  />
                  <rect
                    x="16"
                    y="60"
                    width="160"
                    height="24"
                    rx="3"
                    fill="#879d65"
                  />
                  <g className={explore.miniExtension}>
                    <rect
                      x="176"
                      y="20"
                      width={active.part === "rate" ? 0 : 40}
                      height="24"
                      fill="#b28248"
                    />
                    <rect
                      x="176"
                      y="60"
                      width={active.part === "rate" ? 0 : 100}
                      height="24"
                      fill="#b28248"
                    />
                  </g>
                  <path d="M16 92h260" stroke="#718951" />
                </>
              )}
            </svg>
            <p>{facts[active.part][1]}</p>
            <footer>
              <button onClick={() => setReplay((value) => value + 1)}>
                <ExploreGlyph name="replay" /> Replay
              </button>
              <button
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
