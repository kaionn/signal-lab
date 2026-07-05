interface PriceCardProps {
  priceLabel: string;
  features: string[];
  note?: string;
}

export function PriceCard({ priceLabel, features, note }: PriceCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 p-6">
      <p className="text-2xl font-semibold text-zinc-50">{priceLabel}</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-zinc-300">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-zinc-500">-</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-4 text-xs text-zinc-500">{note}</p> : null}
    </div>
  );
}
