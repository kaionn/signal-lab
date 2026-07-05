interface HeroProps {
  title: string;
  tagline: string;
  painQuote?: string;
}

export function Hero({ title, tagline, painQuote }: HeroProps) {
  return (
    <header className="mb-12">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{title}</h1>
      <p className="mt-2 text-lg text-zinc-400">{tagline}</p>
      {painQuote ? <p className="mt-4 text-sm text-zinc-500 italic">{painQuote}</p> : null}
    </header>
  );
}
