import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function CameraPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { toast.error("Camera permission denied"); }
    })();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);
  const capture = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
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
      const { error } = await supabase.from("stories").insert({ author_id: user.id, image_url: url, media_type: "image" });
      if (error) throw error;
      toast.success("Story posted");
      nav("/");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="relative bg-black min-h-screen">
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
        <button onClick={() => nav("/")} className="text-white p-2 bg-black/40 backdrop-blur rounded-full"><X /></button>
        <button onClick={() => setFacing(facing === "user" ? "environment" : "user")} className="text-white p-2 bg-black/40 backdrop-blur rounded-full"><RefreshCw /></button>
      </header>
      <div className="relative aspect-[9/16] max-h-[90vh] mx-auto overflow-hidden bg-black">
        {snapshot ? <img src={snapshot} alt="" className="w-full h-full object-cover" />
          : <video ref={videoRef} autoPlay playsInline muted style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} className="w-full h-full object-cover" />}
        <canvas ref={canvasRef} hidden />
      </div>
      {!snapshot ? (
        <div className="absolute bottom-8 inset-x-0 flex justify-center">
          <button onClick={capture} className="w-20 h-20 rounded-full bg-white border-4 border-snap grid place-items-center"><CameraIcon className="w-8 h-8 text-black" /></button>
        </div>
      ) : (
        <div className="absolute bottom-8 inset-x-0 flex justify-center gap-4">
          <button onClick={() => setSnapshot(null)} className="px-6 py-3 rounded-full bg-black/60 text-white font-semibold">Retake</button>
          <button onClick={post} disabled={busy} className="px-6 py-3 rounded-full bg-snap text-snap-foreground font-bold flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" /> {busy ? "Posting…" : "Send"}</button>
        </div>
      )}
    </div>
  );
}
