export function ProgressBar({ value, max, label, className = "" }: {
  value: number; max: number; label: string; className?: string;
}) {
  const total = Math.max(max, 1);
  const done = Math.min(Math.max(value, 0), total);
  const percent = Math.round((done / total) * 100);
  return <div
    className={`relative mt-2 h-6 overflow-hidden rounded-full bg-zinc-200 ${className}`}
    role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
    <div className="h-full rounded-full bg-emerald-300 ring-1 ring-inset ring-emerald-700/30" style={{ width: `${percent}%` }} />
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-900 shadow-sm">
        {percent}%
      </span>
    </span>
  </div>;
}
