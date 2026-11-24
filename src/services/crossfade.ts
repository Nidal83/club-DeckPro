import { useDjStore } from "../store/djStore";

let frame=0;
export function stopFade() {
  cancelAnimationFrame(frame);
  frame=0;
}
export function moveFader(crossfader:number) {
  stopFade();
  useDjStore.getState().updateMixer({crossfader});
}
export function fadeTo(id:"A"|"B") {
  stopFade();
  const {decks,mixer}=useDjStore.getState();
  if(!decks[id].isPlaying)return;
  const start=mixer.crossfader, end=id==="A"?0:100, loadId=decks[id].loadId;
  const since=performance.now();
  const advance=(now:number)=>{
    const state=useDjStore.getState(), target=state.decks[id];
    if(!target.isPlaying || target.loadId!==loadId){
      if(state.decks[id==="A"?"B":"A"].isPlaying)state.updateMixer({crossfader:start});
      stopFade();return;
    }
    const t=Math.min(1,(now-since)/3000);
    const next=Math.round(start+(end-start)*t);
    if(next!==state.mixer.crossfader)state.updateMixer({crossfader:next});
    frame=t<1?requestAnimationFrame(advance):0;
  };
  frame=requestAnimationFrame(advance);
}
