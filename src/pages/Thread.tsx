import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Timer, Paperclip, Mic, Image as ImageIcon, Settings2, Reply, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { VoiceMessage } from "@/components/VoiceMessage";
import { notify } from "@/lib/notify";
import { ChatProfileSheet } from "@/components/ChatProfileSheet";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string | null; media_url: string | null; media_type: string | null; created_at: string; expires_at: string; read_at: string | null; reply_to_id: string | null; reply_snippet: string | null };
type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export default function ThreadPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<number>(1);
  const [fontFamily, setFontFamily] = useState<string>("system");
  const [disappearSec, setDisappearSec] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [recording, setRecording] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentTypingRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user || !userId) return;
    const now = new Date().toISOString();
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
    // mark inbound as read
    setMsgs((rows) => rows.map((m) => m.recipient_id === user.id && m.sender_id === userId && !m.read_at ? { ...m, read_at: now } : m));
    await supabase.from("messages").update({ read_at: now }).eq("recipient_id", user.id).eq("sender_id", userId).is("read_at", null);
  };

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(({ data }) => setOther(data as Profile | null));
    if (user) supabase.from("chat_settings").select("bg_url, font_scale, font_family, disappearing_seconds").eq("owner_id", user.id).eq("peer_id", userId).maybeSingle().then(({ data }) => {
      const row = data as { bg_url: string | null; font_scale: number | null; font_family: string | null; disappearing_seconds: number | null } | null;
      setBg(row?.bg_url ?? null);
      setFontScale(row?.font_scale ?? 1);
      setFontFamily(row?.font_family ?? "system");
      setDisappearSec(row?.disappearing_seconds ?? null);
    });
    if (user) supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", userId).maybeSingle().then(({ data }) => setBlocked(!!data));
    load();
    const ch = supabase.channel(`dm-${[user?.id, userId].sort().join("-")}`).on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
      const row = (payload.new ?? payload.old) as Partial<Msg>;
      if (!row || !user) return;
      const relevant = (row.sender_id === user.id && row.recipient_id === userId) || (row.sender_id === userId && row.recipient_id === user.id);
      if (relevant) load();
    }).subscribe();
    // Typing presence — pair-stable channel name (sorted ids)
    if (user) {
      const pair = [user.id, userId].sort().join("--");
      const typing = supabase.channel(`typing-${pair}`, { config: { broadcast: { self: false } } });
      typing.on("broadcast", { event: "typing" }, (msg) => {
        const from = (msg.payload as { from?: string })?.from;
        if (from && from !== user.id) {
          setPeerTyping(true);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPeerTyping(false), 2500);
        }
      }).subscribe();
      typingChannelRef.current = typing;
    }
    const cull = setInterval(() => setMsgs((m) => m.filter((x) => !x.expires_at || new Date(x.expires_at) > new Date())), 5000);
    return () => {
      supabase.removeChannel(ch);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      clearInterval(cull);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!user || !userId || !text.trim()) return;
    if (blocked) { toast.error("You have blocked this user. Unblock to send."); return; }
    const content = text.trim();
    const reply_to_id = replyTo?.id ?? null;
    const reply_snippet = replyTo ? (replyTo.content ?? (replyTo.media_type ? `📎 ${replyTo.media_type}` : "media")).slice(0, 140) : null;
    setText("");
    setReplyTo(null);
    const expires_at = disappearSec ? new Date(Date.now() + disappearSec * 1000).toISOString() : null;
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: userId, content, reply_to_id, reply_snippet, expires_at });
    notify({ kind: "message", message: content.slice(0, 120), actor: { id: user.id }, data: { recipient_id: userId }, recipients: [userId], url: `/messages/${user.id}` });
  };

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (typingChannelRef.current && user && now - lastSentTypingRef.current > 1200) {
      lastSentTypingRef.current = now;
      typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { from: user.id } });
    }
  };

  const uploadAndSend = async (f: File, type: "audio" | "file") => {
    if (!user || !userId) return;
    if (blocked) { toast.error("You have blocked this user."); return; }
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
    const expires_at = disappearSec ? new Date(Date.now() + disappearSec * 1000).toISOString() : null;
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: userId, content: f.name, media_url: url, media_type: detected, expires_at });
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
    await supabase.from("chat_settings").upsert({ owner_id: user.id, peer_id: userId, bg_url: url, updated_at: new Date().toISOString() }, { onConflict: "owner_id,peer_id" });
    setBg(url);
  };

  const saveFontScale = async (v: number) => {
    setFontScale(v);
    if (!user || !userId) return;
    await supabase.from("chat_settings").upsert({ owner_id: user.id, peer_id: userId, font_scale: v, updated_at: new Date().toISOString() }, { onConflict: "owner_id,peer_id" });
  };

  const saveFontFamily = async (v: string) => {
    setFontFamily(v);
    if (!user || !userId) return;
    await supabase.from("chat_settings").upsert({ owner_id: user.id, peer_id: userId, font_family: v, updated_at: new Date().toISOString() }, { onConflict: "owner_id,peer_id" });
  };

  return (
    <div className="flex flex-col h-[100dvh] relative" style={{ ...(bg ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" } : {}), fontFamily: FONT_MAP[fontFamily] ?? undefined }}>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/messages" className="md:hidden p-2 -ml-2"><ArrowLeft /></Link>
        <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <Avatar url={other?.avatar_url} name={other?.display_name} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{other?.display_name ?? "…"}</div>
          <div className="text-[11px] flex items-center gap-1">
            {peerTyping ? (
              <span className="text-snap flex items-center gap-1">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                typing…
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                {disappearSec ? <><Timer className="w-3 h-3 text-snap" /> Disappears in {disappearSec >= 86400 ? `${disappearSec/86400}d` : disappearSec >= 3600 ? `${disappearSec/3600}h` : `${disappearSec/60}m`}</> : "Tap for profile"}
              </span>
            )}
          </div>
        </div>
        </button>
        <label className="p-2 cursor-pointer text-muted-foreground hover:text-foreground" title="Change background">
          <ImageIcon className="w-4 h-4" />
          <input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && setBackground(e.target.files[0])} />
        </label>
        <button onClick={() => setShowSettings(true)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Chat settings">
          <Settings2 className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2" style={{ fontSize: `${fontScale}rem` }}>
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div
                key={m.id}
                id={`msg-${m.id}`}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60) setReplyTo(m); }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[78%] card-glass rounded-3xl overflow-hidden shadow-lg ${mine ? "rounded-br-md ring-1 ring-snap/40" : "rounded-bl-md"}`}>
                  {m.reply_to_id && m.reply_snippet && (
                    <button
                      onClick={() => {
                        const el = document.getElementById(`msg-${m.reply_to_id}`);
                        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ring-2","ring-snap"); setTimeout(()=>el.classList.remove("ring-2","ring-snap"), 1200); }
                      }}
                      className={`w-full text-left flex gap-2 px-3 pt-2 pb-1.5 border-l-[3px] ${mine ? "border-snap bg-snap/10" : "border-foreground/40 bg-foreground/5"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] uppercase tracking-wider font-bold ${mine ? "text-snap" : "text-muted-foreground"}`}>
                          {m.reply_to_id === (mine ? m.sender_id : m.recipient_id) ? "You" : other?.display_name ?? "Reply"}
                        </div>
                        <div className="text-xs truncate opacity-80">{m.reply_snippet}</div>
                      </div>
                    </button>
                  )}
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
                <button onClick={() => setReplyTo(m)} className="self-center mx-1 opacity-0 hover:opacity-100 md:opacity-40 md:hover:opacity-100 text-muted-foreground" aria-label="Reply">
                  <Reply className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      {replyTo && (
        <div className="px-3 py-2 bg-secondary/60 border-t border-border flex items-center gap-2 text-xs">
          <Reply className="w-3.5 h-3.5 text-snap" />
          <span className="truncate flex-1">Replying to: {replyTo.content?.slice(0, 80) ?? "media"}</span>
          <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 items-center">
        <button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground p-2"><Paperclip className="w-5 h-5" /></button>
        <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "file")} />
        <button type="button" onClick={recordVoice} className={`p-2 rounded-full ${recording ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground"}`}><Mic className="w-5 h-5" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Send a disappearing message…" className="flex-1 bg-input rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" disabled={!text.trim()} className="w-12 h-12 rounded-full bg-snap text-snap-foreground grid place-items-center disabled:opacity-50"><Send className="w-5 h-5" /></button>
      </form>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center">
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md bg-card border border-border rounded-t-3xl md:rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Chat settings</h3>
                <button onClick={() => setShowSettings(false)}><X className="w-5 h-5" /></button>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Text size</label>
                <input type="range" min={0.85} max={1.4} step={0.05} value={fontScale} onChange={(e) => saveFontScale(Number(e.target.value))} className="w-full accent-snap mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground"><span>A</span><span style={{ fontSize: `${fontScale}rem` }}>Aa preview</span><span className="text-lg">A</span></div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Font family</label>
                <select value={fontFamily} onChange={(e) => saveFontFamily(e.target.value)}
                  className="w-full mt-2 bg-input border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
                  {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: FONT_MAP[f.id] }}>{f.label}</option>)}
                </select>
                <div className="mt-2 p-3 rounded-xl bg-secondary/50 text-sm" style={{ fontFamily: FONT_MAP[fontFamily] }}>The quick brown fox jumps over the lazy dog.</div>
              </div>
              <p className="text-xs text-muted-foreground">Settings save automatically per chat.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} peer={other} onDeleted={() => { setMsgs([]); }} />
    </div>
  );
}

