import React, { useState } from "react";
import { Download, Maximize2, X } from "lucide-react";

interface ImageBubbleProps {
  src: string;
  alt?: string;
  caption?: string;
}

export default function ImageBubble({ src, alt = "Image générée", caption }: ImageBubbleProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const handleDownload = async () => {
    try {
      const link = document.createElement("a");
      link.href = src;
      link.download = `marvia-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-border bg-card/50 backdrop-blur-sm max-w-sm">
        <div className="relative group">
          <img
            src={src}
            alt={alt}
            className="w-full max-h-80 object-contain bg-black/20 cursor-pointer"
            onClick={() => setFullscreen(true)}
          />
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setFullscreen(true)}
              className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="w-8 h-8 rounded-lg bg-primary/90 backdrop-blur-sm flex items-center justify-center text-primary-foreground hover:bg-primary transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        {caption && (
          <div className="px-3 py-2 text-xs text-muted-foreground">{caption}</div>
        )}
        <div className="px-3 py-2 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Marv-IA • Image</span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="w-3 h-3" />
            Télécharger
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20">
            <X className="w-5 h-5" />
          </button>
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </button>
        </div>
      )}
    </>
  );
}
