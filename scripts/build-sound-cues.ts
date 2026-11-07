/// <reference types="node" />
// Renders scripts/sound-recipe.ts into the curated production cue files.
//
//   node --experimental-strip-types scripts/build-sound-cues.ts \
//     --source "D:\3 I'S APP\Sounds" [--audition]
//
// Requires ffmpeg with libopus (FFMPEG env var, or ffmpeg on PATH). The source
// libraries are only ever read. Output:
//   src/assets/audio/<file>.ogg            production cues (Ogg Opus, 48 kHz)
//   src/assets/audio/cues.manifest.json    measurements, hashes, sources
//   .tmp/sound-audition/                   (with --audition) primaries and
//                                          alternates for the owner's A/B page
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recipe } from "./sound-recipe.ts";
import type { CueFile, Layer, SynthId } from "./sound-recipe.ts";

const RATE = 48000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src/assets/audio");
const auditionDir = join(root, ".tmp/sound-audition");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourceRoot = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
const audition = args.includes("--audition");
if (!sourceRoot || !existsSync(sourceRoot))
  throw new Error('Pass --source "<Sounds library root>"');

type Buffer2 = Float32Array[]; // one Float32Array per channel

/* ───────────────────────── decoding ───────────────────────── */

function decode(layer: Layer, channels: 1 | 2): Buffer2 {
  const path = join(sourceRoot as string, layer.source as string);
  if (!existsSync(path)) throw new Error(`Missing source: ${path}`);
  const filters = [`aresample=${RATE}`];
  if (layer.cents)
    filters.push(
      `asetrate=${Math.round(RATE * 2 ** (layer.cents / 1200))}`,
      `aresample=${RATE}`,
    );
  if (layer.highpassHz) filters.push(`highpass=f=${layer.highpassHz}`);
  if (layer.lowpassHz) filters.push(`lowpass=f=${layer.lowpassHz}`);
  if (layer.shelfDb) filters.push(`treble=g=${layer.shelfDb}:f=8000`);
  const run = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", path, "-af", filters.join(","), "-ac", String(channels), "-f", "f32le", "-"],
    { maxBuffer: 1 << 28 },
  );
  if (run.status !== 0) throw new Error(`ffmpeg decode failed: ${path}\n${run.stderr}`);
  const raw = new Float32Array(
    run.stdout.buffer,
    run.stdout.byteOffset,
    run.stdout.byteLength / 4,
  );
  const frames = raw.length / channels;
  const out: Buffer2 = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let ch = 0; ch < channels; ch++) out[ch]![i] = raw[i * channels + ch]!;
  return out;
}

/* ───────────────────────── generated layers ───────────────────────── */

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pink(n: number, seed: number) {
  // Paul Kellet's economy pink filter over seeded white noise.
  const random = rng(seed);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
  }
  return out;
}

/** RBJ biquad with a per-block time-varying frequency (TDF-II). */
function biquad(
  input: Float32Array,
  type: "bandpass" | "highpass" | "lowpass",
  freq: (t: number) => number,
  q: number,
) {
  const out = new Float32Array(input.length);
  let z1 = 0, z2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % 32 === 0) {
      const w0 = (2 * Math.PI * Math.min(freq(i / input.length), RATE * 0.45)) / RATE;
      const alpha = Math.sin(w0) / (2 * q);
      const cos = Math.cos(w0);
      const a0 = 1 + alpha;
      if (type === "bandpass") {
        b0 = alpha / a0; b1 = 0; b2 = -alpha / a0;
      } else if (type === "highpass") {
        b0 = (1 + cos) / 2 / a0; b1 = -(1 + cos) / a0; b2 = b0;
      } else {
        b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = b0;
      }
      a1 = (-2 * cos) / a0;
      a2 = (1 - alpha) / a0;
    }
    const x = input[i]!;
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    out[i] = y;
  }
  return out;
}

const lerp = (from: number, to: number) => (t: number) => from * (to / from) ** t;

