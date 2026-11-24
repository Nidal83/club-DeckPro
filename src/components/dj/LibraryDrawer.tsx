import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { extractYouTubeVideoId, loadYouTubeIframeApi, youtubeErrorMessage } from "../../services/youtubeService";
import { PlaylistPanel } from "./PlaylistPanel";

export function LibraryDrawer({open}:{open:boolean}) {
  const [tab,setTab]=useState<"Playlist"|"YouTube">("Playlist");
  const [link,setLink]=useState("");
  const [request,setRequest]=useState<{id:string}|null>(null);
  const [error,setError]=useState("");
  const host=useRef<HTMLDivElement>(null);
  const player=useRef<{pauseVideo():void}|null>(null);
  const visible=open && tab==="YouTube";
  const visibleRef=useRef(visible);
  const start=useRef(false);
  useLayoutEffect(()=>{
    visibleRef.current=visible;
    if(!visible){start.current=false;player.current?.pauseVideo?.();}
  },[visible]);
  useEffect(()=>{
    if(!request||!host.current)return;
    const container=host.current;
    let disposed=false, destroy:(()=>void)|undefined;
    void loadYouTubeIframeApi().then(api=>{
      if(disposed)return;
      const mount=document.createElement("div");
      container.replaceChildren(mount);
      const preview=new api.Player(mount,{
        videoId:request.id,width:"100%",height:"100%",
        playerVars:{controls:1,playsinline:1,origin:location.origin,rel:0},
        events:{
          onReady:()=>{
            if(disposed)return;
            player.current=preview;
            if(visibleRef.current && start.current)preview.playVideo();
            start.current=false;
          },
          onStateChange:e=>{if(!disposed&&!visibleRef.current && e.data===1)preview.pauseVideo();},
          onError:e=>{if(!disposed)setError(youtubeErrorMessage(e.data));}
        }
      });
      destroy=()=>preview.destroy();
    }).catch(()=>{if(!disposed)setError("Could not connect to YouTube. Check your connection and retry.");});
    return ()=>{disposed=true;player.current=null;destroy?.();container.replaceChildren();};
  },[request]);
  return <div className="library-view" data-preview={tab==="YouTube"}>
    <nav aria-label="Library views">{(["Playlist","YouTube"] as const).map(name=><button data-hint={name==="Playlist"?"Browse your queue.":"Preview a video."} key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    <div hidden={tab!=="Playlist"}><PlaylistPanel/></div>
    <div hidden={tab!=="YouTube"} className="preview-layout">
      <form onSubmit={e=>{
        e.preventDefault();
        const id=extractYouTubeVideoId(link);
        if(!id||!/^[\w-]{11}$/.test(id)){setError("Enter a YouTube video link.");return;}
        setError("");start.current=true;setRequest({id});
      }}>
        <label htmlFor="preview-link">YouTube preview</label>
        <div><input id="preview-link" placeholder="Paste a YouTube link" value={link} onChange={e=>setLink(e.target.value)}/>
          <button data-hint="Play this link." type="submit"><Play size={15}/> Preview</button></div>
        {error && <span role="status">{error}</span>}
      </form>
      <div ref={host} className="preview-player" aria-label="YouTube preview player"/>
    </div>
  </div>;
}
