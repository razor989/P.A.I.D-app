import { silentReference, storyAccents } from "./story-sound";
import type { ReferenceSound } from "./story-sound";
import { createSalaryExploration } from "./employee-exploration";
import {
  comparisonChapters as chapters,
  comparisonLessons,
  comparisonExplorationMarkup,
} from "./comparison-content";

const duration = 51,
  chapterDuration = 8.5;
const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
/** Display geometry only. Each width is projected from absolute time. */
export function comparisonFrame(
  seconds: number,
  reduced = false,
  scale?: "pesos" | "percent",
) {
  const time = Math.max(
    0,
    Math.min(duration, Number.isFinite(seconds) ? seconds : 0),
  );
  const index = Math.min(5, Math.floor(time / chapterDuration)),
    local = time - index * chapterDuration;
  const normalized = scale
    ? Number(scale === "percent")
    : reduced
      ? Number(time >= 25.5)
      : ease((time - 25.5) / 1.4);
  const cue = local >= 5.5 ? 2 : local >= 2.5 ? 1 : 0;
  const entrances = [0, 2.5, 5.5].map((start) =>
    reduced ? 1 : ease((local - start) / 0.65),
  );
  return {
    time,
    index,
    cue,
    entrances,
    equationEntrance: entrances[cue]!,
    normalized,
    bOriginal: 100 + 100 * normalized,
    bAddition: 20 + 20 * normalized,
    match: time >= 17,
    hundred: time >= 34,
    copyProgress: reduced ? 1 : ease((time - 17) / 1.4),
    entrance: reduced ? 1 : ease(local / 0.8),
  };
}

function markup(avatars: readonly string[]) {
  const trigger = (part: string, label: string) =>
    `data-explore="${part}" role="button" tabindex="0" aria-label="${label}" aria-controls="comparison-inspection" aria-expanded="false"`;
  return `<section class="employee-story comparison-story" aria-label="Compare the two raises explanation">
    <div class="story-heading">${avatars.join("")}<p>A &amp; B <span>· comparison laboratory</span></p><strong data-story-count></strong></div>
    <div class="story-composition"><figure class="story-model"><figcaption>Two originals. The same added money.<span>Green original · gold addition · outline copy</span></figcaption>
      <div class="comparison-graphic"><svg class="story-salary comparison-salary" viewBox="0 0 264 300" role="group" aria-label="Compare the two salaries">
        ${(["A", "B"] as const)
          .map(
            (
              id,
              row,
            ) => `<g data-comparison-employee="${id}" transform="translate(0 ${row * 140})">
          <g ${trigger("original", `Explore Employee ${id}’s reference whole`)}><rect class="story-original" x="4" y="30" width="${row ? 100 : 200}" height="35" rx="3"/></g>
          <g data-divisions></g><g data-hundred></g>
          <g ${trigger("addition", `Explore Employee ${id}’s added money`)}><rect class="raise-block" x="${row ? 112 : 212}" y="30" width="20" height="35" rx="2"/></g>
          <rect class="story-match" data-match x="4" y="30" width="20" height="35"/>
          <path class="story-bracket" data-original-bracket d="M4 69v5h${row ? 100 : 200}v-5"/>
          <path class="comparison-label-leader" data-added-leader d="M${row ? 122 : 222} 22v8"/>
        </g>`,
          )
          .join("")}
      </svg>${(["A", "B"] as const)
        .map(
          (
            id,
            row,
          ) => `<div class="comparison-model-labels" data-label-employee="${id}" style="--row:${row}">
        <div class="comparison-whole-label" data-whole-label><span class="comparison-employee-badge">${id}</span><span><strong>₱${row ? "10,000" : "20,000"}</strong><span data-whole-percent hidden> = 100%</span></span></div>
        <span class="comparison-added-label">+₱2,000</span>
        <span class="comparison-share-label" ${trigger("total", `Explore Employee ${id}’s share compared with the other employee`)} data-share-label hidden></span>
      </div>`,
        )
        .join(
          "",
        )}</div><p class="comparison-equal-cue"><span aria-hidden="true">▰ = ▰</span> Same added money</p><p class="story-grid-caption" data-scale-caption></p>
      <div class="comparison-scales" role="group" aria-label="Comparison scale"><button type="button" data-scale="pesos">In pesos</button><button type="button" data-scale="percent">Each original = 100%</button><button type="button" data-scale="story">Follow story scale</button></div>
      <p class="story-explore-hint">Hover, focus, tap or hold a salary part for a closer look.</p><div class="story-exploration-slot">${comparisonExplorationMarkup}</div>
    </figure><div class="story-narration"><p class="story-kicker">SAME PESOS · DIFFERENT SHARES</p><h3 data-story-title></h3>${[0, 1, 2].map((cue) => `<p class="story-caption" data-cue="${cue}"></p>`).join("")}<p class="story-equation"></p><p class="story-reading-note">Changing the scale changes the picture, not the salaries. Exploration does not advance the lesson.</p></div></div>
    <div class="story-playback" role="group" aria-label="Comparison playback"><button type="button" data-story="previous" class="story-skip" aria-label="Previous moment">‹</button><button type="button" data-story="play" class="story-play" aria-label="Play explanation"></button><button type="button" data-story="next" class="story-skip" aria-label="Next moment">›</button><button type="button" data-story="replay" class="story-restart">↺ Restart</button><label>Comparison position<input type="range" min="0" max="51" step="0.1" value="0"/></label><span class="story-time" aria-hidden="true"></span></div>
    <div class="story-moments" role="group" aria-label="Choose a comparison moment">${chapters.map((chapter, index) => `<button type="button" data-moment="${index}"><span class="chapter-number">0${index + 1}</span><svg viewBox="0 0 66 28" aria-hidden="true"><rect x="2" y="2" width="${index < 3 ? 40 : 40}" height="9"/><rect x="2" y="16" width="${index < 3 ? 20 : 40}" height="9"/><path d="M46 2h4v9h-4zM${index < 3 ? 26 : 46} 16h${index < 3 ? 4 : 8}v9h-${index < 3 ? 4 : 8}z"/></svg><span>${chapter.title}</span></button>`).join("")}</div>
  </section>`;
}

