import { useRef } from "react";
import { HallKnob } from "./HallKnob";
import { Power, RotateCcw } from "lucide-react";
import { useDjStore } from "../../store/djStore";
import { changeLive, resetFx, triggerSlot, useLive, usePreferences } from "../../store/performance";
import type { DeckId } from "../../types/dj";

export function QuickFx({id}: {id: DeckId}) {
  const fx = useLive(s => s[id]);
  const available = useDjStore(s => !!s.decks[id].localFile && s.decks[id].status==="ready");
  const prefs = usePreferences();
  const gesture = useRef({x:0,y:0,value:0,tapped:0});
  const set = (n: number) => changeLive(id,{filter: Math.max(-100,Math.min(100,Math.round(n)))});
  const release = () => triggerSlot(id,1,false);
  return <div className="quick-fx" aria-label={`Deck ${id} quick effects`}>
    <div className="strip-label"><strong>Quick FX</strong><small>{!available ? "LOCAL AUDIO FX" : fx.bypass ? "BYPASSED" : fx.favorite ?? "DECK "+id}</small></div>
    <div className="fx-controls">
      <button data-hint="Left softens highs. Right cuts bass." className="knob-control" role="slider" aria-label={`Deck ${id} Filter`} title="Filter: drag to sweep, double-tap to reset"
        disabled={!available || fx.bypass} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={fx.filter}
        onDoubleClick={()=>set(0)} onKeyDown={e=>{
          if(["Home","ArrowLeft","ArrowRight","ArrowDown","ArrowUp"].includes(e.key)) {
            e.preventDefault(); set(e.key==="Home"?0:fx.filter+(["ArrowLeft","ArrowDown"].includes(e.key)?-2:2));
          }
        }}
        onPointerDown={e=>{
          const g=gesture.current, now=performance.now();
          const reset=now-g.tapped<330; if(reset)set(0);
          Object.assign(g,{x:e.clientX,y:e.clientY,value:reset?0:fx.filter,tapped:now});
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){
          const g=gesture.current; set(g.value+e.clientX-g.x+g.y-e.clientY);
        }}}>
        <i className="knob" style={{transform:`rotate(${fx.filter*1.32}deg)`}}/><span>Filter<small>{fx.filter===0?"Neutral":(fx.filter<0?"LP ":"HP ")+Math.abs(fx.filter)}</small></span>
      </button>
      <HallKnob id={id} disabled={!available||fx.bypass}/>
      {prefs.slots[id][0]!=="Echo" && <button className="fx-slot" aria-label={`Echo deck ${id}`} aria-pressed={fx.quickEcho}
        data-hint={fx.quickEcho?"Tap to let repeats fade.":"Tap to add repeats."} disabled={!available||fx.bypass}
        onClick={()=>changeLive(id,{quickEcho:!fx.quickEcho})}>Echo<small>1/2 beat</small></button>}
      {([0,1] as const).map(slot=>{
        const hint = id==="A"||id==="B" ? prefs.keys[`${slot===0?"first":"second"}${id}`] : "";
        return <button data-hint={slot===1?(fx.roll?"Release to resume.":"Hold to repeat. Release to resume."):fx.echo?(prefs.slots[id][0]==="Echo"?"Tap to let repeats fade.":"Tap to release FX."):prefs.slots[id][0]==="Echo"?"Tap to add repeats.":`Tap to add ${prefs.slots[id][0].toLowerCase()}.`} className="fx-slot" key={slot} disabled={!available||fx.bypass} aria-label={`${prefs.slots[id][slot]} deck ${id}`}
          aria-pressed={slot===0?fx.echo:fx.roll} onClick={slot===0?()=>triggerSlot(id,0,true):undefined}
          onPointerDown={slot===1?e=>{if(e.button===0){triggerSlot(id,1,true); if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);}}:undefined}
          onKeyDown={slot===1?e=>{if([" ","Enter"].includes(e.key)){e.preventDefault();if(!e.repeat)triggerSlot(id,1,true);}}:undefined}
          onKeyUp={slot===1?release:undefined} onPointerLeave={slot===1?release:undefined} onPointerUp={slot===1?release:undefined}
          onPointerCancel={slot===1?release:undefined} onBlur={slot===1?release:undefined}>
          {prefs.slots[id][slot]} <kbd>{hint}</kbd><small>{slot===0?({Echo:"1/2 beat",Delay:"3/4 beat"}[prefs.slots[id][slot] as "Echo"|"Delay"]??"Tap"): (prefs.slots[id][slot]==="Stutter"?"1/8":"1/4")+" hold"}</small>
        </button>;
      })}
      <div className="fx-actions"><button data-hint={fx.bypass?"FX back on.":"Bypass FX."} aria-label={`Bypass effects deck ${id}`} title="Bypass FX" aria-pressed={fx.bypass} disabled={!available}
        onClick={()=>changeLive(id,{bypass:!fx.bypass,roll:false,favorite:null,owner:""})}><Power size={15}/></button>
        <button data-hint="Clear FX." aria-label={`Reset effects deck ${id}`} title="Reset FX" disabled={!available} onClick={()=>resetFx(id)}><RotateCcw size={15}/></button></div>
    </div>
  </div>;
}
