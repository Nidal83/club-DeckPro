import { useRef } from "react";
import type { DeckId } from "../../types/dj";
import { changeLive, useLive } from "../../store/performance";

export function HallKnob({id, disabled}:{id:DeckId;disabled:boolean}) {
  const value=useLive(s=>s[id].hall);
  const drag=useRef({x:0,y:0,cx:0,cy:0,angle:0,amount:0,rotary:false,lastTap:-1000});
  const set=(n:number)=>changeLive(id,{hall:Math.round(Math.max(0,Math.min(100,n)))});
  return <button data-hint={value?"Double-tap for dry audio.":"Turn right for more hall."} className="knob-control hall-knob" disabled={disabled} role="slider" aria-label={`Deck ${id} Hall`}
    title="Hall reverb: turn or drag; double-tap for dry" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={value+"%"}
    onKeyDown={e=>{
      if(["Home","End","ArrowDown","ArrowLeft","ArrowUp","ArrowRight"].includes(e.key)){
        e.preventDefault();set(e.key==="Home"?0:e.key==="End"?100:value+(["ArrowDown","ArrowLeft"].includes(e.key)?-1:1)*(e.shiftKey?10:1));
      }
    }}
    onDoubleClick={()=>set(0)} onPointerDown={e=>{
      if(e.button!==0)return;
      const rect=e.currentTarget.querySelector("i")!.getBoundingClientRect();
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=e.clientX-cx,dy=e.clientY-cy;
      const d=drag.current, reset=performance.now()-d.lastTap<330;
      if(reset)set(0);
      Object.assign(d,{cx,cy,x:e.clientX,y:e.clientY,amount:reset?0:value,angle:Math.atan2(dy,dx),
        rotary:Math.hypot(dx,dy)>5 && Math.hypot(dx,dy)<rect.width/2+5});
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e=>{
      if(!e.currentTarget.hasPointerCapture(e.pointerId))return;
      const d=drag.current;
      if(d.rotary){
        const angle=Math.atan2(e.clientY-d.cy,e.clientX-d.cx);
        const delta=Math.atan2(Math.sin(angle-d.angle),Math.cos(angle-d.angle));
        d.amount=Math.max(0,Math.min(100,d.amount+delta*100/(1.5*Math.PI))); d.angle=angle; set(d.amount);
      }else set(d.amount+e.clientX-d.x+d.y-e.clientY);
    }} onPointerUp={e=>{
      const d=drag.current; d.lastTap=Math.hypot(e.clientX-d.x,e.clientY-d.y)<6?performance.now():-1000;
    }}>
    <i className="knob" style={{transform:`rotate(${-135+value*2.7}deg)`}}/><span>Hall<small>{value}%</small></span>
  </button>;
}
