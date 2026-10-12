const { app, BrowserWindow, ipcMain, Notification, protocol, net, shell } = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");

const APP_ID = "com.faratech.faraflick";

// Set Application User Model ID for Windows 10/11 Action Center & Toast Notifications
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

// Register custom scheme privilege before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
    },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 420,
    minHeight: 600,
    title: "Flick",
    icon: path.join(__dirname, "../public/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Handle external link clicks securely
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith("http:") || targetUrl.startsWith("https:")) {
      shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  // Load production build using custom app:// scheme or dev server
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadURL("app://localhost/index.html");
  }
}

app.whenReady().then(() => {
  // Protocol handler for app:// to serve local files correctly with SPA routing fallback
  const distDir = path.join(__dirname, "../dist");

  protocol.handle("app", (request) => {
    const parsed = new URL(request.url);
    let filePath = path.normalize(path.join(distDir, parsed.pathname));

    // Security check: ensure path stays inside dist directory
    if (!filePath.startsWith(distDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }

    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handler: Native Windows Toast Notifications via Notification API
ipcMain.on("show-notification", (_event, payload) => {
  try {
    const { title, body, url: targetUrl } = payload || {};
    if (!Notification.isSupported()) return;

    const notif = new Notification({
      title: title || "Flick Notification",
      body: body || "",
      icon: path.join(__dirname, "../public/icon-512.png"),
      silent: false,
    });

    notif.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        if (targetUrl) {
          mainWindow.webContents.send("navigate-to", targetUrl);
        }
      }
    });

    notif.show();
  } catch (err) {
    console.error("[Electron] Failed to display Windows notification:", err);
  }
});

// IPC Handler: Flash taskbar icon on Windows
ipcMain.on("flash-frame", () => {
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
});
