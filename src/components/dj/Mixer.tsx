import { Headphones } from "lucide-react";
import { useDjStore } from "../../store/djStore";
import { usePreferences } from "../../store/performance";
import { SliderControl } from "./SliderControl";
import { fadeTo,moveFader,stopFade } from "../../services/crossfade";

export function Crossfader() {
  const value = useDjStore(s=>s.mixer.crossfader);
  const playingA=useDjStore(s=>s.decks.A.isPlaying),playingB=useDjStore(s=>s.decks.B.isPlaying);
  const target=(id:"A"|"B",playing:boolean)=><button aria-label={`Fade to ${id}`} disabled={!playing}
    data-hint={playing?"3 sec fade.":`Play ${id} first.`} onClick={()=>fadeTo(id)}>Fade {id}</button>;
  return <div className="cross-strip" onPointerDownCapture={stopFade}><SliderControl label="Crossfader" value={value} onChange={moveFader}/>
    <div className="fader-scale">{target("A",playingA)}<span>{(["Q","W","A"] as const).map((key,i)=>
      <button data-hint={["More A.","Center.","More B."][i]} key={key} title={["Nudge left","Center crossfader","Nudge right"][i]} onClick={()=>moveFader(
        i===1?50:Math.max(0,Math.min(100,value+(i===0?-5:5))))}>{key}</button>)}</span>{target("B",playingB)}</div></div>;
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
