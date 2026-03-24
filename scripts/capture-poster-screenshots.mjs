#!/usr/bin/env node
/**
 * Capture screenshots for the UniGuard poster.
 * Run with: node scripts/capture-poster-screenshots.mjs
 *
 * Prerequisites:
 *   1. App must be running: npm run dev (or dev:all)
 *   2. Install Playwright: npx playwright install chromium
 *
 * The script will open a browser. Log in if prompted, then it will
 * capture screenshots automatically.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "poster-screenshots");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const WAIT_FOR_LOGIN_MS = parseInt(process.env.WAIT_FOR_LOGIN_MS || "15000", 10);
const VIEWPORT = { width: 1280, height: 800 };

const PAGES = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/dashboard", name: "nexus" }, // nexus 3D is on dashboard
  { path: "/transactions", name: "receipt" }, // will try to open receipt modal
  { path: "/companion", name: "companion" },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("UniGuard Poster Screenshot Capture");
  console.log("===================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output:  ${OUTPUT_DIR}`);
  console.log("");
  console.log("Opening browser... Log in if you see the auth page.");
  console.log(`Waiting ${WAIT_FOR_LOGIN_MS / 1000}s for you to log in...`);
  console.log("");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.error("Could not reach app. Is it running? Try: npm run dev");
    console.error(e.message);
    await browser.close();
    process.exit(1);
  }

  // Wait for user to log in if needed
  await page.waitForTimeout(WAIT_FOR_LOGIN_MS);

  const seen = new Set();
  for (const { path, name } of PAGES) {
    if (seen.has(name)) continue;
    seen.add(name);

    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(2000);

      if (name === "receipt") {
        // Open receipt scanner modal (floating button with title "Scan Receipt")
        const scanBtn = page.getByTitle("Scan Receipt");
        if (await scanBtn.isVisible()) {
          await scanBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      if (name === "nexus") {
        await page.waitForTimeout(3000); // Wait for 3D to render
      }

      const outPath = join(OUTPUT_DIR, `${name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  ✓ ${name}.png`);
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log("");
  console.log("Done! Screenshots saved to poster-screenshots/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
