const {app,BrowserWindow}=require("electron");
const express=require("express");
const path=require("node:path");
const fs=require("node:fs");
const assert=require("node:assert/strict");
app.disableHardwareAcceleration();

function setup(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,msg,limit=4000)=>{const t=performance.now();while(!fn()){if(performance.now()-t>limit)throw Error(msg);await wait(40);}};
  const by=name=>document.querySelector('[aria-label="'+name+'"]');
  const panel=id=>document.querySelector('.live-deck[data-id='+id+']');
  const assign=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));};
  const load=async(id,video)=>{
    by("Deck "+id+" youtube source").click();await wait(40);
    const input=panel(id).querySelector("input[id^=youtube-url]");
    assign(input,"https://www.youtube.com/watch?v="+video);await wait(30);input.form.requestSubmit();
  };
  const file=async id=>{
    const n=8000*120,b=new ArrayBuffer(44+n*2),v=new DataView(b);
    const tag=(i,s)=>[...s].forEach((c,k)=>v.setUint8(i+k,c.charCodeAt(0)));
    tag(0,"RIFF");v.setUint32(4,b.byteLength-8,true);tag(8,"WAVE");tag(12,"fmt ");v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);
    v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,"data");v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++)v.setInt16(44+2*i,id==="A" && i>=8000*9 && i%8000>=320?0:12000*Math.sin(2*Math.PI*(id==="A"?850:220)*i/8000),true);
    const dt=new DataTransfer();dt.items.add(new File([b],id==="A"?"Hall and Echo - pulse check.wav":"Crossfade - steady tone.wav",{type:"audio/wav"}));
    const el=panel(id).querySelector("input[type=file]");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));
    await until(()=>panel(id).textContent.includes("-02:00"),"file load "+id);
  };
  // The recorder receives the same final bus as the speakers. Tap its real PCM stream.
  const listen=async()=>{
    let stream;
    const Native=window.MediaRecorder;
    window.MediaRecorder=class extends Native {constructor(input,options){super(input,options);stream=input;}};
    nav("Tools");await wait(60);by("Start recording").click();await until(()=>stream,"No recording stream");
    window.MediaRecorder=Native;
    const ctx=new AudioContext();await ctx.resume();
    const bus=ctx.createMediaStreamSource(stream),probe=ctx.createScriptProcessor(1024,1,1),samples=[];
    bus.connect(probe);probe.connect(ctx.destination);
    by("Stop recording").click();nav("Tools");
    probe.onaudioprocess=e=>samples.push(...e.inputBuffer.getChannelData(0));
    return async()=>{
      samples.length=0;await wait(2200);
      const rate=ctx.sampleRate;
      let peak=0,at=0;
      for(let i=Math.floor(rate*.1);i<Math.floor(rate*1.3);i++){if(Math.abs(samples[i])>peak){peak=Math.abs(samples[i]);at=i;}}
      const rms=(a,b)=>{const arr=samples.slice(at+Math.round(a*rate),at+Math.round(b*rate));return Math.sqrt(arr.reduce((s,v)=>s+v*v,0)/arr.length);};
      return {peak,hall:rms(.065,.15),echo:rms(.22,.29)};
    };
  };
  const fader=v=>assign(document.querySelector(".console-body .cross-strip input"),String(v));
  const play=async id=>{by("Play deck "+id).click();await until(()=>by("Pause deck "+id),"play "+id);};
  const nav=name=>[...document.querySelectorAll(".console-drawer>nav button")].find(el=>el.textContent===name).click();
  Object.assign(window,{mixTest:{by,wait,until,panel,load,file,listen,fader,play,nav}});
}

