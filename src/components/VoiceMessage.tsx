import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";

// Pseudo-waveform — stable bars derived from URL so it looks consistent per clip.
function bars(seed: string, count = 38) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(0.25 + ((h % 75) / 100));
  }
  return out;
}

export function VoiceMessage({ src, mine }: { src: string; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const wf = bars(src);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime / (a.duration || 1));
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-3 min-w-[220px] max-w-[300px] py-1.5 ${mine ? "" : ""}`}>
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${
          mine ? "bg-snap-foreground/20 text-snap-foreground" : "bg-snap text-snap-foreground"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-[1px]" />}
      </button>
      <div className="flex items-end gap-[2px] h-7 flex-1">
        {wf.map((h, i) => {
          const active = i / wf.length <= progress;
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${
                active
                  ? mine ? "bg-snap-foreground" : "bg-snap"
                  : mine ? "bg-snap-foreground/40" : "bg-muted-foreground/40"
              }`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>
      <div className="text-[11px] tabular-nums opacity-80 flex items-center gap-1 shrink-0">
        <Mic className="w-3 h-3" />
        {fmt(playing ? (audioRef.current?.currentTime ?? 0) : duration)}
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}