import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function Composer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || (!text.trim() && !file)) return;
    setBusy(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file);
        if (upErr) throw upErr;
        image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({
        author_id: user.id, content: text.trim() || "", image_url,
      });
      if (error) throw error;
      setText(""); setFile(null); setPreview(null);
      onPosted();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="border-b border-border p-4 flex gap-3">
      <div className="w-11 h-11 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold shrink-0">
        {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1">
        <textarea
          value={text} onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder="What's flickering?"
          className="w-full bg-transparent text-xl placeholder:text-muted-foreground resize-none focus:outline-none min-h-[60px]"
        />
        {preview && (
          <div className="relative inline-block">
            <img src={preview} alt="" className="rounded-2xl max-h-72 border border-border" />
            <button onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 bg-black/60 backdrop-blur p-1.5 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => inputRef.current?.click()} className="p-2 rounded-full hover:bg-secondary text-primary">
            <ImagePlus className="w-5 h-5" />
          </button>
          <input ref={inputRef} type="file" accept="image/*" hidden
            onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{280 - text.length}</span>
            <button disabled={busy || (!text.trim() && !file)} onClick={submit}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-50 transition hover:brightness-110">
              Flick
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
