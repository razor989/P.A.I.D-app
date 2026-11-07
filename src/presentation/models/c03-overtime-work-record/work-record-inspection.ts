/** Narrow local adaptation of C04 employee-exploration: no private imports.
 * Retains placement candidates, hover/dismiss/hold timings, pinning, pause,
 * keyboard and touch semantics. Salary-specific teaching is intentionally absent.
 */
export function placeInspection(
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

export function createWorkRecordInspection(
  root: HTMLElement,
  options: {
    blocked: () => boolean;
    opened: (open: boolean) => void;
    facts: () => readonly { id: string; title: string; copy: string }[];
  },
) {
  const panel = root.querySelector<HTMLElement>("[data-inspection-panel]")!;
  let trigger: HTMLElement | null = null,
    pinned = false,
    suppressed = false;
  let active: string | null = null;
  let hover: ReturnType<typeof setTimeout> | undefined,
    dismiss: ReturnType<typeof setTimeout> | undefined,
    hold: ReturnType<typeof setTimeout> | undefined;
  // Hover intent (§K4.3): the trigger under the pointer, armed only by a
  // real movement, so a new screen under a resting cursor opens nothing.
  let hovering: HTMLElement | null = null;
  let point = { x: 0, y: 0 },
    touching = false,
    held = false;
  const controller = new AbortController(),
    signal = controller.signal;
  const target = (event: Event) =>
    (event.target as Element).closest<HTMLElement>("[data-explore]");
  let animation: number | undefined;
  const motion =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  function cancelMotion() {
    if (animation !== undefined) cancelAnimationFrame(animation);
    animation = undefined;
  }
  function project(progress: number) {
    const eased = progress * progress * (3 - 2 * progress);
    const pieces = panel.querySelectorAll<SVGElement>(
      `[data-diagram="${active}"] [data-mini-piece]`,
    );
    pieces.forEach((piece, index) => {
      const local = Math.max(0, Math.min(1, eased * 1.4 - index * 0.05));
      piece.style.opacity = String(local);
      piece.style.transform = `translateY(${18 * (1 - local)}px)`;
    });
    panel.dataset.settled = String(progress === 1);
  }
  function replay() {
    cancelMotion();
    if (motion?.matches) {
      project(1);
      return;
    }
    const started = performance.now();
    project(0);
    const tick = () => {
      const progress = Math.min(1, (performance.now() - started) / 1400);
      project(progress);
      if (progress < 1 && !panel.hidden)
        animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }
  motion?.addEventListener(
    "change",
    () => {
      cancelMotion();
      if (active) project(1);
    },
    { signal },
  );
  function position() {
    if (panel.hidden) return;
    const model = root
      .querySelector<HTMLElement>("[data-inspection-model]")!
      .getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const placed = placeInspection(point, model, rect, {
      width: innerWidth,
      height: innerHeight,
    });
    panel.dataset.placement = placed ? "floating" : "companion";
    // Accepted narrow fallback is companion placement, not forced model overlap.
    panel.style.left = placed ? `${placed.x}px` : "";
    panel.style.top = placed ? `${placed.y}px` : "";
  }
  function close(restore = false) {
    cancelMotion();
    clearTimeout(hover);
    clearTimeout(dismiss);
    clearTimeout(hold);
    panel.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
    active = null;
    pinned = false;
    options.opened(false);
    if (restore && trigger?.isConnected) {
      suppressed = true;
      trigger.focus({ preventScroll: true });
      suppressed = false;
    }
  }
  function open(element: HTMLElement, pin = false) {
    if (options.blocked() || suppressed) return;
    const fact = options
      .facts()
      .find((item) => item.id === element.dataset.explore);
    if (!fact) return;
    clearTimeout(dismiss);
    trigger?.setAttribute("aria-expanded", "false");
    trigger = element;
    trigger.setAttribute("aria-expanded", "true");
    pinned = pin;
    options.opened(true);
    const changed = active !== fact.id;
    if (changed) {
      active = fact.id;
      panel.querySelector("h4")!.textContent = fact.title;
      panel.querySelector("[data-inspection-copy]")!.textContent = fact.copy;
      panel.setAttribute("aria-label", fact.title);
      panel
        .querySelectorAll<SVGElement>("[data-diagram]")
        .forEach((diagram) => {
          diagram.setAttribute(
            "display",
            diagram.dataset.diagram === active ? "inline" : "none",
          );
        });
    }
    panel.hidden = false;
    if (changed) replay();
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
      hovering = null;
      point = { x: event.clientX, y: event.clientY };
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
      if (pinned || touching || event.pointerType === "touch") return;
      const element = target(event);
      if (element) {
        point = { x: event.clientX, y: event.clientY };
        position();
        if (
          element !== hovering &&
          (event.movementX !== 0 || event.movementY !== 0)
        ) {
          hovering = element;
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
      hovering = null;
      laterClose();
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      const element = target(event);
      if (!element || suppressed || pinned) return;
      const box = element.getBoundingClientRect();
      point = { x: box.right, y: box.top + box.height / 2 };
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
      if ((event.target as Element).closest("[data-inspection-close]"))
        close(true);
      if ((event.target as Element).closest("[data-inspection-replay]"))
        replay();
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
      if (
        element &&
        (event.key === "Enter" || event.key === " ") &&
        element.tagName !== "BUTTON"
      ) {
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
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        close(true);
      }
    },
    { signal },
  );
  window.addEventListener("resize", position, { signal });
  window.addEventListener("scroll", position, { signal, capture: true });
  return {
    close,
    dispose() {
      close();
      controller.abort();
    },
  };
}
