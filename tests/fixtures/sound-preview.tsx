import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  createSoundEngine,
  SoundProvider,
  SoundToggle,
  useSound,
  type CueId,
  type SequenceLayer,
  type SoundCueEventDetail,
} from "@/presentation/audio/public";
import { cues } from "@/presentation/audio/cues";
import { SOUND_CUE_EVENT } from "@/presentation/audio/engine";
import manifest from "@/assets/audio/cues.manifest.json";
import "@/presentation/styles/base.css";

// Development audition only: served by the Vite dev server, never built.
// Alternates come from `.tmp/sound-audition/` (scripts/build-sound-cues.ts
// --audition); the cue board and the embedded app use the shipped cues.

type Entry = { label: string; path: string; layers: Layer[] };
type Layer = Record<string, string | number>;
type Audition = {
  file: string;
  category: string;
  role: string;
  entries: Entry[];
};
type Logged = SoundCueEventDetail & { t: number };

const engine = createSoundEngine({ load: () => null, save: () => {} });
const busOrder = [
  "ui",
  "model",
  "navigation",
  "feedback",
  "milestone",
] as const;
const page: CSSProperties = {
  maxWidth: "72rem",
  margin: "auto",
  padding: "1rem",
};
const grid: CSSProperties = {
  display: "grid",
  gap: ".5rem",
  gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
};
const card: CSSProperties = {
  border: "1px solid rgb(38 49 40 / .2)",
  borderRadius: ".6rem",
  padding: ".6rem .75rem",
  background: "rgb(255 255 255 / .6)",
};
const small: CSSProperties = { fontSize: ".8rem", opacity: 0.75, margin: 0 };

const stats = new Map(manifest.map((m) => [m.file.replace(/\.ogg$/, ""), m]));
const describe = (layer: Layer) =>
  [
    String(layer.source ?? "")
      .split("/")
      .pop(),
    ...Object.entries(layer)
      .filter(([k]) => k !== "source" && k !== "lib")
      .map(([k, v]) => `${k} ${v}`),
  ].join(" · ");

