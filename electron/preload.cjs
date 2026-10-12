const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  showNotification: (payload) => {
    ipcRenderer.send("show-notification", payload);
  },
  flashFrame: () => {
    ipcRenderer.send("flash-frame");
  },
  onNavigate: (callback) => {
    ipcRenderer.on("navigate-to", (_event, url) => {
      callback(url);
    });
  },
});

// Forward navigate-to events directly to window custom event for React Router
ipcRenderer.on("navigate-to", (_event, targetUrl) => {
  window.dispatchEvent(
    new CustomEvent("flick:push-navigate", {
      detail: { url: targetUrl },
    })
  );
});
