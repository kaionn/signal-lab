import type { Metadata } from "next";
import { Hero, ProCta } from "@/components/probe";
import { EstimateTool } from "./EstimateTool";

export const metadata: Metadata = {
  title: "見積モリ — 見積書を無料・登録不要で 30 秒作成（PDF）",
  description:
    "工数と単価を入れるだけで見積書 PDF が完成。ブラウザ内で完結し、データは送信されません。登録不要・無料。",
};

const FEATURES = [
  "登録不要。開いてすぐ使える",
  "データはブラウザから出ない（サーバー送信なし）",
  "印刷機能でそのまま PDF 保存",
];

export default function MitsumoriPage() {
  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-50 print:bg-white print:text-black">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-24 print:max-w-none print:p-0">
        <div className="print:hidden">
          <Hero title="見積モリ" tagline="工数と単価を入れるだけ。見積書 PDF が 30 秒で完成" />
        </div>

        <EstimateTool />

        <div className="mt-16 print:hidden">
          <ul className="mb-12 flex flex-col gap-3 text-sm text-zinc-300">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-zinc-500">-</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <ProCta slug="mitsumori" label="テンプレ保存やロゴ入れができる Pro 版に興味ある？" />
        </div>
      </main>
    </div>
  );
}