/** Smooth swell: raised-cosine rise to `peakAt`, then a gentler fall. */
function envelope(n: number, peakAt: number, fallPower = 1.6) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out[i] =
      t < peakAt
        ? 0.5 - 0.5 * Math.cos((Math.PI * t) / peakAt)
        : (0.5 + 0.5 * Math.cos((Math.PI * (t - peakAt)) / (1 - peakAt))) ** fallPower;
  }
  return out;
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! * b[i]!;
  return out;
}

/** Paper grain: slow random amplitude flutter around 1. */
function grain(n: number, seed: number, depth: number) {
  const random = rng(seed);
  const out = new Float32Array(n);
  let target = 1, value = 1;
  for (let i = 0; i < n; i++) {
    if (i % 300 === 0) target = 1 - depth + random() * depth * 2;
    value += (target - value) * 0.01;
    out[i] = value;
  }
  return out;
}

function crackle(n: number, seed: number, perSecond: number, decayMs: number) {
  const random = rng(seed);
  const out = new Float32Array(n);
  const p = perSecond / RATE;
  const decay = Math.exp(-1 / ((decayMs / 1000) * RATE));
  let amp = 0;
  for (let i = 0; i < n; i++) {
    if (random() < p) amp = 0.35 + random() * 0.65;
    out[i] = (random() * 2 - 1) * amp;
    amp *= decay;
  }
  return out;
}

const ms = (value: number) => Math.round((value / 1000) * RATE);

function synth(id: SynthId, channels: 1 | 2): Buffer2 {
  const make = (seed: number): Float32Array => {
    switch (id) {
      case "air-rise": {
        const n = ms(460);
        const noise = biquad(pink(n, seed), "bandpass", lerp(900, 2600), 0.7);
        return multiply(noise, envelope(n, 0.78, 1.2));
      }
      case "air-fall": {
        const n = ms(420);
        const noise = biquad(pink(n, seed), "bandpass", lerp(2600, 800), 0.7);
        return multiply(noise, envelope(n, 0.18, 1.8));
      }
      case "paper-slide": {
        const n = ms(320);
        const hp = biquad(pink(n, seed), "highpass", () => 1500, 0.7);
        const bp = biquad(hp, "bandpass", lerp(2500, 4200), 0.9);
        return multiply(multiply(bp, envelope(n, 0.4, 1.4)), grain(n, seed + 7, 0.3));
      }
      case "paper-slide-back": {
        const n = ms(300);
        const hp = biquad(pink(n, seed), "highpass", () => 1400, 0.7);
        const bp = biquad(hp, "bandpass", lerp(4200, 2200), 0.9);
        return multiply(multiply(bp, envelope(n, 0.25, 1.6)), grain(n, seed + 7, 0.3));
      }
      case "perforation": {
        const n = ms(130);
        const dots = biquad(crackle(n, seed, 260, 0.6), "bandpass", () => 3500, 1.2);
        return multiply(dots, envelope(n, 0.6, 1));
      }
      case "release": {
        const n = ms(90);
        const dots = biquad(crackle(n, seed, 900, 0.5), "bandpass", () => 3800, 1);
        const body = biquad(pink(n, seed + 3), "lowpass", () => 600, 0.7);
        const mixed = new Float32Array(n);
        for (let i = 0; i < n; i++) mixed[i] = dots[i]! + body[i]! * 0.6;
        return multiply(mixed, envelope(n, 0.12, 2.2));
      }
      case "split-swish": {
        const n = ms(340);
        // Channel 0 sweeps down, channel 1 up: the sheet parts outwards.
        const sweep = seed % 2 ? lerp(1200, 2800) : lerp(2800, 1200);
        const noise = biquad(pink(n, seed), "bandpass", sweep, 0.8);
        return multiply(noise, envelope(n, 0.3, 1.5));
      }
      case "page-turn": {
        const n = ms(260);
        const hp = biquad(pink(n, seed), "highpass", () => 1200, 0.7);
        const bp = biquad(hp, "bandpass", lerp(3200, 1800), 0.9);
        return multiply(multiply(bp, envelope(n, 0.3, 1.6)), grain(n, seed + 7, 0.35));
      }
      case "grow": {
        const n = ms(380);
        const bp = biquad(pink(n, seed), "bandpass", lerp(700, 1700), 0.8);
        const soft = biquad(bp, "lowpass", () => 3000, 0.7);
        return multiply(soft, envelope(n, 0.7, 1.4));
      }
      case "startup-air": {
        const n = ms(520);
        const noise = biquad(pink(n, seed), "bandpass", lerp(600, 1800), 0.7);
        return multiply(noise, envelope(n, 0.85, 1.2));
      }
    }
  };
  // Decorrelated channels give quiet width without phasey panning.
  return Array.from({ length: channels }, (_, ch) => make(1000 + ch));
}