function CueBoard() {
  const sound = useSound();
  return (
    <section>
      <h2>Cue board (as shipped)</h2>
      <p style={small}>
        Plays through the same engine as the app: cooldowns, variants, levels
        and the master gain all apply. Click once anywhere to allow audio.
      </p>
      {busOrder.map((bus) => (
        <div key={bus}>
          <h3 style={{ textTransform: "capitalize" }}>{bus}</h3>
          <div style={grid}>
            {(Object.keys(cues) as CueId[])
              .filter((id) => cues[id].bus === bus)
              .map((id) => (
                <div key={id} style={card}>
                  <button type="button" onClick={() => sound.play(id)}>
                    ▶ {id}
                  </button>
                  {cues[id].files.map((file) => {
                    const m = stats.get(file);
                    return (
                      <p key={file} style={small}>
                        {file}
                        {m &&
                          ` — ${m.durationMs} ms, ${m.levelDb} dB, peak ${m.peakDb} dB`}
                      </p>
                    );
                  })}
                  {cues[id].gainDb !== 0 && (
                    <p style={small}>cue gain {cues[id].gainDb} dB</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Alternates() {
  const [audition, setAudition] = useState<Audition[] | null | "missing">(null);
  useEffect(() => {
    fetch("/.tmp/sound-audition/manifest.json")
      .then((r): Promise<Audition[] | "missing"> | "missing" =>
        r.ok ? (r.json() as Promise<Audition[]>) : "missing",
      )
      .then(
        (value) => setAudition(value),
        () => setAudition("missing"),
      );
  }, []);
  return (
    <section>
      <h2>Primary vs alternates (A/B)</h2>
      {audition === "missing" ? (
        <p>
          No audition renders found. Run{" "}
          <code>
            node --experimental-strip-types scripts/build-sound-cues.ts --source
            &quot;D:/3 I&apos;S APP/Sounds&quot; --audition
          </code>
          . To swap a cue, edit its line in <code>scripts/sound-recipe.ts</code>{" "}
          and rebuild.
        </p>
      ) : !audition ? (
        <p>Loading…</p>
      ) : (
        <div style={grid}>
          {audition.map((a) => (
            <div key={a.file} style={card}>
              <strong>{a.file}</strong>
              <p style={small}>{a.role}</p>
              {a.entries.map((e) => (
                <div key={e.path} style={{ marginTop: ".4rem" }}>
                  <p style={{ ...small, opacity: 1 }}>{e.label}</p>
                  <audio
                    controls
                    preload="none"
                    src={`/.tmp/sound-audition/${e.path}`}
                    style={{ width: "100%", height: "2rem" }}
                  />
                  {e.layers.map((l, i) => (
                    <p key={i} style={small}>
                      {String(l.lib)}: {describe(l)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The real app, with its real choreography; its cue events are logged so a
 * sequence can be replayed and judged against the motion it accompanies. */
function InContext() {
  const sound = useSound();
  const frame = useRef<HTMLIFrameElement>(null);
  const [log, setLog] = useState<Logged[]>([]);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    let detach = () => {};
    const attach = () => {
      detach();
      const win = node.contentWindow;
      if (!win) return;
      const listener = (event: Event) => {
        const detail = (event as CustomEvent<SoundCueEventDetail>).detail;
        setLog((l) => [{ ...detail, t: performance.now() }, ...l].slice(0, 80));
      };
      win.addEventListener(SOUND_CUE_EVENT, listener);
      detach = () => win.removeEventListener(SOUND_CUE_EVENT, listener);
    };
    node.addEventListener("load", attach);
    attach();
    return () => {
      node.removeEventListener("load", attach);
      detach();
    };
  }, []);
  const sequences = [
    ...new Set(log.filter((l) => l.sequence).map((l) => l.sequence!)),
  ];
  const replay = (name: string) => {
    // The most recent run of that sequence, in its recorded offsets.
    const latest = log.find((l) => l.sequence === name)!;
    const run = log.filter(
      (l) => l.sequence === name && Math.abs(l.t - latest.t) < 3000,
    );
    const layers: SequenceLayer[] = run.map((l) => ({
      cue: l.cue,
      at: l.atMs,
    }));
    sound.sequence(`replay:${name}`, layers);
  };
  return (
    <section>
      <h2>In context</h2>
      <p style={small}>
        The production app below plays its own cues (startup ident, unfold /
        fold, chapter enter / return, feedback, completion). Use its own sound
        switch to mute it. Recorded sequences can be replayed here on their own.
      </p>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
        }}
      >
        <iframe
          ref={frame}
          src="/"
          title="P.A.I.D. app"
          style={{
            width: "100%",
            height: "44rem",
            border: "1px solid #ccc",
            borderRadius: ".5rem",
          }}
        />
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
            {sequences.map((name) => (
              <button key={name} type="button" onClick={() => replay(name)}>
                Replay {name}
              </button>
            ))}
            <button type="button" onClick={() => setLog([])}>
              Clear log
            </button>
          </div>
          <ol
            style={{
              ...small,
              maxHeight: "40rem",
              overflow: "auto",
              paddingInlineStart: "1.2rem",
            }}
          >
            {log.map((l, i) => (
              <li key={i}>
                {l.sequence ? `${l.sequence} +${l.atMs} ms · ` : ""}
                {l.cue}
                {l.audible ? "" : " (silent: locked or muted)"}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** About thirty seconds of a plausible learner session, for judging fatigue. */
const session: [number, CueId][] = [
  [0, "ui.select"],
  [700, "ui.select"],
  [1500, "nav.settle"],
  [3000, "ui.select"],
  [3800, "chapter.seal"],
  [5200, "model.step"],
  [6000, "model.step"],
  [6900, "model.step"],
  [7600, "model.tick"],
  [7800, "model.tick"],
  [8100, "model.tick"],
  [9500, "model.select"],
  [11000, "model.step"],
  [12500, "response.recorded"],
  [14500, "ui.open"],
  [16000, "ui.close"],
  [17500, "model.select"],
  [18200, "model.step"],
  [19800, "feedback.part.reconsider"],
  [22000, "feedback.part.affirm"],
  [23500, "model.snap"],
  [25000, "model.reveal"],
  [26500, "feedback.reconsider"],
  [28000, "feedback.affirm"],
  [30000, "activity.complete"],
];

function SessionSimulation() {
  const sound = useSound();
  const timers = useRef<number[]>([]);
  const [running, setRunning] = useState(false);
  const stop = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setRunning(false);
  };
  useEffect(() => stop, []);
  return (
    <section>
      <h2>Learner session (≈ 30 s)</h2>
      <p style={small}>
        A fixed script of everyday cues ending in a completion, to judge
        loudness balance and listening fatigue.
      </p>
      <button
        type="button"
        onClick={() => {
          if (running) return stop();
          setRunning(true);
          timers.current = session.map(([at, cue]) =>
            window.setTimeout(() => sound.play(cue), at),
          );
          timers.current.push(window.setTimeout(stop, 31500));
        }}
      >
        {running ? "Stop" : "Play session"}
      </button>
    </section>
  );
}

function Preview() {
  return (
    <main style={page}>
      <header style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ marginInlineEnd: "auto" }}>P.A.I.D. sound audition</h1>
        <SoundToggle />
      </header>
      <p style={small}>
        Development only. Not a production route; it is not part of{" "}
        <code>vite build</code>.
      </p>
      <CueBoard />
      <SessionSimulation />
      <Alternates />
      <InContext />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <SoundProvider engine={engine}>
    <Preview />
  </SoundProvider>,
);
