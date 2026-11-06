/** Runtime primitives for decorative navigation motion. Nothing here reads or
 * writes Session state: a run only ever removes its own overlay. */

export type MotionMode = "full" | "reduced" | "off";

const reduceQuery = "(prefers-reduced-motion: reduce)";

/** "off" where the platform cannot animate (jsdom, very old WebViews):
 * navigation is then exactly as it was, with no overlay at all. */
export function motionMode(): MotionMode {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    typeof Element === "undefined" ||
    typeof Element.prototype.animate !== "function"
  )
    return "off";
  return window.matchMedia(reduceQuery).matches ? "reduced" : "full";
}

export type Rect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export function rectOf(element: Element | null | undefined): Rect | null {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Keeps a target rect on screen so a fold or return always lands visibly. */
export function clampRect(rect: Rect | null, w: number, h: number): Rect {
  if (!rect) {
    const width = Math.min(w * 0.36, 220);
    const height = width * (4 / 3);
    return {
      left: (w - width) / 2,
      top: (h - height) / 2,
      width,
      height,
    };
  }
  const width = Math.min(rect.width, w);
  const height = Math.min(rect.height, h);
  return {
    left: Math.max(0, Math.min(rect.left, w - width)),
    top: Math.max(0, Math.min(rect.top, h - height)),
    width,
    height,
  };
}

export function insetOf(rect: Rect, w: number, h: number, radius = 0) {
  const t = Math.max(0, rect.top);
  const l = Math.max(0, rect.left);
  const r = Math.max(0, w - rect.left - rect.width);
  const b = Math.max(0, h - rect.top - rect.height);
  return `inset(${t}px ${r}px ${b}px ${l}px round ${radius}px)`;
}

/** One transition run: every animation and timer it starts, and a single
 * idempotent finish. Cancelling never waits on an animation event. */
export class MotionRun {
  private animations: Animation[] = [];
  private timers: number[] = [];
  private finished = false;
  constructor(private readonly onFinish: () => void) {}

  get done() {
    return this.finished;
  }

  animate(
    element: Element | null | undefined,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation | null {
    if (!element || this.finished) return null;
    try {
      const animation = element.animate(keyframes, {
        fill: "both",
        ...options,
      });
      this.animations.push(animation);
      return animation;
    } catch {
      return null;
    }
  }

  at(ms: number, callback: () => void) {
    if (this.finished) return;
    this.timers.push(
      window.setTimeout(() => {
        if (!this.finished) callback();
      }, ms),
    );
  }

  /** Ends the run now, from any state: completion, skip, interruption. */
  finish = () => {
    if (this.finished) return;
    this.dispose();
    this.onFinish();
  };

  dispose() {
    this.finished = true;
    for (const timer of this.timers) window.clearTimeout(timer);
    for (const animation of this.animations) {
      try {
        animation.cancel();
      } catch {
        /* already gone */
      }
    }
    this.timers = [];
    this.animations = [];
  }
}

/** Any of these ends a run immediately, so a transition layer can never
 * remain over the interface: a key press (the learner acts; the key is not
 * consumed), backgrounding, resizing or a change to reduced motion. */
export function watchInterruptions(finish: () => void): () => void {
  const onKey = () => finish();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") finish();
  };
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(reduceQuery)
      : null;
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", finish);
  document.addEventListener("visibilitychange", onVisibility);
  media?.addEventListener?.("change", finish);
  return () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", finish);
    document.removeEventListener("visibilitychange", onVisibility);
    media?.removeEventListener?.("change", finish);
  };
}

let sheetCache: Readonly<{ count: number; sheets: CSSStyleSheet[] }> | null =
  null;

function ruleText(rules: CSSRuleList): string {
  let text = "";
  for (const rule of Array.from(rules)) {
    if (typeof CSSImportRule !== "undefined" && rule instanceof CSSImportRule) {
      if (rule.styleSheet) text += ruleText(rule.styleSheet.cssRules);
      continue;
    }
    text += `${rule.cssText}\n`;
  }
  return text;
}

/** The document's styles as constructable sheets, so a still copy of the
 * departing screen can render inside a closed shadow root. */
function documentSheets(): CSSStyleSheet[] | null {
  if (
    typeof CSSStyleSheet === "undefined" ||
    !("adoptedStyleSheets" in Document.prototype) ||
    typeof CSSStyleSheet.prototype.replaceSync !== "function"
  )
    return null;
  const list = Array.from(document.styleSheets);
  if (sheetCache && sheetCache.count === list.length) return sheetCache.sheets;
  const sheets = list.map((source) => {
    const sheet = new CSSStyleSheet();
    let text = "";
    try {
      text = ruleText(source.cssRules);
    } catch {
      /* unreadable sheet: skip */
    }
    try {
      sheet.replaceSync(text);
    } catch {
      /* invalid in this context: skip */
    }
    return sheet;
  });
  sheetCache = { count: list.length, sheets };
  return sheets;
}

export type Still = Readonly<{
  /** Detached static copy of the departing shell. */
  node: HTMLElement;
  /** Where the shell sat in the viewport when it departed. */
  rect: Rect;
  sheets: CSSStyleSheet[];
}>;

/** Captures the departing screen before React replaces it. */
export function captureStill(shell: HTMLElement): Still | null {
  const sheets = documentSheets();
  if (!sheets) return null;
  const r = shell.getBoundingClientRect();
  const node = shell.cloneNode(true) as HTMLElement;
  for (const el of Array.from(node.querySelectorAll("[autofocus]")))
    el.removeAttribute("autofocus");
  return {
    node,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    sheets,
  };
}

/** Mounts a still inside a closed shadow root: it renders exactly like the
 * screen it copies, yet no query, id lookup or assistive technology sees it. */
export function mountStill(host: HTMLElement, still: Still) {
  const root = host.attachShadow({ mode: "closed" });
  root.adoptedStyleSheets = still.sheets;
  const frame = document.createElement("div");
  frame.style.cssText = `position:absolute;left:${still.rect.left}px;top:${still.rect.top}px;width:${still.rect.width}px;`;
  frame.append(still.node);
  root.append(frame);
}
