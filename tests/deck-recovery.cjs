// Run after npm run build with: electron tests/deck-recovery.cjs
const { app, BrowserWindow } = require("electron");
const express = require("express");
const path = require("node:path");

async function checkDeck() {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate, description) {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await sleep(40);
    }
    throw new Error(description);
  }
  const plays = [];
  window.YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, CUED: 5 },
    Player: class {
      constructor(mount, { videoId, events }) {
        this.playVideo = () => {
          plays.push(videoId);
          if (videoId === "aaaaaaaaaaa") events.onError({ data: 150 });
          else events.onStateChange({ data: 1 });
        };
        const frame = document.createElement("iframe");
        mount.replaceWith(frame);
        this.destroy = () => frame.remove();
        setTimeout(events.onReady, 0);
      }
      setVolume() {}
      getCurrentTime() { return 0; }
      getDuration() { return 60; }
    }
  };
  window.fetch = async () => Response.json({ title: "Recovery fixture" });
  document.querySelector('[aria-label="Deck A youtube source"]').click();
  await sleep(30);
  const input = document.querySelector("#youtube-url-A");
  const panel = input.closest("section");
  const play = panel.querySelector('[aria-label="Play deck A"]');
  function enter(id) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "https://youtu.be/" + id);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  enter("aaaaaaaaaaa");
  play.click();
  await until(() => panel.textContent.includes("YouTube (150)"), "Missing owner restriction");
  enter("bbbbbbbbbbb");
  play.click();
  await until(() => plays.includes("bbbbbbbbbbb"), "Replacement track did not receive Play");
  if (plays.join(",") !== "aaaaaaaaaaa,bbbbbbbbbbb") throw new Error("Unexpected playback of previous track");

  // A low-level 1 kHz tone makes filter attenuation and delay decay measurable.
  const wav = new ArrayBuffer(44 + 256000);
  const v = new DataView(wav);
  function tag(offset, name) {
    [...name].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  }
  tag(0, "RIFF"); v.setUint32(4, wav.byteLength - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, wav.byteLength - 44, true);
  for(let i=0;i<(wav.byteLength-44)/2;i++) v.setInt16(44+i*2,5000*Math.sin(i*Math.PI/4),true);
  const transfer = new DataTransfer();
  transfer.items.add(new File([wav], "party-test.wav", { type: "audio/wav" }));
  panel.querySelector('[aria-label="Deck A local source"]').click();await sleep(30);
  const picker = panel.querySelector('input[type="file"]');
  picker.files = transfer.files;
  picker.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => panel.textContent.includes("party-test.wav") && panel.textContent.includes("-00:16"), "WAV did not load");
  play.click();
  await until(() => panel.textContent.includes("00:01"), "Local audio did not advance");
  const key = (name, options={}, target=window, type="keydown") => target.dispatchEvent(new KeyboardEvent(type,{key:name,code:"Key"+name.toUpperCase(),bubbles:true,cancelable:true,...options}));
  const button = label => panel.querySelector('[aria-label="'+label+'"]');
  const active = label => button(label)?.getAttribute("aria-pressed")==="true";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const firstPad=panel.querySelector(".pad-row button");
  assert(firstPad.dataset.hint==="Tap to save this point.","Missing save cue instruction");
  firstPad.click(); await until(()=>firstPad.dataset.hint==="Tap to jump here.","Cue instruction did not update");
  assert(button("Pause deck A").dataset.hint==="Tap to pause.","Wrong playing instruction");
  key("x",{},panel.querySelector('input[type=range]'));
  assert(!active("Echo deck A"),"Typed shortcut changed FX");
  key("x"); await until(()=>active("Echo deck A"),"Echo shortcut");
  const level = () => document.querySelector('meter[aria-label="Level A"]').value;
  await until(()=>level()>1,"Audio did not reach channel meter");
  await sleep(500); key("x"); key("z");
  await until(()=>button("Play deck A"),"Pause failed");
  await sleep(130); assert(level()>0.08,"Echo tail cut at release");
  await until(()=>level()<0.04,"Echo feedback did not decay");
  key("z"); await until(()=>button("Pause deck A"),"Resume failed");
  const filter=button("Deck A Filter");
  for(let i=0;i<50;i++) { filter.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true})); await sleep(2); }
  await until(()=>filter.getAttribute("aria-valuenow")==="-100" && level()<0.2,"Low-pass did not attenuate the tone");
  filter.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));
  await until(()=>filter.getAttribute("aria-valuenow")==="0" && level()>1,"Filter reset did not restore dry audio");
  key("x"); await until(()=>active("Echo deck A"),"Echo failed after release");
  key("x",{repeat:true}); await sleep(20); assert(active("Echo deck A"),"Repeated key toggled echo");
  key("c"); await until(()=>active("Beat Roll deck A"),"Roll shortcut");
  const clock=panel.querySelector(".position strong").textContent;
  await until(()=>panel.querySelector(".position strong").textContent!==clock,"Slip transport stopped during roll");
  key("c",{},panel.querySelector('input[type=range]'),"keyup"); await until(()=>!active("Beat Roll deck A"),"Roll stuck after focus moved");
  button("Beat Roll deck A").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
  await until(()=>active("Beat Roll deck A"),"Roll pointer down");
  button("Beat Roll deck A").dispatchEvent(new PointerEvent("pointerout",{bubbles:true,relatedTarget:panel}));
  await until(()=>!active("Beat Roll deck A"),"Roll stuck on pointer exit");
  key("c"); await until(()=>active("Beat Roll deck A"),"Roll before blur");
  window.dispatchEvent(new Event("blur")); await until(()=>!active("Beat Roll deck A"),"Roll stuck after blur");
  key("z",{repeat:true}); await sleep(40); assert(button("Pause deck A"),"Repeated play key paused playback");
  const mode=[...panel.querySelectorAll(".pads button")].find(b=>b.textContent==="Loops");
  mode.click(); await sleep(30);
  const one=panel.querySelector(".pad-row button");
  one.click(); await until(()=>one.getAttribute("aria-pressed")==="true","Loop failed to engage");
  assert(one.dataset.hint==="Tap to exit loop.","Wrong active loop instruction");
  one.click(); await until(()=>one.getAttribute("aria-pressed")==="false","Loop failed to exit");
  const drawer = name=>[...document.querySelectorAll(".console-drawer>nav button")].find(b=>b.textContent===name);
  drawer("Library").click();
  await until(()=>drawer("Library").getAttribute("aria-expanded")==="true","Library failed to open");
  assert(button("Pause deck A") && button("Pause deck A").getBoundingClientRect().bottom < document.querySelector(".console-drawer").getBoundingClientRect().top,"Library interrupted or covered transport");
  drawer("Settings").click(); await sleep(40);
  const mapping = document.querySelector('[aria-label="Remap playA"]');
  key("q",{},mapping); await sleep(30); assert(mapping.value==="Z","Reserved Q was accepted");
  key("m",{},mapping); await sleep(30); assert(mapping.value==="Z","Duplicate M was accepted");
  key("v",{},mapping); await sleep(30); assert(mapping.value==="V","Remap failed");
  drawer("FX Navigator").click(); await sleep(30);
  const slot=document.querySelector(".settings-line select");
  slot.value="Reverb"; slot.dispatchEvent(new Event("change",{bubbles:true}));
  await until(()=>button("Reverb deck A"),"Tap slot reassignment failed");
  drawer("FX Navigator").click();
}

