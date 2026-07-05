#!/usr/bin/env node
const [, , url, outputPath] = process.argv;

if (!url || !outputPath) {
  console.error("使い方: node scripts/probe-screenshot.mjs <url> <output.png>");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright が未インストールよ。`npm i --no-save playwright && npx playwright install --with-deps chromium` を先に実行して");
  process.exit(1);
}

// 操作感が伝わるサンプル入り表示で撮る（?demo=1 非対応ページでは単に無視される）
const demoUrl = new URL(url);
demoUrl.searchParams.set("demo", "1");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(demoUrl.toString(), { waitUntil: "networkidle" });
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`スクショ保存: ${outputPath}`);
} finally {
  await browser.close();
}
