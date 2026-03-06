export function useVoice() {
  const speak = (text: string, tone: "neutral" | "dynamic" | "soft" = "neutral") => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    
    if (tone === "dynamic") {
      utterance.rate = 1.1;
      utterance.pitch = 1.2;
    } else if (tone === "soft") {
      utterance.rate = 0.9;
      utterance.pitch = 0.9;
    } else {
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
    }

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith("fr"));
    if (frVoice) utterance.voice = frVoice;

    window.speechSynthesis.speak(utterance);
  };

  const startListening = (onResult: (text: string) => void, onEnd?: () => void): (() => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return () => {};
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    recognition.onend = () => onEnd?.();
    recognition.onerror = () => onEnd?.();

    recognition.start();
    return () => recognition.stop();
  };

  return { speak, startListening };
}
