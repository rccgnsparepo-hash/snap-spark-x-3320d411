import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.faratech.faraflick",
  appName: "flick",
  webDir: "dist",
  server: {
    // Hot reload from the Lovable sandbox preview for `npx cap run` builds.
    url: "https://600ed84d-2abb-4a80-b188-e89fabece62d.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    LocalNotifications: { smallIcon: "ic_stat_icon_config_sample", iconColor: "#C5E863" },
  },
};

export default config;