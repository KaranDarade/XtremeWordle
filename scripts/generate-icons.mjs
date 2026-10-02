#!/usr/bin/env node
/**
 * Regenerates the app icons from `src/app/icon.svg`.
 *
 * The repo intentionally ships no image toolchain, so this reuses the Playwright
 * Chromium that the E2E suite already installs to rasterise the SVG, then
 * hand-assembles the multi-size `.ico` container (PNGs embedded, which every
 * modern browser understands). No new dependencies.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes: src/app/favicon.ico (16/32/48) and src/app/apple-icon.png (180).
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_PATH = join(root, "src", "app", "icon.svg");
const ICO_PATH = join(root, "src", "app", "favicon.ico");
const APPLE_PATH = join(root, "src", "app", "apple-icon.png");

const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;
const APPLE_BG = "#c98f43";

/** Apple touch icons must be opaque and full-bleed (iOS applies its own radius). */
function appleVariant(svg) {
  return svg
    .replace(/x="0\.5" y="0\.5" width="31" height="31"/g, 'x="0" y="0" width="32" height="32"')
    .replace(/rx="7\.5"/g, 'rx="0"')
    .replace(/stroke-opacity="0\.55"/g, 'stroke-opacity="0"');
}

async function render(page, svg, size, { opaque }) {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${
      opaque ? APPLE_BG : "transparent"
    }}img{display:block;width:${size}px;height:${size}px}</style><img src="${dataUrl}" alt="">`,
  );
  await page.evaluate(async () => {
    await document.querySelector("img").decode();
  });
  return page.screenshot({
    omitBackground: !opaque,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

/** Minimal ICO writer: header + directory + PNG payloads. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at); // width
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1); // height
    directory.writeUInt8(0, at + 2); // palette size
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

const svg = await readFile(SVG_PATH, "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

try {
  const entries = [];
  for (const size of ICO_SIZES) {
    entries.push({ size, png: await render(page, svg, size, { opaque: false }) });
  }
  const ico = buildIco(entries);
  await writeFile(ICO_PATH, ico);

  const apple = await render(page, appleVariant(svg), APPLE_SIZE, { opaque: true });
  await writeFile(APPLE_PATH, apple);

  console.log(`favicon.ico     ${ICO_SIZES.join("/")}px  (${ico.length} bytes)`);
  console.log(`apple-icon.png  ${APPLE_SIZE}px       (${apple.length} bytes)`);
} finally {
  await browser.close();
}
