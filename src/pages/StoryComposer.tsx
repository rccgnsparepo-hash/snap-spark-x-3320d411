import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { UploadProgress, type UploadStage } from "@/components/UploadProgress";

export default function StoryComposerPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"photos" | "video">("photos");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<UploadStage[]>([]);

  const submit = async () => {
    if (!user || files.length === 0) return;
    setBusy(true);
    const initial: UploadStage[] = files.map((f) => ({ label: `Uploading ${f.name}`, progress: 4, status: "active" }));
    setStages(initial);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name} is over 50MB`); continue; }
        const ext = f.name.split(".").pop();
        const path = `${user.id}/story-${crypto.randomUUID()}.${ext}`;
        const tick = setInterval(() => {
          setStages((s) => s.map((x, idx) => idx === i && x.progress < 88 ? { ...x, progress: x.progress + 6 } : x));
        }, 250);
        const { error: upErr } = await supabase.storage.from("media").upload(path, f, { contentType: f.type });
        clearInterval(tick);
        if (upErr) throw upErr;
        setStages((s) => s.map((x, idx) => idx === i ? { ...x, progress: 95, label: `Publishing ${f.name}` } : x));
        const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        const isVideo = f.type.startsWith("video/");
        const { error } = await supabase.from("stories").insert({ author_id: user.id, image_url: url, media_type: isVideo ? "video" : "image" });
        if (error) throw error;
        setStages((s) => s.map((x, idx) => idx === i ? { ...x, progress: 100, status: "done", label: `Posted ${f.name}` } : x));
      }
      notify({ kind: "story", message: `${files.length} new ${files.length === 1 ? "story" : "stories"}`, actor: { id: user.id } });
      setTimeout(() => { setStages([]); nav("/"); }, 900);
    } catch (e) {
      setStages((s) => s.map((x) => x.status === "active" ? { ...x, status: "error", detail: "failed" } : x));
      toast.error((e as Error).message);
      setTimeout(() => setStages([]), 4000);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen p-4">
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => nav("/")} className="p-2"><X /></button>
        <h1 className="font-display text-xl">New story</h1>
        <button onClick={submit} disabled={busy || files.length === 0} className="px-4 py-1.5 rounded-full bg-snap text-snap-foreground font-bold disabled:opacity-50">{busy ? "..." : "Post"}</button>
      </header>
      <div className="flex gap-2 mb-4">
        {(["photos","video"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setFiles([]); }} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${tab === t ? "bg-snap text-snap-foreground" : "bg-secondary"}`}>{t === "photos" ? "Bulk Photos" : "Video"}</button>
        ))}
      </div>
      <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-snap">
        {tab === "video" ? <Video className="mx-auto w-8 h-8 mb-2 text-snap" /> : <Upload className="mx-auto w-8 h-8 mb-2 text-snap" />}
        <p className="text-sm text-muted-foreground">{tab === "photos" ? "Tap to select multiple photos" : "Tap to select a video (≤50MB)"}</p>
        <input type="file" hidden multiple={tab === "photos"} accept={tab === "photos" ? "image/*" : "video/*"} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden bg-secondary grid place-items-center text-xs">
              {f.type.startsWith("image/") ? <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /> : <span className="p-2 break-all">{f.name}</span>}
            </div>
          ))}
        </div>
      )}
      <UploadProgress stages={stages} onDismiss={() => setStages([])} />
    </div>
  );
}
