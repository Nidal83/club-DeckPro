const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("performancePrefs", {
  read: () => ipcRenderer.sendSync("performance-prefs:read"),
  write: value => ipcRenderer.send("performance-prefs:write", value)
});
