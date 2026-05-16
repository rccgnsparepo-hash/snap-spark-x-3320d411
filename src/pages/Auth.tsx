import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 backdrop-blur-xl p-8">
        <Link to="/" className="block mb-6"><h1 className="font-display text-4xl">flick<span className="text-snap">.</span></h1></Link>
        <h2 className="text-xl font-semibold mb-4">{mode === "signup" ? "Create account" : "Welcome back"}</h2>
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
