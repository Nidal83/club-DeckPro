import { useState } from "react";
import { AudioLines, Disc3, Library, Maximize2, MonitorUp, Plus, Settings, SlidersHorizontal, X, Grid2X2, Wrench } from "lucide-react";
import { AiAssistant } from "../components/dj/AiAssistant";
import { Deck } from "../components/dj/Deck";
import { FxNavigator } from "../components/dj/FxNavigator";
import { Mixer, Crossfader } from "../components/dj/Mixer";
import { LibraryDrawer } from "../components/dj/LibraryDrawer";
import { RecordingPanel } from "../components/dj/RecordingPanel";
import { SamplerPads } from "../components/dj/SamplerPads";
import { SoundFxPanel } from "../components/dj/SoundFxPanel";
import { LiveSettings } from "../components/dj/LiveSettings";
import { useMixerMeter } from "../hooks/useMixerMeter";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useVisualizerBroadcast } from "../hooks/useVisualizerBroadcast";
import { useDjStore } from "../store/djStore";
import { usePreferences } from "../store/performance";
import "./studio.css";
import "./hints.css";
import "./classic.css";

const tabs = [["Library",Library],["Sampler",Grid2X2],["FX Navigator",SlidersHorizontal],["Tools",Wrench],["Settings",Settings]] as const;
type Tab = (typeof tabs)[number][0];
export function DjStudio() {
  useMixerMeter(); useKeyboardShortcuts(); useVisualizerBroadcast();
  const ids=useDjStore(s=>s.visibleDeckIds), active=useDjStore(s=>s.activeDeckId), decks=useDjStore(s=>s.decks);
  const {setActiveDeck,addDeck,setPerformanceMode}=useDjStore.getState();
  const [tab,setTab]=useState<Tab|null>(null);
  const [toolsHost,setToolsHost]=useState<HTMLDivElement|null>(null);
  const showHints=usePreferences(s=>s.showHints);
  const large=useDjStore(s=>s.performanceMode);
  const classic=usePreferences(s=>s.classic);
  const drawerHints={"Library":"Browse or preview tracks.","Sampler":"Play samples and sounds.","FX Navigator":"Choose effects for this deck.","Tools":"Set cues or record.","Settings":"Edit keys and outputs."};
  const toggle=(name:Tab)=>setTab(v=>v===name?null:name);
  return <main className="studio" data-classic={classic} data-drawer={!!tab} data-hints={showHints} data-performance={large}>
    <header className="console-head"><div className="wordmark"><AudioLines/><h1>Nidal-ClubDeck-pro</h1></div>
      <span className="head-divider"/><small className="console-title">{large?"Large controls":"Performance mixer"}</small>
      <nav><button className="hint-switch" type="button" role="switch" aria-label="Show hints" aria-checked={showHints} data-hint={showHints?"Tap to hide captions.":"Tap to show captions."} onClick={()=>usePreferences.setState({showHints:!showHints})}><i aria-hidden="true"/><b>Show hints</b></button>
      <button data-hint={ids.length===5?"All decks added.":"Tap to add a deck."} title="Add deck" aria-label="Add deck" onClick={addDeck} disabled={ids.length===5}><Plus/> <span>Deck</span></button>
      <button data-hint="Open the visualizer." title="Projector visualizer" aria-label="Projector visualizer" onClick={()=>window.open(location.origin+"/visualizer","nidal-clubdeck-visualizer","popup,width=1440,height=900")}><MonitorUp/><span>Projector</span></button>
      <button data-hint={large?"Return to mixer.":"Open large controls."} title="Performance mode" aria-label={large?"Exit performance mode":"Performance mode"} aria-pressed={large} onClick={()=>setPerformanceMode(!large)}><Maximize2/></button></nav>
    </header>
    <div className="deck-selector"><small>Deck focus</small>{ids.map(id=><button data-hint={active===id?"Keyboard target.":"Tap to focus."} key={id} aria-label={`Focus deck ${id}`} aria-pressed={active===id}
      onClick={()=>setActiveDeck(id)}><Disc3 size={14}/> {id} <span>{decks[id].isPlaying?"Playing":decks[id].status==="ready"?"Cued":"Standby"}</span></button>)}
      <div className="layout-switch" role="group" aria-label="Mixer layout">{["Classic","Compact"].map((name,i)=><button key={name} aria-pressed={classic===(i===0)} data-hint={i===0?"Show platters.":"Slim controls."} onClick={()=>usePreferences.setState({classic:i===0})}>{name}</button>)}</div></div>
    <div className="console-body">{ids.map(id=><div key={id} className="deck-slot" data-side={id==="B"?"right":"left"}
      data-show={id==="B"||id===(active==="B"?"A":active)} data-mobile={active===id}><Deck deckId={id} toolsHost={toolsHost}/></div>)}<Mixer/></div>
    <div className="mobile-cross"><Crossfader/></div>
    <footer className="console-drawer">
      <nav>{tabs.map(([name,Icon])=><button data-hint={tab===name?"Tap to close.":drawerHints[name]} key={name} onClick={()=>toggle(name)} aria-expanded={tab===name} aria-controls="drawer-content"><Icon size={16}/><span>{name}</span></button>)}
      {tab&&<button data-hint="Close drawer." className="drawer-close" aria-label="Close drawer" onClick={()=>setTab(null)}><X size={17}/></button>}</nav>
      <div className="drawer-content" id="drawer-content" hidden={!tab}>
        <div hidden={tab!=="Library"}><LibraryDrawer open={tab==="Library"}/></div>
        <div hidden={tab!=="Sampler"}><SamplerPads/><SoundFxPanel/></div>
        <div hidden={tab!=="FX Navigator"}><FxNavigator/></div>
        <div hidden={tab!=="Tools"}><div ref={setToolsHost}/><RecordingPanel/><AiAssistant/></div>
        <div hidden={tab!=="Settings"}><LiveSettings/><div className="mobile-mixer"><Mixer/></div></div>
      </div>
    </footer>
  </main>;
}
