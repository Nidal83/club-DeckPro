import { useState } from "react";
import { Pin } from "lucide-react";
import { favorites, international, setBank, usePreferences, type Favorite } from "../../store/performance";
import { useDjStore } from "../../store/djStore";
import { EffectsRack } from "./EffectsRack";
import { SlotSettings } from "./LiveSettings";

export function FxNavigator() {
  const id=useDjStore(s=>s.activeDeckId), ids=useDjStore(s=>s.visibleDeckIds);
  const bank=usePreferences(p=>p.banks[id]);
  const [effect,selectEffect]=useState<Favorite>(international);
  return <>
    <div className="navigator">
      <div className="navigator-decks"><strong>FX Navigator</strong>{ids.map(d=><button data-hint={id===d?"Editing this deck.":"Edit this deck."} key={d} aria-label={`Navigator deck ${d}`}
        aria-pressed={d===id} onClick={()=>useDjStore.getState().setActiveDeck(d)}>Deck {d}</button>)}</div>
      <div className="navigator-controls">
        <label data-hint="Pick a sound to pin.">Favorite effect<select aria-label="Favorite effect" value={effect} onChange={e=>selectEffect(e.target.value as Favorite)}>
          {favorites.map(f=><option key={f}>{f}</option>)}</select></label>
        <div className="pin-targets"><small>Pin to Deck {id} / FX pads</small><div>{bank.pins.map((pin,i)=><button data-hint={pin===effect?"Pinned here.":pin?"Replace this pin.":"Pin here."} key={i}
          aria-label={`Pin ${effect} to deck ${id} pad ${i+1}`} aria-pressed={pin===effect} title={pin??"Empty pad"}
          onClick={()=>setBank(id,{pins:bank.pins.map((v,n)=>n===i?effect:v)})}><Pin size={12}/>{i+1}</button>)}</div></div>
        <label data-hint="Choose the tail length.">Hall decay<select aria-label="Hall decay" value={bank.decay} onChange={e=>setBank(id,{decay:Number(e.target.value)})}>
          {[1.2,1.8,2.4,3.2,4].map(n=><option value={n} key={n}>{n.toFixed(1)} s</option>)}</select></label>
        <label data-hint="Slide right for a brighter tail.">Hall tone · {(bank.tone/1000).toFixed(1)} kHz<input aria-label="Hall tone" type="range" min={2000} max={9000} step={100}
          value={bank.tone} onChange={e=>setBank(id,{tone:Number(e.target.value)})}/></label>
      </div>
    </div>
    <SlotSettings/><EffectsRack/>
  </>;
}
