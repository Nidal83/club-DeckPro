const {BrowserWindow,WebContentsView,ipcMain,session}=require("electron");

function installWatchPage(isMixer){
  const isolated=session.fromPartition("clubdeck-youtube-watch");
  isolated.setPermissionRequestHandler((_wc,_permission,reply)=>reply(false));
  isolated.setPermissionCheckHandler(()=>false);
  isolated.on("will-download",event=>event.preventDefault());
  const panels=new Map();
  const close=win=>{
    const view=panels.get(win);
    if(!view)return;
    panels.delete(win);
    if(!win.isDestroyed())win.contentView.removeChildView(view);
    if(!view.webContents.isDestroyed())view.webContents.close();
  };
  function place(win,view,rect){
    if(!rect||!["x","y","width","height"].every(k=>Number.isFinite(rect[k])))return false;
    const [w,h]=win.getContentSize(),z=win.webContents.getZoomFactor();
    const x=Math.max(0,Math.min(w,Math.round(rect.x*z))),y=Math.max(0,Math.min(h,Math.round(rect.y*z)));
    view.setBounds({x,y,width:Math.max(0,Math.min(w-x,Math.round(rect.width*z))),height:Math.max(0,Math.min(h-y,Math.round(rect.height*z)))});
    return true;
  }
  const owner=e=>isMixer(e)&&e.senderFrame===e.sender.mainFrame?BrowserWindow.fromWebContents(e.sender):null;
  ipcMain.handle("watch:open",async(e,id,rect)=>{
    const win=owner(e);
    if(!win||typeof id!=="string"||!/^[-\w]{11}$/.test(id))return false;
    close(win);
    const view=new WebContentsView({webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true}});
    panels.set(win,view);
    view.webContents.setWindowOpenHandler(()=>({action:"deny"}));
    const restrict=(event,url)=>{
      try{const u=new URL(url);if(u.protocol==="https:"&&["www.youtube.com","m.youtube.com","consent.youtube.com"].includes(u.hostname))return;}catch{/* deny invalid URLs */}
      event.preventDefault();
    };
    view.webContents.on("will-navigate",restrict);
    view.webContents.on("will-redirect",(event,url,_inPlace,main)=>{if(main)restrict(event,url);});
    if(!place(win,view,rect)){close(win);return false;}
    win.contentView.addChildView(view);
    const cleanup=()=>{if(panels.get(win)===view)close(win);};
    const onNavigate=(_event,_url,inPlace,main)=>{if(main&&!inPlace)cleanup();};
    win.once("closed",cleanup);
    e.sender.on("did-start-navigation",onNavigate);
    view.webContents.once("destroyed",()=>{win.removeListener("closed",cleanup);e.sender.removeListener("did-start-navigation",onNavigate);});
    try{await view.webContents.loadURL("https://www.youtube.com/watch?v="+id);return true;}
    catch{cleanup();return false;}
  });
  ipcMain.on("watch:bounds",(e,rect)=>{const w=owner(e);if(panels.has(w))place(w,panels.get(w),rect);});
  ipcMain.on("watch:close",e=>{const w=owner(e);if(w)close(w);});
  return isolated;
}
module.exports={installWatchPage};
