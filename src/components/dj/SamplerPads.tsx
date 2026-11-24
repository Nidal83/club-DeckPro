import { ChangeEvent, useRef } from "react";
import { Upload } from "lucide-react";
import { audioEngine } from "../../audio/audioEngine";
import { useDjStore } from "../../store/djStore";
import { SliderControl } from "./SliderControl";

export function SamplerPads() {
  const samplerPads = useDjStore((state) => state.samplerPads);
  const updateSamplerPad = useDjStore((state) => state.updateSamplerPad);
  const inputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  const loadSample = async (padId: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await audioEngine.loadSamplerPad(padId, file);
    updateSamplerPad(padId, {
      fileName: file.name,
      objectUrl: URL.createObjectURL(file)
    });
  };

  const triggerPad = (padId: number, volume: number) => {
    updateSamplerPad(padId, { isPlaying: true });
    audioEngine.triggerSamplerPad(padId, volume);
    window.setTimeout(() => updateSamplerPad(padId, { isPlaying: false }), 300);
  };

  return (
    <section className="dj-panel grid gap-4 p-4">
      <div>
        <p className="text-xs font-black uppercase text-amber-300">Sampler</p>
        <h2 className="text-xl font-black text-white">Performance Pads</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {samplerPads.map((pad) => (
          <div key={pad.id} className="rounded-md border border-white/10 bg-black/35 p-3">
            <button
              type="button"
              data-hint={pad.fileName?(pad.isPlaying?"Tap to retrigger.":"Tap to play the sample."):"Tap for a test sound."}
              onClick={() => triggerPad(pad.id, pad.volume)}
              className={`mb-3 h-20 w-full rounded-md border text-lg font-black transition ${
                pad.isPlaying
                  ? "border-amber-300 bg-amber-300/25 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.3)]"
                  : "border-sky-400/25 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20"
              }`}
            >
              {pad.label}
            </button>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-zinc-400" title={pad.fileName ?? "No sample loaded"}>
                {pad.fileName ?? "Empty"}
              </span>
              <button
                type="button"
                data-hint={pad.fileName?"Replace sample.":"Choose a sample."} title={`Load sample ${pad.label}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-zinc-200"
                onClick={() => inputsRef.current[pad.id]?.click()}
              >
                <Upload size={14} />
              </button>
              <input
                ref={(node) => {
                  inputsRef.current[pad.id] = node;
                }}
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp3"
                className="hidden"
                onChange={(event) => void loadSample(pad.id, event)}
              />
            </div>
            <SliderControl label="Volume" value={pad.volume} onChange={(volume) => updateSamplerPad(pad.id, { volume })} />
          </div>
        ))}
      </div>
    </section>
  );
}
