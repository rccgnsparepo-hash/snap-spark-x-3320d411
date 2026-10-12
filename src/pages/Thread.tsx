import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowLeft,
  Send,
  Timer,
  Paperclip,
  Mic,
  Image as ImageIcon,
  Settings2,
  Reply,
  X,
  Smile,
  Camera,
  Check,
  CheckCheck,
  Sparkles,
  Phone,
  Video,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { VoiceMessage } from "@/components/VoiceMessage";
import { notify } from "@/lib/notify";
import { ChatProfileSheet } from "@/components/ChatProfileSheet";
import {
  triggerNotchNotification,
  type NotchStyle,
  getStoredNotchStyle,
} from "@/components/notifications/NotchNotification";

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  expires_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  reply_snippet: string | null;
  reactions?: Record<string, string[]>; // emoji -> array of user_ids
};

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

const POPULAR_EMOJIS = ["😂", "🔥", "❤️", "⚡", "👏", "💯", "🚀", "😍", "✨", "🙌"];
const QUICK_REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "👏", "⚡"];

const DISAPPEAR_PRESETS = [
  { label: "Off", sec: null },
  { label: "30s", sec: 30 },
  { label: "5m", sec: 300 },
  { label: "1h", sec: 3600 },
  { label: "24h", sec: 86400 },
];

