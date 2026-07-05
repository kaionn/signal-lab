import type { Metadata } from "next";
import { Hero, PainQuote, PriceCard, WaitlistForm } from "@/components/probe";

export const metadata: Metadata = {
  title: "SSL Certificate Docker Doctor — Docker の SSL 証明書エラーを診断",
  description:
    "Docker コンテナ内での SSL 証明書検証エラーを診断し、原因と直し方を案内するツール。待機リスト受付中。",
};

const FEATURES = [
  "コンテナ内の証明書チェーンを検証し、どこが壊れているかを特定",
  "IdentityServer など外部サービスへの接続失敗の原因を切り分け",
  "CA 証明書の追加・マウント方法をケース別に案内",
];

export default function SslCertificateDockerIssuesPage() {
  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-24">
        <Hero
          title="SSL Certificate Docker Doctor"
          tagline="Docker の「証明書が無効です」、原因を秒で特定"
        />

        <div className="mb-12">
          <PainQuote
            quote={`Developers are facing issues with SSL certificate validation in Docker, causing failures in connecting to IdentityServer.\n\n既存ソリューション: SSL troubleshooting guides, community forums`}
            sourceLabel="Stack Overflow より"
            sourceUrl="https://stackoverflow.com/questions/67375695/docker-image-error-the-remote-certificate-is-invalid-according-to-the-validation"
          />
        </div>

        <ul className="mb-12 flex flex-col gap-3 text-sm text-zinc-300">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span className="text-zinc-500">-</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mb-12">
          <PriceCard
            priceLabel="無料 + Pro 月額500円（CI 連携・複数コンテナの継続監視）"
            features={FEATURES}
            note="価格は検討中。待機リストの反応で決めます"
          />
        </div>

        <WaitlistForm
          slug="ssl-certificate-docker-issues"
          ctaLabel="待機リストに登録"
          successMessage="登録完了。公開時に招待メールを送ります"
        />

        <p className="mt-16 text-xs text-zinc-600">
          現在検証中のツールです。待機リストの登録数を見て開発判断をします。
        </p>
      </main>
    </div>
  );
}