app.whenReady().then(async()=>{
  const server=express().use(express.static(path.resolve(__dirname,"../dist"))).listen(0,"127.0.0.1");
  await new Promise(r=>server.once("listening",r));
  const win=new BrowserWindow({width:1280,height:720,useContentSize:true,show:true,autoHideMenuBar:true,webPreferences:{partition:"source-mixer-test",backgroundThrottling:false}});
  const url="http://127.0.0.1:"+server.address().port;
  const run=js=>win.webContents.executeJavaScript("(async()=>{const {by,wait,until,panel,load,file,listen,fader,play,nav}=mixTest;"+js+"})()",true);
  const reset=async()=>{await win.loadURL(url);await win.webContents.executeJavaScript("("+setup.toString()+")()");};
  try{
    await reset();
    await run('await file("A");await file("B");await play("A");await play("B");window.measure=await listen();');
    const ends=await run('const results=[];for(const value of [0,50,100]){fader(value);await wait(150);let a=0,b=0;for(let i=0;i<60;i++){a=Math.max(a,by("Level A").value);b=Math.max(b,by("Level B").value);await wait(32);}results.push([a,b]);}return results');
    assert(ends[0][0]>1&&ends[0][1]<.05&&ends[1].every(v=>v>1)&&ends[2][0]<.05&&ends[2][1]>1,JSON.stringify(ends));
    const dry=await run('fader(0);by("Pause deck B").click();await wait(4200);return measure();');
    const hall=await run('by("Deck A Hall").dispatchEvent(new KeyboardEvent("keydown",{key:"End",bubbles:true}));await wait(500);return measure();');
    const both=await run('by("Echo deck A").click();await wait(600);return measure();');
    await run('await load("B","M7lc1UVf-VE");nav("Library");by("Performance mode").click();');
    win.setContentSize(390,844);
    const mobile=await run('await wait(250);by("Focus deck A").click();await wait(100);const h=by("Deck A Hall");if(!h.offsetWidth||h.disabled||by("Echo deck A").getAttribute("aria-pressed")!=="true")throw Error("Mobile FX unavailable");return measure();');
    win.setContentSize(1280,720);
    const after=await run('by("Exit performance mode").click();nav("Library");await wait(300);if(!by("Pause deck A")||by("Pause deck B"))throw Error("Loading B changed playback");return measure();');
    console.log("Local crossfade ends/center",ends,"Speaker output dry, hall, both, mobile, restored",{dry,hall,both,mobile,after});
    assert(hall.hall>dry.hall+.0001);
    for(const result of [both,mobile,after])assert(result.hall>dry.hall+.0001&&result.echo>hall.echo+.002,"Missing measured Hall or Echo: "+JSON.stringify(result));
    await run('await until(()=>panel("B").querySelector("iframe"),"No visible official iframe");');
    const shots=path.resolve(__dirname,"../screenshots");fs.mkdirSync(shots,{recursive:true});fs.writeFileSync(path.join(shots,"local-fx-youtube.png"),(await win.webContents.capturePage()).toPNG());
    // First try real provider playback, then exercise deterministic blocked and successful handoffs.
    async function handoffs(){
      await run('await load("A","aqz-KE-bpKQ");await until(()=>!by("Switch to A").disabled&&!by("Switch to B").disabled,"Players unavailable: "+panel("A").textContent.slice(-250),18000);');
      for(const id of ["A","B","A"]){
        await run('by("Switch to '+id+'").click();await until(()=>by("Pause deck '+id+'")&&!by("Pause deck '+(id==="A"?"B":"A")+'"),"Playback not confirmed: "+(panel("'+id+'").querySelector("[role=status]")?.textContent||"no PLAYING event"),7000);');
      }
    }
    try{await handoffs();console.log("LIVE: two official embeds switched both ways");}catch(e){console.log("LIVE provider unavailable:",e.message);}
    await reset();
    await run(`window.fetch=async()=>Response.json({title:"Switch fixture"});window.YT={PlayerState:{PLAYING:1,PAUSED:2,CUED:5,ENDED:0},Player:class{
      constructor(m,{events,videoId}){this.playVideo=()=>window.blockNext?(window.blockNext=false,events.onAutoplayBlocked()):events.onStateChange({data:1});
        this.pauseVideo=()=>events.onStateChange({data:2});setTimeout(events.onReady,0);}
      setVolume(){}getDuration(){return 90}getCurrentTime(){return 0}destroy(){}
    }};await load("B","M7lc1UVf-VE");`);
    await handoffs();
    await run('window.blockNext=true;by("Switch to B").click();await until(()=>panel("B").textContent.includes("Playback blocked"),"Blocked fallback");if(!by("Play deck B"))throw Error("Missing retry");by("Switch to A").click();await until(()=>by("Pause deck A"),"Resume previous");');
    console.log("Player-event handoffs A/B/A, blocked destination, immediate previous-deck recovery passed.");
    app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});
