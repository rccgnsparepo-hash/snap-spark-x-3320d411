// Local screen-time tracking for the "Time management" setting.
const KEY = "flick:usage";

type UsageMap = Record<string, number>; // yyyy-mm-dd -> seconds

const today = () => new Date().toISOString().slice(0, 10);

export function readUsage(): UsageMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as UsageMap;
  } catch {
    return {};
  }
}

function writeUsage(u: UsageMap) {
  // keep the last 30 days only
  const keys = Object.keys(u).sort().slice(-30);
  const trimmed: UsageMap = {};
  keys.forEach((k) => (trimmed[k] = u[k]));
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
}

export function addUsage(seconds: number) {
  const u = readUsage();
  u[today()] = Math.round((u[today()] ?? 0) + seconds);
  writeUsage(u);
}

export function todaySeconds() {
  return readUsage()[today()] ?? 0;
}

export function weekAverageSeconds() {
  const u = readUsage();
  const days = Object.keys(u).sort().slice(-7);
  if (!days.length) return 0;
  return Math.round(days.reduce((s, d) => s + u[d], 0) / days.length);
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Counts time while the tab is visible. Returns a cleanup function. */
export function startUsageTracking() {
  let last = Date.now();
  const tick = () => {
    const now = Date.now();
    if (document.visibilityState === "visible") addUsage((now - last) / 1000);
    last = now;
  };
  const id = window.setInterval(tick, 15000);
  const onVis = () => {
    tick();
    last = Date.now();
  };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("beforeunload", tick);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("beforeunload", tick);
  };
}
