import { Headphones } from "lucide-react";
import { useDjStore } from "../../store/djStore";
import { usePreferences } from "../../store/performance";
import { SliderControl } from "./SliderControl";
import { deckPlayerRegistry } from "../../services/deckPlayerRegistry";

export function Crossfader() {
  const value = useDjStore(s=>s.mixer.crossfader);
  const decks=useDjStore(s=>s.decks);
  if(decks.A.source==="youtube" || decks.B.source==="youtube")return <div className="cross-strip handoff"><small>Deck switch</small><div>
    {(["A","B"] as const).map(id=><button key={id} aria-label={`Switch to ${id}`} data-hint="Pause this deck and play the other." disabled={decks[id].status!=="ready" || decks[id].isPlaying} onClick={()=>{
      deckPlayerRegistry.pause(id==="A"?"B":"A");
      deckPlayerRegistry.play(id);
    }}>Switch to {id}</button>)}</div></div>;
  return <div className="cross-strip"><SliderControl label="Crossfader" value={value} onChange={crossfader=>useDjStore.getState().updateMixer({crossfader})}/>
    <div className="fader-scale"><b>A</b><span>{(["Q","W","A"] as const).map((key,i)=>
      <button data-hint={["More A.","Center.","More B."][i]} key={key} title={["Nudge left","Center crossfader","Nudge right"][i]} onClick={()=>useDjStore.getState().updateMixer({
        crossfader:i===1?50:Math.max(0,Math.min(100,value+(i===0?-5:5)))})}>{key}</button>)}</span><b>B</b></div></div>;
}

export function Mixer() {
  const mixer = useDjStore(s=>s.mixer);
  const decks = useDjStore(s=>s.decks);
  const device = usePreferences(s=>s.device);
  const {updateMixer, updateDeck}=useDjStore.getState();
  return <section className="live-mixer" aria-label="Channel mixer">
    <header><small>Master section</small><h2>Mixer</h2></header>
    <div className="channel-pair">{(["A","B"] as const).map(id=>{
      const d=decks[id], local=!!d.localFile;
      return <div key={id} className="channel" data-id={id}>
        <div className="strip-label"><b>CH {id}</b><meter aria-label={`Level ${id}`} min={0} max={100} value={mixer[`vu${id}`]}/></div>
        <SliderControl label="Gain" value={mixer[`gain${id}`]} onChange={v=>updateMixer({[`gain${id}`]:v})}/>
        <fieldset disabled={!local} title={!local?"Three-band EQ requires local audio":undefined}>{(["high","mid","low"] as const).map(band=>
          <SliderControl key={band} label={band+" EQ"} unit=" dB" min={-12} max={12} value={d.eq[band]} onChange={v=>{
            updateMixer({[`${band}${id}`]:v}); updateDeck(id,{eq:{...d.eq,[band]:v}});
          }}/>)}</fieldset>
        <button data-hint={d.headphoneCue?"Tap to stop listening.":device?"Tap to hear this deck.":"Set headphones in Settings."} aria-label={`Headphone cue ${id}`} title={device?"Pre-fader headphone cue":"Choose a headphone output in Settings"} disabled={!local||!device}
          aria-pressed={d.headphoneCue} onClick={()=>updateDeck(id,{headphoneCue:!d.headphoneCue})}><Headphones size={15}/> Cue</button>
        <SliderControl label="Channel" value={mixer[`channelVolume${id}`]} onChange={v=>updateMixer({[`channelVolume${id}`]:v})}/>
      </div>;
    })}</div>
    <div className="master-strip"><SliderControl label="Master" value={mixer.masterVolume} onChange={masterVolume=>updateMixer({masterVolume})}/>
      <meter aria-label="Master level" min={0} max={100} value={mixer.masterMeter}/></div>
    <Crossfader/>
  </section>;
}
