const {app}=require("electron");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),assert=require("node:assert/strict");
app.setPath("userData",fs.mkdtempSync(path.join(os.tmpdir(),"clubdeck-watch-check-")));
app.setAppPath(path.resolve(__dirname,".."));
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const until=async(check,message,limit=18000)=>{const end=Date.now()+limit;while(!await check()){if(Date.now()>end)throw Error(message);await wait(100);}};
app.once("browser-window-created",(_e,w)=>{
  w.webContents.once("did-finish-load",async()=>{
    try{
      w.setContentSize(1280,720);
      const run=js=>w.webContents.executeJavaScript(js,true);
      await until(()=>run('!!document.querySelector(".studio[data-classic=true]")'),"Classic was not the default");
      await wait(400);
      const sizes=await run('Array.from(document.querySelectorAll(".media-strip button")).map(el=>el.offsetWidth)');
      assert(sizes.every(size=>size>=98),"Classic platters too small: "+sizes);
      fs.writeFileSync(path.resolve("screenshots/classic-mixer.png"),(await w.webContents.capturePage()).toPNG());
      await run(`const dt=new DataTransfer();dt.setData("text/plain","youtu.be/M7lc1UVf-VE");document.querySelector(".live-deck[data-id=B]").dispatchEvent(new ClipboardEvent("paste",{bubbles:true,clipboardData:dt}));`);
      await until(()=>run('!!document.querySelector("#youtube-deck-B iframe")'),"Paste did not cue a video on B");
      const webButton='[...document.querySelectorAll(".local-fx-notice button")].find(b=>b.textContent==="Watch inside mixer")';
      await run(webButton+'.click()');
      await until(()=>w.contentView.children.length>0,"No in-window YouTube page");
      const view=w.contentView.children.at(-1);
      await until(()=>view.webContents.getURL().startsWith("https://www.youtube.com/watch?"),"Official watch URL did not open");
      await until(()=>view.webContents.executeJavaScript('!!document.querySelector("video")'),"YouTube did not display its video on the watch page",30000);
      await view.webContents.executeJavaScript('const v=document.querySelector("video");if(v.paused)document.querySelector(".ytp-play-button")?.click()',true);
      await until(()=>view.webContents.executeJavaScript('Array.from(document.querySelectorAll("video")).some(v=>!v.paused && v.currentTime>0.5)'),"Playback on the watch page was not confirmed",20000);
      const before=view.getBounds();w.setContentSize(1040,740);await wait(400);
      assert(view.getBounds().x<before.x,"Watch view did not track window bounds");
      const remote=view.webContents;
      await run(`document.querySelector('[aria-label="Close watch page"]').click()`);
      await until(()=>remote.isDestroyed(),"Watch view continued after closing");
      await run('[...document.querySelectorAll(".layout-switch button")].find(b=>b.textContent==="Compact").click()');
      await wait(200);w.webContents.reload();await until(()=>run('!!document.querySelector(".studio[data-classic=false]")'),"Layout preference not restored");
      console.log("Passed: classic platters",sizes,"paste-to-cue, official in-window watch playback, resize, close, saved layout.");app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
  });
});
require("../electron/main.cjs");