/* ───────────────────────── editing ───────────────────────── */

const db = (value: number) => 10 ** (value / 20);
const toDb = (value: number) => 20 * Math.log10(Math.max(value, 1e-9));

function peakOf(buffer: Buffer2) {
  let peak = 0;
  for (const ch of buffer) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  return peak;
}

function edit(buffer: Buffer2, layer: Layer): Buffer2 {
  let channels = buffer.map((ch) => ch.slice());
  if (layer.reverse) channels = channels.map((ch) => ch.reverse());
  const frames = channels[0]!.length;
  const peak = peakOf(channels);
  const level = (i: number) => Math.max(...channels.map((ch) => Math.abs(ch[i]!)));
  let start = 0;
  let end = frames;
  if (layer.startMs !== undefined) start = ms(layer.startMs);
  else {
    const floor = peak * db(-50);
    while (start < frames && level(start) < floor) start++;
    start = Math.max(0, start - ms(2));
  }
  if (layer.endMs !== undefined) end = Math.min(frames, ms(layer.endMs));
  else {
    const floor = peak * db(-60);
    while (end > start + 1 && level(end - 1) < floor) end--;
  }
  const length = end - start;
  const fadeOut = Math.min(ms(layer.fadeOutMs ?? 30), Math.floor(length * 0.3));
  const fadeIn = Math.min(ms(0.5), length);
  const gain = db(layer.gainDb ?? 0);
  return channels.map((ch) => {
    const out = ch.slice(start, end);
    for (let i = 0; i < out.length; i++) {
      let g = gain;
      if (i < fadeIn) g *= i / fadeIn;
      const fromEnd = out.length - 1 - i;
      if (fromEnd < fadeOut) g *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / fadeOut);
      out[i] = out[i]! * g;
    }
    return out;
  });
}

function render(layers: readonly Layer[], channels: 1 | 2): Buffer2 {
  const parts = layers.map((layer) => {
    const raw =
      typeof layer.source === "string" ? decode(layer, channels) : synth(layer.source.synth, channels);
    return { at: ms(layer.at ?? 0), audio: edit(raw, layer) };
  });
  const frames = Math.max(...parts.map((p) => p.at + p.audio[0]!.length));
  const mix: Buffer2 = Array.from({ length: channels }, () => new Float32Array(frames));
  for (const { at, audio } of parts)
    for (let ch = 0; ch < channels; ch++)
      for (let i = 0; i < audio[ch]!.length; i++) (mix[ch] as Float32Array)[at + i] += (audio[ch] as Float32Array)[i] as number;
  return mix;
}

/** Loudest 30 ms RMS window across channels. */
function shortTermLevel(buffer: Buffer2) {
  const w = ms(30);
  const hop = ms(5);
  const frames = buffer[0]!.length;
  let best = 0;
  for (let start = 0; start < Math.max(1, frames - w + 1); start += hop) {
    let sum = 0;
    let count = 0;
    for (const ch of buffer)
      for (let i = start; i < Math.min(frames, start + w); i++) {
        sum += ch[i]! * ch[i]!;
        count++;
      }
    best = Math.max(best, Math.sqrt(sum / Math.max(1, count)));
  }
  return best;
}

