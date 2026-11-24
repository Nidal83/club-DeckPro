import { clsx } from "clsx";

interface VuMeterProps {
  label: string;
  value: number;
  compact?: boolean;
}

export function VuMeter({ label, value, compact }: VuMeterProps) {
  const bars = compact ? 12 : 18;
  const activeBars = Math.round((Math.min(100, Math.max(0, value)) / 100) * bars);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-300">{Math.round(value)}</span>
      </div>
      <div className="flex h-24 items-end gap-1 rounded-md border border-white/10 bg-black/40 p-2">
        {Array.from({ length: bars }, (_, index) => {
          const active = index < activeBars;
          const hot = index > bars * 0.78;
          const warm = index > bars * 0.58;

          return (
            <span
              key={index}
              className={clsx(
                "w-full rounded-sm transition",
                active ? (hot ? "bg-rose-400" : warm ? "bg-amber-300" : "bg-emerald-400") : "bg-white/[0.08]"
              )}
              style={{ height: `${20 + index * (compact ? 5 : 4)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
