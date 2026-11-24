import { useEffect } from "react";
import { channels } from "../audio/liveChannel";
import { audioEngine, calculateCrossfadeGain } from "../audio/audioEngine";
import { useDjStore } from "../store/djStore";

export function useMixerMeter() {
  useEffect(() => {
    const route=()=>{
      const {mixer}=useDjStore.getState();
      audioEngine.setMasterVolume(mixer.masterVolume);
      for(const id of ["A","B"] as const) audioEngine.setChannelVolume(id,
        mixer[`channelVolume${id}`]*mixer[`gain${id}`]/100*calculateCrossfadeGain(id,mixer.crossfader,mixer.fadeCurve));
    };
    route();
    const off=useDjStore.subscribe((s,p)=>{
      const m=s.mixer, old=p.mixer;
      if(m.crossfader!==old.crossfader||m.fadeCurve!==old.fadeCurve||m.masterVolume!==old.masterVolume||m.channelVolumeA!==old.channelVolumeA||m.channelVolumeB!==old.channelVolumeB||m.gainA!==old.gainA||m.gainB!==old.gainB) route();
    });
    const timer = window.setInterval(() => {
      const levels = Array.from(channels.values(), channel => channel.level());
      const vuA = channels.get("A")?.level() ?? 0, vuB = channels.get("B")?.level() ?? 0;
      useDjStore.getState().updateMixer({vuA,vuB,masterMeter:Math.min(100,levels.reduce((a,b)=>a+b,0))});
    }, 100);
    return () => {off();window.clearInterval(timer);};
  }, []);
}
