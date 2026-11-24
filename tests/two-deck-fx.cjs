const assert = require("node:assert/strict");

async function prepare() {
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const panel = id => document.querySelector('.live-deck[data-id="'+id+'"]');
  const control = label => document.querySelector('[aria-label="'+label+'"]');
  const nav = label => [...document.querySelectorAll(".console-drawer>nav button")].find(b=>b.textContent===label);
  const level = id => control("Level "+id).value;
  const until = async (fn,msg) => {
    for(let i=0;i<80;i++){if(fn())return;await sleep(50);}
    throw Error(msg);
  };
  const key = (target,k,type="keydown")=>target.dispatchEvent(new KeyboardEvent(type,{key:k,code:"Key"+k.toUpperCase(),bubbles:true,cancelable:true}));
  window.fxTest={sleep,panel,control,nav,level,until,key};
  // Separate low and mid tones make cross-deck coupling measurable on the channel meters.
  for(const [id,freq] of [["A",125],["B",1000]]){
    const samples=8000*45, buffer=new ArrayBuffer(44+samples*2), v=new DataView(buffer);
    const tag=(i,s)=>[...s].forEach((c,n)=>v.setUint8(i+n,c.charCodeAt(0)));
    tag(0,"RIFF");v.setUint32(4,buffer.byteLength-8,true);tag(8,"WAVE");tag(12,"fmt ");
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);
    v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,"data");v.setUint32(40,samples*2,true);
    for(let i=0;i<samples;i++)v.setInt16(44+2*i,6500*Math.sin(2*Math.PI*freq*i/8000),true);
    const transfer=new DataTransfer();transfer.items.add(new File([buffer],id+".wav",{type:"audio/wav"}));
    const file=panel(id).querySelector('[type=file]');file.files=transfer.files;
    file.dispatchEvent(new Event("change",{bubbles:true}));await until(()=>panel(id).textContent.includes("-00:45"),"load "+id);
    control("Play deck "+id).click(); await until(()=>level(id)>1,"no signal on "+id);
  }
  const knob=control("Deck A Hall"), filter=control("Deck A Filter");
  key(knob,"ArrowUp");await sleep(25);
  for(let i=0;i<3;i++){knob.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",shiftKey:true,bubbles:true}));await sleep(25);}
  key(filter,"ArrowLeft");await sleep(30);
  nav("FX Navigator").click();await sleep(40);
  control("Navigator deck A").click();await sleep(30);
  // Restore the normal Echo slot after the earlier remapping regression.
  const tap=document.querySelector(".settings-line select");tap.value="Echo";tap.dispatchEvent(new Event("change",{bubbles:true}));
  control("Pin DJ International to deck A pad 2").click();await sleep(35);
  nav("FX Navigator").click();await sleep(35);control("Echo deck A").click();
  [...panel("A").querySelectorAll(".pads button")].find(b=>b.textContent==="FX").click();await sleep(1400);
  window.fxTest.base=[level("A"),level("B")];
  window.fxTest.time=panel("B").querySelector(".position strong").textContent;
  const pad=control("Deck A FX pad 2: DJ International"), rect=pad.getBoundingClientRect();
  window.fxTest.pad=pad;
  if(knob.getAttribute("aria-valuenow")!=="31"||control("Deck B Hall").getAttribute("aria-valuenow")!=="0")throw Error("Hall isolation");
  return {x:Math.floor(rect.x+rect.width/2),y:Math.floor(rect.y+rect.height/2)};
}

async function verifyRelease() {
  const {sleep,panel,control,nav,level,until,key,base,pad,time}=window.fxTest;
  await until(()=>pad.getAttribute("aria-pressed")==="false","outside release stuck");
  await sleep(1800);
  if(Math.abs(level("A")-base[0])>base[0]*0.22 || Math.abs(level("B")-base[1])>base[1]*0.12)throw Error("Channel levels failed to return");
  if(control("Deck A Hall").getAttribute("aria-valuenow")!=="31" || control("Deck A Filter").getAttribute("aria-valuenow")!=="-2" ||
    control("Echo deck A").getAttribute("aria-pressed")!=="true")throw Error("Prior deck settings were lost");
  nav("FX Navigator").click();await sleep(100);nav("FX Navigator").click();await sleep(80);
  if(!control("Pause deck B")||time===panel("B").querySelector(".position strong").textContent)throw Error("Deck B stopped");
  key(window,"g");await until(()=>pad.getAttribute("aria-pressed")==="true","preset shortcut");
  window.dispatchEvent(new Event("blur"));await until(()=>pad.getAttribute("aria-pressed")==="false","blur release");
  control("Deck A Hall").dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));await until(()=>control("Deck A Hall").getAttribute("aria-valuenow")==="0","Hall dry reset");
  const previewCalls=[];
  window.YT={PlayerState:{PLAYING:1},Player:class{
    constructor(mount,{events,playerVars}){
      if(playerVars.controls!==1)throw Error("Preview must expose official controls");
      mount.replaceWith(document.createElement("iframe"));this.playVideo=()=>{previewCalls.push("play");events.onError({data:150});};
      this.pauseVideo=()=>previewCalls.push("pause");this.destroy=()=>{};setTimeout(events.onReady,0);
    }
  }};
  nav("Library").click();await sleep(40);[...document.querySelectorAll(".library-view nav button")].find(b=>b.textContent==="YouTube").click();
  const link=document.querySelector("#preview-link");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(link,"https://youtu.be/aaaaaaaaaaa");
  link.dispatchEvent(new Event("input",{bubbles:true}));await sleep(30);
  link.form.requestSubmit();await until(()=>previewCalls.includes("play"),"Preview did not start");
  if(!document.querySelector(".preview-layout a")?.textContent.includes("Open on YouTube")||!document.querySelector(".preview-layout [role=status]")?.textContent.includes("150"))throw Error("Preview blocked fallback");
  if(document.documentElement.scrollHeight>innerHeight+1)throw Error("Page overflow with preview open");
  nav("Library").click();await until(()=>previewCalls.at(-1)==="pause","Preview continued behind drawer");
  if(!control("Pause deck A")||!control("Pause deck B"))throw Error("Preview interrupted deck transport");
}

module.exports=async function twoDeckFx(win){
  const run=js=>win.webContents.executeJavaScript(js,true);
  const xy=await run("("+prepare.toString()+")()");
  win.webContents.sendInputEvent({type:"mouseDown",button:"left",clickCount:1,...xy});
  await run('fxTest.until(()=>fxTest.pad.getAttribute("aria-pressed")==="true","Pad did not engage")');
  await run("fxTest.sleep(1500)");
  const levels=await run('({base:fxTest.base,held:[fxTest.level("A"),fxTest.level("B")]})');
  assert.ok(levels.held[0]<levels.base[0]*0.6,"Preset must sweep bass from A");
  assert.ok(Math.abs(levels.held[1]-levels.base[1])<levels.base[1]*0.12,"Preset affected B");
  win.webContents.sendInputEvent({type:"mouseMove",x:xy.x,y:xy.y-70,modifiers:["leftButtonDown"]});
  win.webContents.sendInputEvent({type:"mouseUp",button:"left",x:xy.x,y:xy.y-70,clickCount:1});
  await run("("+verifyRelease.toString()+")()");
  console.log("Two local decks, preset sweep and recovery, Hall, outside release, Navigator and preview lifecycle passed",levels);
};
