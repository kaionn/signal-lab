#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const SLUG = process.argv[2];
const LP_BASE_URL = "https://signal-lab-six.vercel.app/p";
const CLAUDE_TIMEOUT_MS = 60_000;

if (!SLUG || SLUG.startsWith("--")) {
  console.error("使い方: node scripts/post-draft.mjs <slug> [--dry-run]");
  process.exit(1);
}

function loadMeta(slug) {
  const metaPath = path.join(ROOT, "experiments", slug, "meta.yaml");
  if (!fs.existsSync(metaPath)) {
    console.error(`meta.yaml が見つからない: ${metaPath}`);
    process.exit(1);
  }
  return parse(fs.readFileSync(metaPath, "utf-8"));
}

function fallbackCta(cta) {
  if (cta === "waitlist") {
    return "待機リスト公開中。";
  }
  if (cta === "pro_interest") {
    return "無料で使える。";
  }
  return "";
}

function fallbackDraft(meta) {
  const lines = [meta.tagline, "", fallbackCta(meta.cta)].filter((line) => line !== "");
  return lines.join("\n");
}

function generateDraft(meta, lpUrl) {
  const prompt = `以下の Probe（検証 LP）の X 投稿本文を 1 案作成して。

- title: ${meta.title}
- tagline: ${meta.tagline}
- price_hypothesis: ${meta.price_hypothesis}
- cta: ${meta.cta}
- probe_type: ${meta.probe_type}
- LP URL: ${lpUrl}

## 指示

- 日本語、全角 130 字以内
- URL は別途付加するので本文に含めない
- キャッチーに。1 行目は目を引くフック（悩みへの共感 or 意外性）から入る
- 絵文字を 2〜4 個使う（行頭の箇条書きマーカーや強調に。乱発はしない）。事実の誇張・嘘は禁止
- 個人開発者が「作った」と語る一人称視点
- 出力はプレーンテキストの本文のみ（前置き・後書き・引用符・コードブロック不要）`;

  const output = execFileSync(
    "claude",
    ["-p", prompt, "--output-format", "text"],
    { encoding: "utf-8", timeout: CLAUDE_TIMEOUT_MS },
  );
  const draft = output.trim();
  if (draft === "") {
    throw new Error("claude が空の出力を返した");
  }
  return draft;
}

async function sendDiscord(meta, slug, body, screenshotPath) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL が未設定");
    process.exit(1);
  }

  const headerContent = `📣 ${meta.title}（${slug}）が公開されたわ。X 投稿ドラフト↓（次のメッセージをそのままコピペ + 画像添付）`;

  const hasScreenshot = screenshotPath !== null && fs.existsSync(screenshotPath);
  let headerResponse;
  if (hasScreenshot) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: headerContent }));
    form.append("files[0]", new Blob([fs.readFileSync(screenshotPath)]), path.basename(screenshotPath));
    headerResponse = await fetch(webhookUrl, { method: "POST", body: form });
  } else {
    headerResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: headerContent }),
    });
  }
  if (!headerResponse.ok) {
    throw new Error(`discord webhook failed (header): status=${headerResponse.status}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const bodyResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: body }),
  });
  if (!bodyResponse.ok) {
    throw new Error(`discord webhook failed (body): status=${bodyResponse.status}`);
  }
}

async function main() {
  const meta = loadMeta(SLUG);

  if (meta.status !== "live") {
    console.warn(`警告: ${SLUG} の status は "${meta.status}"（live ではない）のため skip する`);
    return;
  }

  // distribution 記録後の meta.yaml 更新 push で重複配信しないためのガード
  if ((meta.distribution ?? []).length > 0 && !FORCE) {
    console.warn(`警告: ${SLUG} は集客済み（distribution あり）のため skip する。再生成は --force`);
    return;
  }

  const lpUrl = `${LP_BASE_URL}/${SLUG}`;

  let draft;
  try {
    draft = generateDraft(meta, lpUrl);
  } catch (error) {
    console.warn(`警告: claude での生成に失敗（${error.message}）。フォールバック文を使用する`);
    draft = fallbackDraft(meta);
  }

  const body = `${draft}\n${lpUrl}`;

  if (DRY_RUN) {
    console.log(body);
    return;
  }

  const screenshotPath = `/tmp/probe-shot-${SLUG}.png`;
  try {
    await sendDiscord(meta, SLUG, body, screenshotPath);
  } catch (error) {
    console.error(`Discord 送信失敗: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
