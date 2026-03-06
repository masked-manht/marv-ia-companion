import React from "react";
import { Zap } from "lucide-react";

interface CreditsDisplayProps {
  credits: number;
  className?: string;
}

export default function CreditsDisplay({ credits, className = "" }: CreditsDisplayProps) {
  const isLow = credits <= 5;
  const isEmpty = credits <= 0;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Zap className={`w-4 h-4 ${isEmpty ? "text-destructive" : isLow ? "text-yellow-500" : "text-primary"}`} />
      <span className={`text-xs font-semibold ${isEmpty ? "text-destructive" : isLow ? "text-yellow-500" : "text-primary"}`}>
        {credits}
      </span>
    </div>
  );
}
