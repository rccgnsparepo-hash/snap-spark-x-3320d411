// App-wide, instantly-applied local preferences (settings screen).
import { useEffect, useState } from "react";

export type AppPrefs = {
  /** iOS-style in-app news banners */
  newsPopups: boolean;
  /** Interval between banners, seconds */
  newsIntervalSec: number;
  /** Also fire a system notification when the app is in the background */
  newsExternal: boolean;
  /** Private account */
  privateAccount: boolean;
  /** Ids marked as close friends */
  closeFriends: string[];
  /** Story authors hidden from your stories bar */
  hiddenStoryUsers: string[];
  /** Who may DM you */
  dmFrom: "everyone" | "closeFriends" | "nobody";
  /** Allow tags & mentions notifications */
  allowTags: boolean;
  /** Open the share sheet automatically after posting */
  autoShareOnPost: boolean;
  /** Daily time limit in minutes (0 = off) */
  dailyLimitMin: number;
};

export const DEFAULT_APP_PREFS: AppPrefs = {
  newsPopups: true,
  newsIntervalSec: 29,
  newsExternal: true,
  privateAccount: false,
  closeFriends: [],
  hiddenStoryUsers: [],
  dmFrom: "everyone",
  allowTags: true,
  autoShareOnPost: false,
  dailyLimitMin: 0,
};

const KEY = "flick:app-prefs";
const EVT = "flick:app-prefs-changed";

export function readAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_APP_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) } : DEFAULT_APP_PREFS;
  } catch {
    return DEFAULT_APP_PREFS;
  }
}

export function writeAppPrefs(p: AppPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useAppPrefs() {
  const [prefs, setPrefs] = useState<AppPrefs>(readAppPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readAppPrefs());
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const update = (patch: Partial<AppPrefs>) => {
    const next = { ...readAppPrefs(), ...patch };
    writeAppPrefs(next);
    setPrefs(next);
  };
  return { prefs, update };
}
