const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("youtubeWatch",{
  open:(id,rect)=>ipcRenderer.invoke("watch:open",id,rect),
  bounds:rect=>ipcRenderer.send("watch:bounds",rect),
  close:()=>ipcRenderer.send("watch:close")
});
contextBridge.exposeInMainWorld("performancePrefs", {
  read: () => ipcRenderer.sendSync("performance-prefs:read"),
  write: value => ipcRenderer.send("performance-prefs:write", value)
});
