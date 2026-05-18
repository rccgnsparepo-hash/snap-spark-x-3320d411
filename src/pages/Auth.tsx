import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { AnimatedBg } from "@/components/AnimatedBg";

export default function AuthPage() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (session) nav("/", { replace: true }); }, [session, nav]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { handle: handle || email.split("@")[0], display_name: handle || email.split("@")[0] } } });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { toast.error(res.error.message); setBusy(false); }
  };
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <AnimatedBg />
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/60 backdrop-blur-2xl p-8 shadow-2xl">
        <Link to="/" className="block mb-2"><h1 className="font-display text-4xl">flick<span className="text-snap">.</span></h1></Link>
        <p className="text-sm text-muted-foreground mb-6">Share moments instantly.</p>
        <h2 className="text-xl font-semibold mb-4">{mode === "signup" ? "Create account" : "Welcome back"}</h2>
        <button onClick={google} disabled={busy} className="w-full py-3 rounded-xl bg-white text-black font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition disabled:opacity-60 mb-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h5.92c-.26 1.36-1.04 2.51-2.21 3.28v2.72h3.57c2.09-1.93 3.22-4.76 3.22-8.24z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.72c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.15c-.22-.66-.35-1.36-.35-2.08s.13-1.42.35-2.08V7.15H2.18C1.43 8.63 1 10.27 1 12s.43 3.37 1.18 4.85l3.66-2.7z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.15l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3 my-4 text-xs text-muted-foreground">
          <span className="flex-1 h-px bg-border" /> or <span className="flex-1 h-px bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none" />}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none" />
          <button disabled={busy} type="submit" className="w-full py-3 rounded-xl bg-snap text-snap-foreground font-bold disabled:opacity-60">{busy ? "..." : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="block mx-auto mt-6 text-sm text-muted-foreground">{mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}</button>
      </div>
    </main>
  );
}