// Heard only while the comparison plays by itself (seconds).
const comparisonAccents = storyAccents(
  [
    // The copy slides across (1.4 s), then the pair matches.
    { at: 17, cue: "story.grow" },
    { at: 18.4, cue: "story.stamp" },
    { at: 25.5, cue: "story.grow" },
    { at: 34, cue: "story.piece" },
  ],
  chapterDuration,
  duration,
);

export function createComparisonExplanation(
  announce: (text: string) => void,
  sound: ReferenceSound = silentReference,
) {
  let root: HTMLElement | null = null,
    time = 0,
    playing = false,
    blocked = false,
    parentBeat = -1,
    lastTick = 0,
    listening = false;
  let scale: "pesos" | "percent" | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let exploration: ReturnType<typeof createSalaryExploration> | undefined,
    lastAnnouncement = "";
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const pause = () => {
    playing = false;
    clearTimeout(timer);
    timer = undefined;
  };
  const find = <T extends Element = HTMLElement>(selector: string) =>
    root!.querySelector<T>(selector)!;
  function notify() {
    const f = comparisonFrame(time),
      text = `${chapters[f.index]!.title}. ${chapters[f.index]!.captions[f.cue]}`;
    if (text !== lastAnnouncement) {
      lastAnnouncement = text;
      announce(text);
    }
  }
  function draw() {
    if (!root) return;
    const frame = comparisonFrame(time, motion?.matches, scale),
      chapter = chapters[frame.index]!;
    root.dataset.time = frame.time.toFixed(3);
    root.dataset.playing = String(playing);
    root.dataset.moment = String(frame.index);
    find("[data-story-count]").textContent = `${frame.index + 1} / 6`;
    find("[data-story-title]").textContent = chapter.title;
    find("[data-story-title]").style.transform =
      `translateY(${((1 - frame.entrance) * 14).toFixed(3)}px)`;
    root.querySelectorAll<HTMLElement>("[data-cue]").forEach((caption, i) => {
      caption.hidden = i > frame.cue;
      caption.classList.toggle("is-current", i === frame.cue);
      const text = chapter.captions[i]!,
        emphasis = chapter.emphasis[i]!,
        start = text.indexOf(emphasis);
      if (caption.dataset.copy !== text) {
        const strong = document.createElement("strong");
        strong.textContent = emphasis;
        strong.dataset.explore = chapter.part;
        strong.tabIndex = blocked ? -1 : 0;
        strong.setAttribute("role", "button");
        strong.setAttribute("aria-controls", "comparison-inspection");
        strong.setAttribute("aria-expanded", "false");
        caption.replaceChildren(
          text.slice(0, start),
          strong,
          text.slice(start + emphasis.length),
        );
        caption.dataset.copy = text;
      }
      caption.style.opacity = "1";
      caption.style.transform = `translateY(${((1 - frame.entrances[i]!) * 16).toFixed(3)}px)`;
      caption.style.setProperty("--cue-reveal", String(frame.entrances[i]));
    });
    find(".story-equation").textContent = chapter.equations[frame.cue]!;
    find(".story-equation").style.transform =
      `translateY(${((1 - frame.equationEntrance) * 12).toFixed(3)}px)`;
    find(".story-equation").style.setProperty(
      "--cue-reveal",
      String(frame.equationEntrance),
    );
    root
      .querySelectorAll<SVGGElement>("[data-comparison-employee]")
      .forEach((group, row) => {
        const original = row ? frame.bOriginal : 200,
          addition = row ? frame.bAddition : 20,
          parts = row ? 5 : 10;
        group
          .querySelector(".story-original")!
          .setAttribute("width", String(original));
        const added = group.querySelector(".raise-block")!;
        added.setAttribute("x", String(12 + original));
        added.setAttribute("width", String(addition));
        const divisions = group.querySelector("[data-divisions]")!,
          hundred = group.querySelector("[data-hundred]")!;
        divisions.innerHTML = Array.from(
          { length: parts - 1 },
          (_, i) =>
            `<path class="story-divider" d="M${4 + (original * (i + 1)) / parts} 30v35"/>`,
        ).join("");
        hundred.innerHTML = frame.hundred
          ? Array.from(
              { length: 100 / parts - 1 },
              (_, i) =>
                `<path class="story-divider" d="M4 ${30 + (35 * (i + 1)) / (100 / parts)}h${original}"/>`,
            ).join("")
          : "";
        const match = group.querySelector<SVGElement>("[data-match]")!;
        match.toggleAttribute("hidden", !frame.match);
        match.setAttribute("width", String(addition));
        match.setAttribute(
          "transform",
          `translate(${((original + 8) * (1 - frame.copyProgress)).toFixed(3)} 0)`,
        );
        group
          .querySelector("[data-original-bracket]")!
          .setAttribute("d", `M4 69v5h${original}v-5`);
        group
          .querySelector("[data-added-leader]")!
          .setAttribute("d", `M${12 + original + addition / 2} 22v8`);
        const labels = find(`[data-label-employee="${row ? "B" : "A"}"]`);
        labels.style.setProperty(
          "--original-width",
          `${(original / 264) * 100}%`,
        );
        labels.style.setProperty(
          "--addition-center",
          `${((12 + original + addition / 2) / 264) * 100}%`,
        );
        labels.querySelector<HTMLElement>("[data-whole-percent]")!.hidden =
          frame.normalized !== 1;
        const share = labels.querySelector<HTMLElement>("[data-share-label]")!;
        share.hidden = !frame.match && frame.normalized !== 1;
        share.textContent =
          frame.hundred || frame.index >= 3 || frame.normalized === 1
            ? row
              ? "1/5 → 20%"
              : "1/10 → 10%"
            : row
              ? "1/5 of B’s original"
              : "1/10 of A’s original";
      });
    const description =
      frame.normalized === 0
        ? "Common peso scale: A original ₱20,000; B original ₱10,000 is half as wide. Both additions are ₱2,000 and equal width."
        : frame.normalized === 1
          ? "Each own original = 100%: A ₱20,000; B ₱10,000. Equal original widths do not mean equal salaries. Each addition retains its share."
          : "Changing scale: B’s original and addition enlarge together. No money changes.";
    find("[data-scale-caption]").textContent = description;
    find(".story-salary").setAttribute(
      "aria-label",
      `${description} Original plus addition: A new salary ₱22,000; B new salary ₱12,000.${frame.hundred ? " A: 10% increase; B: 20% increase." : ""}`,
    );
    root
      .querySelectorAll<HTMLButtonElement>("[data-scale]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.scale === (scale ?? "story")),
        ),
      );
    root
      .querySelectorAll<HTMLButtonElement>("[data-moment]")
      .forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === frame.index)),
      );
    root
      .querySelectorAll<HTMLButtonElement | HTMLInputElement>("button,input")
      .forEach((control) => (control.disabled = blocked));
    root
      .querySelectorAll<HTMLElement | SVGElement>("[data-explore]")
      .forEach((element) => {
        element.setAttribute("tabindex", blocked ? "-1" : "0");
        element.setAttribute("aria-disabled", String(blocked));
      });
    find<HTMLButtonElement>('[data-story="previous"]').disabled =
      blocked || frame.index === 0;
    find<HTMLButtonElement>('[data-story="next"]').disabled =
      blocked || frame.index === 5;
    find('[data-story="play"]').setAttribute(
      "aria-label",
      playing ? "Pause explanation" : "Play explanation",
    );
    const input = find<HTMLInputElement>("input");
    input.value = String(time);
    input.setAttribute(
      "aria-valuetext",
      `${time.toFixed(1)} of 51 seconds. ${chapter.title}. ${chapter.captions[frame.cue]}`,
    );
    find(".story-time").textContent = `${time.toFixed(1)} / 51 s`;
  }
  function seek(seconds: number) {
    pause();
    time = comparisonFrame(seconds).time;
    scale = undefined;
    exploration?.close();
    draw();
    notify();
  }
  function schedule() {
    lastTick = performance.now();
    timer = setTimeout(() => {
      if (!playing) return;
      const before = time;
      time = Math.min(duration, time + (performance.now() - lastTick) / 1000);
      comparisonAccents(sound, before, time, motion?.matches ?? false);
      if (time === duration) pause();
      draw();
      notify();
      if (playing) schedule();
    }, 50);
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
      host: HTMLElement,
      avatars: readonly string[],
      beat: number,
      isBlocked: boolean,
    ) {
      blocked = isBlocked;
      if (!root) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = markup(avatars);
        root = wrapper.firstElementChild as HTMLElement;
        root.onclick = (event) => {
          const button = (event.target as Element).closest<HTMLButtonElement>(
            "button",
          );
          if (!button || button.disabled || blocked) return;
          if (button.dataset.scale) {
            pause();
            scale =
              button.dataset.scale === "story"
                ? undefined
                : (button.dataset.scale as "pesos" | "percent");
            exploration?.close();
            draw();
            announce(find("[data-scale-caption]").textContent);
            return;
          }
          const action = button.dataset.story,
            index = comparisonFrame(time).index;
          if (action === "play") {
            sound.cue(playing ? "ui.toggle.off" : "ui.toggle.on");
            if (playing) pause();
            else {
              if (time === duration) time = 0;
              exploration?.close();
              playing = true;
              schedule();
            }
            draw();
          } else if (action === "previous") {
            sound.cue("model.step");
            seek(Math.max(0, index - 1) * chapterDuration);
          } else if (action === "next") {
            sound.cue("model.step");
            seek(Math.min(5, index + 1) * chapterDuration);
          } else if (action === "replay") {
            sound.cue("model.step");
            seek(0);
          } else if (button.dataset.moment !== undefined) {
            sound.cue("model.step");
            seek(Number(button.dataset.moment) * chapterDuration);
          }
        };
        root.oninput = (event) => {
          if (!blocked && event.target instanceof HTMLInputElement)
            seek(Number(event.target.value));
        };
        exploration = createSalaryExploration(root, {
          pause: () => {
            pause();
            draw();
          },
          blocked: () => blocked,
          reduced: () => motion?.matches ?? false,
          announce,
          lessons: comparisonLessons,
          copyDistance: 206,
          sound: sound.inspection,
        });
      }
      if (parentBeat !== beat) {
        parentBeat = beat;
        seek([0, 25.5, 42.5][beat] ?? 0);
      }
      if (blocked) {
        pause();
        exploration?.close();
      }
      if (root.parentElement !== host) host.replaceChildren(root);
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
    },
    dispose() {
      pause();
      stopListening();
      exploration?.dispose();
      root?.remove();
      root = null;
      exploration = undefined;
    },
  };
}