const PEAK_CEILING = db(-3);

function level(buffer: Buffer2, targetDb: number) {
  const current = shortTermLevel(buffer);
  let gain = db(targetDb) / current;
  const peak = peakOf(buffer) * gain;
  if (peak > PEAK_CEILING) gain *= PEAK_CEILING / peak;
  const out = buffer.map((ch) => ch.map((v) => v * gain));
  return { audio: out, levelDb: toDb(shortTermLevel(out)), peakDb: toDb(peakOf(out)) };
}

/* ───────────────────────── encoding ───────────────────────── */

function encode(buffer: Buffer2, path: string) {
  const channels = buffer.length;
  const frames = buffer[0]!.length;
  const interleaved = new Float32Array(frames * channels);
  for (let i = 0; i < frames; i++)
    for (let ch = 0; ch < channels; ch++) interleaved[i * channels + ch] = buffer[ch]![i]!;
  mkdirSync(dirname(path), { recursive: true });
  const run = spawnSync(
    ffmpeg,
    [
      "-v", "error", "-y",
      "-f", "f32le", "-ar", String(RATE), "-ac", String(channels), "-i", "-",
      "-c:a", "libopus", "-b:a", channels === 1 ? "96k" : "128k",
      "-vbr", "on", "-compression_level", "10", "-application", "audio",
      "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
      path,
    ],
    { input: Buffer.from(interleaved.buffer) },
  );
  if (run.status !== 0) throw new Error(`ffmpeg encode failed: ${path}\n${run.stderr}`);
  const bytes = readFileSync(path);
  return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/* ───────────────────────── build ───────────────────────── */

const describe = (layer: Layer) => ({
  lib: layer.lib,
  source: typeof layer.source === "string" ? layer.source : `generated:${layer.source.synth}`,
  ...(layer.at ? { atMs: layer.at } : {}),
  ...(layer.gainDb ? { gainDb: layer.gainDb } : {}),
  ...(layer.cents ? { cents: layer.cents } : {}),
  ...(layer.startMs !== undefined ? { startMs: layer.startMs } : {}),
  ...(layer.endMs !== undefined ? { endMs: layer.endMs } : {}),
  ...(layer.reverse ? { reverse: true } : {}),
  ...(layer.highpassHz ? { highpassHz: layer.highpassHz } : {}),
  ...(layer.lowpassHz ? { lowpassHz: layer.lowpassHz } : {}),
  ...(layer.shelfDb ? { shelf8kDb: layer.shelfDb } : {}),
});

function build(cue: CueFile, layers: readonly Layer[], channels: 1 | 2, path: string) {
  const { audio, levelDb, peakDb } = level(render(layers, channels), cue.targetDb);
  const { bytes, sha256 } = encode(audio, path);
  return {
    channels,
    durationMs: Math.round((audio[0]!.length / RATE) * 1000),
    levelDb: Math.round(levelDb * 10) / 10,
    peakDb: Math.round(peakDb * 10) / 10,
    bytes,
    sha256,
  };
}

mkdirSync(outDir, { recursive: true });
for (const stale of readdirSync(outDir).filter((f) => f.endsWith(".ogg")))
  rmSync(join(outDir, stale));
if (audition) rmSync(auditionDir, { recursive: true, force: true });

const manifest = [];
const auditionManifest = [];
for (const cue of recipe) {
  const result = build(cue, cue.layers, cue.channels, join(outDir, `${cue.file}.ogg`));
  manifest.push({
    file: `${cue.file}.ogg`,
    category: cue.category,
    role: cue.role,
    targetDb: cue.targetDb,
    ...result,
    layers: cue.layers.map(describe),
  });
  console.log(
    `${cue.file.padEnd(22)} ${String(result.durationMs).padStart(5)} ms  level ${result.levelDb} dB  peak ${result.peakDb} dB  ${result.bytes} B`,
  );
  if (audition) {
    const entries = [
      { label: "Primary (in app)", path: `${cue.file}/primary.ogg`, layers: cue.layers.map(describe) },
    ];
    build(cue, cue.layers, cue.channels, join(auditionDir, cue.file, "primary.ogg"));
    (cue.alternates ?? []).forEach((alt, i) => {
      const rel = `${cue.file}/alt-${i + 1}.ogg`;
      build(cue, alt.layers, alt.channels ?? cue.channels, join(auditionDir, rel));
      entries.push({ label: alt.label, path: rel, layers: alt.layers.map(describe) });
    });
    auditionManifest.push({ file: cue.file, category: cue.category, role: cue.role, entries });
  }
}

writeFileSync(join(outDir, "cues.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
if (audition)
  writeFileSync(join(auditionDir, "manifest.json"), `${JSON.stringify(auditionManifest, null, 2)}\n`);
const total = manifest.reduce((sum, m) => sum + m.bytes, 0);
console.log(`\n${manifest.length} cue files, ${(total / 1024).toFixed(1)} KB total`);

// PROVENANCE.md is generated with the cues so it can never drift from them.
const libraries: Record<string, string> = {
  D: "Clean UI – 20 Minimal Interaction Sounds (R4orce) — CleanUI-License.txt",
  E: "Soft Signal Free Minimal UI SFX Pack v1.0.0 — SoftSignal-LICENSE.txt",
  B: "Free Natural SFX Pack (cicifyre) — NaturalSFX-readme.txt",
  A: "Epic Stock Media – Smart UI (Notification one-shots) — ESM-NOTICE.txt",
  C: "“MACOS GOLDEN GATE SFX” folder (no licence) — MACOS-RISK-ACCEPTANCE.txt",
  S: "Generated by scripts/build-sound-cues.ts (seeded, no source audio)",
};
const processing = (l: Record<string, unknown>) =>
  [
    l.atMs !== undefined && `at ${l.atMs} ms`,
    l.endMs !== undefined && `cut ${l.endMs} ms`,
    l.cents !== undefined && `${Number(l.cents) > 0 ? "+" : ""}${l.cents} cents`,
    l.gainDb !== undefined && `${l.gainDb} dB`,
    l.highpassHz !== undefined && `HP ${l.highpassHz} Hz`,
    l.shelf8kDb !== undefined && `8 kHz shelf ${l.shelf8kDb} dB`,
  ]
    .filter(Boolean)
    .join(", ");
const lines = [
  "# Sound-effect provenance",
  "",
  "Generated by `scripts/build-sound-cues.ts` from `scripts/sound-recipe.ts`.",
  "Do not edit by hand: change the recipe and rebuild. Source libraries stay",
  "outside the repository (read-only); only these processed cues ship.",
  "",
  "Every cue: decoded to 48 kHz float, leading silence trimmed (2 ms pre-roll),",
  "tail cut at −60 dB re peak with a raised-cosine fade, high-passed, layered,",
  "levelled to its category target (30 ms-window RMS) with peaks ≤ −3 dBFS,",
  "encoded as Ogg Opus (libopus, 96 kb/s mono / 128 kb/s stereo, bit-exact).",
  "",
  "## Libraries",
  "",
  "| Key | Library and retained notice |",
  "|---|---|",
  ...Object.entries(libraries).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Cues",
  "",
  "| File | Layers (library: source file — processing) | ms | Level dB | Peak dB | SHA-256 |",
  "|---|---|---|---|---|---|",
  ...manifest.map(
    (m) =>
      `| ${m.file} | ${m.layers
        .map((l) => {
          const r = l as Record<string, unknown>;
          const name = String(r.source).split("/").pop();
          const p = processing(r);
          return `${String(r.lib)}: ${name}${p ? ` — ${p}` : ""}`;
        })
        .join("<br>")} | ${m.durationMs} | ${m.levelDb} | ${m.peakDb} | ${m.sha256} |`,
  ),
  "",
  `${manifest.length} files, ${total} bytes.`,
  "",
];
writeFileSync(join(outDir, "PROVENANCE.md"), lines.join("\n"));
