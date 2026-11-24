import { clsx } from "clsx";

interface SliderControlProps {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  className?: string;
}

const faderHints: Record<string,string> = {
  Crossfader:"Slide left for A, right for B.", Gain:"Slide to trim input.", Channel:"Slide to mix in.", Master:"Slide to set output level.",
  "high EQ":"Cut or boost treble.", "mid EQ":"Cut or boost mids.", "low EQ":"Cut or boost bass.", Tempo:"Slide to change speed.",
  "Deck volume":"Slide to set deck level.", "Deck gain":"Slide to trim this deck.", Volume:"Slide to set sound level.",
  "Dry/Wet":"Slide right for more effect.", Amount:"Slide to change intensity."
};

export function SliderControl({
  label,
  hint,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
  className
}: SliderControlProps) {
  return (
    <label data-hint={hint ?? faderHints[label]} className={clsx("grid gap-2 text-xs font-semibold uppercase text-zinc-400", className)}>
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-200">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="dj-range"
      />
    </label>
  );
}
