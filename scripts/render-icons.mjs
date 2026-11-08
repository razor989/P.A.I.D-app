// Renders docs/images/icon-foreground.svg into the Android launcher icons and
// splash screens, plus a README icon. Uses the Playwright Chromium already
// installed for the browser tests (npx playwright install chromium).
//
//   node scripts/render-icons.mjs [--preview <dir>]
//
// The adaptive-icon background colour lives in
// android/app/src/main/res/values/ic_launcher_background.xml and must match BACKGROUND.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BACKGROUND = "#2f6b4f"; // --palette-forest
const CANVAS = "#fbf7ef"; // --palette-canvas (app launch background)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android/app/src/main/res");
const svg = readFileSync(join(root, "docs/images/icon-foreground.svg"), "utf8");
const preview = process.argv.indexOf("--preview");
const previewDir = preview > 0 ? resolve(process.argv[preview + 1]) : null;

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const splashes = {
  "port-mdpi": [320, 480],
  "port-hdpi": [480, 800],
  "port-xhdpi": [720, 1280],
  "port-xxhdpi": [960, 1600],
  "port-xxxhdpi": [1280, 1920],
  "land-mdpi": [480, 320],
  "land-hdpi": [800, 480],
  "land-xhdpi": [1280, 720],
  "land-xxhdpi": [1600, 960],
  "land-xxxhdpi": [1920, 1280],
};

/** A w×h page with a centred tile of `tile` px (forest background, clipped
 * to `shape`) showing the 108-unit art at `art` px. art = 1.5 × tile maps the
 * 72-unit visible area of an adaptive icon onto the whole tile. */
function page(
  w,
  h,
  { tile, art = tile, background = "transparent", shape = "none" },
) {
  const clip =
    shape === "circle"
      ? "border-radius:50%;"
      : shape === "square"
        ? `border-radius:${tile * 0.18}px;`
        : "";
  const fill = shape === "none" ? "" : `background:${BACKGROUND};`;
  return `<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;
    background:${background};display:grid;place-items:center">
    <div style="width:${tile}px;height:${tile}px;${fill}${clip}overflow:hidden;
      position:relative">
    ${svg.replace(
      "<svg ",
      `<svg style="position:absolute;left:${(tile - art) / 2}px;top:${(tile - art) / 2}px;width:${art}px;height:${art}px" `,
    )}
    </div></body></html>`;
}

async function shot(browser, file, w, h, html) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html);
  mkdirSync(dirname(file), { recursive: true });
  await p.screenshot({ path: file, omitBackground: true });
  await p.close();
}

const browser = await chromium.launch();
try {
  if (previewDir) {
    for (const px of [48, 96, 192])
      await shot(
        browser,
        join(previewDir, `launcher-${px}.png`),
        px,
        px,
        page(px, px, { tile: px, art: px * 1.5, shape: "square" }),
      );
    await shot(
      browser,
      join(previewDir, "round-192.png"),
      192,
      192,
      page(192, 192, { tile: 192, art: 288, shape: "circle" }),
    );
    await shot(
      browser,
      join(previewDir, "splash-port.png"),
      720,
      1280,
      page(720, 1280, {
        tile: 288,
        art: 432,
        background: CANVAS,
        shape: "circle",
      }),
    );
  } else {
    for (const [d, scale] of Object.entries(densities)) {
      const icon = Math.round(48 * scale);
      const fg = Math.round(108 * scale);
      // Legacy icons flatten the adaptive layers; see page() for the 1.5 scale.
      await shot(
        browser,
        join(res, `mipmap-${d}/ic_launcher.png`),
        icon,
        icon,
        page(icon, icon, { tile: icon, art: icon * 1.5, shape: "square" }),
      );
      await shot(
        browser,
        join(res, `mipmap-${d}/ic_launcher_round.png`),
        icon,
        icon,
        page(icon, icon, { tile: icon, art: icon * 1.5, shape: "circle" }),
      );
      await shot(
        browser,
        join(res, `mipmap-${d}/ic_launcher_foreground.png`),
        fg,
        fg,
        page(fg, fg, { tile: fg }),
      );
    }
    for (const [name, [w, h]] of Object.entries(splashes)) {
      const tile = Math.round(Math.min(w, h) * 0.4);
      await shot(
        browser,
        join(res, `drawable-${name}/splash.png`),
        w,
        h,
        page(w, h, {
          tile,
          art: tile * 1.5,
          background: CANVAS,
          shape: "circle",
        }),
      );
    }
    await shot(
      browser,
      join(res, "drawable/splash.png"),
      480,
      320,
      page(480, 320, {
        tile: 128,
        art: 192,
        background: CANVAS,
        shape: "circle",
      }),
    );
    await shot(
      browser,
      join(root, "docs/images/icon-512.png"),
      512,
      512,
      page(512, 512, { tile: 512, art: 768, shape: "square" }),
    );
  }
} finally {
  await browser.close();
}
