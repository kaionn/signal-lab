import Link from "next/link";
import { getLiveExperiments } from "@/lib/experiments";

export default function Home() {
  const experiments = getLiveExperiments();

  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-24">
        <header className="mb-16">
          <h1 className="text-3xl font-semibold tracking-tight">Signal Lab</h1>
          <p className="mt-2 text-zinc-400">
            小さく作って、市場に聞く。実シグナルが立った Probe だけ本実装する。
          </p>
        </header>

        {experiments.length === 0 ? (
          <p className="text-zinc-500">実験準備中</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {experiments.map((experiment) => (
              <li key={experiment.slug}>
                <Link
                  href={`/p/${experiment.slug}`}
                  className="block rounded-lg border border-zinc-800 p-5 transition-colors hover:border-zinc-600"
                >
                  <h2 className="text-lg font-medium">{experiment.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{experiment.tagline}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
