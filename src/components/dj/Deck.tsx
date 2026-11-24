import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Link, Pause, Play, SkipBack, Zap, FolderOpen } from "lucide-react";
import { useDjStore } from "../../store/djStore";
import type { DeckId } from "../../types/dj";
import { useYouTubeDeck } from "../../hooks/useYouTubeDeck";
import { extractYouTubeVideoId,getYouTubeWatchUrl } from "../../services/youtubeService";
import { createPortal } from "react-dom";
import { changeLive, useLive, toggleLoop, usePreferences } from "../../store/performance";
import { QuickFx } from "./QuickFx";
import { FavoritePad } from "./FavoritePad";
import { ControlButton } from "./ControlButton";
import { JogWheel } from "./JogWheel";
import { SliderControl } from "./SliderControl";
import { WaveformDisplay } from "./WaveformDisplay";

interface DeckProps {
  deckId: DeckId;
  toolsHost: HTMLElement | null;
  onWatch:(id:string)=>void;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
};

export function Deck({ deckId, toolsHost,onWatch }: DeckProps) {
  const deck = useDjStore((state) => state.decks[deckId]);
  const updateDeck = useDjStore((state) => state.updateDeck);
  const loadYouTubeTrack = useDjStore((state) => state.loadYouTubeTrack);
  const toggleHotCue = useDjStore((state) => state.toggleHotCue);
  const [url, setUrl] = useState(deck.url);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasSource = Boolean(deck.videoId || deck.localFile);
  const youtube=deck.source==="youtube";
  const selectSource=(source:typeof deck.source)=>{
    if(source===deck.source)return;
    setUrl("");
    updateDeck(deckId,{source,loadId:deck.loadId+1,autoPlay:false,localFile:null,videoId:null,url:"",title:"",duration:0,currentTime:0,status:"idle",error:null,isPlaying:false,beatGrid:[],downbeats:[]});
  };
  const [cueInput, setCueInput] = useState("0:00");
  const [padMode,setPadMode] = useState<"Hot Cues" | "Loops" | "FX">("Hot Cues");
  const [bank,setBank] = useState(0);
  const focused = useDjStore(s => s.activeDeckId === deckId);
  const loop = useLive(s => s[deckId].loop);
  const keys = usePreferences(s => s.keys);
  const playerElementId = useMemo(() => `youtube-deck-${deckId}`, [deckId]);
  const player = useYouTubeDeck(deckId, playerElementId);
  const otherDeckId: DeckId = deckId === "A" ? "B" : "A";
  const setActiveDeck = useDjStore((state) => state.setActiveDeck);

  useEffect(() => {
    setUrl(deck.url);
  }, [deck.url]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadYouTubeTrack(deckId, url.trim());
  };

  const handlePlay = () => {
    const nextUrl = url.trim();
    if (deck.isPlaying && nextUrl === deck.url.trim()) { player.pause(); return; }
    if (!nextUrl && deck.localFile) {
      if (deck.status === "error") updateDeck(deckId, { loadId: deck.loadId + 1, autoPlay: true, status: "loading", error: null });
      else player.play();
      return;
    }

    if (!nextUrl) {
      updateDeck(deckId, { status: "error", error: "Paste a YouTube URL, then press Play or Load." });
      return;
    }

    if (nextUrl !== deck.url.trim() || deck.status === "error" || !deck.videoId) {
      void loadYouTubeTrack(deckId, nextUrl, true);
      return;
    }
    player.play();
  };

  const handlePitchChange = (pitch: number) => {
    updateDeck(deckId, { pitch });
    player.setPitchRate(pitch);
  };

  const goToCueInput = () => {
    const seconds = parseTimeInput(cueInput);
    if (seconds === null) {
      updateDeck(deckId, { error: "Enter cue time as seconds, mm:ss, or hh:mm:ss." });
      return;
    }

    player.seekTo(seconds);
  };

  const setCueFromCurrentPosition = () => {
    setCueInput(deck.currentTime.toFixed(2));
    updateDeck(deckId, { cueEnabled: true, error: null });
  };

  const transportHint = deckId === "A" ? keys.playA : deckId === "B" ? keys.playB : "";
  return (
    <section className="live-deck" data-id={deckId} data-source={deck.source} data-focused={focused} aria-label={`Deck ${deckId}`}
      onPointerDown={() => setActiveDeck(deckId)} onFocusCapture={() => setActiveDeck(deckId)}
      onPaste={e=>{
        if(deck.isPlaying || (e.target as HTMLElement).closest("input,textarea,[contenteditable=true]"))return;
        const link=e.clipboardData.getData("text/plain").trim();
        if(extractYouTubeVideoId(link)){e.preventDefault();void loadYouTubeTrack(deckId,link);}
      }}
      onDragOver={e=>{if(e.dataTransfer.types.some(t=>t==="text/uri-list"||t==="text/plain"))e.preventDefault();}}
      onDrop={e=>{
        const link=(e.dataTransfer.getData("text/uri-list").split(/\r?\n/).find(line=>line&&!line.startsWith("#"))||e.dataTransfer.getData("text/plain")).trim();
        if(extractYouTubeVideoId(link)){e.preventDefault();if(!deck.isPlaying)void loadYouTubeTrack(deckId,link);}
      }}>
      <header className="track-head">
        <b className="deck-letter">{deckId}</b>
        <div><small>{deck.isPlaying ? "PLAYING" : deck.status.toUpperCase()} &nbsp; / &nbsp; {deck.localFile ? "LOCAL AUDIO" : deck.videoId ? "YOUTUBE" : "DECK "+deckId}</small>
        <h2 title={deck.title}>{hasSource ? deck.title : "No track loaded"}</h2></div>
        <div className="bpm"><strong>{Math.round(deck.bpm*(1+deck.pitch/100))}</strong><small>BPM</small></div>
      </header>
      <form onSubmit={onSubmit} className="load-row flex gap-2">
        <div className="source-switch" role="group" aria-label={`Deck ${deckId} source`}>{(["local","youtube"] as const).map(s=>
          <button key={s} type="button" aria-pressed={deck.source===s} aria-label={`Deck ${deckId} ${s} source`} data-hint={s===deck.source?"Selected.":hasSource?"Replace source.":"Select source."} onClick={()=>selectSource(s)}>{s==="local"?"Local":"YouTube"}</button>)}</div>
        {youtube && <>
        <label className="sr-only" htmlFor={`youtube-url-${deckId}`}>
          YouTube URL deck {deckId}
        </label>
        <input
          id={`youtube-url-${deckId}`}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste YouTube link"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-300"
        />
        <ControlButton data-hint="Cue this link." type="submit" label={`Load deck ${deckId}`} tone="blue">
          <Link size={15} /> Open video
        </ControlButton>
        </>}
        <input type="file" ref={fileInput} hidden accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUrl("");
          updateDeck(deckId, { source:"local", loadId: deck.loadId + 1, localFile: file, autoPlay: false, url: "", videoId: null,
            title: file.name, duration: 0, currentTime: 0, isPlaying: false, status: "loading", error: null,
            beatGrid: [], downbeats: [], targetBpm: null });
        }} />
        {!youtube && <ControlButton data-hint="Choose a track to cue." label={`Open audio file on deck ${deckId}`} onClick={() => fileInput.current?.click()}>
          <FolderOpen size={17} />Load audio file
        </ControlButton>}
      </form>
      <div className="transport">
        <ControlButton disabled={!hasSource && !url.trim()} data-hint={url.trim()!==deck.url.trim()?"Play this link.":deck.isPlaying?"Tap to pause.":!hasSource?"Add a track first.":deck.status==="error"?"Tap to retry.":"Tap to play."} label={`${deck.isPlaying ? "Pause" : "Play"} deck ${deckId}`} onClick={handlePlay} active={deck.isPlaying} tone="blue">
          {deck.isPlaying ? <Pause size={17}/> : <Play size={17}/>} {deck.isPlaying ? "Pause" : "Play"} <kbd>{transportHint}</kbd>
        </ControlButton>
        <ControlButton data-hint="Pause at cue." label={`Cue deck ${deckId}`} disabled={!hasSource} onClick={() => {player.pause(); goToCueInput();}}><SkipBack size={16}/> Cue</ControlButton>
        <ControlButton data-hint={`Match Deck ${otherDeckId}.`} label={`Sync deck ${deckId}`} disabled={!hasSource} onClick={() => player.syncTo(otherDeckId)}><Zap size={15}/> Sync</ControlButton>
        <time title="Time remaining">-{formatTime(deck.duration-deck.currentTime)}</time>
      </div>
      <div className="deck-video" hidden={!youtube}>
        <div id={playerElementId} className="yt-mount"/>
        {!deck.videoId && <strong>YouTube player</strong>}
      </div>
      {!youtube && <div className="scope"><WaveformDisplay deckId={deckId}/></div>}
      {youtube ? <div className="local-fx-notice"><span>Load a local file to use FX.</span>
        {deck.videoId && (window.youtubeWatch ? <button data-hint="Use YouTube's own controls." onClick={()=>{player.pause();onWatch(deck.videoId!);}}>Watch inside mixer</button>
        : <a data-hint="Open the official watch page." href={getYouTubeWatchUrl(deck.videoId)} target="_blank" rel="noreferrer">Open on YouTube</a>)}</div>:<QuickFx id={deckId}/>}
      <div className="tempo"><SliderControl label="Tempo" min={-16} max={16} step={0.1} unit="%" value={deck.pitch} onChange={handlePitchChange}/></div>
      <div className="pads"><div className="strip-label"><strong>Performance pads</strong><div>{(["Hot Cues","Loops","FX"] as const).map(mode =>
        <button data-hint={mode==="Hot Cues"?"Use cue points.":mode==="Loops"?"Use beat loops.":"Use pinned FX."} key={mode} aria-pressed={padMode===mode} onClick={() => setPadMode(mode)}>{mode}</button>)}</div></div>
        <div className="pad-row">{[0,1,2,3].map(i => {
          if(padMode==="FX")return <FavoritePad key={i} id={deckId} index={i}/>;
          const cue = deck.hotCues[i+bank*4], beats = 2**i;
          return <button data-hint={padMode==="Loops"?(loop===beats?"Tap to exit loop.":`Loop ${beats} beat${beats===1?"":"s"}.`):cue.active?"Tap to jump here.":"Tap to save this point."} key={i} disabled={!hasSource} aria-pressed={padMode==="Loops" ? loop===beats : cue.active}
            onClick={() => { if (padMode==="Loops") toggleLoop(deckId,beats); else if(cue.active) player.seekTo(cue.time); else toggleHotCue(deckId,cue.index); }}>
            {padMode==="Loops" ? beats+" beat"+(beats>1?"s":"") : cue.label}</button>;
        })}</div>
      </div>
      <div className="media-strip" data-video={!!deck.videoId}>
        {!deck.videoId && <JogWheel deckId={deckId} disabled={!hasSource} isPlaying={deck.isPlaying} onActivate={() => setActiveDeck(deckId)} onJog={player.jog} onBackspin={player.backspin}/>}
        <div className="position"><small>Playhead</small><strong>{formatTime(deck.currentTime)}</strong><span>{deck.localFile?.name ?? (deck.videoId ? "YouTube player" : "Manual jog")}</span></div>
      </div>
      {deck.error && <aside className="deck-error" role="status">{deck.error} {deck.videoId && <a data-hint="Watch in your browser." href={getYouTubeWatchUrl(deck.videoId)} target="_blank" rel="noreferrer"><ExternalLink size={14}/> YouTube</a>}</aside>}
      {focused && toolsHost && createPortal(<div className="deck-tools">
        <h3>Deck {deckId} tools</h3><label data-hint="Choose four cue pads.">Cue bank <select value={bank} onChange={e => setBank(Number(e.target.value))}><option value="0">1 - 4</option><option value="1">5 - 8</option></select></label>
        <label data-hint="Choose a length or exit.">Loop beats <select value={loop} onChange={e => toggleLoop(deckId,Number(e.target.value))}>{[0,1,2,4,8].map(n=><option key={n} value={n}>{n || "Off"}</option>)}</select></label>
        <button data-hint="Start the loop here." disabled={!loop} onClick={()=>changeLive(deckId,{loopStart:deck.currentTime})}>Set loop in</button>
        <label data-hint="Enter the track tempo.">Track BPM <input key={deck.loadId} type="number" min="30" max="300" defaultValue={deck.bpm} onBlur={e=>{const n=Number(e.target.value); if(n>=30 && n<=300) updateDeck(deckId,{bpm:n}); else e.target.value=String(deck.bpm);}}/></label>
        <SliderControl label="Deck volume" value={deck.volume} onChange={volume=>updateDeck(deckId,{volume})}/>
        <SliderControl label="Deck gain" value={deck.gain} onChange={gain=>updateDeck(deckId,{gain})}/>
        <JogWheel deckId={deckId} disabled={!hasSource} isPlaying={deck.isPlaying} onActivate={()=>setActiveDeck(deckId)} onJog={player.jog} onBackspin={player.backspin}/>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <ControlButton data-hint="Step backward with FX." label={`Reverse effect deck ${deckId}`} tone="blue" onClick={player.reverseEffect} disabled={!hasSource}>
              <span className="text-[11px] uppercase">Reverse</span>
            </ControlButton>
            <ControlButton data-hint="Jump to the entered time." label={`Cue to entered time deck ${deckId}`} tone="blue" onClick={goToCueInput} disabled={!hasSource}>
              <span className="text-[11px] uppercase">Go Cue</span>
            </ControlButton>
            <ControlButton data-hint="Skip back one second." label={`Nudge deck ${deckId} backward 1 second`} onClick={() => player.seekTo(deck.currentTime - 1)} disabled={!hasSource}>
              -1s
            </ControlButton>
            <ControlButton data-hint="Skip ahead one second." label={`Nudge deck ${deckId} forward 1 second`} onClick={() => player.seekTo(deck.currentTime + 1)} disabled={!hasSource}>
              +1s
            </ControlButton>
          </div>

          <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <label className="grid gap-1 text-xs font-bold uppercase text-zinc-500" htmlFor={`cue-input-${deckId}`}>
              Exact cue point
              <input
                id={`cue-input-${deckId}`}
                value={cueInput}
                onChange={(event) => setCueInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    goToCueInput();
                  }
                }}
                placeholder="90 or 1:30"
                className="h-9 rounded-md border border-white/10 bg-black/45 px-3 text-sm font-bold tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-300"
              />
            </label>
            <ControlButton data-hint="Save this cue time." label={`Set cue deck ${deckId}`} onClick={setCueFromCurrentPosition} disabled={!hasSource}>
              <span className="text-[11px] uppercase">Set Cue</span>
            </ControlButton>
            <div className="grid grid-cols-2 gap-1">
              <ControlButton data-hint="Slow down briefly." label={`Pitch bend deck ${deckId} slower`} tone="amber" onClick={() => player.pitchBend("backward")} disabled={!hasSource}>
                Bend -
              </ControlButton>
              <ControlButton data-hint="Speed up briefly." label={`Pitch bend deck ${deckId} faster`} tone="amber" onClick={() => player.pitchBend("forward")} disabled={!hasSource}>
                Bend +
              </ControlButton>
            </div>
          </div>

        <div className="flex gap-2">{deck.hotCues.filter(c=>c.active).map(c=><button data-hint="Erase this cue." key={c.index} onClick={()=>toggleHotCue(deckId,c.index)}>Clear cue {c.label}</button>)}</div>
      </div>, toolsHost)}
    </section>
  );
}
