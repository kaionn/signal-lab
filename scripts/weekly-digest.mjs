#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";

const ROOT = process.cwd();
const EXPERIMENTS_DIR = path.join(ROOT, "experiments");
const RULES_PATH = path.join(ROOT, "config", "verdict-rules.yaml");
const DRY_RUN = process.argv.includes("--dry-run");
const DAY_MS = 24 * 60 * 60 * 1000;
const GH_REPO = "kaionn/signal-lab";

const warnings = [];

function loadLiveExperiments() {
  if (!fs.existsSync(EXPERIMENTS_DIR)) {
    return [];
  }

  const results = [];
  const dirs = fs
    .readdirSync(EXPERIMENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));

  for (const entry of dirs) {
    const metaPath = path.join(EXPERIMENTS_DIR, entry.name, "meta.yaml");
    try {
      const raw = fs.readFileSync(metaPath, "utf-8");
      const meta = parse(raw);
      if (meta == null || typeof meta !== "object") {
        warnings.push(`meta.yaml 読み込み失敗 (${entry.name}): 有効な YAML オブジェクトではありません`);
        continue;
      }
      if (meta.status === "live") {
        results.push({ ...meta, _dir: entry.name, _metaPath: metaPath });
      }
    } catch (error) {
      warnings.push(`meta.yaml 読み込み失敗 (${entry.name}): ${error.message}`);
    }
  }

  return results;
}

function loadRules() {
  return parse(fs.readFileSync(RULES_PATH, "utf-8"));
}

async function fetchWaitlistCounts(slugs) {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  const counts = new Map(slugs.map((slug) => [slug, null]));

  if (!url || !token) {
    warnings.push("待機リスト: 未接続（Upstash env 無し）");
    return counts;
  }

  for (const slug of slugs) {
    try {
      const response = await fetch(`${url}/scard/waitlist:${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`status=${response.status}`);
      }
      const body = await response.json();
      counts.set(slug, typeof body.result === "number" ? body.result : 0);
    } catch (error) {
      warnings.push(`待機リスト取得失敗 (${slug}): ${error.message}`);
    }
  }

  return counts;
}

function emptyEventCounts() {
  return { pageview: 0, cta_click: 0, signup: 0, tool_use: 0 };
}

async function queryPostHog(apiKey, projectId, query) {
  const response = await fetch(
    `https://us.posthog.com/api/projects/${projectId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    },
  );
  if (!response.ok) {
    throw new Error(`status=${response.status}`);
  }
  return response.json();
}

// $pageview は properties.slug が無いことがあるため $pathname（'/p/{slug}'）から補完する
const SLUG_FROM_PATH = "multiIf(event = '$pageview', extract(properties.$pathname, '/p/([a-z0-9-]+)'), properties.slug)";

async function fetchPostHogStats(slugs) {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const eventCounts = new Map(slugs.map((slug) => [slug, null]));
  const returningUsers = new Map(slugs.map((slug) => [slug, null]));

  if (!apiKey || !projectId) {
    warnings.push("計測: 未接続（PostHog env 無し）");
    return { eventCounts, returningUsers, available: false };
  }

  try {
    const json = await queryPostHog(
      apiKey,
      projectId,
      `select ${SLUG_FROM_PATH} as slug, event, count() as cnt
       from events
       where timestamp > now() - interval 7 day
         and event in ('$pageview', 'cta_click', 'signup', 'tool_use')
       group by slug, event`,
    );

    for (const slug of slugs) {
      eventCounts.set(slug, emptyEventCounts());
    }

    for (const [slug, event, cnt] of json.results ?? []) {
      if (!eventCounts.has(slug)) {
        continue;
      }
      const key = event === "$pageview" ? "pageview" : event;
      const entry = eventCounts.get(slug);
      entry[key] = (entry[key] ?? 0) + Number(cnt);
    }
  } catch (error) {
    warnings.push(`PostHog イベント集計取得失敗: ${error.message}`);
    return { eventCounts, returningUsers, available: false };
  }

  try {
    const json = await queryPostHog(
      apiKey,
      projectId,
      `select slug, count() as returning_count
       from (
         select ${SLUG_FROM_PATH} as slug, distinct_id, count() as events_count
         from events
         where timestamp > now() - interval 7 day
           and event in ('$pageview', 'cta_click', 'signup', 'tool_use')
         group by slug, distinct_id
         having events_count >= 2
       )
       group by slug`,
    );

    for (const [slug, cnt] of json.results ?? []) {
      returningUsers.set(slug, Number(cnt));
    }
  } catch (error) {
    warnings.push(`PostHog 再訪ユーザー集計取得失敗: ${error.message}`);
  }

  return { eventCounts, returningUsers, available: true };
}

function ageDaysOf(created) {
  return Math.floor((Date.now() - new Date(created).getTime()) / DAY_MS);
}

function judge(meta, rules, waitlistCount, events, returningUsers, postHogAvailable) {
  const ageDays = ageDaysOf(meta.created);
  const distributed = (meta.distribution ?? []).length > 0;
  const weeklyToolUse = events?.tool_use ?? 0;
  const signals = (waitlistCount ?? 0) + weeklyToolUse;

  const graduatedB =
    meta.probe_type === "B" && waitlistCount !== null && waitlistCount >= rules.graduate.probe_b_signups;
  const graduatedA =
    meta.probe_type === "A" &&
    (weeklyToolUse >= rules.graduate.probe_a_weekly_tool_use ||
      (postHogAvailable &&
        returningUsers !== null &&
        returningUsers >= rules.graduate.probe_a_returning_users));

  let verdict = "WATCH";
  if (graduatedB || graduatedA) {
    verdict = "GRADUATE";
  } else if (
    (!rules.kill.requires_distribution || distributed) &&
    ageDays >= rules.kill.min_age_days &&
    signals < rules.kill.max_signals
  ) {
    verdict = "KILL";
  }

  return { verdict, ageDays, distributed, weeklyToolUse, signals };
}

const VERDICT_EMOJI = { GRADUATE: "🎓", KILL: "💀", WATCH: "👀" };

function buildField(meta, judgement, waitlistCount, events, postHogAvailable) {
  const waitlistDisplay = waitlistCount === null ? "n/a" : String(waitlistCount);
  const eventsDisplay = postHogAvailable
    ? `pageview ${events.pageview}・cta ${events.cta_click}・tool_use ${events.tool_use}`
    : "未接続";

  const lines = [
    `${VERDICT_EMOJI[judgement.verdict]} ${judgement.verdict}`,
    `待機リスト ${waitlistDisplay}`,
    `7日: ${eventsDisplay}`,
    `経過 ${judgement.ageDays} 日`,
  ];
  if (!judgement.distributed) {
    lines.push("⚠️ 未集客");
  }

  return {
    name: `${meta.title} (${meta.slug}) [${meta.probe_type}]`,
    value: lines.join("\n"),
  };
}

function buildEmbed(experiments, judgements, rules) {
  const today = new Date().toISOString().slice(0, 10);
  const footer = {
    text: `閾値: GRADUATE B>=${rules.graduate.probe_b_signups}件 / A>=${rules.graduate.probe_a_weekly_tool_use}回 / KILL: ${rules.kill.min_age_days}日以上&シグナル<${rules.kill.max_signals}`,
  };

  if (experiments.length === 0) {
    return {
      title: `📊 Signal Lab 週次ダイジェスト (${today})`,
      description: "対象なし（live 状態の実験がないわ）",
      footer,
    };
  }

  return {
    title: `📊 Signal Lab 週次ダイジェスト (${today})`,
    fields: experiments.map((meta, i) => buildField(meta, judgements[i].judgement, judgements[i].waitlistCount, judgements[i].events, judgements[i].postHogAvailable)),
    footer,
  };
}

async function sendToDiscord(embed) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL が未設定");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    throw new Error(`discord webhook failed: status=${response.status}`);
  }
}

