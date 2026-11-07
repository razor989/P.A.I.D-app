import type { InspectionSound } from "../../audio/public";
/** Presentation-only supplemental lessons. No source/assessment/Session callbacks. */
export type SalaryPart = "original" | "addition" | "total";
type ExplorationLessons = Record<
  SalaryPart,
  {
    title: string;
    copy: string;
    equation: string;
    labels: readonly [string, string];
  }
>;
const lessons = {
  original: {
    title: "Which whole are we measuring against?",
    copy: "The raise is compared with where the salary started. Using the final salary would answer a different comparison: the addition’s share of the total.",
    equation: "₱2,000 ÷ ₱20,000 = 1/10",
    labels: [
      "Starting whole · ₱20,000",
      "The addition is measured against this whole",
    ],
  },
  addition: {
    title: "One addition. One of ten equal parts.",
    copy: "An outline copy of ₱2,000 matches one tenth of ₱20,000. The original stays intact: this is a comparison, not money taken away.",
    equation: "₱2,000 × 10 = ₱20,000",
    labels: [
      "Ten equal parts make the original",
      "A copy matches one part · no money removed",
    ],
  },
  total: {
    title: "The total includes the starting salary.",
    copy: "Only the gold addition is the increase. The green original was already there. Together they make 110% of the starting whole—not a 110% increase.",
    equation: "100% original + 10% increase = 110% total",
    labels: ["100% original", "+10% increase → 110% total"],
  },
} as const;

export const explorationMarkup = `<aside class="story-callout" id="employee-a-inspection" aria-labelledby="employee-a-inspection-title" hidden>
  <header><span class="story-kicker">A CLOSER LOOK</span><button type="button" data-explore-close aria-label="Close supplemental explanation">×</button></header>
  <h3 id="employee-a-inspection-title"></h3>
  <svg class="explore-diagram" viewBox="0 0 300 118" role="img" aria-label="">
    <text x="8" y="17" data-mini-label></text>
    <rect class="mini-original" x="8" y="32" width="240" height="32" rx="3"/>
    <g class="mini-divisions">${Array.from({ length: 9 }, (_, i) => `<path d="M${32 + i * 24} 32v32"/>`).join("")}</g>
    <g class="mini-add"><rect x="254" y="32" width="24" height="32" rx="2"/></g>
    <rect class="mini-copy" x="8" y="32" width="24" height="32"/>
    <path class="mini-reference" d="M8 72v7h240v-7"/>
    <text x="8" y="103" data-mini-result></text>
  </svg><p class="mini-equation"></p><p class="mini-copy-text"></p>
  <footer><span>Explore the model · keep the whole in view</span><button type="button" data-explore-replay aria-label="Replay supplemental diagram">↺</button></footer>
</aside>`;

