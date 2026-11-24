// Run in Electron against the production build. Each run uses fresh browser storage.
const {app,BrowserWindow}=require("electron");
const express=require("express");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const server=express().use(express.static(path.resolve(__dirname,"../dist"))).listen(0,"127.0.0.1");
  await new Promise(done=>server.once("listening",done));
  const w=new BrowserWindow({width:1280,height:720,useContentSize:true,show:true,autoHideMenuBar:true,webPreferences:{partition:"hint-review",backgroundThrottling:false}});
  const run=js=>w.webContents.executeJavaScript(js,true);
  const wait=ms=>new Promise(done=>setTimeout(done,ms));
  const output=path.resolve(__dirname,"../screenshots");
  fs.mkdirSync(output,{recursive:true});
  const capture=async name=>{
    await wait(350);
    const image=await w.webContents.capturePage();
    assert(!image.isEmpty());
    fs.writeFileSync(path.join(output,name+".png"),image.toPNG());
    console.log(name,image.getSize());
  };
  try {
    await w.loadURL("http://127.0.0.1:"+server.address().port);
    await wait(400);
    if(process.env.CLUBDECK_BEFORE==="1"){await capture("desktop-before");app.exit(0);return;}
    assert(await run('document.querySelector("[aria-label=\\"Show hints\\"]").getAttribute("aria-checked")==="true"'));
    await capture("desktop-after");
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('.studio button,.studio a[href],.studio input[type=range]')).filter(el=>!el.closest('[data-hint]')).map(el=>el.outerHTML.slice(0,160))`),[]);
    assert(await run(`Array.from(document.querySelectorAll('.live-deck .wave-caption,.live-deck .media-strip,.live-mixer .cross-strip')).every(el=>el.getBoundingClientRect().bottom<=document.querySelector(".console-drawer").getBoundingClientRect().top)`));
    assert(await run(`getComputedStyle(document.querySelector('.hint-switch'),'::after').display==='block'`));
    await run("document.querySelector('.hint-switch').click()"); await wait(250);
    await w.loadURL(w.webContents.getURL()); await wait(250);
    assert(await run("document.querySelector('.hint-switch').getAttribute('aria-checked')==='false' && getComputedStyle(document.querySelector('.hint-switch'),'::after').content==='none'"));
    await run("document.querySelector('.hint-switch').click()"); await wait(100);
    w.setContentSize(390,844);await wait(250);
    await capture("mobile-hints");
    assert(await run(`document.documentElement.scrollWidth===innerWidth && document.querySelector('.deck-slot[data-mobile=false]').offsetWidth===0 && getComputedStyle(document.querySelector('.hint-switch'),'::after').display==='block'`));
    app.exit(0);
  } catch(e){console.error(e);app.exit(1);}
});
