import {useEffect,useRef,useState} from "react";
import {X} from "lucide-react";
import {getYouTubeWatchUrl} from "../../services/youtubeService";
type Bounds={x:number;y:number;width:number;height:number};
declare global {interface Window {youtubeWatch?:{open:(id:string,rect:Bounds)=>Promise<boolean>;bounds:(rect:Bounds)=>void;close:()=>void}}}

export function WatchPanel({id,deck,onClose}:{id:string;deck:string;onClose:()=>void}){
  const host=useRef<HTMLDivElement>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const node=host.current,bridge=window.youtubeWatch;
    if(!node||!bridge)return;
    let alive=true;
    const bounds=()=>{const {x,y,width,height}=node.getBoundingClientRect();return {x,y,width,height};};
    const resize=()=>bridge.bounds(bounds());
    setFailed(false);
    void bridge.open(id,bounds()).then(ok=>{if(alive)setFailed(!ok);},()=>{if(alive)setFailed(true);});
    const observer=new ResizeObserver(resize);observer.observe(node);
    window.addEventListener("resize",resize);
    return ()=>{alive=false;observer.disconnect();window.removeEventListener("resize",resize);bridge.close();};
  },[id]);
  return <aside className="watch-panel" aria-label="YouTube watch page"><header><div><small>Deck {deck} / Separate playback</small><h2>YouTube watch page</h2></div>
    <button aria-label="Close watch page" data-hint="Stop and close." onClick={onClose}><X size={16}/></button></header>
    <div ref={host} className="watch-host">{failed && <p>Could not open YouTube here. <a href={getYouTubeWatchUrl(id)} target="_blank" rel="noreferrer">Open in browser</a></p>}</div></aside>;
}
