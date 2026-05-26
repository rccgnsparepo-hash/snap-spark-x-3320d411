import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Timer, Paperclip, Mic, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { VoiceMessage } from "@/components/VoiceMessage";
import { notify } from "@/lib/notify";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string | null; media_url: string | null; media_type: string | null; created_at: string; expires_at: string; read_at: string | null };
type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export default function ThreadPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user || !userId) return;
    const { data } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
    // mark inbound as read
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).eq("sender_id", userId).is("read_at", null);
  };

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(({ data }) => setOther(data as Profile | null));
    if (user) supabase.from("chat_settings").select("bg_url").eq("owner_id", user.id).eq("peer_id", userId).maybeSingle().then(({ data }) => setBg((data as { bg_url: string | null } | null)?.bg_url ?? null));
    load();
    const ch = supabase.channel(`dm-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load).subscribe();
    const cull = setInterval(() => setMsgs((m) => m.filter((x) => new Date(x.expires_at) > new Date())), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(cull); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!user || !userId || !text.trim()) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: userId, content });
    notify({ kind: "message", message: content.slice(0, 120), actor: { id: user.id }, data: { recipient_id: userId } });
  };

  const uploadAndSend = async (f: File, type: "audio" | "file") => {
    if (!user || !userId) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("File over 25MB"); return; }
    const detected = type === "audio" ? "audio"
      : f.type.startsWith("image/") ? "image"
      : f.type.startsWith("video/") ? "video"
      : f.type.startsWith("audio/") ? "audio"
      : "file";
    const path = `${user.id}/dm-${crypto.randomUUID()}-${f.name}`;
    const { error: e1 } = await supabase.storage.from("media").upload(path, f, { contentType: f.type });
    if (e1) { toast.error(e1.message); return; }
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: userId, content: f.name, media_url: url, media_type: detected });
  };

  const recordVoice = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadAndSend(file, "audio");
        setRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 120000);
    } catch { toast.error("Microphone denied"); }
  };

  const setBackground = async (file: File) => {
    if (!user || !userId) return;
    const path = `${user.id}/bg-${crypto.randomUUID()}-${file.name}`;
    const { error: e1 } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (e1) { toast.error(e1.message); return; }
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    await supabase.from("chat_settings").upsert({ owner_id: user.id, peer_id: userId, bg_url: url, updated_at: new Date().toISOString() });
    setBg(url);
  };

  return (
    <div className="flex flex-col h-screen relative" style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/messages" className="md:hidden p-2 -ml-2"><ArrowLeft /></Link>
        <Avatar url={other?.avatar_url} name={other?.display_name} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{other?.display_name ?? "…"}</div>
          <div className="text-[11px] text-snap flex items-center gap-1"><Timer className="w-3 h-3" /> Disappears in 24h</div>
        </div>
        <label className="p-2 cursor-pointer text-muted-foreground hover:text-foreground" title="Change background">
          <ImageIcon className="w-4 h-4" />
          <input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && setBackground(e.target.files[0])} />
        </label>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] card-glass rounded-3xl overflow-hidden shadow-lg ${mine ? "rounded-br-md ring-1 ring-snap/40" : "rounded-bl-md"}`}>
                  {m.media_type === "audio" && m.media_url ? (
                    <div className="px-3 py-2"><VoiceMessage src={m.media_url} mine={mine} /></div>
                  ) : m.media_type === "image" && m.media_url ? (
                    <a href={m.media_url} target="_blank" rel="noreferrer">
                      <img src={m.media_url} alt={m.content ?? ""} className="max-h-72 w-full object-cover" />
                    </a>
                  ) : m.media_type === "video" && m.media_url ? (
                    <video src={m.media_url} controls className="max-h-72 w-full bg-black" />
                  ) : m.media_url ? (
                    <a href={m.media_url} target="_blank" rel="noreferrer" download className="flex items-center gap-2 px-4 py-3 underline">
                      <Paperclip className="w-4 h-4 shrink-0" />
                      <span className="truncate">{m.content || "file"}</span>
                    </a>
                  ) : (
                    <div className={`px-4 py-2 ${mine ? "text-primary-foreground bg-primary/90" : ""}`}>{m.content}</div>
                  )}
                  {m.media_url && m.content && (m.media_type === "image" || m.media_type === "video") && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground truncate">{m.content}</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-3 flex gap-2 items-center">
        <button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground p-2"><Paperclip className="w-5 h-5" /></button>
        <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "file")} />
        <button type="button" onClick={recordVoice} className={`p-2 rounded-full ${recording ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground"}`}><Mic className="w-5 h-5" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Send a disappearing message…" className="flex-1 bg-input rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" disabled={!text.trim()} className="w-12 h-12 rounded-full bg-snap text-snap-foreground grid place-items-center disabled:opacity-50"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  );
}
