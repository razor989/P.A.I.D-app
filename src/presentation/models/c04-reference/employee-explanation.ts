import { silentReference, storyAccents } from "./story-sound";
import type { ReferenceSound } from "./story-sound";
import {
  createSalaryExploration,
  explorationMarkup,
} from "./employee-exploration";
import {
  employeeBChapters,
  employeeBLessons,
  employeeBExplorationMarkup,
} from "./employee-b-content";
/** Reading time only; mounted by the renderer after authentic source engagement. */
export const employeeStoryDuration = 51;
const chapterDuration = 8.5;
const chapters = [
  {
    title: "Start with one whole",
    captions: [
      "Employee A starts with ₱20,000.",
      "This starting salary is our chosen whole.",
      "Keep that whole intact as we measure the raise.",
    ],
    emphasis: ["₱20,000", "chosen whole", "whole intact"],
    equations: [
      "₱20,000",
      "₱20,000 = one starting salary",
      "Original salary = 100%",
    ],
  },
  {
    title: "Bring in the added money",
    captions: [
      "The raise adds a separate ₱2,000.",
      "The gold block shows only the added money.",
      "On this same peso scale, it is one tenth as wide as the original.",
    ],
    emphasis: ["₱2,000", "only the added money", "same peso scale"],
    equations: [
      "Added money: ₱2,000",
      "Original stays ₱20,000",
      "₱20,000 + ₱2,000",
    ],
  },
  {
    title: "Join the amounts",
    captions: [
      "Bring the addition alongside the original.",
      "Together, they make the new salary of ₱22,000.",
      "The new total includes money that was already there.",
    ],
    emphasis: ["alongside", "₱22,000", "already there"],
    equations: [
      "₱20,000 + ₱2,000",
      "₱20,000 + ₱2,000 = ₱22,000",
      "New total ≠ added money",
    ],
  },
  {
    title: "Measure against the starting whole",
    captions: [
      "Split the original into ten equal parts.",
      "An outline copy of the addition matches one part. No money is removed.",
      "Compare the ₱2,000 addition with the ₱20,000 original: one tenth.",
    ],
    emphasis: ["ten equal parts", "outline copy", "one tenth"],
    equations: [
      "Original ₱20,000 = 10 equal parts",
      "Each part matches ₱2,000",
      "₱2,000 / ₱20,000 = 1/10",
    ],
  },
  {
    title: "Name the same share three ways",
    captions: [
      "One tenth is the same share as 0.10 of the original.",
      "Split each tenth into ten. Our same whole now has 100 equal parts.",
      "The matching share covers ten of those parts: 10% of the original.",
    ],
    emphasis: ["0.10", "100 equal parts", "10%"],
    equations: [
      "1/10 = 0.10",
      "1/10 = 0.10 = 10/100",
      "1/10 = 0.10 = 10/100 = 10%",
    ],
  },
  {
    title: "Keep increase and total separate",
    captions: [
      "Only the added ₱2,000 is the 10% increase.",
      "The original salary is still 100% of the starting whole.",
      "Original plus increase is 110% altogether—not a 110% increase.",
    ],
    emphasis: ["10% increase", "100%", "110% altogether"],
    equations: [
      "₱2,000 increase = 10%",
      "₱20,000 original = 100%",
      "100% original + 10% increase = 110% total",
    ],
  },
] as const;
const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
/** Deterministic display projection: no authoritative salary calculation or assessment. */
export function employeeStoryFrame(seconds: number, reduced = false) {
  const time = Math.max(
    0,
    Math.min(employeeStoryDuration, Number.isFinite(seconds) ? seconds : 0),
  );
  const index = Math.min(5, Math.floor(time / chapterDuration));
  const local = time - index * chapterDuration;
  const cue = local >= 5.5 ? 2 : local >= 2.5 ? 1 : 0;
  const entrance = (start: number, duration = 0.8) =>
    reduced ? 1 : ease((time - start) / duration);
  return {
    time,
    index,
    cue,
    captionProgress: [0, 2.5, 5.5].map((offset) =>
      entrance(index * chapterDuration + offset),
    ),
    equationProgress: entrance(index * chapterDuration + [0, 2.5, 5.5][cue]!),
    originalProgress: entrance(0, 1.2),
    additionProgress: entrance(8.5),
    totalProgress: entrance(19.5),
    tenthsProgress: entrance(25.5),
    addition: time >= 8.5,
    additionX: reduced
      ? time >= 17
        ? 208
        : 236
      : 236 - 28 * ease((time - 17) / 1.2),
    total: time >= 19.5,
    tenths: time >= 25.5,
    match: time >= 28,
    hundred: time >= 36.5,
    hundredProgress: reduced
      ? time >= 36.5
        ? 1
        : 0
      : ease((time - 36.5) / 1.2),
    percent: time >= 39.5,
  };
}
// Heard only while the explanation plays by itself (seconds).
const employeeAccents = storyAccents(
  [
    { at: 8.5, cue: "story.appear" },
    { at: 17, cue: "story.grow" },
    { at: 19.5, cue: "story.appear" },
    { at: 25.5, cue: "story.piece" },
    { at: 28, cue: "story.stamp" },
    { at: 36.5, cue: "story.grow" },
    { at: 39.5, cue: "story.appear" },
  ],
  chapterDuration,
  employeeStoryDuration,
);

