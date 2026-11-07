import { silentReference, storyAccents } from "./story-sound";
import type { ReferenceSound } from "./story-sound";
import {
  createSalaryExploration,
  explorationMarkup,
} from "./employee-exploration";
import { formulaChapters as chapters, formulaLessons } from "./formula-content";

const chapterDuration = 12,
  duration = 48;
const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
/** Display-only absolute time; neither playback nor inspection advances the activity. */
export function formulaFrame(seconds: number, reduced = false) {
  const time = Math.max(
    0,
    Math.min(duration, Number.isFinite(seconds) ? seconds : 0),
  );
  const index = Math.min(3, Math.floor(time / chapterDuration)),
    local = time - index * chapterDuration;
  const cue = local >= 8 ? 2 : local >= 4 ? 1 : 0;
  return {
    time,
    index,
    cue,
    entrances: [0, 4, 8].map((start) =>
      reduced ? 1 : ease((local - start) / 0.8),
    ),
    heading: reduced ? 1 : ease(local / 0.8),
    copy: reduced ? 1 : ease((time - 12) / 1.5),
    hundred: index >= 2,
  };
}
const trigger = (part: string, label: string) =>
  `data-explore="${part}" role="button" tabindex="0" aria-label="${label}" aria-controls="formula-inspection" aria-expanded="false"`;
const term = (part: string, text: string) =>
  `<strong ${trigger(part, `Explore ${text}`)}>${text}</strong>`;
function markup(avatar: string) {
  return `<section class="employee-story formula-story" aria-label="Writing the reasoning as a formula explanation">
    <div class="story-heading">${avatar}<p>A <span>· from model to formula</span></p><strong data-story-count></strong></div>
    <div class="story-composition"><figure class="story-model"><figcaption>One original. One separate addition.<span>Green original · gold change · outline comparison copy</span></figcaption>
      <div class="formula-model"><div class="formula-top-label">${term("addition", "+₱2,000")}<span>Change · numerator</span></div>
      <svg class="story-salary" viewBox="0 0 264 100" role="group" aria-label="Employee A: original ₱20,000, addition ₱2,000, new salary ₱22,000. Original remains intact.">
        <g ${trigger("original", "Explore A’s original reference whole")}><rect class="story-original" x="4" y="22" width="200" height="35" rx="3"/></g>
        <g data-formula-divisions></g><g data-formula-hundred></g>
        <g ${trigger("addition", "Explore A’s added money, the change")}><rect class="raise-block" x="212" y="22" width="20" height="35" rx="2"/></g>
        <rect class="story-match" data-formula-copy x="4" y="22" width="20" height="35"/>
        <path class="story-bracket" d="M4 61v6h200v-6"/><path class="formula-leader" d="M222 2v20"/>
      </svg><div class="formula-original-label">${term("original", "₱20,000")}<span>Original · denominator<span data-formula-percent hidden> · 100%</span></span></div>
      <div class="formula-total-label">${term("total", "₱22,000")}<span>New = Original + Change</span></div></div>
      <p class="formula-model-note" data-formula-model-note></p>
      <div class="formula-b-check" data-formula-b hidden><strong>B · reference check</strong><p>₱2,000 ÷ <b>₱10,000</b> = 0.20 = 20%</p><p>B’s own original = 100%. A’s ₱20,000 is not B’s denominator.</p></div>
    </figure><div class="story-narration"><span class="story-kicker">BUILD THE REASONING</span><h3 data-story-title></h3>
      ${[0, 1, 2].map((i) => `<p class="story-caption" data-cue="${i}"></p>`).join("")}
      <div class="formula-construction" aria-label="Formula built from the model"><span data-formula-name></span><div class="formula-symbols"><div class="formula-fraction" data-formula-fraction><div>${term("addition", "New − Original")}</div><div data-formula-denominator>${term("original", "Original")}</div></div><span data-formula-multiply>× 100%</span></div></div>
      <p class="story-equation" data-equation></p><p class="story-explore-hint">Explore the model or underlined terms. Each explanation pauses playback. These are unscored explorations, not a requirement to continue.</p>
    </div></div><div class="story-callout-slot">${explorationMarkup.replace(/employee-a-inspection/g, "formula-inspection")}</div>
    <div class="story-playback" role="group" aria-label="Formula playback"><button type="button" data-story="previous" class="story-skip" aria-label="Previous moment">‹</button><button type="button" data-story="play" class="story-play" aria-label="Play explanation"></button><button type="button" data-story="next" class="story-skip" aria-label="Next moment">›</button><button type="button" data-story="replay" class="story-restart">↺ Restart</button><label>Formula position<input type="range" min="0" max="48" step="0.1" value="0"/></label><span class="story-time" aria-hidden="true"></span></div>
    <div class="story-moments" role="group" aria-label="Choose a formula moment">${chapters.map((c, i) => `<button type="button" data-moment="${i}"><span class="chapter-number">0${i + 1}</span><svg viewBox="0 0 66 28" aria-hidden="true"><rect x="2" y="9" width="44" height="12"/><path d="M50 9h6v12h-6z"/></svg><span>${c.title}</span></button>`).join("")}</div>
  </section>`;
}
// Heard only while the formula plays by itself (seconds).
const formulaAccents = storyAccents(
  [
    { at: 12, cue: "story.grow" },
    { at: 24, cue: "story.piece" },
  ],
  chapterDuration,
  duration,
);

