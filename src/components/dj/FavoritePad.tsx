import { useEffect } from "react";
import { holdFavorite, releaseFavorite, useLive, usePreferences } from "../../store/performance";
import { useDjStore } from "../../store/djStore";
import type { DeckId } from "../../types/dj";

export function FavoritePad({id,index}:{id:DeckId;index:number}) {
  const favorite=usePreferences(p=>p.banks[id].pins[index]);
  const ready=useDjStore(s=>!!s.decks[id].localFile && s.decks[id].status==="ready");
  const active=useLive(s=>!!favorite && s[id].favorite===favorite);
  const bypass=useLive(s=>s[id].bypass);
  const owner="pad-"+index;
  useEffect(()=>()=>{
    releaseFavorite(id,owner);
  },[id,owner,favorite]);
  const stop=()=>releaseFavorite(id,owner);
  return <button data-hint={!favorite?"Pin an effect first.":active?"Release to restore.":"Hold for this effect."} disabled={!ready||!favorite||bypass} aria-pressed={active}
    aria-label={`Deck ${id} FX pad ${index+1}: ${favorite??"empty"}`} title={favorite?"Hold "+favorite:"Pin an effect in FX Navigator"}
    onPointerDown={e=>{
      if(e.button!==0||!favorite)return;
      e.currentTarget.setPointerCapture(e.pointerId);
      holdFavorite(id,favorite,owner);
    }} onPointerMove={e=>{
      if(!e.currentTarget.hasPointerCapture(e.pointerId))return;
      const r=e.currentTarget.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)stop();
    }} onPointerLeave={stop} onPointerCancel={stop} onLostPointerCapture={stop} onPointerUp={stop} onBlur={stop}
    onKeyDown={e=>{if(favorite && [" ","Enter"].includes(e.key)){e.preventDefault();if(!e.repeat)holdFavorite(id,favorite,owner);}}}
    onKeyUp={e=>{if([" ","Enter"].includes(e.key))stop();}}>
    {favorite??"Empty"}
  </button>;
}
