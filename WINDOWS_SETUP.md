# Flick for Windows Desktop (.exe)

This project includes support for building native Windows desktop executables (`.exe` NSIS installer and portable executable) with native Windows Action Center Toast push notifications.

---

## 🚀 Building on GitHub Actions (Automated Workflow)

A GitHub Actions workflow is preconfigured in `.github/workflows/windows-build.yml`.

### How to run the build:
1. Push your code to the `main` or `master` branch, OR
2. Go to your repository on GitHub -> **Actions** tab -> select **Windows EXE Build** -> click **Run workflow**.
3. When the build completes (~2-3 minutes on GitHub's `windows-latest` runner), download the **`Flick-Windows-Installer`** artifact.
4. The downloaded zip will contain:
   - `Flick-Setup-1.0.0.exe` (NSIS Installer with desktop and start menu shortcuts)
   - `Flick 1.0.0.exe` (Portable executable)

---

## 🔔 Push Notifications on Windows

Windows desktop notifications are configured to integrate directly with the **Windows Action Center / Toast system**:

1. **Windows AppUserModelID**:
   - `app.setAppUserModelId("com.faratech.faraflick")` is registered upon startup.
   - This ensures Windows 10 & Windows 11 recognize the app and show banner toasts in the bottom-right corner and Action Center history.

2. **Native Notification Bridge**:
   - Direct Messages, flick mentions, stories, and reactions trigger native Windows Toast notifications.
   - When clicked, Windows automatically restores and focuses the Flick window and routes directly to the specific DM conversation or post.

3. **Taskbar Frame Flash**:
   - When a new message arrives and the app is in the background or minimized, the Windows taskbar icon pulses/flashes to alert the user.

4. **Permissions**:
   - Notification and camera/microphone permissions are automatically approved in desktop mode so users never encounter permission pop-up blocks.

---

## 💻 Local Windows Development & Packaging

If you are on a Windows machine:

```bash
# 1. Install dependencies
npm install

# 2. Build the web app
npm run build

# 3. Test the desktop app locally
npm run electron:start

# 4. Generate the Windows installer (.exe)
npm run build:win
```

The resulting `.exe` files will be in the `release/` directory.
