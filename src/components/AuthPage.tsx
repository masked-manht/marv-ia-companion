import React, { useState } from "react";
import { Sparkles, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Connecté !");
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre email.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "select_account",
        },
      });
      if (result?.error) {
        console.error("Google OAuth error:", result.error);
        toast.error("Erreur Google Sign-In. Réessayez.");
      }
    } catch (err: any) {
      console.error("Google OAuth catch:", err);
      toast.error(err.message || "Erreur de connexion Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo area */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4 neon-glow">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Marv-IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Votre assistant intelligent</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-10 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold neon-glow hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? "..." : isLogin ? "Se connecter" : "Créer un compte"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={handleGoogle} disabled={loading} className="w-full bg-secondary text-foreground rounded-xl py-3 text-sm font-medium border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuer avec Google
        </button>

        <p className="text-center text-sm text-muted-foreground mt-5">
          {isLogin ? "Pas de compte ?" : "Déjà un compte ?"}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary ml-1 hover:underline">
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-8">Conçu par Marvens Zamy</p>
    </div>
  );
}