const FONT_OPTIONS: { id: string; label: string }[] = [
  { id: "system", label: "System default" },
  { id: "trebuchet", label: "Trebuchet MS" },
  { id: "comic", label: "Comic Sans MS" },
  { id: "georgia", label: "Georgia" },
  { id: "times", label: "Times New Roman" },
  { id: "courier", label: "Courier New" },
  { id: "verdana", label: "Verdana" },
  { id: "tahoma", label: "Tahoma" },
  { id: "arial", label: "Arial" },
  { id: "helvetica", label: "Helvetica" },
  { id: "palatino", label: "Palatino" },
  { id: "garamond", label: "Garamond" },
  { id: "impact", label: "Impact" },
  { id: "lucida", label: "Lucida Console" },
  { id: "monaco", label: "Monaco" },
  { id: "brush", label: "Brush Script MT" },
  { id: "copperplate", label: "Copperplate" },
];
const FONT_MAP: Record<string, string> = {
  system: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  trebuchet: '"Trebuchet MS", sans-serif',
  comic: '"Comic Sans MS", "Comic Sans", cursive',
  georgia: 'Georgia, serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  arial: 'Arial, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  palatino: '"Palatino Linotype", Palatino, serif',
  garamond: 'Garamond, serif',
  impact: 'Impact, Charcoal, sans-serif',
  lucida: '"Lucida Console", Monaco, monospace',
  monaco: 'Monaco, Consolas, monospace',
  brush: '"Brush Script MT", cursive',
  copperplate: 'Copperplate, "Copperplate Gothic Light", serif',
};
