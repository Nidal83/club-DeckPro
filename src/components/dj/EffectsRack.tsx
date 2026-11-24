import { Play, Power } from "lucide-react";
import { djEffects } from "../../data/djEffects";
import { effectsEngine } from "../../effects/effectsEngine";
import { audioEngine } from "../../audio/audioEngine";
import { tapEffects } from "../../audio/liveChannel";
import { assignSlot, changeLive, useLive, usePreferences } from "../../store/performance";
import { useDjStore } from "../../store/djStore";
import type { EffectCategory } from "../../types/dj";
import { ControlButton } from "./ControlButton";
import { SliderControl } from "./SliderControl";

const categories: EffectCategory[] = ["Basic", "Club", "Performance", "EDM"];

const accentClass = {
  amber: "border-amber-400/25",
  blue: "border-sky-400/25",
  cyan: "border-cyan-400/25",
  pink: "border-fuchsia-400/25"
};

export function EffectsRack() {
  const effects = useDjStore((state) => state.effects);
  const updateEffect = useDjStore((state) => state.updateEffect);
  const id = useDjStore(s=>s.activeDeckId);
  const local = useDjStore(s=>!!s.decks[id].localFile && s.decks[id].status==="ready");
  const live=useLive(s=>s[id]), slot=usePreferences(s=>s.slots[id][0]);

  return (
    <section className="dj-panel grid gap-4 p-4">
      <div>
        <p className="text-xs font-black uppercase text-amber-300">FX Engine</p>
        <h2 className="text-xl font-black text-white">Professional DJ Effects</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {categories.map((category) => (
          <div key={category} className="grid content-start gap-3">
            <h3 className="text-sm font-black uppercase text-zinc-300">{category}</h3>
            {djEffects
              .filter((effect) => effect.category === category)
              .map((effect) => {
                const state = effects[effect.id];
                const insert = tapEffects.find(f=>f.toLowerCase()===effect.id);
                const enabled = insert ? live.echo && !live.bypass && slot===insert : state.enabled;
                const activate = () => {
                  if(insert) {
                    assignSlot(id,0,insert);
                    changeLive(id,{echo:!enabled,bypass:false});
                    return;
                  }
                  const key="rack-"+effect.id;
                  if(enabled) audioEngine.stopTone(key);
                  else {
                    void audioEngine.previewTone(effect.id,state.dryWet,["master"],key,state.amount);
                    window.setTimeout(()=>updateEffect(effect.id,{enabled:false}),1400);
                  }
                  updateEffect(effect.id,{enabled:!enabled});
                };
                return (
                  <div key={effect.id} className={`rounded-md border bg-black/35 p-3 ${accentClass[effect.accent]}`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white">{effect.label}</span>
                      <div className="flex gap-1">
                        <ControlButton
                          data-hint="Hear a preview." label={`Preview ${effect.label}`}
                          className="h-8 min-w-8 px-2"
                          onClick={() => void effectsEngine.preview(effect.id, state)}
                        >
                          <Play size={14} />
                        </ControlButton>
                        <ControlButton
                          data-hint={enabled?"Turn it off.":insert?"Apply to this deck.":"Play the sound."} label={insert?`Apply ${effect.label} to deck ${id}`:`Trigger ${effect.label} one-shot`}
                          className="h-8 min-w-8 px-2"
                          disabled={!!insert && !local}
                          active={enabled}
                          tone="amber"
                          onClick={activate}
                        >
                          <Power size={14} />
                        </ControlButton>
                      </div>
                    </div>
                    <SliderControl label="Dry/Wet" value={state.dryWet} onChange={(dryWet) => updateEffect(effect.id, { dryWet })} />
                    <SliderControl label="Amount" value={state.amount} onChange={(amount) => updateEffect(effect.id, { amount })} />
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
