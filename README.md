# signal-lab

検証ファースト開発の実験場 — 小さく作って、市場に聞く

公開URL: https://signal-lab-six.vercel.app

## なぜ作ったか

旧機構（アイデア→MVP自動生成）は84案を生成したが、選定は0件、公開まで至ったMVPは1本のみに終わった。原因は「人間の判断がデータの前に置かれ、実験単価が高すぎた」こと。アイデア出しからMVP完成までの間に人間の意思決定が挟まるたび、案は選ばれずに死んでいった。

本機構はこの判断を「データの後」に移す。作り込む前にPR 1本分のProbe（探針）を公開し、実シグナル（登録・利用）が立ったものだけを本実装する。実験単価をPR 1本まで下げることで、判断コストを人間からデータに移譲する。

## 機構の全体図

```
pain-collector の Issue
    │  /probe コマンド
    ▼
probe-request.yml（Claude Code が LP を生成 → PR）
    │  人間が merge
    ▼
Vercel 自動デプロイ = 公開
    │  登録が入るたびに Discord へ即時通知
    ▼
weekly-digest.yml（週次）
    │  KILL / WATCH / GRADUATE を判定
    ▼
GRADUATE → Build Issue 起票 → app/app/{slug}/ に本実装
KILL     → 撤退
WATCH    → 継続観察
```

## Probeの型

- **Probe A**: 動くマイクロツール（1〜3日で作れる案）。ツール自体が集客し、利用数・再訪 + Pro CTAを計測する
- **Probe B**: LP + 待機リスト（それ以上の規模の案）。iOS案はTestFlight待機リストとして公開する。実装が完了した時点で、待機リストの登録者が最初のユーザーとして確保済みになる利点もある

## 卒業・撤退ルール

判定は週次ダイジェスト（`scripts/weekly-digest.mjs`、閾値は`config/verdict-rules.yaml`）で行う。

| 判定 | 条件 |
|---|---|
| GRADUATE（Probe B） | 累計待機リスト登録数 10 件以上 |
| GRADUATE（Probe A） | 直近7日のtool_useイベント20回以上、または再訪ユニークユーザー5人以上（PostHog利用可能時のみ） |
| KILL | 公開から21日以上経過 かつ シグナル（登録+tool_use）が2未満 |
| WATCH | 上記いずれにも該当しない |

集客していないProbeはKILL判定しない。公開後に出典コミュニティへ投げ返し、`meta.yaml`の`distribution`に記録していない実験は、経過日数・シグナル数によらずKILL対象外とする。

## 技術スタック

- Next.js (App Router) / Tailwind CSS
- PostHog（計測）
- Upstash Redis（待機リスト保存 + レート制限）
- Vercel（ホスティング・自動デプロイ）
- GitHub Actions + Claude Code（Probe自動生成・週次ダイジェスト）

## 実験の追加方法

- **手動**: `experiments/_template/meta.yaml`を`experiments/{slug}/meta.yaml`にコピーして編集し、`app/p/{slug}/page.tsx`を作成してPRを出す。merge = 公開
- **自動**: pain-collectorのIssueから`/probe`コマンドを実行すると、`probe-request.yml`がClaude CodeでProbeを生成しPRを作成する。merge判断は人間が行う

詳細な規約は[CLAUDE.md](./CLAUDE.md)を参照。

## 稼働中の実験

トップページ（https://signal-lab-six.vercel.app）に自動一覧される。
