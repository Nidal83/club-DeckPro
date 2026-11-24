import { Pause, Play } from "lucide-react";
import { soundFxDefinitions } from "../../data/djEffects";
import { audioEngine } from "../../audio/audioEngine";
import { useDjStore } from "../../store/djStore";
import { ControlButton } from "./ControlButton";
import { SliderControl } from "./SliderControl";

export function SoundFxPanel() {
  const soundFx = useDjStore((state) => state.soundFx);
  const updateSoundFx = useDjStore((state) => state.updateSoundFx);

  const playFx = (id: string) => {
    const state = soundFx[id];
    updateSoundFx(id, { isPlaying: true });
    const routes: ("A"|"B"|"master")[]=[];
    if(state.assignA)routes.push("A");
    if(state.assignB)routes.push("B");
    if(state.assignMaster)routes.push("master");
    void audioEngine.previewTone(id, state.volume,routes,"sfx-"+id);
    window.setTimeout(() => updateSoundFx(id, { isPlaying: false }), 650);
  };

  return (
    <section className="dj-panel grid gap-4 p-4">
      <div>
        <p className="text-xs font-black uppercase text-sky-300">Sound FX</p>
        <h2 className="text-xl font-black text-white">Master FX Panel</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {soundFxDefinitions.map((fx) => {
          const state = soundFx[fx.id];
          return (
            <div key={fx.id} className="rounded-md border border-white/10 bg-black/35 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-black text-white">{fx.label}</span>
                <div className="flex gap-1">
                  <ControlButton data-hint={state.isPlaying?"Play it again.":"Play this sound."} label={`Play ${fx.label}`} active={state.isPlaying} tone="blue" onClick={() => playFx(fx.id)} className="h-8 min-w-8 px-2">
                    <Play size={14} />
                  </ControlButton>
                  <ControlButton data-hint="Stop the sound." label={`Stop ${fx.label}`} onClick={() => { audioEngine.stopTone("sfx-"+fx.id); updateSoundFx(fx.id, { isPlaying: false }); }} className="h-8 min-w-8 px-2">
                    <Pause size={14} />
                  </ControlButton>
                </div>
              </div>
              <SliderControl label="Volume" value={state.volume} onChange={(volume) => updateSoundFx(fx.id, { volume })} />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <ControlButton data-hint={state.assignA?"Remove this route.":"Send to A."} label={`Assign ${fx.label} to deck A`} active={state.assignA} onClick={() => updateSoundFx(fx.id, { assignA: !state.assignA })}>
                  A
                </ControlButton>
                <ControlButton data-hint={state.assignB?"Remove this route.":"Send to B."} label={`Assign ${fx.label} to deck B`} active={state.assignB} onClick={() => updateSoundFx(fx.id, { assignB: !state.assignB })}>
                  B
                </ControlButton>
                <ControlButton
                  data-hint={state.assignMaster?"Remove master route.":"Send to master."} label={`Assign ${fx.label} to master`}
                  active={state.assignMaster}
                  tone="amber"
                  onClick={() => updateSoundFx(fx.id, { assignMaster: !state.assignMaster })}
                >
                  M
                </ControlButton>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
