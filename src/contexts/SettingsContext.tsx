import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light" | "auto";
type ResponseStyle = "precise" | "standard" | "creative";
type VoiceTone = "neutral" | "dynamic" | "soft";
type AIModel = "google/gemini-3-flash-preview" | "google/gemini-2.5-flash" | "google/gemini-2.5-pro";
type AccentColor = "green" | "blue" | "purple" | "orange" | "pink" | "cyan";

const ACCENT_COLORS: Record<AccentColor, { primary: string; ring: string; accent: string }> = {
  green:  { primary: "120 100% 55%", ring: "120 100% 55%", accent: "120 100% 55%" },
  blue:   { primary: "217 91% 60%",  ring: "217 91% 60%",  accent: "217 91% 60%" },
  purple: { primary: "270 76% 62%",  ring: "270 76% 62%",  accent: "270 76% 62%" },
  orange: { primary: "25 95% 53%",   ring: "25 95% 53%",   accent: "25 95% 53%" },
  pink:   { primary: "330 81% 60%",  ring: "330 81% 60%",  accent: "330 81% 60%" },
  cyan:   { primary: "187 85% 53%",  ring: "187 85% 53%",  accent: "187 85% 53%" },
};

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
  accentColor: AccentColor;
  setAccentColor: (c: AccentColor) => void;
  ideMode: boolean;
  setIdeMode: (v: boolean) => void;
  ideAutoSave: boolean;
  setIdeAutoSave: (v: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType>({} as SettingsContextType);

export const useSettings = () => useContext(SettingsContext);

export const ACCENT_OPTIONS = ACCENT_COLORS;
export type { AccentColor };

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("marvia-theme") as Theme) || "dark");
  const [responseStyle, setResponseStyleState] = useState<ResponseStyle>(() => (localStorage.getItem("marvia-style") as ResponseStyle) || "standard");
  const [voiceEnabled, setVoiceEnabledState] = useState(() => localStorage.getItem("marvia-voice") === "true");
  const [voiceTone, setVoiceToneState] = useState<VoiceTone>(() => (localStorage.getItem("marvia-tone") as VoiceTone) || "neutral");
  const [aiModel, setAiModelState] = useState<AIModel>(() => (localStorage.getItem("marvia-model") as AIModel) || "google/gemini-3-flash-preview");
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => (localStorage.getItem("marvia-accent") as AccentColor) || "green");
  const [ideMode, setIdeModeState] = useState(() => localStorage.getItem("marvia-ide") === "true");

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("marvia-theme", t); };
  const setResponseStyle = (s: ResponseStyle) => { setResponseStyleState(s); localStorage.setItem("marvia-style", s); };
  const setVoiceEnabled = (v: boolean) => { setVoiceEnabledState(v); localStorage.setItem("marvia-voice", String(v)); };
  const setVoiceTone = (t: VoiceTone) => { setVoiceToneState(t); localStorage.setItem("marvia-tone", t); };
  const setAiModel = (m: AIModel) => { setAiModelState(m); localStorage.setItem("marvia-model", m); };
  const setAccentColor = (c: AccentColor) => { setAccentColorState(c); localStorage.setItem("marvia-accent", c); };
  const setIdeMode = (v: boolean) => { setIdeModeState(v); localStorage.setItem("marvia-ide", String(v)); };

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

  // Apply accent color CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const colors = ACCENT_COLORS[accentColor];
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--ring", colors.ring);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--chat-user", colors.primary);
    root.style.setProperty("--neon-glow", `0 0 10px hsl(${colors.primary} / 0.3), 0 0 20px hsl(${colors.primary} / 0.15)`);
    // Also update sidebar
    root.style.setProperty("--sidebar-primary", colors.primary);
    root.style.setProperty("--sidebar-ring", colors.ring);
  }, [accentColor]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, responseStyle, setResponseStyle, voiceEnabled, setVoiceEnabled, voiceTone, setVoiceTone, aiModel, setAiModel, accentColor, setAccentColor, ideMode, setIdeMode }}>
      {children}
    </SettingsContext.Provider>
  );
};
