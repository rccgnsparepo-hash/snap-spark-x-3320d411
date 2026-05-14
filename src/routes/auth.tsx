import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Flick" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) nav({ to: "/" }); }, [session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { handle: handle || email.split("@")[0], display_name: handle || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40"
           style={{ background: "radial-gradient(60% 50% at 50% 0%, oklch(0.7 0.18 240 / 0.4), transparent 60%), radial-gradient(40% 40% at 80% 90%, oklch(0.95 0.2 100 / 0.25), transparent 60%)" }} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card/70 backdrop-blur-xl p-8">
        <Link to="/" className="block mb-6">
          <h1 className="font-display text-4xl tracking-tight">
            flick<span className="text-snap">.</span>
          </h1>
        </Link>
        <h2 className="text-xl font-semibold mb-1">{mode === "signup" ? "Create account" : "Welcome back"}</h2>
        <p className="text-sm text-muted-foreground mb-6">Timeline. Stories. Filters. Disappearing chats.</p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle"
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
          )}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email"
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password"
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
          <button disabled={busy} type="submit"
            className="w-full py-3 rounded-xl bg-snap text-snap-foreground font-bold tracking-tight disabled:opacity-60 transition hover:brightness-110"
            style={{ boxShadow: "var(--shadow-snap)" }}>
            {busy ? "..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="block mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground">
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
        </button>
      </motion.div>
    </main>
  );
}