export function createFormulaExplanation(
  announce: (text: string) => void,
  sound: ReferenceSound = silentReference,
) {
  let root: HTMLElement | null = null,
    time = 0,
    playing = false,
    blocked = false,
    parentBeat = -1,
    listening = false,
    lastTick = 0,
    lastAnnouncement = "";
  let timer: ReturnType<typeof setTimeout> | undefined,
    exploration: ReturnType<typeof createSalaryExploration> | undefined;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const find = <T extends Element = HTMLElement>(s: string) =>
    root!.querySelector<T>(s)!;
  function pause() {
    playing = false;
    clearTimeout(timer);
    timer = undefined;
  }
  function notify() {
    const f = formulaFrame(time),
      c = chapters[f.index]!,
      text = `${c.title}. ${c.captions[f.cue]}`;
    if (lastAnnouncement !== text) {
      lastAnnouncement = text;
      announce(text);
    }
  }
  function draw() {
    if (!root) return;
    const f = formulaFrame(time, motion?.matches),
      c = chapters[f.index]!;
    root.dataset.time = f.time.toFixed(3);
    root.dataset.playing = String(playing);
    root.dataset.moment = String(f.index);
    find("[data-story-count]").textContent = `${f.index + 1} / 4`;
    find("[data-story-title]").textContent = c.title;
    find("[data-story-title]").style.transform =
      `translateY(${(1 - f.heading) * 14}px)`;
    root.querySelectorAll<HTMLElement>("[data-cue]").forEach((caption, i) => {
      const text = c.captions[i]!,
        emphasis = c.emphasis[i]!,
        start = text.indexOf(emphasis);
      if (caption.dataset.copy !== text) {
        const strong = document.createElement("strong");
        strong.textContent = emphasis;
        strong.dataset.explore = c.parts[i];
        strong.tabIndex = 0;
        strong.setAttribute("role", "button");
        strong.setAttribute("aria-controls", "formula-inspection");
        strong.setAttribute("aria-expanded", "false");
        caption.replaceChildren(
          text.slice(0, start),
          strong,
          text.slice(start + emphasis.length),
        );
        caption.dataset.copy = text;
      }
      caption.hidden = i > f.cue;
      caption.classList.toggle("is-current", i === f.cue);
      caption.style.opacity = "1";
      caption.style.transform = `translateY(${(1 - f.entrances[i]!) * 16}px)`;
      caption.style.setProperty("--cue-reveal", String(f.entrances[i]));
    });
    find("[data-equation]").textContent = c.equations[f.cue]!;
    find("[data-equation]").style.transform =
      `translateY(${(1 - f.entrances[f.cue]!) * 12}px)`;
    find("[data-equation]").style.setProperty(
      "--cue-reveal",
      String(f.entrances[f.cue]),
    );
    const divided = f.index >= 1,
      percentage = f.index >= 2;
    find("[data-formula-denominator]").hidden = !divided;
    find("[data-formula-multiply]").hidden = !percentage;
    find("[data-formula-fraction]").classList.toggle("is-divided", divided);
    find("[data-formula-name]").textContent = percentage
      ? "Percentage change ="
      : divided
        ? "Share of the original ="
        : "Change =";
    find("[data-formula-divisions]").innerHTML = divided
      ? Array.from(
          { length: 9 },
          (_, i) => `<path class="story-divider" d="M${24 + i * 20} 22v35"/>`,
        ).join("")
      : "";
    find("[data-formula-hundred]").innerHTML = f.hundred
      ? Array.from(
          { length: 9 },
          (_, i) =>
            `<path class="story-divider" d="M4 ${25.5 + i * 3.5}h200"/>`,
        ).join("")
      : "";
    find("[data-formula-copy]").toggleAttribute("hidden", !divided);
    find("[data-formula-copy]").setAttribute(
      "transform",
      `translate(${(208 * (1 - f.copy)).toFixed(3)} 0)`,
    );
    find("[data-formula-percent]").hidden = !percentage;
    find("[data-formula-b]").hidden =
      f.index < 1 || (f.index === 1 && f.cue < 2);
    find("[data-formula-model-note]").textContent = percentage
      ? "Original: 100%. Increase: 10%. New total: 110%. The original stays intact."
      : "Only the gold addition is new money. The green original was already there.";
    root
      .querySelectorAll<HTMLButtonElement>("[data-moment]")
      .forEach((b, i) => b.setAttribute("aria-pressed", String(i === f.index)));
    root
      .querySelectorAll<HTMLButtonElement | HTMLInputElement>("button,input")
      .forEach((b) => (b.disabled = blocked));
    root
      .querySelectorAll<HTMLElement | SVGElement>("[data-explore]")
      .forEach((e) => {
        e.setAttribute("tabindex", blocked ? "-1" : "0");
        e.setAttribute("aria-disabled", String(blocked));
      });
    find<HTMLButtonElement>('[data-story="previous"]').disabled =
      blocked || f.index === 0;
    find<HTMLButtonElement>('[data-story="next"]').disabled =
      blocked || f.index === 3;
    find('[data-story="play"]').setAttribute(
      "aria-label",
      playing ? "Pause explanation" : "Play explanation",
    );
    const input = find<HTMLInputElement>("input");
    input.value = String(time);
    input.setAttribute(
      "aria-valuetext",
      `${time.toFixed(1)} of 48 seconds. ${c.title}. ${c.captions[f.cue]}`,
    );
    find(".story-time").textContent = `${time.toFixed(1)} / 48 s`;
  }
  function seek(seconds: number) {
    pause();
    time = formulaFrame(seconds).time;
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
      formulaAccents(sound, before, time, motion?.matches ?? false);
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
    mount(host: HTMLElement, avatar: string, beat: number, isBlocked: boolean) {
      blocked = isBlocked;
      if (!root) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = markup(avatar);
        root = wrapper.firstElementChild as HTMLElement;
        root.onclick = (event) => {
          const b = (event.target as Element).closest<HTMLButtonElement>(
            "button",
          );
          if (!b || b.disabled || blocked) return;
          const action = b.dataset.story,
            index = formulaFrame(time).index;
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
            seek(Math.min(3, index + 1) * chapterDuration);
          } else if (action === "replay") {
            sound.cue("model.step");
            seek(0);
          } else if (b.dataset.moment !== undefined) {
            sound.cue("model.step");
            seek(Number(b.dataset.moment) * chapterDuration);
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
          lessons: formulaLessons,
          sound: sound.inspection,
        });
      }
      if (parentBeat !== beat) {
        parentBeat = beat;
        seek(beat * chapterDuration);
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
