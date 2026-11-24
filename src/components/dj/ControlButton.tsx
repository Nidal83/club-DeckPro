import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: "neutral" | "amber" | "blue" | "danger";
  children: ReactNode;
}

const toneClasses = {
  neutral: "border-white/10 bg-white/[0.06] text-zinc-100 hover:border-white/25 hover:bg-white/[0.1]",
  amber: "border-amber-400/35 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
  blue: "border-sky-400/35 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20",
  danger: "border-rose-400/35 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20"
};

export function ControlButton({ label, active, tone = "neutral", className, children, ...props }: ControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-bold transition",
        toneClasses[tone],
        active && "border-amber-300 bg-amber-300/20 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.22)]",
        props.disabled && "cursor-not-allowed opacity-45",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
