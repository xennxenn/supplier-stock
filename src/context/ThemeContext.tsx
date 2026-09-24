import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { LiquidGlassPalette, LiquidGlassThemeConfig } from "../types";

export interface PaletteDef {
  id: LiquidGlassPalette;
  name: string;
  nameEn: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentRing: string;
  glowColor: string;
  gradient: string;
  previewClass: string;
}

export const PALETTES: Record<LiquidGlassPalette, PaletteDef> = {
  "ios-liquid-azure": {
    id: "ios-liquid-azure",
    name: "Liquid Azure (iOS 27)",
    nameEn: "Electric Cyan & Azure Glass",
    accent: "#0284c7", // sky-600
    accentHover: "#0369a1",
    accentLight: "rgba(14, 165, 233, 0.12)",
    accentRing: "rgba(14, 165, 233, 0.35)",
    glowColor: "rgba(2, 132, 199, 0.25)",
    gradient: "from-sky-500 via-blue-600 to-indigo-600",
    previewClass: "bg-gradient-to-r from-sky-400 to-blue-600",
  },
  "emerald-aurora": {
    id: "emerald-aurora",
    name: "Emerald Aurora",
    nameEn: "Radiant Jade & Mint Glass",
    accent: "#059669", // emerald-600
    accentHover: "#047857",
    accentLight: "rgba(16, 185, 129, 0.12)",
    accentRing: "rgba(16, 185, 129, 0.35)",
    glowColor: "rgba(5, 150, 105, 0.25)",
    gradient: "from-emerald-500 via-teal-600 to-cyan-600",
    previewClass: "bg-gradient-to-r from-emerald-400 to-teal-600",
  },
  "pasaya-amber-luxe": {
    id: "pasaya-amber-luxe",
    name: "PASAYA Amber Luxe",
    nameEn: "Warm Gold & Cognac Glass",
    accent: "#d97706", // amber-600
    accentHover: "#b45309",
    accentLight: "rgba(217, 119, 6, 0.12)",
    accentRing: "rgba(217, 119, 6, 0.35)",
    glowColor: "rgba(217, 119, 6, 0.25)",
    gradient: "from-amber-500 via-orange-600 to-amber-700",
    previewClass: "bg-gradient-to-r from-amber-400 to-orange-600",
  },
  "neon-violet": {
    id: "neon-violet",
    name: "Amethyst Violet",
    nameEn: "Deep Purple & Magenta Glass",
    accent: "#7c3aed", // violet-600
    accentHover: "#6d28d9",
    accentLight: "rgba(124, 58, 237, 0.12)",
    accentRing: "rgba(124, 58, 237, 0.35)",
    glowColor: "rgba(124, 58, 237, 0.25)",
    gradient: "from-violet-500 via-purple-600 to-fuchsia-600",
    previewClass: "bg-gradient-to-r from-violet-400 to-fuchsia-600",
  },
  "titanium-frost": {
    id: "titanium-frost",
    name: "Titanium Frost",
    nameEn: "Apple Titanium & Platinum Glass",
    accent: "#334155", // slate-700
    accentHover: "#1e293b",
    accentLight: "rgba(51, 65, 85, 0.12)",
    accentRing: "rgba(51, 65, 85, 0.35)",
    glowColor: "rgba(51, 65, 85, 0.2)",
    gradient: "from-slate-600 via-zinc-700 to-slate-900",
    previewClass: "bg-gradient-to-r from-slate-400 to-slate-700",
  },
  "rose-gold": {
    id: "rose-gold",
    name: "Rose Quartz",
    nameEn: "Sunset Coral & Rose Glass",
    accent: "#e11d48", // rose-600
    accentHover: "#be123c",
    accentLight: "rgba(225, 29, 72, 0.12)",
    accentRing: "rgba(225, 29, 72, 0.35)",
    glowColor: "rgba(225, 29, 72, 0.25)",
    gradient: "from-rose-500 via-pink-600 to-amber-500",
    previewClass: "bg-gradient-to-r from-rose-400 to-pink-600",
  },
  "custom": {
    id: "custom",
    name: "สีที่กำหนดเอง (Custom)",
    nameEn: "Custom Brand Color",
    accent: "#0ea5e9",
    accentHover: "#0284c7",
    accentLight: "rgba(14, 165, 233, 0.12)",
    accentRing: "rgba(14, 165, 233, 0.35)",
    glowColor: "rgba(14, 165, 233, 0.25)",
    gradient: "from-sky-500 via-indigo-600 to-blue-700",
    previewClass: "bg-gradient-to-r from-sky-500 to-indigo-600",
  },
};

const DEFAULT_THEME: LiquidGlassThemeConfig = {
  palette: "ios-liquid-azure",
  blurIntensity: "ultra",
  fluidMotion: true,
  ambientGlow: true,
  isDarkGlass: false,
  customPrimaryColor: "#0284c7",
  logoText: "PASAYA Accessories",
};