function viewportCheck(mobile) {
  const visible = el=>{const r=el.getBoundingClientRect();return r.width>0 && r.height>0 && r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth+1;};
  if(document.documentElement.scrollHeight>innerHeight+1 || document.documentElement.scrollWidth>innerWidth+1) throw new Error("Page overflow "+innerWidth+"x"+innerHeight);
  if(mobile) {
    if(!visible(document.querySelector(".mobile-cross")) || !visible(document.querySelector('[aria-label="Focus deck B"]'))) throw new Error("Mobile switch or crossfader missing");
  } else {
    for(const el of document.querySelectorAll(".console-body .scope,.console-body .transport,.console-body .quick-fx,.console-body .live-mixer,.console-body .pad-row")) {
      if(!visible(el) || el.getBoundingClientRect().bottom>document.querySelector(".console-drawer").getBoundingClientRect().top) throw new Error("Inaccessible control "+el.className);
    }
  }
}

app.whenReady().then(async () => {
  const server = express().use(express.static(path.resolve(__dirname, "../dist"))).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const win = new BrowserWindow({ show: false, useContentSize:true, width:1366,height:768, webPreferences: { partition: "deck-recovery-test", backgroundThrottling: false } });
  if(process.env.CLUBDECK_LIVE_PREVIEW==="1"){
    try {
      await win.loadURL("http://127.0.0.1:"+server.address().port);
      const result=await win.webContents.executeJavaScript(`(async()=>{
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const click=(selector,name)=>[...document.querySelectorAll(selector)].find(b=>b.textContent===name).click();
        click(".console-drawer>nav button","Library");await sleep(80);
        click(".library-view nav button","YouTube");await sleep(80);
        const input=document.querySelector("#preview-link");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"https://www.youtube.com/watch?v=M7lc1UVf-VE");
        input.dispatchEvent(new Event("input",{bubbles:true}));await sleep(60);input.form.requestSubmit();
        for(let i=0;i<120;i++){
          await sleep(250);
          const error=document.querySelector(".preview-layout [role=status]")?.textContent;
          if(error)return {error};
          const iframe=document.querySelector(".preview-player iframe");
          const p=iframe && window.YT?.get?.(iframe.id);
          if(p?.getPlayerState?.()===1){
            click(".console-drawer>nav button","Library");await sleep(600);
            return {playing:true,paused:p.getPlayerState()===2};
          }
        }
        return {error:"No confirmed playback within 30 seconds",iframe:!!document.querySelector(".preview-player iframe")};
      })()`,true);
      console.log(result);app.exit(result.playing && result.paused?0:1);
    } catch(error){console.error(error);app.exit(1);}
    return;
  }
  win.webContents.session.webRequest.onBeforeRequest({ urls: ["https://*/*"] }, (_, done) => done({ cancel: true }));
  try {
    await win.loadURL("http://127.0.0.1:" + server.address().port);
    for(const [width,height] of [[1366,768],[1280,720]]) {
      win.setContentSize(width,height);
      await new Promise(resolve=>setTimeout(resolve,200));
      await win.webContents.executeJavaScript("("+viewportCheck.toString()+")(false)");
      if(width===1280 && process.env.CLUBDECK_SCREENSHOT) require("node:fs").writeFileSync(path.join(app.getPath("temp"),"clubdeck-mixer-layout.png"),(await win.webContents.capturePage()).toPNG());
    }
    await win.webContents.executeJavaScript("(" + checkDeck.toString() + ")()", true);
    win.setContentSize(390,844);
    await new Promise(resolve=>setTimeout(resolve,100));
    await win.webContents.executeJavaScript("("+viewportCheck.toString()+")(true)");
    await win.webContents.executeJavaScript(`(async()=>{
      document.querySelector('[aria-label="Focus deck B"]').click();
      await new Promise(r=>setTimeout(r,80));
      const a=document.querySelector('.live-deck[data-id=A]'), b=document.querySelector('.live-deck[data-id=B]');
      if(a.offsetWidth || !b.offsetWidth || !a.querySelector('[aria-label="Pause deck A"]')) throw Error("Mobile deck switch interrupted A");
      if(document.querySelector('[aria-label="Focus deck B"]').getAttribute("aria-pressed")!=="true") throw Error("Missing focus indicator");
      const time=a.querySelector(".position strong").textContent;
      await new Promise(r=>setTimeout(r,1300));
      if(time===a.querySelector(".position strong").textContent) throw Error("Hidden deck stopped advancing");
    })()`);
    await win.loadURL("http://127.0.0.1:" + server.address().port);
    await win.webContents.executeJavaScript(`if(!document.querySelector('[aria-label="Reverb deck A"]') || document.querySelector('[aria-label="Remap playA"]').value!=="V") throw Error("Preferences did not survive reload");`);
    win.setContentSize(1280,720);
    await require("./two-deck-fx.cjs")(win);
    await win.loadURL("http://127.0.0.1:" + server.address().port);
    await win.webContents.executeJavaScript(`if(!document.querySelector('[aria-label="Pin DJ International to deck A pad 2"][aria-pressed=true]')) throw Error("Pin lost on reload");`);
    console.log("Passed desktop and mobile layouts, live deck switching, library playback, file and link recovery, shortcut conflicts and hold release.");
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
