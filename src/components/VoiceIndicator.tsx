import React from "react";
import { Volume2, VolumeX } from "lucide-react";

interface VoiceIndicatorProps {
  isSpeaking: boolean;
  onStop: () => void;
}

export default function VoiceIndicator({ isSpeaking, onStop }: VoiceIndicatorProps) {
  if (!isSpeaking) return null;

  return (
    <button
      onClick={onStop}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg animate-fade-in"
      style={{ boxShadow: "var(--neon-glow)" }}
    >
      <Volume2 className="w-4 h-4" />
      <div className="flex gap-0.5 items-center">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="w-0.5 bg-primary-foreground rounded-full"
            style={{
              height: "12px",
              animation: `voice-bar 0.8s ease-in-out infinite ${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-medium ml-1">Lecture en cours</span>
    </button>
  );
}
