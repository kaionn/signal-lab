# signal-lab

検証ファースト開発の実験場。アイデアは MVP を作る前に Probe（探針）として公開し、実シグナル（登録・利用）が立ったものだけ本実装する。

## 機構の原則

- Probe A = 動くマイクロツール（1〜3 日で作れる案）。ツール自体が集客し、利用数・再訪 + Pro CTA を計測する
- Probe B = LP + 待機リスト（それ以上の規模、iOS 案は TestFlight 待機リスト）
- 集客していない Probe は KILL 判定しない。公開したら出典コミュニティへの投げ返しを distribution に記録する
- 判定は週次ダイジェスト（KILL / WATCH / GRADUATE、閾値は config/verdict-rules.yaml）。実装は `scripts/weekly-digest.mjs`（`--dry-run` で Discord 送信 / Issue 起票なしの確認が可能）
- GRADUATE した Web 案は app/app/{slug}/ に本実装。モバイル案は独立 repo に切り出し、待機リストへ TestFlight 招待

## Probe の追加手順

1. `experiments/_template/meta.yaml` を `experiments/{slug}/meta.yaml` にコピーして編集（ディレクトリ名 = slug 必須）
2. `app/p/{slug}/page.tsx` を作成（Probe B は components/probe/ の共通部品で組む）
3. PR を出す。merge = 公開（Vercel 自動デプロイ）
4. 公開後、出典コミュニティに投げ返し、meta.yaml の distribution に記録する

## 規約

- meta.yaml のスキーマは lib/experiments.ts の zod が唯一の正。スキーマ変更は _template と同時に
- 計測イベントは pageview / cta_click / signup / tool_use の 4 種のみ。全イベントに slug property を付ける
- 計測は lib/track.ts の track() 経由のみ。posthog.capture を直接呼ばない
- Probe 段階で決済実装はしない（preorder は MoR の Payment Link を貼るだけ）
- validation: `yarn lint && yarn build`

## 必要な環境変数

| 変数 | 用途 | 未設定時 |
|---|---|---|
| NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST | 計測 | 計測が無音で無効化 |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（または KV_REST_API_URL / KV_REST_API_TOKEN。Vercel Marketplace 統合は KV_* 名で注入） | 待機リスト保存 + レート制限 | /api/signup が 503 |
| DISCORD_WEBHOOK_URL | 登録の即時通知 + 週次ダイジェスト配信 | 通知なしで登録は成功 / ダイジェストは送信失敗で exit 1 |
| POSTHOG_API_KEY / POSTHOG_PROJECT_ID（GitHub Secrets、週次ダイジェスト用） | PostHog Query API での行動イベント集計 | 「計測: 未接続」警告を出して続行 |
