import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import { getAllExperiments } from "@/lib/experiments";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SignupSchema = z.object({
  email: z.email(),
  slug: z.string().regex(SLUG_REGEX),
});

interface SignupClients {
  redis: Redis;
  ratelimit: Ratelimit;
}

// env はリクエスト時にのみ読む（モジュールトップレベル評価だとビルド時に落ちるため）
let clients: SignupClients | null | undefined;

function getClients(): SignupClients | null {
  if (clients !== undefined) {
    return clients;
  }

  // Vercel Marketplace 経由の Upstash は KV_* 名で env を注入する
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    clients = null;
    return clients;
  }

  const redis = new Redis({ url, token });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "signup",
  });

  clients = { redis, ratelimit };
  return clients;
}

async function notifyDiscord(slug: string, count: number): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // email 本体は送らない（PII を外部サービスに出さないため）
      body: JSON.stringify({
        content: `🎉 ${slug} に待機リスト登録があったわ（累計 ${count} 件）`,
      }),
    });

    if (!response.ok) {
      console.error(`discord webhook failed: status=${response.status}`);
    }
  } catch (error) {
    console.error("discord webhook error", error);
  }
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { email, slug } = parsed.data;

  const experiments = getAllExperiments();
  if (!experiments.some((experiment) => experiment.slug === slug)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const signupClients = getClients();
  if (!signupClients) {
    return NextResponse.json({ error: "signup not configured" }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await signupClients.ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  await signupClients.redis.sadd(`waitlist:${slug}`, email);
  const count = await signupClients.redis.scard(`waitlist:${slug}`);

  await notifyDiscord(slug, count);

  return NextResponse.json({ ok: true });
}
