import { useState } from "react";
import { assignSlot, remap, usePreferences, type Action } from "../../store/performance";
import { useDjStore } from "../../store/djStore";
import { tapEffects, holdEffects, type LiveEffect } from "../../audio/liveChannel";
import type { FadeCurve } from "../../types/dj";

export function SlotSettings() {
  const id = useDjStore(s=>s.activeDeckId), slots=usePreferences(s=>s.slots[id]);
  return <div className="settings-line"><b>Deck {id} quick FX</b>{([0,1] as const).map(slot=><label data-hint="Choose this slot’s effect." key={slot}>{slot===0?"Tap slot":"Hold slot"}
    <select value={slots[slot]} onChange={e=>assignSlot(id,slot,e.target.value as LiveEffect)}>
      {(slot===0?tapEffects:holdEffects).map(f=><option key={f}>{f}</option>)}</select></label>)}</div>;
}
export function LiveSettings() {
  const prefs=usePreferences(), mixer=useDjStore(s=>s.mixer);
  const [message, setMessage]=useState("");
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  return <div className="live-settings">
    <div className="settings-line"><b>Keyboard</b>{(Object.entries(prefs.keys) as [Action,string][]).map(([action,key])=>
      <label data-hint="Press a new key." key={action}>{action.endsWith("A")?"A":"B"} / {action.startsWith("play")?"Play":action.startsWith("first")?"Tap FX":action.startsWith("preset")?"DJ International":"Hold FX"}
        <input aria-label={`Remap ${action}`} value={key.toUpperCase()} maxLength={1} readOnly onKeyDown={e=>{
          if(e.key==="Tab")return; e.preventDefault(); e.stopPropagation();
          setMessage(remap(action,e.key.toLowerCase())?"Mapping saved":"Use an unused letter or number. Q, W and A control the crossfader.");
        }}/></label>)}</div>
    <div className="settings-line"><label data-hint="Choose how the decks blend.">Fade curve<select value={mixer.fadeCurve} onChange={e=>useDjStore.getState().setFadeCurve(e.target.value as FadeCurve)}>
      {["linear","smooth","sharp","scratch"].map(v=><option key={v}>{v}</option>)}</select></label>
      <button data-hint="Scan for outputs." onClick={async()=>{try {
        const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="audiooutput" && d.deviceId && d.deviceId!=="default" && d.deviceId!=="communications");
        setDevices(list); setMessage(list.length?"Choose a separate output for headphone cue.":"No separate headphone output is available.");
      } catch {setMessage("Audio output selection is unavailable.");}}}>Find headphone outputs</button>
      <label data-hint="Choose where cue audio plays.">Headphone output<select value={prefs.device} onChange={e=>usePreferences.setState({device:e.target.value})}>
        <option value="">Off</option>{prefs.device&&!devices.some(d=>d.deviceId===prefs.device)&&<option value={prefs.device}>Saved output</option>}
        {devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||"Output "+(i+1)}</option>)}</select></label></div>
    <p role="status">{message}</p>
  </div>;
}