interface ThemeContextValue {
  theme: LiquidGlassThemeConfig;
  paletteDef: PaletteDef;
  setPalette: (p: LiquidGlassPalette) => void;
  setBlurIntensity: (b: "subtle" | "medium" | "deep" | "ultra") => void;
  setFluidMotion: (v: boolean) => void;
  setAmbientGlow: (v: boolean) => void;
  setIsDarkGlass: (v: boolean) => void;
  setCustomPrimaryColor: (color: string) => void;
  setLogoUrl: (url: string | undefined) => void;
  setLogoText: (text: string) => void;
  saveThemeToCloud: (newTheme: LiquidGlassThemeConfig, adminName: string) => Promise<void>;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<LiquidGlassThemeConfig>(() => {
    try {
      const saved = localStorage.getItem("pasaya_liquid_glass_theme");
      if (saved) {
        return { ...DEFAULT_THEME, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_THEME;
  });

  // Sync theme changes with Firestore on mount for multi-device sync
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "appSettings", "liquid_glass_theme"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            setTheme((prev) => {
              const updated: LiquidGlassThemeConfig = {
                ...prev,
                palette: (data.palette as LiquidGlassPalette) || prev.palette,
                blurIntensity: data.blurIntensity || prev.blurIntensity,
                ambientGlow: data.ambientGlow !== undefined ? data.ambientGlow : prev.ambientGlow,
                isDarkGlass: data.isDarkGlass !== undefined ? data.isDarkGlass : prev.isDarkGlass,
                customPrimaryColor: data.customPrimaryColor || prev.customPrimaryColor,
                customBgTone: data.customBgTone || prev.customBgTone,
                logoUrl: data.logoUrl !== undefined ? data.logoUrl : prev.logoUrl,
                logoText: data.logoText !== undefined ? data.logoText : prev.logoText,
              };
              try {
                localStorage.setItem("pasaya_liquid_glass_theme", JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }
      },
      (err) => {
        console.warn("Theme sync onSnapshot error:", err);
      }
    );
    return () => unsub();
  }, []);

  // Update CSS custom properties on document root for dynamic color themes
  useEffect(() => {
    const root = document.documentElement;
    let p = PALETTES[theme.palette] || PALETTES["ios-liquid-azure"];

    if (theme.palette === "custom" && theme.customPrimaryColor) {
      p = {
        ...p,
        accent: theme.customPrimaryColor,
        accentHover: theme.customPrimaryColor,
        accentLight: `${theme.customPrimaryColor}1f`,
        accentRing: `${theme.customPrimaryColor}55`,
        glowColor: `${theme.customPrimaryColor}40`,
      };
    }

    root.style.setProperty("--liquid-accent", p.accent);
    root.style.setProperty("--liquid-accent-hover", p.accentHover);
    root.style.setProperty("--liquid-accent-light", p.accentLight);
    root.style.setProperty("--liquid-accent-ring", p.accentRing);
    root.style.setProperty("--liquid-glow", p.glowColor);

    if (theme.isDarkGlass) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      localStorage.setItem("pasaya_liquid_glass_theme", JSON.stringify(theme));
    } catch {}
  }, [theme]);

  let paletteDef = PALETTES[theme.palette] || PALETTES["ios-liquid-azure"];
  if (theme.palette === "custom" && theme.customPrimaryColor) {
    paletteDef = {
      ...paletteDef,
      accent: theme.customPrimaryColor,
      accentHover: theme.customPrimaryColor,
      accentLight: `${theme.customPrimaryColor}1f`,
      accentRing: `${theme.customPrimaryColor}55`,
      glowColor: `${theme.customPrimaryColor}40`,
    };
  }

  const setPalette = (palette: LiquidGlassPalette) => {
    setTheme((prev) => ({ ...prev, palette }));
  };

  const setBlurIntensity = (blurIntensity: "subtle" | "medium" | "deep" | "ultra") => {
    setTheme((prev) => ({ ...prev, blurIntensity }));
  };

  const setFluidMotion = (fluidMotion: boolean) => {
    setTheme((prev) => ({ ...prev, fluidMotion }));
  };

  const setAmbientGlow = (ambientGlow: boolean) => {
    setTheme((prev) => ({ ...prev, ambientGlow }));
  };

  const setIsDarkGlass = (isDarkGlass: boolean) => {
    setTheme((prev) => ({ ...prev, isDarkGlass }));
  };

  const setCustomPrimaryColor = (color: string) => {
    setTheme((prev) => ({ ...prev, customPrimaryColor: color, palette: "custom" }));
  };

  const setLogoUrl = (url: string | undefined) => {
    setTheme((prev) => ({ ...prev, logoUrl: url }));
  };

  const setLogoText = (text: string) => {
    setTheme((prev) => ({ ...prev, logoText: text }));
  };

  const saveThemeToCloud = async (newTheme: LiquidGlassThemeConfig, adminName: string) => {
    setTheme(newTheme);
    try {
      await setDoc(doc(db, "appSettings", "liquid_glass_theme"), {
        id: "liquid_glass_theme",
        palette: newTheme.palette,
        blurIntensity: newTheme.blurIntensity,
        ambientGlow: newTheme.ambientGlow,
        isDarkGlass: newTheme.isDarkGlass,
        customPrimaryColor: newTheme.customPrimaryColor || null,
        customBgTone: newTheme.customBgTone || null,
        logoUrl: newTheme.logoUrl || null,
        logoText: newTheme.logoText || "PASAYA Accessories",
        updatedAt: new Date().toISOString(),
        updatedBy: adminName,
      });
      localStorage.setItem("pasaya_liquid_glass_theme", JSON.stringify(newTheme));
    } catch (err) {
      console.error("Error saving theme to cloud:", err);
      throw err;
    }
  };

  const resetToDefault = () => {
    setTheme(DEFAULT_THEME);
    try {
      localStorage.setItem("pasaya_liquid_glass_theme", JSON.stringify(DEFAULT_THEME));
    } catch {}
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        paletteDef,
        setPalette,
        setBlurIntensity,
        setFluidMotion,
        setAmbientGlow,
        setIsDarkGlass,
        setCustomPrimaryColor,
        setLogoUrl,
        setLogoText,
        saveThemeToCloud,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
