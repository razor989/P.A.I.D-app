import { Component, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import type { CompetencySummary, Destination } from "../shell/public";
import { CompetencyArt } from "../destinations/art/CompetencyArt";
import {
  ActivityCoverArt,
  coverPalette,
} from "../destinations/art/ActivityCoverArt";
import { competencyStories } from "../destinations/content";
import { destinationIdentity, planTransition, worldOf } from "./plan";
import type { TransitionPlan } from "./plan";
import {
  MotionRun,
  captureStill,
  clampRect,
  insetOf,
  motionMode,
  mountStill,
  rectOf,
  watchInterruptions,
} from "./runtime";
import type { MotionMode, Rect, Still } from "./runtime";
import styles from "./transitions.module.css";

type StageProps = Readonly<{
  destination: Destination;
  competencies: readonly CompetencySummary[];
  /** The shell element whose departing state is copied. */
  shell: RefObject<HTMLElement | null>;
  children: ReactNode;
}>;

type Capture = Readonly<{
  still: Still;
  origin: Rect | null;
  mode: MotionMode;
  from: Destination;
}>;

type Run = Readonly<{ key: number; plan: TransitionPlan; capture: Capture }>;

/** Where the learner's selection sat on the departing screen. */
function originOf(shell: HTMLElement, from: Destination, to: Destination) {
  if (from.kind === "competency" && to.kind === "activity")
    // The destination's own cover (after an unfinished-activity choice it
    // need not be the featured one); the featured cover only as a fallback.
    return rectOf(
      shell.querySelector(`[data-cover="${to.activityId}"] svg`) ??
        shell.querySelector('[data-cover][aria-checked="true"] svg'),
    );
  const active = document.activeElement;
  const origin =
    active && shell.contains(active)
      ? active.closest("[data-motion-origin]")
      : null;
  return rectOf(origin);
}

/** Decorates real destination changes. The Session has always moved
 * already: this component only notices that it did (the departing DOM is
 * still on screen in getSnapshotBeforeUpdate) and lays a short-lived,
 * aria-hidden overlay over the hand-off. No change, no motion — so a
 * rejected move, a local Back step or the unfinished-activity choice never
 * pretends a new screen opened. */
export class TransitionStage extends Component<
  StageProps,
  { run: Run | null }
> {
  override state: { run: Run | null } = { run: null };
  private count = 0;

  override getSnapshotBeforeUpdate(previous: StageProps): Capture | null {
    if (
      destinationIdentity(previous.destination) ===
      destinationIdentity(this.props.destination)
    )
      return null;
    const mode = motionMode();
    const shell = this.props.shell.current;
    if (mode === "off" || !shell) return null;
    try {
      const still = captureStill(shell);
      if (!still) return null;
      return {
        still,
        origin: originOf(shell, previous.destination, this.props.destination),
        mode,
        from: previous.destination,
      };
    } catch {
      return null;
    }
  }

  override componentDidUpdate(
    _props: StageProps,
    _state: unknown,
    capture: Capture | null,
  ) {
    if (!capture) return;
    const plan = planTransition(
      capture.from,
      this.props.destination,
      this.props.competencies,
    );
    if (!plan) return;
    this.count += 1;
    // A newer change replaces (and so cleans up) any run still playing.
    this.setState({ run: { key: this.count, plan, capture } });
  }

  private readonly done = (key: number) =>
    this.setState((s) => (s.run?.key === key ? { run: null } : null));

  override render() {
    const { run } = this.state;
    return (
      <>
        {this.props.children}
        {run &&
          createPortal(
            <TransitionOverlay key={run.key} run={run} onDone={this.done} />,
            document.body,
          )}
      </>
    );
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const ease = {
  /** Expressive settle with a whisper of overshoot. */
  settle: "cubic-bezier(.2,.9,.3,1.06)",
  glide: "cubic-bezier(.7,0,.2,1)",
  away: "cubic-bezier(.55,0,.8,.25)",
  pull: "cubic-bezier(.5,0,.75,0)",
};

function TransitionOverlay({
  run,
  onDone,
}: Readonly<{ run: Run; onDone: (key: number) => void }>) {
  const root = useRef<HTMLDivElement>(null);
  const stillHost = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const { plan, capture } = run;
  const family = capture.mode === "reduced" ? "fallback" : plan.family;
  const w = window.innerWidth;
  const h = window.innerHeight;

  useLayoutEffect(() => {
    const host = stillHost.current;
    if (host && !mounted.current) {
      mounted.current = true;
      try {
        mountStill(host, capture.still);
      } catch {
        /* no still: the overlay simply starts from its own layers */
      }
    }
    const motion = new MotionRun(() => onDone(run.key));
    const stop = watchInterruptions(motion.finish);
    const node = root.current;
    const total = node
      ? family === "accordion"
        ? accordion(motion, node, plan, capture.origin, w, h)
        : family === "chapter"
          ? chapter(motion, node, plan, capture.origin, w, h)
          : fallback(motion, node, capture.mode)
      : 0;
    motion.at(total, motion.finish);
    // Belt and braces: the layer always goes, even if a timer is throttled.
    motion.at(total + 400, motion.finish);
    return () => {
      stop();
      motion.dispose();
    };
    // One run per mount; the key changes for every new transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={root}
      className={styles.stage}
      data-paid-transition={family}
      data-direction={plan.direction}
      aria-hidden="true"
      // Not inert: an inert layer is not hit-tested, so presses would fall
      // through to the obscured screen. The layer catches the press itself
      // (it never reaches the controls underneath) and ends the run.
      onPointerDown={() => {
        onDone(run.key);
      }}
    >
      {/* The copied screen keeps its buttons: inert keeps them out of focus. */}
      <div ref={stillHost} className={styles.still} data-part="still" inert />
      {family === "accordion" && <AccordionLayers plan={plan} w={w} h={h} />}
      {family === "chapter" && <ChapterLayers plan={plan} w={w} h={h} />}
    </div>
  );
}

function hideStill(node: HTMLElement) {
  const still = node.querySelector<HTMLElement>('[data-part="still"]');
  if (still) still.style.visibility = "hidden";
}

function fallback(motion: MotionRun, node: HTMLElement, mode: MotionMode) {
  // Non-spatial: the departing screen simply gives way.
  const duration = mode === "reduced" ? 140 : 220;
  motion.animate(
    node.querySelector('[data-part="still"]'),
    [{ opacity: 1 }, { opacity: 0 }],
    { duration, easing: "ease-out" },
  );
  return duration;
}

/* ───────────────────── Accordion Unfold / Fold ───────────────────── */

function accordionGeometry(w: number, h: number) {
  const axis: "x" | "y" = w >= h * 0.9 ? "x" : "y";
  const count = axis === "x" ? 5 : 4;
  const size = (axis === "x" ? w : h) / count;
  return { axis, count, size };
}

function AccordionLayers({
  plan,
  w,
  h,
}: Readonly<{ plan: TransitionPlan; w: number; h: number }>) {
  const { axis, count, size } = accordionGeometry(w, h);
  const world = worldOf(plan.competencyId);
  const story = plan.competencyId
    ? competencyStories[plan.competencyId]
    : undefined;
  const vars = {
    "--world": world.world,
    "--world-deep": world.deep,
    "--world-soft": world.soft,
    "--world-wash": world.wash,
    "--world-art": world.art,
  } as CSSProperties;
  return (
    <div className={styles.fold} data-part="fold" data-axis={axis} style={vars}>
      {range(count).map((i) => (
        <div
          key={i}
          className={styles.panel}
          data-part="panel"
          data-face={i % 2}
          style={
            axis === "x"
              ? {
                  left: i * size,
                  width: size + 2,
                  height: h,
                  transformOrigin: i % 2 ? "right center" : "left center",
                }
              : {
                  top: i * size,
                  height: size + 2,
                  width: w,
                  transformOrigin: i % 2 ? "center bottom" : "center top",
                }
          }
        >
          <div
            className={styles.sheet}
            style={{
              width: w,
              height: h,
              left: axis === "x" ? -i * size : 0,
              top: axis === "y" ? -i * size : 0,
            }}
          >
            <span className={styles.sheetBand} />
            {plan.competencyId && (
              <CompetencyArt
                id={plan.competencyId}
                className={styles.sheetArt}
              />
            )}
            <span className={styles.sheetType}>
              <span className={styles.sheetKicker}>
                Competency · Four activities
              </span>
              <span className={styles.sheetNumber}>
                {story?.number ?? plan.competencyId}
              </span>
              <span className={styles.sheetHeadline}>{story?.headline}</span>
            </span>
          </div>
          <span className={styles.shade} data-part="shade" />
        </div>
      ))}
    </div>
  );
}

function accordion(
  motion: MotionRun,
  node: HTMLElement,
  plan: TransitionPlan,
  origin: Rect | null,
  w: number,
  h: number,
) {
  const { axis, count, size } = accordionGeometry(w, h);
  const fold = node.querySelector<HTMLElement>('[data-part="fold"]');
  const panels = Array.from(
    node.querySelectorAll<HTMLElement>('[data-part="panel"]'),
  );
  const shades = Array.from(
    node.querySelectorAll<HTMLElement>('[data-part="shade"]'),
  );
  const span = axis === "x" ? w : h;
  const translate = axis === "x" ? "translateX" : "translateY";
  const rotate = axis === "x" ? "rotateY" : "rotateX";
  const angle = (i: number) =>
    i === 0 ? 0 : (i % 2 ? -86 : 86) * (axis === "x" ? 1 : -1);
  /** Panel i folded flat against position `at` (the hinge line). */
  const folded = (i: number, at: number) =>
    `${translate}(${at - i * size}px) ${rotate}(${angle(i)}deg)`;
  const open = `${translate}(0px) ${rotate}(0deg)`;
  const rest = (i: number) => (i % 2 ? 0.1 : 0);
  const edge = span - size;
  const full = "inset(0px 0px 0px 0px round 0px)";

  if (plan.direction === "forward") {
    // A: the selected card turns into the publication's cover.
    const seed = clampRect(origin, w, h);
    const at = Math.max(0, Math.min(axis === "x" ? seed.left : seed.top, edge));
    motion.animate(
      fold,
      [{ clipPath: insetOf(seed, w, h, 18) }, { clipPath: full }],
      {
        duration: 400,
        easing: ease.glide,
      },
    );
    // B–C: connected panels unfold from the card, one hinge after another.
    panels.forEach((panel, i) => {
      const timing = { duration: 260, delay: 40 + i * 30, easing: ease.settle };
      motion.animate(
        panel,
        [{ transform: folded(i, at) }, { transform: open }],
        timing,
      );
      motion.animate(
        shades[i],
        [{ opacity: 0.5 }, { opacity: rest(i) }],
        timing,
      );
    });
    const covered = 40 + (count - 1) * 30 + 260;
    motion.at(covered, () => hideStill(node));
    // D: the publication opens onto the gallery, folding off the far edge.
    panels.forEach((panel, i) => {
      const timing: KeyframeAnimationOptions = {
        duration: 180,
        delay: covered + (count - 1 - i) * 20,
        easing: ease.away,
        fill: "forwards",
      };
      motion.animate(
        panel,
        [{ transform: open }, { transform: folded(i, edge) }],
        timing,
      );
      motion.animate(
        shades[i],
        [{ opacity: rest(i) }, { opacity: 0.55 }],
        timing,
      );
    });
    return covered + (count - 1) * 20 + 180;
  }

  // Fold back: the same panels unfold in mirror from the far edge…
  panels.forEach((panel, i) => {
    const timing = {
      duration: 260,
      delay: 30 + (count - 1 - i) * 35,
      easing: ease.settle,
    };
    motion.animate(
      panel,
      [{ transform: folded(i, edge) }, { transform: open }],
      timing,
    );
    motion.animate(shades[i], [{ opacity: 0.5 }, { opacity: rest(i) }], timing);
  });
  const covered = 30 + (count - 1) * 35 + 260;
  // …then close into the card the learner opened it from.
  motion.at(covered, () => {
    hideStill(node);
    const competency = plan.competencyId;
    const target = clampRect(
      rectOf(
        competency
          ? document.querySelector(`[data-competency="${competency}"]`)
          : null,
      ),
      w,
      h,
    );
    const at = Math.max(
      0,
      Math.min(axis === "x" ? target.left : target.top, edge),
    );
    motion.animate(
      fold,
      [{ clipPath: full }, { clipPath: insetOf(target, w, h, 18) }],
      {
        duration: 280,
        easing: ease.glide,
        fill: "forwards",
      },
    );
    panels.forEach((panel, i) => {
      const timing: KeyframeAnimationOptions = {
        duration: 260,
        delay: (count - 1 - i) * 18,
        easing: ease.glide,
        fill: "forwards",
      };
      motion.animate(
        panel,
        [{ transform: open }, { transform: folded(i, at) }],
        timing,
      );
      motion.animate(
        shades[i],
        [{ opacity: rest(i) }, { opacity: 0.45 }],
        timing,
      );
    });
    motion.animate(fold, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 90,
      delay: 230,
      easing: "ease-out",
      fill: "forwards",
    });
  });
  return covered + 330;
}

/* ─────────────────── Tear-Away Chapter / Chapter Return ─────────────────── */

function chapterGeometry(w: number, h: number) {
  const height = Math.min(h * 0.84, w * 0.84 * (4 / 3));
  const width = height * 0.75;
  const cover: Rect = {
    left: (w - width) / 2,
    top: (h - height) / 2,
    width,
    height,
  };
  // A torn, slightly diagonal seam: from 58% across the top edge to 40%
  // across the bottom, with small alternating teeth along its length.
  const teeth = Math.max(10, Math.round(h / 34));
  const seam: [number, number][] = [];
  for (let k = 0; k <= teeth; k++) {
    const t = k / teeth;
    const x =
      w * (0.58 - 0.18 * t) +
      (k % 2 ? 7 : -7) * (k === 0 || k === teeth ? 0 : 1);
    seam.push([x, -2 + t * (h + 4)]);
  }
  const points = (list: [number, number][]) =>
    list.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ");
  const left = points([
    [-4, -4],
    ...seam.map(([x, y]): [number, number] => [x + 1, y]),
    [-4, h + 4],
  ]);
  const right = points([...seam, [w + 4, h + 4], [w + 4, -4]]);
  return {
    cover,
    clipA: `polygon(${left})`,
    clipB: `polygon(${right})`,
    seam: seam.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
  };
}

function ChapterLayers({
  plan,
  w,
  h,
}: Readonly<{ plan: TransitionPlan; w: number; h: number }>) {
  const chapter = plan.chapter;
  if (!chapter) return null;
  const { cover, clipA, clipB, seam } = chapterGeometry(w, h);
  const palette = coverPalette(chapter.competencyId, chapter.step);
  const ground = `linear-gradient(168deg, ${palette.top} 0%, ${palette.bottom} 100%)`;
  return (
    <div className={styles.wrap} data-part="wrap">
      {(["a", "b"] as const).map((part) => (
        <div
          key={part}
          className={styles.half}
          data-part={part}
          style={{ clipPath: part === "a" ? clipA : clipB, background: ground }}
        >
          <span className={styles.grain} />
          <div
            className={styles.cover}
            data-part="cover"
            style={{
              left: cover.left,
              top: cover.top,
              width: cover.width,
              height: cover.height,
            }}
          >
            <ActivityCoverArt
              competency={chapter.competencyId}
              step={chapter.step}
              number={chapter.number}
              title={chapter.label}
              fit="meet"
            />
          </div>
        </div>
      ))}
      <svg
        className={styles.perf}
        data-part="perf"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        focusable="false"
      >
        <polyline
          points={seam}
          fill="none"
          stroke={palette.ink}
          strokeOpacity="0.6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0.5 9"
        />
      </svg>
      <span
        className={styles.stub}
        data-part="stub"
        style={{ background: palette.bottom, color: palette.ink }}
      />
    </div>
  );
}

function coverTransform(from: Rect, to: Rect) {
  const s = from.width / to.width;
  const dx = from.left - to.left;
  const dy = from.top + from.height / 2 - (to.top + (to.height * s) / 2);
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}

function chapter(
  motion: MotionRun,
  node: HTMLElement,
  plan: TransitionPlan,
  origin: Rect | null,
  w: number,
  h: number,
) {
  const { cover } = chapterGeometry(w, h);
  const wrap = node.querySelector<HTMLElement>('[data-part="wrap"]');
  const a = node.querySelector<HTMLElement>('[data-part="a"]');
  const b = node.querySelector<HTMLElement>('[data-part="b"]');
  const covers = Array.from(
    node.querySelectorAll<HTMLElement>('[data-part="cover"]'),
  );
  const perf = node.querySelector('[data-part="perf"]');
  const stub = node.querySelector('[data-part="stub"]');
  const full = "inset(0px 0px 0px 0px round 0px)";
  const tornA = `translate(${-0.34 * w}px, ${-1.08 * h}px) rotate(-13deg)`;
  const tornB = `translate(${0.3 * w}px, ${1.08 * h}px) rotate(9deg)`;

  if (plan.direction === "forward") {
    // A–B: the chosen cover lifts and grows into the chapter sheet.
    const seed = clampRect(origin, w, h);
    const lift = { duration: 300, easing: ease.glide };
    motion.animate(
      wrap,
      [{ clipPath: insetOf(seed, w, h, 10) }, { clipPath: full }],
      lift,
    );
    for (const c of covers)
      motion.animate(
        c,
        [{ transform: coverTransform(seed, cover) }, { transform: "none" }],
        lift,
      );
    motion.at(300, () => hideStill(node));
    // C: perforation, a small pull, then the sheet tears away.
    motion.animate(
      perf,
      [
        { opacity: 0, clipPath: "inset(0px 0px 100% 0px)" },
        { opacity: 1, clipPath: "inset(0px 0px 0% 0px)" },
      ],
      { duration: 120, delay: 260, easing: "ease-out" },
    );
    motion.animate(perf, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 80,
      delay: 400,
      fill: "forwards",
    });
    const tear = (to: string, nudge: string, delay: number) => ({
      keyframes: [
        { transform: "none", easing: "ease-out" },
        { transform: nudge, offset: 0.2, easing: ease.pull },
        { transform: to },
      ],
      options: { duration: 320, delay },
    });
    const ta = tear(tornA, "translate(-5px, -4px) rotate(-0.8deg)", 330);
    const tb = tear(tornB, "translate(4px, 3px) rotate(0.5deg)", 360);
    motion.animate(a, ta.keyframes, ta.options);
    motion.animate(b, tb.keyframes, tb.options);
    motion.animate(
      stub,
      [{ transform: "translateX(0)" }, { transform: "translateX(-110%)" }],
      {
        duration: 180,
        delay: 380,
        easing: ease.away,
      },
    );
    // D–E: the lesson is already live beneath; the run then removes itself.
    return 680;
  }

  // Chapter Return: the torn halves swing back together over the lesson…
  motion.animate(a, [{ transform: tornA }, { transform: "none" }], {
    duration: 300,
    easing: ease.settle,
  });
  motion.animate(b, [{ transform: tornB }, { transform: "none" }], {
    duration: 300,
    delay: 30,
    easing: ease.settle,
  });
  motion.animate(
    stub,
    [{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }],
    {
      duration: 200,
      delay: 120,
      easing: ease.settle,
    },
  );
  motion.animate(
    perf,
    [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
    {
      duration: 420,
    },
  );
  // …and the sealed chapter cover settles back into its place.
  motion.at(340, () => {
    hideStill(node);
    const chapterId = plan.chapter?.activityId;
    const target = clampRect(
      rectOf(
        (chapterId &&
          document.querySelector(`[data-cover="${chapterId}"] svg`)) ||
          (plan.competencyId &&
            document.querySelector(
              `[data-competency="${plan.competencyId}"]`,
            )) ||
          null,
      ),
      w,
      h,
    );
    const settle: KeyframeAnimationOptions = {
      duration: 280,
      easing: ease.glide,
      fill: "forwards",
    };
    motion.animate(
      wrap,
      [{ clipPath: full }, { clipPath: insetOf(target, w, h, 10) }],
      settle,
    );
    for (const c of covers)
      motion.animate(
        c,
        [{ transform: "none" }, { transform: coverTransform(target, cover) }],
        settle,
      );
    motion.animate(stub, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 120,
      fill: "forwards",
    });
    motion.animate(wrap, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 80,
      delay: 220,
      easing: "ease-out",
      fill: "forwards",
    });
  });
  return 340 + 310;
}
