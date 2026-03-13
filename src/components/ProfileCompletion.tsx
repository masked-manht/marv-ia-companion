import React, { useState } from "react";
import { Sparkles, User, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileCompletionProps {
  userId: string;
  onComplete: () => void;
}

export default function ProfileCompletion({ userId, onComplete }: ProfileCompletionProps) {
  const [pseudo, setPseudo] = useState("");
  const [dob, setDob] = useState(""); // MM/DD/YY format input
  const [loading, setLoading] = useState(false);

  const parseDob = (input: string): Date | null => {
    // Accept MM/DD/YY
    const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return null;
    let month = parseInt(match[1], 10);
    let day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    // Handle 2-digit year
    if (year < 100) {
      year += year > 30 ? 1900 : 2000;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date > new Date()) return null;
    return date;
  };

  const formatDobInput = (value: string) => {
    // Auto-format: add slashes as user types
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 6)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) {
      toast.error("Choisissez un pseudo !");
      return;
    }
    const parsedDate = parseDob(dob);
    if (!parsedDate) {
      toast.error("Date invalide. Format : MM/JJ/AA");
      return;
    }

    setLoading(true);
    try {
      const isoDate = parsedDate.toISOString().split("T")[0];
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: pseudo.trim(),
          date_of_birth: isoDate,
        })
        .eq("user_id", userId);

      if (error) throw error;
      toast.success(`Bienvenue, ${pseudo.trim()} ! 🎉`);
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4 neon-glow">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Complétez votre profil</h1>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Marv-IA a besoin de ces infos pour personnaliser votre expérience
        </p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Pseudo / Nom d'affichage
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="Votre pseudo"
                className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                maxLength={30}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Date de naissance (MM/JJ/AA)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(formatDobInput(e.target.value))}
                placeholder="MM/JJ/AA"
                className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                maxLength={8}
                required
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Utilisée pour la sécurité du contenu. Ne sera pas partagée.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold neon-glow hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? "..." : "C'est parti ! 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}