function graduateIssueExists(slug) {
  const title = `Build: ${slug} — GRADUATE 到達`;
  try {
    const output = execFileSync(
      "gh",
      ["issue", "list", "--repo", GH_REPO, "--state", "open", "--search", title, "--json", "title"],
      { encoding: "utf-8" },
    );
    const issues = JSON.parse(output);
    return issues.some((issue) => issue.title === title);
  } catch (error) {
    warnings.push(`GRADUATE Issue 存在確認失敗 (${slug}): ${error.message}`);
    return true; // 確認できない場合は二重起票を避けるため既存扱いにする
  }
}

function createGraduateIssue(meta, judgement, waitlistCount) {
  const title = `Build: ${meta.slug} — GRADUATE 到達`;
  const body = `## GRADUATE 判定

- slug: ${meta.slug}
- probe_type: ${meta.probe_type}
- meta.yaml: \`experiments/${meta.slug}/meta.yaml\`

## 判定根拠

- 待機リスト累計: ${waitlistCount === null ? "n/a" : waitlistCount}
- 直近 7 日 tool_use: ${judgement.weeklyToolUse}
- 経過日数: ${judgement.ageDays}

## 次のアクション

\`app/app/${meta.slug}/\` に本実装する。
`;

  try {
    execFileSync(
      "gh",
      ["issue", "create", "--repo", GH_REPO, "--title", title, "--label", "plan", "--body", body],
      { encoding: "utf-8" },
    );
  } catch (error) {
    warnings.push(`GRADUATE Issue 起票失敗 (${meta.slug}): ${error.message}`);
  }
}

async function main() {
  const rules = loadRules();
  const experiments = loadLiveExperiments();
  const slugs = experiments.map((meta) => meta.slug);

  const waitlistCounts = await fetchWaitlistCounts(slugs);
  const { eventCounts, returningUsers, available: postHogAvailable } = await fetchPostHogStats(slugs);

  const judgements = experiments.map((meta) => {
    const waitlistCount = waitlistCounts.get(meta.slug);
    const events = eventCounts.get(meta.slug);
    const judgement = judge(
      meta,
      rules,
      waitlistCount,
      events,
      returningUsers.get(meta.slug),
      postHogAvailable,
    );
    return { waitlistCount, events, postHogAvailable, judgement };
  });

  const embed = buildEmbed(experiments, judgements, rules);

  if (DRY_RUN) {
    console.log(JSON.stringify(embed, null, 2));
    console.table(
      experiments.map((meta, i) => ({
        slug: meta.slug,
        probe_type: meta.probe_type,
        verdict: judgements[i].judgement.verdict,
        waitlist: judgements[i].waitlistCount ?? "n/a",
        weekly_tool_use: judgements[i].judgement.weeklyToolUse,
        age_days: judgements[i].judgement.ageDays,
        distributed: judgements[i].judgement.distributed,
      })),
    );
  } else {
    try {
      await sendToDiscord(embed);
    } catch (error) {
      console.error(`Discord 送信失敗: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    for (let i = 0; i < experiments.length; i++) {
      if (judgements[i].judgement.verdict !== "GRADUATE") {
        continue;
      }
      const meta = experiments[i];
      if (graduateIssueExists(meta.slug)) {
        continue;
      }
      createGraduateIssue(meta, judgements[i].judgement, judgements[i].waitlistCount);
    }
  }

  if (warnings.length > 0) {
    console.warn("警告:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }
}

await main();
