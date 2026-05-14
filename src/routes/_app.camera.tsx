import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/camera")({
  head: () => ({ meta: [{ title: "Camera — Flick" }] }),
  component: CameraPage,
});

const FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "sun", label: "Sun", css: "saturate(1.4) contrast(1.1) brightness(1.05) hue-rotate(-10deg)" },
  { id: "vhs", label: "VHS", css: "saturate(1.6) contrast(1.2) hue-rotate(310deg) blur(0.4px)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.3)" },
  { id: "dream", label: "Dream", css: "blur(1px) saturate(1.4) brightness(1.1)" },
  { id: "neon", label: "Neon", css: "saturate(2) hue-rotate(80deg) contrast(1.2)" },
  { id: "warm", label: "Warm", css: "sepia(0.4) saturate(1.3)" },
] as const;

function CameraPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing }, audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) { toast.error("Camera permission denied"); }
    };
    start();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const capture = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.filter = filter.css;
    if (facing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setSnapshot(c.toDataURL("image/jpeg", 0.9));
  };

  const post = async () => {
    if (!snapshot || !user) return;
    setBusy(true);
    try {
      const blob = await (await fetch(snapshot)).blob();
      const path = `${user.id}/story-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("stories").insert({ author_id: user.id, image_url: url, caption: caption || null });
      if (error) throw error;
      toast.success("Story posted — disappears in 24h");
      nav({ to: "/" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative bg-black min-h-screen">
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
        <button onClick={() => nav({ to: "/" })} className="text-white p-2 bg-black/40 backdrop-blur rounded-full">
          <X />
        </button>
        <button onClick={() => setFacing(facing === "user" ? "environment" : "user")} className="text-white p-2 bg-black/40 backdrop-blur rounded-full">
          <RefreshCw />
        </button>
      </header>

      <div className="relative aspect-[9/16] max-h-[90vh] mx-auto overflow-hidden bg-black">
        {snapshot ? (
          <img src={snapshot} alt="" className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            style={{ filter: filter.css, transform: facing === "user" ? "scaleX(-1)" : undefined }}
            className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} hidden />

        {snapshot && (
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} placeholder="Add a caption…"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[80%] bg-black/60 backdrop-blur text-white text-center text-lg py-2 rounded-full focus:outline-none placeholder:text-white/60" />
        )}
      </div>

      {!snapshot ? (
        <>
          <div className="absolute bottom-28 inset-x-0 flex gap-2 overflow-x-auto px-4 no-scrollbar">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition ${
                  filter.id === f.id ? "bg-snap text-snap-foreground border-snap" : "bg-black/50 text-white border-white/20"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <button onClick={capture}
              className="w-20 h-20 rounded-full bg-white border-4 border-snap grid place-items-center"
              style={{ boxShadow: "var(--shadow-snap)" }}>
              <CameraIcon className="w-8 h-8 text-black" />
            </button>
          </div>
        </>
      ) : (
        <div className="absolute bottom-8 inset-x-0 flex justify-center gap-4">
          <button onClick={() => { setSnapshot(null); setCaption(""); }}
            className="px-6 py-3 rounded-full bg-black/60 backdrop-blur text-white font-semibold">Retake</button>
          <button onClick={post} disabled={busy}
            className="px-6 py-3 rounded-full bg-snap text-snap-foreground font-bold flex items-center gap-2 disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-snap)" }}>
            <Send className="w-4 h-4" /> {busy ? "Posting…" : "Send to story"}
          </button>
        </div>
      )}
    </div>
  );
}
