import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light" | "auto";
type ResponseStyle = "precise" | "standard" | "creative";
type VoiceTone = "neutral" | "dynamic" | "soft";
type AIModel = "google/gemini-3-flash-preview" | "google/gemini-2.5-flash" | "google/gemini-2.5-pro";

type SettingsContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  responseStyle: ResponseStyle;
  setResponseStyle: (s: ResponseStyle) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  voiceTone: VoiceTone;
  setVoiceTone: (t: VoiceTone) => void;
  aiModel: AIModel;
  setAiModel: (m: AIModel) => void;
};

const SettingsContext = createContext<SettingsContextType>({} as SettingsContextType);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("marvia-theme") as Theme) || "dark");
  const [responseStyle, setResponseStyleState] = useState<ResponseStyle>(() => (localStorage.getItem("marvia-style") as ResponseStyle) || "standard");
  const [voiceEnabled, setVoiceEnabledState] = useState(() => localStorage.getItem("marvia-voice") === "true");
  const [voiceTone, setVoiceToneState] = useState<VoiceTone>(() => (localStorage.getItem("marvia-tone") as VoiceTone) || "neutral");
  const [aiModel, setAiModelState] = useState<AIModel>(() => (localStorage.getItem("marvia-model") as AIModel) || "google/gemini-3-flash-preview");

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("marvia-theme", t); };
  const setResponseStyle = (s: ResponseStyle) => { setResponseStyleState(s); localStorage.setItem("marvia-style", s); };
  const setVoiceEnabled = (v: boolean) => { setVoiceEnabledState(v); localStorage.setItem("marvia-voice", String(v)); };
  const setVoiceTone = (t: VoiceTone) => { setVoiceToneState(t); localStorage.setItem("marvia-tone", t); };
  const setAiModel = (m: AIModel) => { setAiModelState(m); localStorage.setItem("marvia-model", m); };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else if (theme === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
      root.classList.toggle("light", !isDark);
    }
  }, [theme]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, responseStyle, setResponseStyle, voiceEnabled, setVoiceEnabled, voiceTone, setVoiceTone, aiModel, setAiModel }}>
      {children}
    </SettingsContext.Provider>
  );
};