export function createEmployeeExplanation(
  announce: (text: string) => void,
  employee: "A" | "B" = "A",
  sound: ReferenceSound = silentReference,
) {
  const isB = employee === "B";
  const storyChapters = isB ? employeeBChapters : chapters;
  const frameAt = (seconds: number, reduced = false) => {
    const frame = employeeStoryFrame(seconds, reduced);
    return isB ? { ...frame, additionX: frame.additionX - 100 } : frame;
  };
  let time = 0,
    playing = false,
    lastTick = 0,
    parentBeat = -1,
    isBlocked = false,
    listening = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let host: HTMLElement | null = null,
    root: HTMLElement | null = null;
  let exploration: ReturnType<typeof createSalaryExploration> | undefined;
  let lastAnnouncement = "";
  let lastDrawKey = "";
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const find = <T extends Element = HTMLElement>(selector: string) =>
    root!.querySelector<T>(selector)!;
  const pause = () => {
    playing = false;
    clearTimeout(timer);
    timer = undefined;
  };
  function notify() {
    const frame = frameAt(time);
    const text = `${storyChapters[frame.index]!.title}. ${storyChapters[frame.index]!.captions[frame.cue]}`;
    if (text !== lastAnnouncement) {
      announce(text);
      lastAnnouncement = text;
    }
  }
  function build(avatar: string) {
    const element = document.createElement("section");
    element.className = "employee-story";
    element.setAttribute("aria-label", `Employee ${employee} explanation`);
    element.innerHTML = `<div class="story-heading">${avatar}<p>EMPLOYEE ${employee} <span>· salary laboratory</span></p><strong data-story-count></strong></div>
      <div class="story-composition"><figure class="story-model"><figcaption>One continuous salary model <span>Same peso scale throughout · green original, gold addition</span></figcaption>
      <svg class="story-salary" viewBox="0 0 264 126" role="group" aria-label="Explore Employee ${employee}’s salary">
        <text x="4" y="15" data-original-label></text>
        <g data-explore="original" role="button" tabindex="0" aria-label="Explore the original salary" aria-controls="employee-${employee.toLowerCase()}-inspection" aria-expanded="false"><rect class="story-original original-block" x="4" y="26" width="${isB ? 100 : 200}" height="35" rx="3"/></g>
        <rect class="story-share" x="4" y="26" width="20" height="35" hidden/>
        <g data-tenths>${Array.from({ length: isB ? 4 : 9 }, (_, i) => `<line class="story-divider" x1="${24 + i * 20}" x2="${24 + i * 20}" y1="26" y2="61"/>`).join("")}</g>
        <g class="story-hundred">${Array.from({ length: isB ? 19 : 9 }, (_, i) => `<line class="story-divider" x1="4" x2="${isB ? 104 : 204}" y1="${26 + (i + 1) * (isB ? 1.75 : 3.5)}" y2="${26 + (i + 1) * (isB ? 1.75 : 3.5)}"/>`).join("")}</g>
        <g class="story-added" data-explore="addition" role="button" tabindex="0" aria-label="Explore the added money" aria-controls="employee-${employee.toLowerCase()}-inspection" aria-expanded="false"><rect class="raise-block" x="0" y="26" width="20" height="35" rx="2"/><text x="-4" y="78">+₱2,000</text></g>
        <rect class="story-match" x="4" y="26" width="20" height="35"/>
        <g data-total data-explore="total" role="button" tabindex="0" aria-label="Explore the new total" aria-controls="employee-${employee.toLowerCase()}-inspection" aria-expanded="false"><rect class="story-hit-area" x="2" y="84" width="${isB ? 132 : 232}" height="32"/><path class="story-bracket" d="M4 88v6h${isB ? 124 : 224}v-6"/><text x="4" y="109">New salary · ₱${isB ? "12,000" : "22,000"}</text></g>
      </svg><p class="story-grid-caption" data-grid-caption></p>
      <p class="story-explore-hint"><span aria-hidden="true">✧</span> There is more in the model. Hover, focus or hold a salary part.</p>
      <div class="story-exploration-slot">${isB ? employeeBExplorationMarkup : explorationMarkup}</div>
      </figure><div class="story-narration"><p class="story-kicker">BUILD ON THE SAME WHOLE</p><h3 data-story-title></h3>
      ${[0, 1, 2].map((cue) => `<p class="story-caption" data-cue="${cue}"></p>`).join("")}
      <p class="story-equation"></p><p class="story-reading-note">Follow the story at your pace. Explore the salary itself for a closer look.</p></div></div>
      <div class="story-playback" role="group" aria-label="Explanation playback"><button data-story="previous" class="story-skip" aria-label="Previous moment"><span aria-hidden="true">‹</span></button><button data-story="play" class="story-play" aria-label="Play explanation"></button><button data-story="next" class="story-skip" aria-label="Next moment"><span aria-hidden="true">›</span></button><button data-story="replay" class="story-restart" aria-label="Replay from start"><span aria-hidden="true">↺</span> Restart</button><label>Explanation position<input type="range" min="0" max="51" step="0.1" value="0"></label><span class="story-time" aria-hidden="true"></span></div>
      <div class="story-moments" role="group" aria-label="Choose an explanatory moment">${storyChapters.map((chapter, index) => `<button data-moment="${index}"><span class="chapter-number">0${index + 1}</span><svg viewBox="0 0 66 28" aria-hidden="true"><rect x="2" y="6" width="48" height="15" rx="2"/><path d="${["M2 25h48", "M55 6v15h5V6Z", "M2 25h60", "M7 6v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15", "M7 6v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15m5-15v15M2 11h48M2 16h48", "M55 6v15h5V6ZM2 25h58"][index]}"/></svg><span class="chapter-title">${chapter.title}</span></button>`).join("")}</div>`;
    if (isB) {
      // Chapter illustrations use the same peso scale as A, not a normalized whole.
      const paths = [
        "M2 25h24",
        "M31 6v15h5V6Z",
        "M2 25h34",
        "M7 6v15m5-15v15m5-15v15m5-15v15",
        "M7 6v15m5-15v15m5-15v15m5-15v15M2 10h24M2 14h24M2 18h24",
        "M31 6v15h5V6ZM2 25h34",
      ];
      element.querySelectorAll(".story-moments svg").forEach((svg, index) => {
        svg.querySelector("rect")!.setAttribute("width", "24");
        svg.querySelector("path")!.setAttribute("d", paths[index]!);
      });
    }
    return element;
  }
  function draw() {
    if (!root) return;
    const frame = frameAt(time, motion?.matches),
      chapter = storyChapters[frame.index]!;
    root.dataset.time = frame.time.toFixed(3);
    // Absolute-time entrances are projected on every draw, including a paused seek.
    const entrance = (selector: string, progress: number, distance = 12) => {
      const element = find<HTMLElement | SVGElement>(selector);
      // Readable contrast survives a paused seek at the start of any entrance.
      element.style.opacity = "1";
      element.style.transform = `translateY(${((1 - progress) * distance).toFixed(3)}px)`;
    };
    frame.captionProgress.forEach((progress, index) =>
      entrance(`.story-caption[data-cue="${index}"]`, progress),
    );
    entrance(".story-equation", frame.equationProgress, 8);
    entrance('[data-explore="original"]', frame.originalProgress, 8);
    entrance("[data-total]", frame.totalProgress, 8);
    entrance("[data-tenths]", frame.tenthsProgress, 0);
    find<SVGElement>(".story-added").style.opacity = String(
      frame.additionProgress,
    );
    find<SVGElement>(".story-added").setAttribute(
      "transform",
      `translate(${frame.additionX.toFixed(3)} 0)`,
    );
    find<SVGElement>(".story-hundred").setAttribute(
      "transform",
      `translate(4 26) scale(1 ${frame.hundredProgress.toFixed(3)}) translate(-4 -26)`,
    );
    const position = find<HTMLInputElement>('input[type="range"]');
    position.value = String(frame.time);
    position.setAttribute(
      "aria-valuetext",
      `${frame.time.toFixed(1)} of 51 seconds. ${frame.index + 1} of 6: ${chapter.title}. ${chapter.captions[frame.cue]}`,
    );
    find(".story-time").textContent = `${frame.time.toFixed(1)} / 51 s`;
    const key = [
      frame.index,
      frame.cue,
      frame.addition,
      frame.total,
      frame.tenths,
      frame.match,
      frame.hundred,
      frame.percent,
      playing,

      isBlocked,
      time === 0,
    ].join("/");
    if (key === lastDrawKey) return;
    lastDrawKey = key;
    root.dataset.moment = String(frame.index);
    root.dataset.time = frame.time.toFixed(3);
    root.dataset.cue = String(frame.cue);
    root.dataset.playing = String(playing);
    find("[data-story-count]").textContent = `${frame.index + 1} / 6`;
    find("[data-story-title]").textContent = chapter.title;
    root
      .querySelectorAll<HTMLElement>("[data-cue]")
      .forEach((caption, index) => {
        caption.hidden = index > frame.cue;
        caption.classList.toggle("is-current", index === frame.cue);
        const text = chapter.captions[index]!,
          emphasis = chapter.emphasis[index]!,
          start = text.indexOf(emphasis);
        if (caption.dataset.copy !== text) {
          const strong = document.createElement("strong");
          strong.textContent = emphasis;
          const part =
            frame.index === 0
              ? "original"
              : frame.index === 1
                ? "addition"
                : frame.index === 2
                  ? "total"
                  : frame.index === 5 && frame.cue === 2
                    ? "total"
                    : frame.index === 5 && frame.cue === 1
                      ? "original"
                      : "addition";
          strong.dataset.explore = part;
          strong.setAttribute("role", "button");
          strong.tabIndex = 0;
          strong.setAttribute("aria-label", `Explore ${emphasis}`);
          strong.setAttribute(
            "aria-controls",
            "employee-${employee.toLowerCase()}-inspection",
          );
          strong.setAttribute("aria-expanded", "false");
          caption.replaceChildren(
            text.slice(0, start),
            strong,
            text.slice(start + emphasis.length),
          );
          caption.dataset.copy = text;
        }
      });
    find(".story-equation").textContent = chapter.equations[frame.cue]!;
    find("[data-original-label]").textContent =
      `Original · ₱${isB ? "10,000" : "20,000"}${frame.tenths ? " · 100%" : ""}`;
    find(".story-salary").setAttribute(
      "aria-label",
      `Original salary ₱${isB ? "10,000" : "20,000"}${frame.addition ? `; added ₱2,000, one ${isB ? "fifth" : "tenth"} as wide` : ""}${frame.total ? `; new total ₱${isB ? "12,000" : "22,000"}` : ""}${frame.hundred ? `; the original has 100 equal parts; the matching share covers ${isB ? 20 : 10}` : frame.tenths ? `; original divided into ${isB ? "five" : "ten"} equal parts` : ""}`,
    );
    const show = (selector: string, visible: boolean) => {
      const element = find(selector);
      element.toggleAttribute("hidden", !visible);
      element.setAttribute("aria-hidden", String(!visible));
    };
    show(".story-added", frame.addition);
    find<SVGElement>(".story-added").setAttribute(
      "transform",
      `translate(${frame.additionX.toFixed(3)} 0)`,
    );
    show("[data-total]", frame.total);
    show("[data-tenths]", frame.tenths);
    show(".story-hundred", frame.hundred);
    find<SVGElement>(".story-hundred").setAttribute(
      "transform",
      `translate(4 26) scale(1 ${frame.hundredProgress.toFixed(3)}) translate(-4 -26)`,
    );
    show(".story-share", frame.percent);
    show(".story-match", frame.match);
    find("[data-grid-caption]").textContent = frame.hundred
      ? `The same original: 100 equal parts. The matching share occupies ${isB ? 20 : 10} parts.`
      : frame.tenths
        ? `The same original: ${isB ? "five" : "ten"} equal parts. One matches the addition.`
        : "The original stays intact. Only the gold block is added money.";
    root
      .querySelectorAll<HTMLButtonElement>("[data-moment]")
      .forEach((button, index) => {
        button.setAttribute("aria-pressed", String(frame.index === index));
        button.disabled = isBlocked;
      });
    root
      .querySelectorAll<HTMLElement | SVGElement>("[data-explore]")
      .forEach((element) => {
        element.setAttribute("aria-disabled", String(isBlocked));
        element.tabIndex = isBlocked ? -1 : 0;
      });
    root
      .querySelectorAll<HTMLButtonElement>(".story-callout button")
      .forEach((button) => {
        button.disabled = isBlocked;
      });
    for (const name of ["play", "replay"])
      find<HTMLButtonElement>(`[data-story="${name}"]`).disabled = isBlocked;
    find<HTMLButtonElement>('[data-story="previous"]').disabled =
      isBlocked || time === 0;
    find<HTMLButtonElement>('[data-story="next"]').disabled =
      isBlocked || frame.index === 5;
    find('[data-story="play"]').setAttribute(
      "aria-label",
      playing ? "Pause explanation" : "Play explanation",
    );
    const range = find<HTMLInputElement>('input[type="range"]');
    range.disabled = isBlocked;
    range.value = String(frame.time);
    range.setAttribute(
      "aria-valuetext",
      `${frame.time.toFixed(1)} of 51 seconds. ${frame.index + 1} of 6: ${chapter.title}. ${chapter.captions[frame.cue]}`,
    );
    find(".story-time").textContent = `${frame.time.toFixed(1)} / 51 s`;
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    lastTick = performance.now();
    timer = setTimeout(() => {
      if (!host?.isConnected || document.hidden || isBlocked) {
        pause();
        draw();
        return;
      }
      const before = time;
      time = Math.min(
        employeeStoryDuration,
        Math.round((time + (performance.now() - lastTick) / 1000) * 1000) /
          1000,
      );
      employeeAccents(sound, before, time, motion?.matches ?? false);
      if (time === employeeStoryDuration) pause();
      draw();
      notify();
      schedule();
    }, 50);
  }
  function seek(seconds: number) {
    pause();
    time = frameAt(seconds).time;
    exploration?.close();
    draw();
    notify();
  }
  function bind() {
    root!.onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button",
      );
      if (!button || button.disabled || isBlocked) return;
      const action = button.dataset.story;
      if (action === "play") {
        sound.cue(playing ? "ui.toggle.off" : "ui.toggle.on");
        if (playing) pause();
        else {
          if (time === employeeStoryDuration) time = 0;
          exploration?.close();
          playing = true;
          schedule();
        }
        draw();
        return;
      }
      const index = frameAt(time).index;
      if (
        action === "previous" ||
        action === "next" ||
        action === "replay" ||
        button.dataset.moment !== undefined
      )
        sound.cue("model.step");
      if (action === "previous") seek(Math.max(0, index - 1) * chapterDuration);
      else if (action === "next")
        seek(Math.min(5, index + 1) * chapterDuration);
      else if (action === "replay") seek(0);
      else if (button.dataset.moment !== undefined)
        seek(Number(button.dataset.moment) * chapterDuration);
    };
    root!.oninput = (event) => {
      if (event.target instanceof HTMLInputElement && !isBlocked)
        seek(Number(event.target.value));
    };
  }
  function interrupt() {
    pause();
    draw();
    exploration?.refresh();
    if (document.hidden) exploration?.close();
  }
  function visibility() {
    if (document.hidden) interrupt();
  }
  function stopListening() {
    if (!listening) return;
    motion?.removeEventListener?.("change", interrupt);
    document.removeEventListener("visibilitychange", visibility);
    listening = false;
  }
  return {
    mount(
      element: HTMLElement,
      avatar: string,
      beat: number,
      blocked: boolean,
    ) {
      host = element;
      isBlocked = blocked;
      if (!root) {
        lastDrawKey = "";
        root = build(avatar);
        bind();
        exploration = createSalaryExploration(root, {
          pause: () => {
            pause();
            draw();
          },
          blocked: () => isBlocked,
          reduced: () => motion?.matches ?? false,
          announce,
          lessons: isB ? employeeBLessons : undefined,
          copyDistance: isB ? 126 : 246,
          sound: sound.inspection,
        });
      }
      if (parentBeat !== beat) {
        pause();
        parentBeat = beat;
        time = [0, 25.5, 34, 42.5][beat] ?? 0;
        exploration?.close();
      }
      if (blocked) {
        pause();
        exploration?.close();
      }
      if (root.parentElement !== element) element.replaceChildren(root);
      if (!listening) {
        motion?.addEventListener?.("change", interrupt);
        document.addEventListener("visibilitychange", visibility);
        listening = true;
      }
      draw();
    },
    detach() {
      pause();
      stopListening();
      exploration?.close();
      root?.remove();
      exploration?.close();
      host = null;
    },
    dispose() {
      pause();
      stopListening();
      exploration?.close();
      exploration?.dispose();
      root?.remove();
      exploration = undefined;
      root = null;
      host = null;
    },
  };
}
