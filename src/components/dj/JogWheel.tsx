import { PointerEvent, WheelEvent, useRef, useState } from "react";
import type { DeckId } from "../../types/dj";

interface JogWheelProps {
  deckId: DeckId;
  disabled?: boolean;
  isPlaying: boolean;
  onJog: (deltaSeconds: number) => void;
  onBackspin: () => void;
  onActivate: () => void;
}

const normalizeAngleDelta = (delta: number) => {
  if (delta > 180) {
    return delta - 360;
  }

  if (delta < -180) {
    return delta + 360;
  }

  return delta;
};

const getPointerAngle = (event: PointerEvent<HTMLButtonElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  return Math.atan2(y, x) * (180 / Math.PI);
};

export function JogWheel({ deckId, disabled, isPlaying, onJog, onBackspin, onActivate }: JogWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastAngleRef = useRef<number | null>(null);
  const totalDeltaRef = useRef(0);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    onActivate();
    if (disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    lastAngleRef.current = getPointerAngle(event);
    totalDeltaRef.current = 0;
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || lastAngleRef.current === null || event.buttons !== 1) {
      return;
    }

    const angle = getPointerAngle(event);
    const delta = normalizeAngleDelta(angle - lastAngleRef.current);
    lastAngleRef.current = angle;
    totalDeltaRef.current += delta;

    setRotation((value) => value + delta);
    onJog((delta / 360) * 4.8);

  };

  const endDrag = () => {
    if (!disabled && totalDeltaRef.current < -220) {
      onBackspin();
    }

    lastAngleRef.current = null;
    totalDeltaRef.current = 0;
    setDragging(false);
  };

  const handleWheel = (event: WheelEvent<HTMLButtonElement>) => {
    onActivate();
    if (disabled) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const amount = event.shiftKey ? 3 : event.altKey ? 0.25 : 0.8;
    setRotation((value) => value + direction * amount * 18);
    onJog(direction * amount);
  };

  return (
    <button
      type="button"
      data-hint="Drag to seek." aria-label={`Jog wheel deck ${deckId}`}
      title={`Jog wheel deck ${deckId}`}
      disabled={disabled}
      data-spinning={isPlaying&&!dragging}
      style={{"--jog-angle":rotation+"deg"} as import("react").CSSProperties}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      className={`relative aspect-square w-full max-w-52 touch-none rounded-full border bg-zinc-950 outline-none transition ${
        disabled
          ? "cursor-not-allowed border-white/10 opacity-45"
          : dragging
            ? "cursor-grabbing border-amber-200 shadow-[0_0_42px_rgba(245,158,11,0.32)]"
            : "cursor-grab border-sky-300/30 hover:border-amber-300/60 hover:shadow-[0_0_30px_rgba(14,165,233,0.18)]"
      }`}
    >
      <span className="absolute inset-3 rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.2)_54%,rgba(0,0,0,0.65))]" />
      <span
        className="absolute inset-5 rounded-full border border-white/10"
        style={{
          transform: `rotate(${rotation}deg)`,
          background:
            "conic-gradient(from 0deg, rgba(56,189,248,0.85), rgba(255,255,255,0.08), rgba(245,158,11,0.9), rgba(255,255,255,0.08), rgba(56,189,248,0.85))"
        }}
      />
      <span className="absolute inset-10 rounded-full bg-black shadow-inner" />
      <span className="absolute left-1/2 top-4 h-8 w-1 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.9)]" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-zinc-950 text-center">
          <span className="text-[10px] font-black uppercase text-zinc-500">Deck {deckId}</span>
          <span className="text-sm font-black uppercase text-white">{isPlaying ? "Live" : "Jog"}</span>
        </span>
      </span>
    </button>
  );
}
