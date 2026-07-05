interface PainQuoteProps {
  quote: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

export function PainQuote({ quote, sourceLabel, sourceUrl }: PainQuoteProps) {
  return (
    <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-300">
      <p className="italic">&ldquo;{quote}&rdquo;</p>
      {sourceLabel ? (
        <cite className="mt-2 block text-sm not-italic text-zinc-500">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              — {sourceLabel}
            </a>
          ) : (
            <>— {sourceLabel}</>
          )}
        </cite>
      ) : null}
    </blockquote>
  );
}
