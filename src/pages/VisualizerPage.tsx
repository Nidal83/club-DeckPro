import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Maximize2, Mic2, MonitorUp, RadioTower, X } from "lucide-react";
import { Link } from "react-router-dom";
import { getActiveDeckId } from "../services/visualizerBridge";
import { useVisualizerSnapshot } from "../hooks/useVisualizerSnapshot";

const barCount = 84;
const visualizerBackgroundKey = "nidal-clubdeck-visualizer-background";

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const enterFullscreen = () => {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.();
  }
};

export function VisualizerPage() {
  const snapshot = useVisualizerSnapshot();
  const [frame, setFrame] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState(() => localStorage.getItem(visualizerBackgroundKey) ?? "");
  const [realEqEnabled, setRealEqEnabled] = useState(false);
  const [realEqError, setRealEqError] = useState("");
  const [frequencyBins, setFrequencyBins] = useState<number[]>(() => Array.from({ length: barCount }, () => 8));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const eqAnimationRef = useRef(0);
  const activeDeckId = getActiveDeckId(snapshot);
  const activeDeck = snapshot.decks[activeDeckId] ?? snapshot.decks.A;
  const visibleDeckIds = snapshot.visibleDeckIds.length > 0 ? snapshot.visibleDeckIds : (["A", "B"] as const);
  const live = Date.now() - snapshot.updatedAt < 2500;
  const realEnergy = useMemo(
    () => frequencyBins.reduce((total, value) => total + value, 0) / Math.max(1, frequencyBins.length),
    [frequencyBins]
  );
  const energy = Math.max(8, realEqEnabled ? realEnergy : snapshot.mixer.masterMeter);
  const bpm = activeDeck.bpm || 124;
  const beatPhase = (frame / Math.max(18, 3600 / bpm)) % 1;
  const crossfadeBias = snapshot.mixer.crossfader / 100;

  const stopRealEqualizer = useCallback(() => {
    if (eqAnimationRef.current) {
      cancelAnimationFrame(eqAnimationRef.current);
      eqAnimationRef.current = 0;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }

    audioContextRef.current = null;
    setRealEqEnabled(false);
  }, []);

  const startRealEqualizer = useCallback(async () => {
    setRealEqError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setRealEqError("Real EQ needs microphone or line-in support in this browser.");
      return;
    }

    try {
      stopRealEqualizer();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      const data = new Uint8Array(analyser.frequencyBinCount);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      await context.resume();

      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      setRealEqEnabled(true);

      const readInput = () => {
        analyser.getByteFrequencyData(data);
        setFrequencyBins(
          Array.from({ length: barCount }, (_, index) => {
            const low = Math.floor(Math.pow(index / barCount, 1.55) * data.length);
            const high = Math.max(low + 1, Math.floor(Math.pow((index + 1) / barCount, 1.55) * data.length));
            let total = 0;

            for (let bin = low; bin < high; bin += 1) {
              total += data[bin] ?? 0;
            }

            const average = total / Math.max(1, high - low);
            return Math.min(100, Math.max(4, (average / 255) * 112));
          })
        );
        eqAnimationRef.current = requestAnimationFrame(readInput);
      };

      readInput();
    } catch {
      stopRealEqualizer();
      setRealEqError("Microphone or line-in permission is needed for real EQ.");
    }
  }, [stopRealEqualizer]);

  const handleBackgroundFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === "string" ? reader.result : "";
      setBackgroundImage(image);
      localStorage.setItem(visualizerBackgroundKey, image);
    };
    reader.readAsDataURL(file);
  };

  const clearBackground = () => {
    setBackgroundImage("");
    localStorage.removeItem(visualizerBackgroundKey);
  };

  useEffect(() => {
    let animationFrame = 0;
    const tick = () => {
      setFrame((value) => value + 1);
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => () => stopRealEqualizer(), [stopRealEqualizer]);

  const bars = useMemo(
    () =>
      Array.from({ length: barCount }, (_, index) => {
        const lane = index / (barCount - 1);
        const leftInfluence = 1 - lane;
        const rightInfluence = lane;
        const deckEnergy = snapshot.mixer.vuA * leftInfluence + snapshot.mixer.vuB * rightInfluence;
        const bassPulse = Math.max(0, Math.sin((beatPhase + lane * 0.14) * Math.PI * 2));
        const midPulse = Math.sin(frame * 0.045 + index * 0.55) * 0.5 + 0.5;
        const shimmer = Math.sin(frame * 0.082 + index * 1.7) * 0.5 + 0.5;
        const liveInput = frequencyBins[index] ?? 0;
        const height = realEqEnabled
          ? Math.min(100, 6 + liveInput * 0.92 + bassPulse * 7 + shimmer * 5)
          : Math.min(100, 10 + deckEnergy * 0.62 + energy * bassPulse * 0.35 + midPulse * 22 + shimmer * 10);
        const hue = realEqEnabled ? 174 + lane * 86 + liveInput * 0.18 : 196 + lane * 44 + crossfadeBias * 36;
        const opacity = realEqEnabled ? 0.68 + Math.min(0.32, liveInput / 190) : 0.58 + Math.min(0.4, energy / 180);

        return {
          height,
          hue,
          opacity,
          delay: realEqEnabled ? 0 : index * 0.012
        };
      }),
    [beatPhase, crossfadeBias, energy, frame, frequencyBins, realEqEnabled, snapshot.mixer.vuA, snapshot.mixer.vuB]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.14),transparent_42%),linear-gradient(180deg,rgba(245,158,11,0.12),transparent_36%,rgba(14,165,233,0.12))]" />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 flex min-h-screen flex-col p-5 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-md border border-sky-300/30 bg-sky-300/10 text-sky-100">
              <MonitorUp size={28} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-300">Nidal-ClubDeck-pro</p>
              <h1 className="text-3xl font-black md:text-5xl">Projector Visualizer</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 text-xs font-black uppercase text-zinc-300">
              <RadioTower className={live ? "text-emerald-300" : "text-rose-300"} size={16} />
              {live ? "Live sync" : "Waiting"}
            </div>
            <button
              type="button"
              onClick={realEqEnabled ? stopRealEqualizer : startRealEqualizer}
              className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 text-xs font-black uppercase transition ${
                realEqEnabled
                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25"
                  : "border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
              }`}
            >
              <Mic2 size={16} />
              {realEqEnabled ? "Real EQ on" : "Real EQ"}
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={handleBackgroundFile} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 text-xs font-black uppercase text-zinc-200 transition hover:bg-white/[0.12]"
            >
              <ImagePlus size={16} />
              Background
            </button>
            {backgroundImage ? (
              <button
                type="button"
                onClick={clearBackground}
                className="grid h-11 w-11 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.12]"
                aria-label="Clear background image"
                title="Clear background image"
              >
                <X size={16} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={enterFullscreen}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-sky-300/30 bg-sky-300/10 px-4 text-xs font-black uppercase text-sky-100 transition hover:bg-sky-300/20"
            >
              <Maximize2 size={16} />
              Fullscreen
            </button>
            <Link
              to="/"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 text-xs font-black uppercase text-zinc-200 transition hover:bg-white/[0.12]"
            >
              <ArrowLeft size={16} />
              Mixer
            </Link>
          </div>
        </header>

        <section className="grid flex-1 content-center gap-8 py-8">
          {realEqError ? (
            <div className="mx-auto w-full max-w-[1600px] rounded-md border border-rose-300/30 bg-rose-950/55 px-4 py-3 text-sm font-bold text-rose-100">
              {realEqError}
            </div>
          ) : null}

          <div className="grid gap-4 text-center">
            <p className="text-sm font-black uppercase text-sky-200">Now visualizing Deck {activeDeckId}</p>
            <h2 className="mx-auto max-w-6xl text-balance text-4xl font-black leading-tight md:text-7xl">{activeDeck.title}</h2>
            <div className="mx-auto flex flex-wrap items-center justify-center gap-3 text-sm font-black uppercase text-zinc-300 md:text-base">
              <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-amber-100">{activeDeck.bpm} BPM</span>
              <span className="rounded-md border border-white/10 bg-white/[0.06] px-4 py-2">{formatTime(activeDeck.currentTime)}</span>
              <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sky-100">
                {realEqEnabled ? "Input" : "Master"} {Math.round(energy)}
              </span>
            </div>
          </div>

          <div className="relative mx-auto flex h-[42vh] min-h-80 w-full max-w-[1600px] items-end justify-center gap-1 overflow-hidden rounded-md border border-white/10 bg-black/50 p-4 shadow-[0_0_80px_rgba(14,165,233,0.16)]">
            <div
              className="absolute inset-x-0 bottom-0 h-1/2 opacity-35"
              style={{
                background: `linear-gradient(90deg, rgba(245,158,11,${1 - crossfadeBias}) 0%, rgba(14,165,233,0.6) 50%, rgba(244,114,182,${crossfadeBias}) 100%)`
              }}
            />
            {bars.map((bar, index) => (
              <div
                key={index}
                className="relative z-10 w-full rounded-t-sm transition-[height,filter] duration-100"
                style={{
                  height: `${bar.height}%`,
                  opacity: bar.opacity,
                  background: `linear-gradient(180deg, hsl(${bar.hue} 95% 68%), hsl(${bar.hue + 28} 95% 42%))`,
                  boxShadow: `0 0 ${8 + bar.height / 6}px hsla(${bar.hue}, 95%, 62%, 0.5)`,
                  filter: `saturate(${1.1 + energy / 180})`,
                  transitionDelay: `${bar.delay}s`
                }}
              />
            ))}
            <div
              className="pointer-events-none absolute inset-0 border-t border-white/15"
              style={{
                transform: `translateY(${42 - Math.sin(beatPhase * Math.PI * 2) * 8}%)`,
                boxShadow: "0 -18px 60px rgba(255,255,255,0.18)"
              }}
            />
          </div>

          <div className="mx-auto grid w-full max-w-[1600px] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDeckIds.map((deckId) => {
              const deck = snapshot.decks[deckId];
              const isActive = deckId === activeDeckId;
              return (
                <div
                  key={deckId}
                  className={`rounded-md border p-4 ${
                    isActive ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/[0.045]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase text-zinc-400">Deck {deckId}</span>
                    <span className={deck.isPlaying ? "text-xs font-black uppercase text-emerald-300" : "text-xs font-black uppercase text-zinc-500"}>
                      {deck.status}
                    </span>
                  </div>
                  <p className="truncate text-xl font-black">{deck.title}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-300"
                      style={{ width: `${deck.duration > 0 ? Math.min(100, (deck.currentTime / deck.duration) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.045] p-4 text-center">
              <p className="text-xs font-black uppercase text-zinc-400">Crossfader</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{Math.round(snapshot.mixer.crossfader)}</p>
              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-300" style={{ width: `${snapshot.mixer.crossfader}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold text-zinc-400">{realEqEnabled ? "Microphone / line-in analyzer" : "Deck A to Deck B mix"}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
