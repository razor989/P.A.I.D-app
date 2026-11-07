import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cueFiles, cues } from "./cues";

const audioDir = resolve(
  fileURLToPath(import.meta.url),
  "../../../assets/audio",
);
const manifest = JSON.parse(
  readFileSync(join(audioDir, "cues.manifest.json"), "utf8"),
) as { file: string; sha256: string; bytes: number }[];
const provenance = readFileSync(join(audioDir, "PROVENANCE.md"), "utf8");
const shipped = readdirSync(audioDir).filter((f) => f.endsWith(".ogg"));
const referenced = Object.values(cueFiles).map((href) =>
  basename(decodeURIComponent(new URL(href, "file:///").pathname)),
);

describe("bundled sound cues", () => {
  it("references only curated files that exist, and ships no orphans", () => {
    expect([...referenced].sort()).toEqual([...shipped].sort());
    expect(manifest.map((m) => m.file).sort()).toEqual([...shipped].sort());
  });

  it("maps every semantic cue to known files", () => {
    for (const [id, spec] of Object.entries(cues)) {
      expect(spec.files.length, id).toBeGreaterThan(0);
      for (const file of spec.files) expect(cueFiles).toHaveProperty(file);
    }
  });

  it("is Ogg Opus, matches its recorded hash and provenance", () => {
    for (const entry of manifest) {
      const bytes = readFileSync(join(audioDir, entry.file));
      expect(bytes.subarray(0, 4).toString("latin1"), entry.file).toBe("OggS");
      expect(bytes.subarray(28, 36).toString("latin1"), entry.file).toBe(
        "OpusHead",
      );
      const sha = createHash("sha256").update(bytes).digest("hex");
      expect(sha, entry.file).toBe(entry.sha256);
      expect(provenance).toContain(`| ${entry.file} |`);
      expect(provenance).toContain(sha);
    }
  });

  it("stays within the audio budget", () => {
    const total = shipped.reduce(
      (sum, f) => sum + statSync(join(audioDir, f)).size,
      0,
    );
    expect(total).toBeLessThanOrEqual(400 * 1024);
  });

  it("keeps every licence notice beside the assets", () => {
    for (const notice of [
      "CleanUI-License.txt",
      "SoftSignal-LICENSE.txt",
      "NaturalSFX-readme.txt",
      "ESM-NOTICE.txt",
      "MACOS-RISK-ACCEPTANCE.txt",
    ]) {
      expect(statSync(join(audioDir, notice)).size, notice).toBeGreaterThan(0);
      expect(provenance).toContain(notice);
    }
  });
});