/** Returns a viewport-contained placement that never intersects the main model. */
export function placeExploration(
  point: { x: number; y: number },
  model: { left: number; right: number; top: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const margin = 12,
    gap = 18;
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
  const candidates = [
    { x: Math.max(point.x + gap, model.right + gap), y: point.y - 48 },
    {
      x: Math.min(point.x - panel.width - gap, model.left - panel.width - gap),
      y: point.y - 48,
    },
    { x: point.x + gap, y: model.bottom + gap },
    { x: point.x + gap, y: model.top - panel.height - gap },
  ];
  if (viewport.width < 720) return null;
  for (const candidate of candidates) {
    const x = clamp(candidate.x, margin, viewport.width - panel.width - margin);
    const y = clamp(
      candidate.y,
      margin,
      viewport.height - panel.height - margin,
    );
    if (
      x < margin ||
      y < margin ||
      x + panel.width > viewport.width - margin ||
      y + panel.height > viewport.height - margin
    )
      continue;
    if (
      x + panel.width <= model.left - gap ||
      x >= model.right + gap ||
      y + panel.height <= model.top - gap ||
      y >= model.bottom + gap
    )
      return { x, y };
  }
  return null;
}

export function createSalaryExploration(
  root: HTMLElement,
  options: {
    pause: () => void;
    blocked: () => boolean;
    reduced: () => boolean;
    announce: (text: string) => void;
    lessons?: ExplorationLessons | undefined;
    copyDistance?: number;
    /** Decorative sound for opening, closing and the mini-animation. */
    sound?: InspectionSound | undefined;
  },
) {
  const content = options.lessons ?? lessons;
  const panel = root.querySelector<HTMLElement>(".story-callout")!;
  let trigger: HTMLElement | SVGElement | null = null;
  let active: SalaryPart | null = null,
    pinned = false,
    suppressed = false;
  let hover: ReturnType<typeof setTimeout> | undefined,
    dismiss: ReturnType<typeof setTimeout> | undefined,
    hold: ReturnType<typeof setTimeout> | undefined;
  let animation: number | undefined,
    started = 0,
    point = { x: 0, y: 0 };
  let touching = false,
    held = false;
  const controller = new AbortController();
  const signal = controller.signal;
  const target = (event: Event) =>
    (event.target as Element).closest<HTMLElement | SVGElement>(
      "[data-explore]",
    );
  const cancelMotion = () => {
    if (animation !== undefined) cancelAnimationFrame(animation);
    animation = undefined;
  };
  // True only during an animated run whose copy slide is still to land.
  let copyPending = false;
  function project(progress: number) {
    const eased = progress * progress * (3 - 2 * progress);
    if (copyPending && eased >= 0.95) {
      copyPending = false;
      options.sound?.("piece", { index: 4 });
    }
    const copy = panel.querySelector<SVGElement>(".mini-copy")!;
    copy.setAttribute(
      "transform",
      `translate(${((options.copyDistance ?? 246) * (1 - eased)).toFixed(3)} 0)`,
    );
    panel.querySelector<SVGElement>(".mini-reference")!.style.strokeDasharray =
      "260";
    panel.querySelector<SVGElement>(".mini-reference")!.style.strokeDashoffset =
      String(260 * (1 - eased));
    panel
      .querySelector<SVGElement>(".mini-add")!
      .setAttribute(
        "transform",
        `translate(${(18 * (1 - eased)).toFixed(3)} 0)`,
      );
    panel.dataset.settled = String(progress === 1);
  }
  function replay() {
    cancelMotion();
    copyPending = false;
    if (options.reduced()) {
      project(1);
      return;
    }
    // The reference line draws; a copied amount slides home as it ends.
    options.sound?.("draw");
    copyPending = (options.copyDistance ?? 246) > 0;
    started = performance.now();
    project(0);
    const tick = () => {
      const progress = Math.min(1, (performance.now() - started) / 1400);
      project(progress);
      if (progress < 1 && !panel.hidden)
        animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }
  function position() {
    if (panel.hidden) return;
    const model = root
      .querySelector<HTMLElement>(".story-salary")!
      .getBoundingClientRect();
    // Measure without changing document layout. The fallback slot is reserved in CSS.
    panel.dataset.placement = "floating";
    const bounds = panel.getBoundingClientRect();
    const placement = placeExploration(point, model, bounds, {
      width: innerWidth,
      height: innerHeight,
    });
    if (placement) {
      panel.style.left = `${placement.x}px`;
      panel.style.top = `${placement.y}px`;
    } else {
      panel.dataset.placement = "companion";
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
    }
  }
  function close(restore = false, quiet = false) {
    if (!quiet && !panel.hidden && active) options.sound?.("close");
    copyPending = false;
    clearTimeout(hover);
    clearTimeout(dismiss);
    clearTimeout(hold);
    cancelMotion();
    const previous = trigger;
    active = null;
    pinned = false;
    panel.hidden = true;
    root
      .querySelectorAll("[data-explore]")
      .forEach((element) => element.setAttribute("aria-expanded", "false"));
    if (restore && previous?.isConnected) {
      suppressed = true;
      previous.focus({ preventScroll: true });
      suppressed = false;
    }
  }
  function open(element: HTMLElement | SVGElement, pin = false) {
    if (
      options.blocked() ||
      element.getAttribute("aria-disabled") === "true" ||
      element.closest("[hidden]")
    )
      return;
    const part = element.dataset.explore as SalaryPart;
    if (!(part in content)) return;
    clearTimeout(dismiss);
    clearTimeout(hover);
    options.pause();
    const changed = active !== part;
    const wasOpen = !panel.hidden && active !== null;
    if (pin) {
      if (!(pinned && !changed)) options.sound?.("pin");
    } else if (!wasOpen) options.sound?.("open");
    else if (changed) options.sound?.("switch");
    trigger = element;
    active = part;
    pinned = pin || pinned;
    panel.hidden = false;
    panel.dataset.part = part;
    root
      .querySelectorAll<HTMLElement>("[data-explore]")
      .forEach((item) =>
        item.setAttribute(
          "aria-expanded",
          String(item.dataset.explore === part),
        ),
      );
    if (changed) {
      const lesson = content[part];
      panel.querySelector("h3")!.textContent = lesson.title;
      panel.querySelector(".mini-copy-text")!.textContent = lesson.copy;
      panel.querySelector(".mini-equation")!.textContent = lesson.equation;
      panel.querySelector("[data-mini-label]")!.textContent = lesson.labels[0];
      panel.querySelector("[data-mini-result]")!.textContent = lesson.labels[1];
      panel
        .querySelector("svg")!
        .setAttribute(
          "aria-label",
          `${lesson.labels.join(". ")}. ${lesson.equation}`,
        );
      options.announce(`${lesson.title} ${lesson.copy}`);
      replay();
    }
    position();
  }
  const laterClose = () => {
    clearTimeout(dismiss);
    if (!pinned)
      dismiss = setTimeout(() => {
        if (
          trigger?.matches(":hover") ||
          panel.matches(":hover") ||
          panel.contains(document.activeElement) ||
          trigger === document.activeElement
        )
          return;
        close();
      }, 280);
  };
  root.addEventListener(
    "pointerover",
    (event) => {
      if (event.pointerType === "touch" || pinned) return;
      const element = target(event);
      if (!element || element.contains(event.relatedTarget as Node)) return;
      clearTimeout(dismiss);
      clearTimeout(hover);
      point = { x: event.clientX, y: event.clientY };
      hover = setTimeout(() => open(element), 180);
    },
    { signal },
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      const element = target(event);
      if (element && (!pinned || element === trigger)) {
        point = { x: event.clientX, y: event.clientY };
        if (active) position();
        else {
          clearTimeout(hover);
          hover = setTimeout(() => open(element), 180);
        }
      }
    },
    { signal },
  );
  root.addEventListener(
    "pointerout",
    (event) => {
      const element = target(event);
      if (!element || element.contains(event.relatedTarget as Node)) return;
      clearTimeout(hover);
      if (panel.contains(event.relatedTarget as Node)) return;
      laterClose();
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      if (suppressed || touching || panel.contains(event.target as Node))
        return;
      const element = target(event);
      if (!element) return;
      const box = element.getBoundingClientRect();
      point = { x: box.right, y: box.top };
      open(element);
    },
    { signal },
  );
  root.addEventListener(
    "focusout",
    (event) => {
      if (
        panel.contains(event.relatedTarget as Node) ||
        target(event)?.contains(event.relatedTarget as Node)
      )
        return;
      laterClose();
    },
    { signal },
  );
  root.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      touching = true;
      held = false;
      const element = target(event);
      if (!element) return;
      point = { x: event.clientX, y: event.clientY };
      clearTimeout(hold);
      hold = setTimeout(() => {
        held = true;
        open(element, true);
      }, 420);
    },
    { signal },
  );
  root.addEventListener(
    "pointerup",
    () => {
      clearTimeout(hold);
      touching = false;
    },
    { signal },
  );
  root.addEventListener(
    "pointercancel",
    () => {
      clearTimeout(hold);
      touching = false;
      held = false;
    },
    { signal },
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      if (
        touching &&
        Math.hypot(event.clientX - point.x, event.clientY - point.y) > 12
      )
        clearTimeout(hold);
    },
    { signal },
  );
  root.addEventListener(
    "click",
    (event) => {
      const element = target(event);
      if (element) {
        event.preventDefault();
        if (held) {
          held = false;
          return;
        }
        if (active === element.dataset.explore && pinned) close();
        else open(element, true);
      }
      if ((event.target as Element).closest("[data-explore-close]"))
        close(true);
      if ((event.target as Element).closest("[data-explore-replay]")) replay();
    },
    { signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
      const element = target(event);
      if (element && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        open(element, true);
      }
    },
    { signal },
  );
  panel.addEventListener("pointerenter", () => clearTimeout(dismiss), {
    signal,
  });
  panel.addEventListener("pointerleave", laterClose, { signal });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        active &&
        !panel.contains(event.target as Node) &&
        !trigger?.contains(event.target as Node)
      )
        close();
    },
    { signal },
  );
  window.addEventListener("resize", position, { signal });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        close(false);
      }
    },
    { signal },
  );
  window.addEventListener("scroll", position, { signal, capture: true });
  return {
    // Closes asked for by the story (a new beat, a block) stay quiet.
    close: (restore = false) => close(restore, true),
    refresh() {
      if (options.blocked()) close(false, true);
      else if (active) {
        if (options.reduced()) {
          cancelMotion();
          project(1);
        }
        position();
      }
    },
    dispose() {
      close(false, true);
      controller.abort();
    },
  };
}
