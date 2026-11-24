import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { createSyntheticWaveform, fileWaveform, type WaveformBar } from "../../waveform/waveformEngine";
import { useDjStore } from "../../store/djStore";
import type { DeckId } from "../../types/dj";
import { deckPlayerRegistry } from "../../services/deckPlayerRegistry";
import { ControlButton } from "./ControlButton";

interface WaveformDisplayProps {
  deckId: DeckId;
  large?: boolean;
}

const barColor = {
  low: "#f59e0b",
  mid: "#38bdf8",
  high: "#f472b6"
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const parseSeekValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
};

export function WaveformDisplay({ deckId, large }: WaveformDisplayProps) {
  const deck = useDjStore((state) => state.decks[deckId]);
  const updateDeck = useDjStore((state) => state.updateDeck);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [seekInput, setSeekInput] = useState("0:00");
  const [peaks,setPeaks]=useState<WaveformBar[]|null>(null);
  useEffect(()=>{
    let current=true;
    setPeaks(null);
    if(deck.localFile) void fileWaveform(deck.localFile).then(data=>{if(current)setPeaks(data);}).catch(()=>{});
    return ()=>{current=false;};
  },[deck.localFile]);
  const preview = useMemo(
    () => createSyntheticWaveform(deck.videoId ?? deck.id, deck.bpm, large ? 220 : 148),
    [deck.bpm, deck.id, deck.videoId, large]
  );
  const full = peaks ?? preview;
  const fraction = deck.duration > 0 ? Math.min(1, deck.currentTime / deck.duration) : 0;
  const span = 1 / Math.max(1,deck.waveformZoom);
  const start = clamp(fraction-span/2,0,1-span);
  const bars = full.slice(Math.floor(start*full.length),Math.ceil((start+span)*full.length));
  const progress = (fraction-start)/span;
  const canSeek = Boolean((deck.videoId || deck.localFile) && deck.duration > 0 && deck.status !== "error");

  useEffect(() => {
    if (document.activeElement?.id !== `seek-input-${deckId}`) {
      setSeekInput(formatClock(deck.currentTime));
    }
  }, [deck.currentTime, deckId]);

  const seekTo = (seconds: number) => {
    if (!canSeek) {
      updateDeck(deckId, { error: "Load a playable YouTube video before seeking on the waveform." });
      return;
    }

    const nextTime = clamp(seconds, 0, deck.duration);
    deckPlayerRegistry.seekTo(deckId, nextTime);
    updateDeck(deckId, { currentTime: nextTime, error: null });
    setSeekInput(formatClock(nextTime));
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const position = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    seekTo((start + position * span) * deck.duration);
  };

  const handleSeekKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canSeek) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekTo(deck.currentTime - (event.shiftKey ? 10 : 1));
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(deck.currentTime + (event.shiftKey ? 10 : 1));
    }
  };

  const submitExactSeek = () => {
    const seconds = parseSeekValue(seekInput);
    if (seconds === null) {
      updateDeck(deckId, { error: "Enter a seek time as seconds, mm:ss, or hh:mm:ss." });
      return;
    }

    seekTo(seconds);
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
          <span>{deck.videoId ? "Beat overview" : "Waveform"}</span>
        </div>
        <div className="flex items-center gap-1">
          <ControlButton
            data-hint="Zoom out." label={`Zoom out deck ${deckId}`}
            className="h-8 min-w-8 px-2"
            disabled={deck.waveformZoom<=1}
            onClick={() => updateDeck(deckId, { waveformZoom: Math.max(1, Number((deck.waveformZoom - 0.25).toFixed(2))) })}
          >
            <Minus size={15} />
          </ControlButton>
          <span className="w-10 text-center text-xs font-bold tabular-nums text-zinc-300">{deck.waveformZoom}x</span>
          <ControlButton
            data-hint="Zoom in." label={`Zoom in deck ${deckId}`}
            className="h-8 min-w-8 px-2"
            onClick={() => updateDeck(deckId, { waveformZoom: Math.min(3, Number((deck.waveformZoom + 0.25).toFixed(2))) })}
          >
            <Plus size={15} />
          </ControlButton>
        </div>
      </div>
      <div
        ref={waveformRef}
        role="slider"
        aria-label={`Seek deck ${deckId}`}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(deck.duration))}
        aria-valuenow={Math.floor(deck.currentTime)}
        tabIndex={0}
        onKeyDown={handleSeekKey}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) {
            seekFromPointer(event);
          }
        }}
        className={
          large
            ? "relative h-44 overflow-hidden rounded bg-zinc-950 outline-none ring-sky-300/0 transition focus:ring-2 focus:ring-sky-300/60"
            : "relative h-28 overflow-hidden rounded bg-zinc-950 outline-none ring-sky-300/0 transition focus:ring-2 focus:ring-sky-300/60"
        }
      >
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${bars.length} 100`} role="img">
          <defs>
            <linearGradient id={`wave-grid-${deckId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <rect width={bars.length} height="100" fill={`url(#wave-grid-${deckId})`} />
          {bars.map((bar, index) => {
            const height = bar.height * 82;
            const y = 50 - height / 2;
            return (
              <g key={index}>
                {bar.beat && (
                  <line
                    x1={index}
                    x2={index}
                    y1="0"
                    y2="100"
                    stroke={bar.downbeat ? "#f59e0b" : "#ffffff"}
                    strokeOpacity={bar.downbeat ? 0.45 : 0.12}
                    strokeWidth={bar.downbeat ? 0.55 : 0.25}
                  />
                )}
                <rect
                  x={index + 0.15}
                  y={y}
                  width="0.7"
                  height={height}
                  rx="0.3"
                  fill={barColor[bar.hue]}
                  opacity={index / bars.length < progress ? 0.95 : 0.42}
                />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]" />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.85)]"
          style={{ left: `${progress * 100}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-100/60 bg-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.85)]"
          style={{ left: `${progress * 100}%` }}
        />
        {!canSeek && (
          <div className="seek-notice pointer-events-none absolute bottom-2 right-2 rounded bg-black/65 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
            Load playable track to seek
          </div>
        )}
      </div>
      <span className="wave-caption">{canSeek?"Drag to seek through the track.":"Load a track, then drag to seek."}</span>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-bold uppercase text-zinc-500" htmlFor={`seek-input-${deckId}`}>
          Jump to second / time
          <input
            id={`seek-input-${deckId}`}
            value={seekInput}
            onChange={(event) => setSeekInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitExactSeek();
              }
            }}
            placeholder="90 or 1:30"
            className="h-9 rounded-md border border-white/10 bg-black/45 px-3 text-sm font-bold tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-300"
          />
        </label>
        <button
          type="button"
          data-hint="Jump to this time." onClick={submitExactSeek}
          className="h-9 rounded-md border border-amber-400/35 bg-amber-400/10 px-4 text-xs font-black uppercase text-amber-100 transition hover:bg-amber-400/20"
        >
          Seek
        </button>
      </div>
    </div>
  );
}