export default function ThreadPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user, profile } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<number>(1);
  const [fontFamily, setFontFamily] = useState<string>("system");
  const [disappearSec, setDisappearSec] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, number>>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});

  const typingTimeoutRef = useRef<number | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentTypingRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user || !userId) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`,
      )
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
    // mark inbound as read
    setMsgs((rows) =>
      rows.map((m) =>
        m.recipient_id === user.id && m.sender_id === userId && !m.read_at
          ? { ...m, read_at: now }
          : m,
      ),
    );
    await supabase
      .from("messages")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .eq("sender_id", userId)
      .is("read_at", null);
    // Also clear the notifications-bell counter for DM notifications from this peer.
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .eq("actor_id", userId)
      .eq("kind", "message")
      .is("read_at", null);
    window.dispatchEvent(new Event("flick:notifications-updated"));
  };

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setOther(data as Profile | null));
    if (user)
      supabase
        .from("chat_settings")
        .select("bg_url, font_scale, font_family, disappearing_seconds")
        .eq("owner_id", user.id)
        .eq("peer_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as {
            bg_url: string | null;
            font_scale: number | null;
            font_family: string | null;
            disappearing_seconds: number | null;
          } | null;
          setBg(row?.bg_url ?? null);
          setFontScale(row?.font_scale ?? 1);
          setFontFamily(row?.font_family ?? "system");
          setDisappearSec(row?.disappearing_seconds ?? null);
        });
    if (user)
      supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId)
        .maybeSingle()
        .then(({ data }) => setBlocked(!!data));
    load();
    const ch = supabase
      .channel(`dm-${[user?.id, userId].sort().join("-")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Msg>;
        if (!row || !user) return;
        const relevant =
          (row.sender_id === user.id && row.recipient_id === userId) ||
          (row.sender_id === userId && row.recipient_id === user.id);
        if (relevant) load();
      })
      .subscribe();

    // Typing presence
    if (user) {
      const pair = [user.id, userId].sort().join("--");
      const typing = supabase.channel(`typing-${pair}`, { config: { broadcast: { self: false } } });
      typing
        .on("broadcast", { event: "typing" }, (msg) => {
          const from = (msg.payload as { from?: string })?.from;
          if (from && from !== user.id) {
            setPeerTyping(true);
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => setPeerTyping(false), 2500);
          }
        })
        .subscribe();
      typingChannelRef.current = typing;
    }
    const cull = setInterval(
      () => setMsgs((m) => m.filter((x) => !x.expires_at || new Date(x.expires_at) > new Date())),
      5000,
    );
    return () => {
      supabase.removeChannel(ch);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      clearInterval(cull);
    };
  }, [userId, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, peerTyping]);

  // Resolve private DM attachment paths into short-lived signed URLs.
  useEffect(() => {
    const paths = msgs
      .map((m) => m.media_url)
      .filter((u): u is string => !!u && !/^https?:\/\//.test(u) && !signed[u]);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("dm-media")
        .createSignedUrls([...new Set(paths)], 3600);
      if (cancelled || !data) return;
      setSigned((prev) => {
        const next = { ...prev };
        for (const r of data) if (r.path && r.signedUrl) next[r.path] = r.signedUrl;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [msgs, signed]);

  const mediaSrc = (u: string | null) =>
    !u ? null : /^https?:\/\//.test(u) ? u : (signed[u] ?? null);


  const send = async () => {
    if (!user || !userId || !text.trim()) return;
    if (blocked) {
      toast.error("You have blocked this user. Unblock to send.");
      return;
    }
    const content = text.trim();
    const reply_to_id = replyTo?.id ?? null;
    const reply_snippet = replyTo
      ? (replyTo.content ?? (replyTo.media_type ? `📎 ${replyTo.media_type}` : "media")).slice(
          0,
          140,
        )
      : null;
    setText("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    const expires_at = disappearSec
      ? new Date(Date.now() + disappearSec * 1000).toISOString()
      : null;
    const optimistic: Msg = {
      id: `local-${crypto.randomUUID()}`,
      sender_id: user.id,
      recipient_id: userId,
      content,
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
      expires_at: expires_at ?? "",
      read_at: null,
      reply_to_id,
      reply_snippet,
    };
    setMsgs((rows) => [...rows, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: userId,
        content,
        reply_to_id,
        reply_snippet,
        expires_at,
      })
      .select("*")
      .single();
    if (error) {
      setMsgs((rows) => rows.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
      return;
    }
    setMsgs((rows) => rows.map((m) => (m.id === optimistic.id ? (data as Msg) : m)));

    // Send push notification to recipient
    notify({
      kind: "message",
      message: content.slice(0, 120),
      actor: {
        id: user.id,
        display_name: profile?.display_name || "User",
        handle: profile?.handle || "user",
        avatar_url: profile?.avatar_url || null,
      },
      data: { recipient_id: userId },
      recipients: [userId],
      url: `/messages/${user.id}`,
      dedupe_id: `message:${user.id}:${data.id}`,
    });
  };

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (typingChannelRef.current && user && now - lastSentTypingRef.current > 1200) {
      lastSentTypingRef.current = now;
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { from: user.id },
      });
    }
  };

  const uploadAndSend = async (f: File, type: "audio" | "file" | "image") => {
    if (!user || !userId) return;
    if (blocked) {
      toast.error("You have blocked this user.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File over 25MB");
      return;
    }
    const detected =
      type === "audio"
        ? "audio"
        : f.type.startsWith("image/")
          ? "image"
          : f.type.startsWith("video/")
            ? "video"
            : f.type.startsWith("audio/")
              ? "audio"
              : "file";
    const folder = [user.id, userId].sort().join("__");
    const path = `${folder}/dm-${crypto.randomUUID()}-${f.name}`;
    const { error: e1 } = await supabase.storage
      .from("dm-media")
      .upload(path, f, { contentType: f.type });
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const url = path;
    const expires_at = disappearSec
      ? new Date(Date.now() + disappearSec * 1000).toISOString()
      : null;
    const optimistic: Msg = {
      id: `local-${crypto.randomUUID()}`,
      sender_id: user.id,
      recipient_id: userId,
      content: f.name,
      media_url: url,
      media_type: detected,
      created_at: new Date().toISOString(),
      expires_at: expires_at ?? "",
      read_at: null,
      reply_to_id: null,
      reply_snippet: null,
    };
    setMsgs((rows) => [...rows, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: userId,
        content: f.name,
        media_url: url,
        media_type: detected,
        expires_at,
      })
      .select("*")
      .single();
    if (error) {
      setMsgs((rows) => rows.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
      return;
    }
    setMsgs((rows) => rows.map((m) => (m.id === optimistic.id ? (data as Msg) : m)));
    notify({
      kind: "message",
      message: detected === "audio" ? "Voice message" : f.name,
      actor: {
        id: user.id,
        display_name: profile?.display_name || "User",
        handle: profile?.handle || "user",
        avatar_url: profile?.avatar_url || null,
      },
      data: { recipient_id: userId },
      recipients: [userId],
      url: `/messages/${user.id}`,
      dedupe_id: `message:${user.id}:${data.id}`,
    });
  };

  const recordVoice = async () => {
    if (recording) {
      recorderRef.current?.stop();
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      setRecording(false);
      setRecordSeconds(0);
      return;
    }
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
        setRecordSeconds(0);
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      setTimeout(() => {
        if (rec.state === "recording") {
          rec.stop();
          if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        }
      }, 120000);
    } catch {
      toast.error("Microphone permission needed");
    }
  };

  const setBackground = async (file: File) => {
    if (!user || !userId) return;
    const path = `${user.id}/bg-${crypto.randomUUID()}-${file.name}`;
    const { error: e1 } = await supabase.storage
      .from("media")
      .upload(path, file, { contentType: file.type });
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    await supabase
      .from("chat_settings")
      .upsert(
        { owner_id: user.id, peer_id: userId, bg_url: url, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,peer_id" },
      );
    setBg(url);
    toast.success("Chat background updated");
  };

  const updateDisappearing = async (sec: number | null) => {
    setDisappearSec(sec);
    setShowTimerMenu(false);
    if (!user || !userId) return;
    await supabase
      .from("chat_settings")
      .upsert(
        {
          owner_id: user.id,
          peer_id: userId,
          disappearing_seconds: sec,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,peer_id" },
      );
    toast.success(
      sec ? `Disappearing messages set to ${sec >= 3600 ? `${sec / 3600}h` : `${sec}s`}` : "Disappearing messages off",
    );
  };

  const addReaction = (msgId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const msgReactions = prev[msgId] ? { ...prev[msgId] } : {};
      msgReactions[emoji] = (msgReactions[emoji] ?? 0) + 1;
      return { ...prev, [msgId]: msgReactions };
    });
    setActiveReactionMsgId(null);
    toast(`Reacted with ${emoji}`);
  };

  const simulatePeerNotificationNow = () => {
    if (!other) return;
    triggerNotchNotification({
      kind: "message",
      title: `${other.display_name} sent a flick`,
      message: "Check out this new photo flick! Tap to view directly ⚡️",
      actor: other,
      url: `/messages/${other.id}`,
    });
    toast.success("Triggered iOS Dynamic Screen alert!");
  };

  return (
    <div
      className="flex flex-col h-full relative min-w-0 overflow-hidden bg-background"
      style={{
        ...(bg
          ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}),
        fontFamily: FONT_MAP[fontFamily] ?? undefined,
      }}
    >
      {/* Modern iOS Top Navigation Header */}
      <header className="shrink-0 sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/80 px-3 py-2.5 flex items-center justify-between min-w-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to="/messages"
            className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 min-w-0 text-left group"
          >
            <div className="relative shrink-0">
              <Avatar url={other?.avatar_url} name={other?.display_name} size={38} ring={peerTyping} />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate group-hover:text-snap transition flex items-center gap-1.5">
                <span>{other?.display_name ?? "Direct Message"}</span>
                <span className="text-[10px] text-muted-foreground font-normal">@{other?.handle}</span>
              </div>
              <div className="text-[11px] flex items-center gap-1.5 leading-none mt-0.5">
                {peerTyping ? (
                  <span className="text-snap font-semibold flex items-center gap-1">
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    typing…
                  </span>
                ) : (
                  <span className="text-emerald-400/90 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active now
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Disappearing Timer Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowTimerMenu((v) => !v)}
              className={`p-2 rounded-full transition flex items-center gap-1 text-xs font-semibold ${
                disappearSec
                  ? "bg-snap/20 text-snap border border-snap/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Disappearing timer"
            >
              <Timer className="w-4 h-4" />
              {disappearSec && (
                <span className="text-[10px]">
                  {disappearSec >= 86400
                    ? `${disappearSec / 86400}d`
                    : disappearSec >= 3600
                      ? `${disappearSec / 3600}h`
                      : `${disappearSec}s`}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showTimerMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                  className="absolute right-0 mt-2 w-40 card-glass rounded-2xl p-1.5 z-40 shadow-2xl border border-white/20"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    Disappear timer
                  </div>
                  {DISAPPEAR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => updateDisappearing(p.sec)}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        disappearSec === p.sec
                          ? "bg-snap text-black font-bold"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span>{p.label}</span>
                      {disappearSec === p.sec && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Test Notch alert button */}
          <button
            onClick={simulatePeerNotificationNow}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-[11px] font-bold text-snap transition"
            title="Simulate incoming notch push notification"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Notch</span>
          </button>

          {/* Background Wallpaper */}
          <label
            className="p-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition"
            title="Change background wallpaper"
          >
            <ImageIcon className="w-4 h-4" />
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && setBackground(e.target.files[0])}
            />
          </label>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition"
            aria-label="Chat settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Message Stream */}
      <div
        className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-6 space-y-3 min-h-0 overscroll-contain"
        style={{ fontSize: `${fontScale}rem` }}
      >
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground space-y-3">
            <Avatar url={other?.avatar_url} name={other?.display_name} size={64} ring />
            <div>
              <h3 className="font-bold text-foreground text-base">{other?.display_name}</h3>
              <p className="text-xs text-muted-foreground">@{other?.handle} · Flick Direct Message</p>
            </div>
            <p className="text-xs max-w-xs text-muted-foreground/80">
              Send a disappearing message, voice note, or photo. All messages are encrypted & fullstack.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            const reactions = reactionsMap[m.id];

            return (
              <motion.div
                key={m.id}
                id={`msg-${m.id}`}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={(_, info) => {
                  if (Math.abs(info.offset.x) > 50) setReplyTo(m);
                }}
                className={`flex flex-col group ${mine ? "items-end" : "items-start"}`}
              >
                {/* Replying quote badge if linked */}
                {m.reply_to_id && m.reply_snippet && (
                  <button
                    onClick={() => {
                      const el = document.getElementById(`msg-${m.reply_to_id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-snap");
                        setTimeout(() => el.classList.remove("ring-2", "ring-snap"), 1200);
                      }
                    }}
                    className={`text-left max-w-[82%] sm:max-w-[70%] mb-1 px-3 py-1 rounded-2xl text-[11px] truncate flex items-center gap-1.5 ${
                      mine ? "bg-snap/10 text-snap border border-snap/20" : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    <Reply className="w-3 h-3 shrink-0" />
                    <span className="truncate">{m.reply_snippet}</span>
                  </button>
                )}

                <div className="relative flex items-center gap-1 max-w-[85%] sm:max-w-[72%]">
                  {/* Left Action for Mine (Reply) */}
                  {mine && (
                    <button
                      onClick={() => setReplyTo(m)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground rounded-full transition"
                      aria-label="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Message Bubble */}
                  <div
                    onDoubleClick={() => setActiveReactionMsgId((curr) => (curr === m.id ? null : m.id))}
                    className={`rounded-[24px] overflow-hidden shadow-md transition-all ${
                      mine
                        ? "bg-[#182210] border border-snap/40 text-foreground rounded-br-md"
                        : "bg-secondary/90 backdrop-blur-xl border border-white/10 text-foreground rounded-bl-md"
                    }`}
                  >
                    {/* Media Render */}
                    {m.media_url && !mediaSrc(m.media_url) ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">
                        Loading media…
                      </div>
                    ) : m.media_type === "audio" && mediaSrc(m.media_url) ? (
                      <div className="px-3.5 py-2.5">
                        <VoiceMessage src={mediaSrc(m.media_url)!} mine={mine} />
                      </div>
                    ) : m.media_type === "image" && mediaSrc(m.media_url) ? (
                      <a href={mediaSrc(m.media_url)!} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={mediaSrc(m.media_url)!}
                          alt={m.content ?? "image"}
                          className="max-h-80 w-full object-cover rounded-t-[22px]"
                          loading="lazy"
                        />
                      </a>
                    ) : m.media_type === "video" && mediaSrc(m.media_url) ? (
                      <video
                        src={mediaSrc(m.media_url)!}
                        controls
                        className="max-h-80 w-full bg-black rounded-t-[22px]"
                      />
                    ) : mediaSrc(m.media_url) ? (
                      <a
                        href={mediaSrc(m.media_url)!}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex items-center gap-2 px-4 py-3 underline text-xs"
                      >
                        <Paperclip className="w-4 h-4 shrink-0 text-snap" />
                        <span className="truncate">{m.content || "file attachment"}</span>
                      </a>
                    ) : null}

                    {/* Text Content */}
                    {m.content && m.media_type !== "image" && m.media_type !== "video" && m.media_type !== "audio" && (
                      <div className="px-4 py-2.5 break-words text-[14px] leading-relaxed">
                        {m.content}
                      </div>
                    )}

                    {/* Media Caption */}
                    {m.content && (m.media_type === "image" || m.media_type === "video") && (
                      <div className="px-4 py-1.5 text-xs text-muted-foreground">
                        {m.content}
                      </div>
                    )}

                    {/* Bottom Metadata: Timestamp + Read Status */}
                    <div
                      className={`flex items-center justify-end gap-1.5 px-3 pb-1 text-[10px] ${
                        mine ? "text-snap/70" : "text-muted-foreground/70"
                      }`}
                    >
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine && (
                        <span>
                          {m.read_at ? (
                            <CheckCheck className="w-3.5 h-3.5 text-snap" title="Read" />
                          ) : (
                            <Check className="w-3 h-3 text-muted-foreground" title="Sent" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action for Peer (Reply) */}
                  {!mine && (
                    <button
                      onClick={() => setReplyTo(m)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground rounded-full transition"
                      aria-label="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Floating Quick Reaction Toolbar */}
                  <AnimatePresence>
                    {activeReactionMsgId === m.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={`absolute -top-10 z-30 card-glass rounded-full px-2 py-1 flex items-center gap-1.5 shadow-2xl border border-white/20 ${
                          mine ? "right-0" : "left-0"
                        }`}
                      >
                        {QUICK_REACTION_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => addReaction(m.id, e)}
                            className="hover:scale-125 transition text-base p-1"
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Attached Reactions Pills */}
                {reactions && Object.keys(reactions).length > 0 && (
                  <div className={`flex gap-1 mt-1 ${mine ? "mr-2" : "ml-2"}`}>
                    {Object.entries(reactions).map(([emoji, count]) => (
                      <span
                        key={emoji}
                        className="bg-card border border-white/20 rounded-full px-2 py-0.5 text-[11px] shadow-sm flex items-center gap-1"
                      >
                        <span>{emoji}</span>
                        {count > 1 && <span className="font-bold text-muted-foreground">{count}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Peer Typing Bubble */}
        {peerTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Avatar url={other?.avatar_url} name={other?.display_name} size={28} />
            <div className="bg-secondary/90 border border-white/10 rounded-2xl rounded-bl-sm px-3.5 py-2 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-secondary/80 backdrop-blur border-t border-border flex items-center gap-2 text-xs">
          <Reply className="w-3.5 h-3.5 text-snap" />
          <span className="truncate flex-1 font-medium">
            Replying to: {replyTo.content?.slice(0, 80) ?? "attachment"}
          </span>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Popular Emoji Bar */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card/95 backdrop-blur-xl border-t border-border px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-lg"
          >
            {POPULAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((prev) => prev + e)}
                className="text-xl p-1.5 hover:scale-125 transition shrink-0"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Floating Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="shrink-0 sticky bottom-0 z-20 bg-background/90 backdrop-blur-2xl border-t border-border px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 min-w-0"
      >
        {/* Quick Camera Snap */}
        <label
          className="p-2 text-muted-foreground hover:text-snap hover:bg-secondary rounded-full cursor-pointer transition shrink-0"
          title="Snap photo"
        >
          <Camera className="w-5 h-5" />
          <input
            ref={cameraRef}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "image")}
          />
        </label>

        {/* Attach File */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-2 text-muted-foreground hover:text-snap hover:bg-secondary rounded-full transition shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "file")}
        />

        {/* Voice Note Recording Button with Live Timer */}
        {recording ? (
          <div className="flex-1 flex items-center gap-2 bg-red-950/40 border border-red-500/50 rounded-full px-4 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-red-400">
              Recording {Math.floor(recordSeconds / 60)}:
              {String(recordSeconds % 60).padStart(2, "0")}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={recordVoice}
              className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold shadow hover:bg-red-600 transition"
            >
              Stop & Send
            </button>
          </div>
        ) : (
          <>
            {/* Input Capsule */}
            <div className="flex-1 min-w-0 flex items-center bg-secondary/80 rounded-full px-3.5 py-1.5 border border-border/60 focus-within:border-snap/60 focus-within:ring-1 focus-within:ring-snap/40 transition">
              <input
                value={text}
                onChange={(e) => onType(e.target.value)}
                placeholder="Send a flick message…"
                className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground min-w-0 text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className={`p-1.5 rounded-full transition text-muted-foreground hover:text-snap ${
                  showEmojiPicker ? "text-snap" : ""
                }`}
                title="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Mic trigger */}
            <button
              type="button"
              onClick={recordVoice}
              className="p-2 rounded-full text-muted-foreground hover:text-snap hover:bg-secondary transition shrink-0"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!text.trim()}
              className="w-10 h-10 rounded-full bg-snap text-black font-bold grid place-items-center disabled:opacity-30 disabled:scale-95 hover:scale-105 active:scale-95 transition shadow-lg shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        )}
      </form>

      {/* Chat Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md bg-card border border-border rounded-t-3xl md:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Chat settings</h3>
                <button onClick={() => setShowSettings(false)} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Text size
                </label>
                <input
                  type="range"
                  min={0.85}
                  max={1.35}
                  step={0.05}
                  value={fontScale}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFontScale(v);
                    if (user && userId) {
                      void supabase.from("chat_settings").upsert(
                        { owner_id: user.id, peer_id: userId, font_scale: v, updated_at: new Date().toISOString() },
                        { onConflict: "owner_id,peer_id" },
                      );
                    }
                  }}
                  className="w-full accent-snap mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Small</span>
                  <span style={{ fontSize: `${fontScale}rem` }}>Aa preview</span>
                  <span>Large</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Font family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFontFamily(v);
                    if (user && userId) {
                      void supabase.from("chat_settings").upsert(
                        { owner_id: user.id, peer_id: userId, font_family: v, updated_at: new Date().toISOString() },
                        { onConflict: "owner_id,peer_id" },
                      );
                    }
                  }}
                  className="w-full mt-2 bg-secondary border border-border rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    simulatePeerNotificationNow();
                    setShowSettings(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-snap text-black font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Test iOS Dynamic Screen Alert
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        peer={other}
        onDeleted={() => {
          setMsgs([]);
        }}
      />
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
  georgia: "Georgia, serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  arial: "Arial, sans-serif",
  helvetica: "Helvetica, Arial, sans-serif",
  palatino: '"Palatino Linotype", Palatino, serif',
  garamond: "Garamond, serif",
  impact: "Impact, Charcoal, sans-serif",
  lucida: '"Lucida Console", Monaco, monospace',
  monaco: "Monaco, Consolas, monospace",
  brush: '"Brush Script MT", cursive',
  copperplate: 'Copperplate, "Copperplate Gothic Light", serif',
};
