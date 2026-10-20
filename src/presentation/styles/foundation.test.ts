/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const tokens = read("src/presentation/styles/tokens.css");
const base = read("src/presentation/styles/base.css");
const values = new Map(
  [...tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
);

function value(name: string): string {
  const text = values.get(name);
  if (!text) throw new Error(`Missing token ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(text);
  return reference?.[1] ? value(reference[1]) : text;
}

function luminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/../g);
  if (rgb?.length !== 3) throw new Error(`Invalid color ${hex}`);
  const [r = 0, g = 0, b = 0] = rgb.map((part) => {
    const s = parseInt(part, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// WOFF2 directory parsing only: no glyph rewriting or installed font tools.
function fontMetadata(bytes: Buffer) {
  expect(bytes.toString("ascii", 0, 4)).toBe("wOF2");
  expect(bytes.readUInt32BE(8)).toBe(bytes.length);
  // Fixed tags, including spaces, are specified by the WOFF2 directory.
  const known = [
    "cmap",
    "head",
    "hhea",
    "hmtx",
    "maxp",
    "name",
    "OS/2",
    "post",
    "cvt ",
    "fpgm",
    "glyf",
    "loca",
    "prep",
    "CFF ",
    "VORG",
    "EBDT",
    "EBLC",
    "gasp",
    "hdmx",
    "kern",
    "LTSH",
    "PCLT",
    "VDMX",
    "vhea",
    "vmtx",
    "BASE",
    "GDEF",
    "GPOS",
    "GSUB",
    "EBSC",
    "JSTF",
    "MATH",
    "CBDT",
    "CBLC",
    "COLR",
    "CPAL",
    "SVG ",
    "sbix",
    "acnt",
    "avar",
    "bdat",
    "bloc",
    "bsln",
    "cvar",
    "fdsc",
    "feat",
    "fmtx",
    "fvar",
    "gvar",
    "hsty",
    "just",
    "lcar",
    "mort",
    "morx",
    "opbd",
    "prop",
    "trak",
    "Zapf",
    "Silf",
    "Glat",
    "Gloc",
    "Feat",
    "Sill",
  ];
  let cursor = 48;
  const uint = () => {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const b = bytes.readUInt8(cursor++);
      result = result * 128 + (b & 127);
      if (!(b & 128)) return result;
    }
    throw new Error("Invalid WOFF2 UIntBase128");
  };
  const records: { tag: string; size: number; offset: number }[] = [];
  let offset = 0;
  for (let i = 0; i < bytes.readUInt16BE(12); i++) {
    const flags = bytes.readUInt8(cursor++);
    let tag = known[flags & 63];
    if ((flags & 63) === 63) {
      tag = bytes.toString("ascii", cursor, cursor + 4);
      cursor += 4;
    }
    if (!tag) throw new Error("Missing WOFF2 table tag");
    let size = uint();
    const transformed = ["glyf", "loca"].includes(tag)
      ? flags >> 6 !== 3
      : flags >> 6 !== 0;
    if (transformed) size = uint();
    records.push({ tag, size, offset });
    offset += size;
  }
  const data = brotliDecompressSync(
    bytes.subarray(cursor, cursor + bytes.readUInt32BE(20)),
  );
  expect(data.length).toBe(offset);
  const table = (tag: string) => {
    const record = records.find((r) => r.tag === tag);
    if (!record) throw new Error(`Missing ${tag}`);
    return data.subarray(record.offset, record.offset + record.size);
  };
  const name = table("name");
  const names: string[] = [];
  for (let i = 0; i < name.readUInt16BE(2); i++) {
    const start = 6 + i * 12;
    const id = name.readUInt16BE(start + 6);
    if (![1, 2, 16, 17].includes(id)) continue;
    const begin = name.readUInt16BE(4) + name.readUInt16BE(start + 10);
    const text = Buffer.from(
      name.subarray(begin, begin + name.readUInt16BE(start + 8)),
    );
    const unicode = [0, 3].includes(name.readUInt16BE(start));
    names.push(
      unicode ? text.swap16().toString("utf16le") : text.toString("latin1"),
    );
  }
  const os2 = table("OS/2");
  return {
    names: names.join(" | "),
    weight: os2.readUInt16BE(4),
    italic: Boolean(os2.readUInt16BE(62) & 1),
  };
}

describe("T038 source-governed visual foundation", () => {
  it("preserves every P-D008 base hue and analytical role", () => {
    const palette = {
      canvas: "#fbf7ef",
      surface: "#ffffff",
      ink: "#263128",
      secondary: "#657064",
      border: "#ddd5c7",
      forest: "#2f6b4f",
      indigo: "#465d9e",
      success: "#3f7a55",
      caution: "#a06b00",
      correction: "#a6453a",
      clay: "#c97a50",
      sage: "#dde8db",
      workspace: "#f5f7f4",
      "technical-ink": "#24332e",
      structural: "#b9c8c0",
    };
    for (const [role, hex] of Object.entries(palette))
      expect(value(`--palette-${role}`)).toBe(hex);
    expect(value("--color-relation")).toBe(palette.forest);
    expect(value("--color-reference")).toBe(palette.indigo);
    expect(value("--color-numerical-emphasis")).toBe(palette.ink);
    expect(value("--color-grid-decorative")).toBe(palette.structural);
  });

  it("measures actual text, focus and meaningful boundary usage pairs", () => {
    for (const bg of [
      "--color-canvas",
      "--color-surface",
      "--color-workspace",
    ]) {
      for (const fg of [
        "--color-text",
        "--color-text-secondary",
        "--color-reference",
        "--color-success",
        "--color-caution-text",
        "--color-correction",
        "--color-technical-text",
      ]) {
        const ratio = contrast(value(fg), value(bg));
        console.log("CONTRAST", fg, bg, ratio.toFixed(3));
        expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const fg of ["--color-border-interactive", "--color-focus"])
        expect(contrast(value(fg), value(bg))).toBeGreaterThanOrEqual(3);
    }
    for (const bg of [
      "--color-action",
      "--color-action-hover",
      "--color-action-pressed",
    ])
      expect(
        contrast(value("--color-on-action"), value(bg)),
      ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        value("--color-selected-text"),
        value("--color-selected-surface"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(value("--palette-caution"), value("--color-canvas")),
    ).toBeLessThan(4.5);
    expect(
      contrast(value("--color-grid-decorative"), value("--color-workspace")),
    ).toBeLessThan(3);
    expect(base).toContain("color: var(--color-caution-text)");
    expect(base).not.toContain("color: var(--palette-caution)");
  });

  it("retains rem hierarchy, compact-first primitives and non-color affordances", () => {
    expect(value("--font-body")).toContain('"Atkinson Hyperlegible"');
    expect(value("--font-heading")).toContain('"Lexend"');
    expect(value("--font-technical")).toContain('"IBM Plex Mono"');
    expect(parseFloat(value("--text-title"))).toBeGreaterThan(
      parseFloat(value("--text-body")),
    );
    expect(value("--workspace-max")).toBe("72rem");
    expect(base).toContain("@media (min-width: 40rem)");
    expect(base).toContain("@media (min-width: 64rem)");
    expect(base).toContain(":focus-visible");
    expect(base).toContain("@media (forced-colors: active)");
    expect(base).toContain("outline-color: Highlight");
    expect(base).toContain("border-inline-start-style: dashed");
    expect(base).toContain("border-inline-start-style: double");
    expect(base).toContain("font-variant-numeric: tabular-nums lining-nums");
    expect(base + tokens).not.toMatch(
      /prefers-color-scheme|@keyframes|animation:|transition:|text-size-adjust:\s*none|font-size:\s*\d+px/,
    );
    expect(base).not.toMatch(/@import\s+url|https?:\/\//);
    expect(base).not.toContain(
      "font-family: var(--font-technical);\n  font-size: var(--text-body)",
    );
  });

  it("authenticates local WOFF2 metadata, exact bytes, CSS mapping and notices", () => {
    const faces = [
      [
        "Lexend-SemiBold",
        "Lexend",
        600,
        false,
        "90341b5a4388f312327333c82fae2a9a3951e75f8f7e71568f25779fb6211a43",
      ],
      [
        "AtkinsonHyperlegible-Regular",
        "Atkinson Hyperlegible",
        400,
        false,
        "2df4ba17804bc7a36f123127966075d8427bff2df58d0d76820c1130bb1a4150",
      ],
      [
        "AtkinsonHyperlegible-Bold",
        "Atkinson Hyperlegible",
        700,
        false,
        "da8fce41a04f8498fbf79076f92d304b12e70c76f71b143c5dcfb6536c93c075",
      ],
      [
        "AtkinsonHyperlegible-Italic",
        "Atkinson Hyperlegible",
        400,
        true,
        "60bedf0954ffa7e7800eddd529b06c7558d09283667c74fef60170d8d241089e",
      ],
      [
        "IBMPlexMono-Regular",
        "IBM Plex Mono",
        400,
        false,
        "ba204497f16b6d334cee9d1e963a831b73e3a56e1d6300a8489d18df7214b350",
      ],
    ] as const;
    const provenance = read("src/assets/fonts/PROVENANCE.md");
    for (const [file, family, weight, italic, hash] of faces) {
      const bytes = readFileSync(
        resolve(root, `src/assets/fonts/${file}.woff2`),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
      const metadata = fontMetadata(bytes);
      console.log("FONT", file, bytes.length, JSON.stringify(metadata));
      expect(metadata.names).toContain(family);
      expect(metadata.names).not.toContain("Next");
      expect(metadata.weight).toBe(weight);
      expect(metadata.italic).toBe(italic);
      const block = base.match(
        new RegExp(`@font-face\\s*\\{[^}]*${file}\\.woff2[^}]*\\}`),
      )?.[0];
      expect(block).toBeDefined();
      expect(block).toContain(`font-weight: ${weight}`);
      expect(block).toContain(`font-style: ${italic ? "italic" : "normal"}`);
      expect(block).toContain("font-display: swap");
      expect(provenance).toContain(hash);
    }
    for (const [file, owner] of [
      ["Lexend", "Lexend Project Authors"],
      ["AtkinsonHyperlegible", "Braille Institute"],
      ["IBMPlexMono", "IBM Corp."],
    ]) {
      const license = read(`src/assets/fonts/${file}-OFL.txt`);
      expect(license).toContain(owner);
      expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
      expect(license).toContain("TERMINATION");
    }
    expect(base.match(/@font-face/g)).toHaveLength(5);
  });

  it("attaches CSS once and preserves the exact S1 declaration", () => {
    expect(
      read("src/main.tsx").match(
        /import "@\/presentation\/styles\/base\.css";/g,
      ),
    ).toHaveLength(1);
    expect(read("src/vite-env.d.ts")).toBe(
      '/// <reference types="vite/client" />\n',
    );
  });

  it("allows only the exact entry CSS edge with loaded ESLint policy", async () => {
    // Load the installed JS API without a new @types package or TS suppression.
    const moduleName: string = "eslint";
    const loaded: unknown = await import(moduleName);
    const { ESLint } = loaded as {
      ESLint: new (options: { cache: boolean }) => {
        lintText(
          text: string,
          options: { filePath: string },
        ): Promise<{ messages: { ruleId: string | null }[] }[]>;
      };
    };
    const engine = new ESLint({ cache: false });
    const main = read("src/main.tsx");
    const cases: [string, string, boolean][] = [
      ["src/main.tsx", main, false],
      ...[
        "@/presentation/styles/tokens.css",
        "@/presentation/styles/base.css/private",
        "@/presentation/styles/base.css.ts",
        "@/presentation/styles/baseXcss",
        "@/presentation/styles/private",
        "@/session/app-machine/private",
        "../presentation/styles/base.css",
        "@/src/presentation/styles/base.css",
        "@/presentation/styles/../styles/base.css",
      ].map((target): [string, string, boolean] => [
        "src/main.tsx",
        `import "${target}";\n`,
        true,
      ]),
      [
        "src/app/bootstrap.tsx",
        'import "@/presentation/styles/base.css";\n',
        true,
      ],
      [
        "src/main.tsx",
        'import type { Private } from "@/session/app-machine/private";\n',
        true,
      ],
    ];
    for (const [filePath, text, denied] of cases) {
      const results = await engine.lintText(text, { filePath });
      const messages = results.flatMap((r) => r.messages);
      expect(
        messages.some((m) => m.ruleId === "no-restricted-imports"),
        `${filePath}: ${text}`,
      ).toBe(denied);
      if (!denied) expect(messages).toEqual([]);
    }
  }, 120_000);
});
