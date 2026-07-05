import type { Metadata } from "next";
import { Hero, PainQuote, PriceCard, WaitlistForm } from "@/components/probe";

export const metadata: Metadata = {
  title: "SubTracker — サブスクの解約し忘れ・解約後請求を見張る",
  description:
    "サブスクの更新日を一覧で見張り、解約したのに請求が続いていないかを検知する iOS アプリ。TestFlight 待機リスト受付中。",
};

const FEATURES = [
  "契約中サブスクの更新日を一覧で見張る",
  "更新日の前にリマインド（解約するなら今）",
  "「解約したのに請求」を検知したら次のアクションを案内",
];

export default function SubTrackerPage() {
  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-24">
        <Hero
          title="SubTracker"
          tagline="解約したはずのサブスク、まだ請求されてない？"
        />

        <div className="mb-12">
          <PainQuote
            quote="Uber Eats での自動更新のトラブルにより、解約後も料金が引き落とされ続けている"
            sourceLabel="App Store レビューより"
            sourceUrl="https://apps.apple.com/app/id1058959277"
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
            priceLabel="無料 + Pro 月額300円"
            features={FEATURES}
            note="価格は検討中。待機リストの反応で決めます"
          />
        </div>

        <WaitlistForm
          slug="subtracker"
          ctaLabel="TestFlight 待機リストに登録"
          successMessage="登録完了。TestFlight 配信開始時に招待メールを送ります"
        />

        <p className="mt-16 text-xs text-zinc-600">
          現在開発中の iOS アプリです。待機リストの登録数を見て配信判断をします。
        </p>
      </main>
    </div>
  );
}
