import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(onComplete, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Glow ring */}
      <div
        className={`relative w-28 h-28 flex items-center justify-center transition-all duration-700 ${
          phase === "enter" ? "scale-50 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-2 rounded-full border-2 border-primary/30" style={{ boxShadow: "var(--neon-glow)" }} />
        <div className="w-20 h-20 bg-primary/15 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/20">
          <Sparkles className="w-10 h-10 text-primary" style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))" }} />
        </div>
      </div>

      {/* Text */}
      <div
        className={`mt-8 text-center transition-all duration-700 delay-300 ${
          phase === "enter" ? "translate-y-4 opacity-0" : phase === "exit" ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Marv-<span className="text-primary">IA</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Votre assistant intelligent</p>
      </div>

      {/* Loading bar */}
      <div
        className={`mt-8 w-32 h-1 bg-secondary rounded-full overflow-hidden transition-opacity duration-500 delay-500 ${
          phase === "enter" ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          className="h-full bg-primary rounded-full"
          style={{
            animation: "splash-load 2s ease-in-out forwards",
          }}
        />
      </div>
    </div>
  );
}
