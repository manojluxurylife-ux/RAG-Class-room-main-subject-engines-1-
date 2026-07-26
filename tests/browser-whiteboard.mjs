import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server", "--proxy-bypass-list=<-loopback>"] });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3100/whiteboard-test", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector('[data-testid="whiteboard-engine"]', { timeout: 60000 });
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="whiteboard-engine"]')?.getAttribute('data-command-index')) >= 7, null, { timeout: 30000 });
  const result = await page.evaluate(() => {
    const engine = document.querySelector('[data-testid="whiteboard-engine"]');
    const canvas = engine?.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return {
      page: Number(engine?.getAttribute('data-page')),
      commandIndex: Number(engine?.getAttribute('data-command-index')),
      canvasWidth: rect?.width,
      canvasHeight: rect?.height,
      buttons: Array.from(engine?.querySelectorAll('button') || []).map(b => b.getAttribute('aria-label') || b.getAttribute('title')),
    };
  });
  assert.equal(result.commandIndex, 7);
  assert.ok(result.page >= 1, "overflow should create a later board page");
  assert.equal(result.canvasWidth, 360);
  assert.equal(result.canvasHeight, 190);
  assert.ok(result.buttons.includes("Replay whiteboard"));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/mnt/data/whiteboard-browser-test.png" });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
