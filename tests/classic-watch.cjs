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
      assert.equal(w.contentView.children.length,0,"Deck opened a separate watch view");
      assert(await run('!!document.querySelector(".console-body .cross-strip input")'),"Embedded source has no fader");
      await run('[...document.querySelectorAll(".layout-switch button")].find(b=>b.textContent==="Compact").click()');
      await wait(200);w.webContents.reload();await until(()=>run('!!document.querySelector(".studio[data-classic=false]")'),"Layout preference not restored");
      console.log("Passed: classic platters",sizes,"paste-to-cue, embedded deck, crossfader, saved layout.");app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
  });
});
require("../electron/main.cjs");
