const path = require("node:path");
const express = require("express");
const { app, BrowserWindow, Menu, shell, ipcMain, screen } = require("electron");
const fs = require("node:fs");

const isDev = !app.isPackaged;
const appRoot = app.getAppPath();
const distPath = path.join(appRoot, "dist");

let staticServer;
let appUrl;

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const serverApp = express();

    serverApp.disable("x-powered-by");
    serverApp.use(express.static(distPath, { maxAge: isDev ? 0 : "1y" }));

    serverApp.use((_request, response) => {
      response.sendFile(path.join(distPath, "index.html"));
    });

    staticServer = serverApp.listen(0, "127.0.0.1", () => {
      const address = staticServer.address();
      if (typeof address === "object" && address?.port) {
        appUrl = `http://127.0.0.1:${address.port}`;
        resolve(appUrl);
        return;
      }

      reject(new Error("Unable to start Nidal-ClubDeck-pro local server."));
    });

    staticServer.on("error", reject);
  });
}

function createWindow(route = "/") {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workAreaSize;
  const window = new BrowserWindow({
    width: Math.min(area.width, route === "/visualizer" ? 1440 : 1560),
    height: Math.min(area.height, route === "/visualizer" ? 900 : 980),
    minWidth: 380,
    minHeight: 540,
    backgroundColor: "#050608",
    title: route === "/visualizer" ? "Nidal-ClubDeck-pro Visualizer" : "Nidal-ClubDeck-pro",
    webPreferences: {
      preload: path.join(__dirname, "preferences.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadURL(`${appUrl}${route}`);
  return window;
}

function createMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Nidal-ClubDeck-pro",
      submenu: [
        {
          label: "Open Mixer",
          accelerator: "CmdOrCtrl+1",
          click: () => createWindow("/")
        },
        {
          label: "Open Projector Visualizer",
          accelerator: "CmdOrCtrl+2",
          click: () => createWindow("/visualizer")
        },
        { type: "separator" },
        { role: "reload" },
        { role: "togglefullscreen" },
        { type: "separator" },
        { role: "quit" }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await startStaticServer();
  const prefs = path.join(app.getPath("userData"), "performance-controls.json");
  const isMixer = event => event.senderFrame?.url === appUrl + "/";
  ipcMain.on("performance-prefs:read", event => {
    try { event.returnValue = isMixer(event) ? fs.readFileSync(prefs, "utf8") : null; }
    catch { event.returnValue = null; }
  });
  ipcMain.on("performance-prefs:write", (event, value) => {
    if (isMixer(event) && typeof value === "string" && value.length < 8000) {
      try { fs.writeFileSync(prefs + ".tmp", value); fs.renameSync(prefs + ".tmp", prefs); }
      catch (error) { console.warn("Could not save performance controls", error.message); }
    }
  });
  createMenu();
  createWindow("/");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow("/");
    }
  });
});

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appUrl)) {
      const parsed = new URL(url);
      createWindow(parsed.pathname === "/visualizer" ? "/visualizer" : "/");
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  staticServer?.close();
});
