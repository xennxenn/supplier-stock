import React, { useState, useRef } from "react";
import {
  Sparkles,
  Palette,
  Check,
  RotateCcw,
  Cloud,
  Layers,
  Sliders,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Lock,
  Eye,
  Pipette,
  SunMedium,
  ShieldCheck,
} from "lucide-react";
import { useTheme, PALETTES } from "../context/ThemeContext";
import type { LiquidGlassPalette, Employee } from "../types";

interface ThemeSettingsViewProps {
  currentUser: Employee;
}

const COLOR_PRESETS = [
  { name: "Electric Cyan", hex: "#0284c7" },
  { name: "PASAYA Gold", hex: "#d97706" },
  { name: "Emerald Jade", hex: "#059669" },
  { name: "Amethyst Violet", hex: "#7c3aed" },
  { name: "Ruby Rose", hex: "#e11d48" },
  { name: "Royal Indigo", hex: "#4f46e5" },
  { name: "Teal Cyan", hex: "#0d9488" },
  { name: "Titanium Slate", hex: "#334155" },
  { name: "Amber Flame", hex: "#ea580c" },
];

export const ThemeSettingsView: React.FC<ThemeSettingsViewProps> = ({ currentUser }) => {
  const {
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
  } = useTheme();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customColorInput, setCustomColorInput] = useState(theme.customPrimaryColor || "#0284c7");
  const [logoTextInput, setLocalLogoText] = useState(theme.logoText || "PASAYA Accessories");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Strictly enforce Admin check
  if (currentUser.role !== "admin") {
    return (
      <div className="liquid-glass rounded-3xl p-12 text-center max-w-lg mx-auto shadow-xl border border-white/60">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">
          สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin Only)
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          การตั้งค่าโทนสีและโลโก้ของระบบนี้สามารถปรับเปลี่ยนและบันทึกซิงค์คลาวด์ได้เฉพาะผู้ใช้งานระดับ Admin เท่านั้น เพื่อรักษามาตรฐานภาพลักษณ์ขององค์กร
        </p>
      </div>
    );
  }

  // Handle Logo File Upload (PNG/JPG/WebP/SVG -> base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("ขนาดไฟล์ภาพต้องไม่เกิน 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomColorInput(hex);
    setCustomPrimaryColor(hex);
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedTheme = {
        ...theme,
        customPrimaryColor: customColorInput,
        logoText: logoTextInput,
      };
      await saveThemeToCloud(updatedTheme, currentUser.name);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกธีมไปยัง Cloud");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-sm border border-white/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  ตั้งค่าโทนสี สีของเว็บ & โลโก้แบรนด์ (Admin Only)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs">
                  เฉพาะแอดมิน
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ปรับแต่งธีม Liquid Glass iOS 27, อัปโหลดโลโก้บริษัท และกำหนดโทนสีหลักของเว็บไซต์ให้ซิงค์ตรงกันทุกเครื่อง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>รีเซ็ตค่าเริ่มต้น</span>
            </button>

            <button
              onClick={handleSaveToCloud}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Cloud className="w-4 h-4 text-sky-400" />
              <span>{isSaving ? "กำลังบันทึก..." : "บันทึกซิงค์คลาวด์ทุกเครื่อง"}</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              บันทึกการตั้งค่าโทนสีและโลโก้ไปยังระบบคลาวด์สำเร็จ! ผู้ใช้งานทุกคนจะเห็นการเปลี่ยนแปลงนี้แบบ Realtime
            </span>
          </div>
        )}
      </div>

      {/* 1. Logo & Brand Icon Upload */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-sm border border-white/60">
        <div className="flex items-center gap-2.5 mb-2">
          <ImageIcon className="w-5 h-5 text-sky-600" />
          <h2 className="font-bold text-slate-900 text-base">
            1. อัปโหลดโลโก้หรือไอคอนแบรนด์ (Logo & Icon Upload)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          อัปโหลดโลโก้บริษัทเพื่อแสดงในส่วนหัวเว็บ (Navbar), หน้าเข้าสู่ระบบ, และในแบบฟอร์มใบสั่งซื้อ (PO Form)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Upload Area */}
          <div className="bg-white/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                ไฟล์รูปภาพโลโก้ (PNG, JPG, SVG, WebP):
              </span>
              {theme.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบโลโก้</span>
                </button>
              )}
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-sky-50/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-800">
                คลิกเพื่อเลือกไฟล์รูปภาพโลโก้
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                แนะนำรูปภาพแบบโปร่งใส (Transparent PNG หรือ SVG) ขนาดไม่เกิน 2MB
              </p>
            </div>

            {/* Custom Brand Text */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-800">
                ชื่อแบรนด์หรือองค์กร (Brand Title Text):
              </label>
              <input
                type="text"
                value={logoTextInput}
                onChange={(e) => {
                  setLocalLogoText(e.target.value);
                  setLogoText(e.target.value);
                }}
                placeholder="เช่น PASAYA Accessories"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="bg-white/80 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Eye className="w-4 h-4 text-sky-600" />
              <span>ตัวอย่างการแสดงผลบน Header & ฟอร์มพิมพ์:</span>
            </div>

            <div className="p-4 rounded-2xl liquid-glass border border-white/90 shadow-sm flex items-center gap-3">
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt="Custom Brand Logo"
                  className="w-12 h-12 object-contain rounded-xl border border-white/80 p-1 bg-white/60 shadow-2xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl liquid-glass-card flex items-center justify-center font-black text-sky-700 text-2xl shadow-xs border border-white/80">
                  A
                </div>
              )}
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {logoTextInput || "Accessories Stock"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  ระบบจัดการสต็อก วัตถุดิบ และใบสั่งซื้อ · PASAYA
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
              💡 โลโก้นี้จะถูกนำไปใช้อัตโนมัติใน:
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600">
                <li>แถบนำทางหลัก (Top Navbar) ทุกหน้า</li>
                <li>หน้าเข้าสู่ระบบพนักงาน (Login Screen)</li>
                <li>แบบฟอร์มเอกสารใบสั่งซื้ออย่างเป็นทางการ (Printable PO Form)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Custom Color Picker & Presets */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-sm border border-white/60">
        <div className="flex items-center gap-2.5 mb-2">
          <Palette className="w-5 h-5 text-sky-600" />
          <h2 className="font-bold text-slate-900 text-base">
            2. ตั้งค่าโทนสีและสีของเว็บ (Web Theme & Color Customizer)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          เลือกชุดสีที่ตั้งไว้ หรือระบุรหัสสีหลัก (Primary Accent Hex Color) ตามแบรนด์ของคุณ
        </p>

        {/* Custom Color Selector */}
        <div className="bg-white/80 p-5 rounded-2xl border border-slate-200 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-800 block flex items-center gap-1.5">
                <Pipette className="w-4 h-4 text-sky-600" />
                <span>ระบุรหัสสีหลักเอง (Custom Color Hex):</span>
              </span>
              <span className="text-[11px] text-slate-500">
                สีนี้จะถูกใช้เป็นสีปุ่มหลัก การไฮไลต์แท็บ แสงสะท้อน และกราฟทั่วทั้งเว็บไซต์
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customColorInput}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white shadow-sm"
              />
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                placeholder="#0284c7"
                className="w-28 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Quick Swatches */}
          <div className="pt-3 border-t border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-600 block mb-2">
              หรือเลือกสีสำเร็จรูปยอดนิยม:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => handleCustomColorChange(c.hex)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    customColorInput.toLowerCase() === c.hex.toLowerCase()
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/80 shadow-2xs"
                    style={{ background: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Liquid Glass Preset Palettes */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-800 block">
            ชุดสี Liquid Glass ของ iOS 27 (Preset Palettes):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(PALETTES) as LiquidGlassPalette[]).map((key) => {
              const p = PALETTES[key];
              const isSelected = theme.palette === key;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setPalette(key);
                    if (p.accent) setCustomColorInput(p.accent);
                  }}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "bg-white/95 border-sky-500 shadow-md ring-2 ring-sky-500/20"
                      : "bg-white/70 hover:bg-white/90 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-xl shadow-xs border border-white flex items-center justify-center text-white"
                        style={{ background: p.accent }}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.nameEn}</div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`h-2.5 w-full rounded-full ${p.previewClass} opacity-90 group-hover:opacity-100 transition-opacity`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Glass Materials & Atmosphere */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-sm border border-white/60">
        <div className="flex items-center gap-2.5 mb-2">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-slate-900 text-base">
            3. ปรับแต่งเอฟเฟกต์กระจกและแสงแอมเบียนต์ (Glass Materials & Atmosphere)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          ความเบลอของฉากหลัง ความลื่นไหลของแอนิเมชัน และการเรืองแสง
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blur Intensity */}
          <div className="bg-white/80 p-4 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>ระดับความเบลอของกระจก (Glass Blur Level):</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: "subtle", label: "บางเบา" },
                  { id: "medium", label: "ปานกลาง" },
                  { id: "deep", label: "คมชัด" },
                  { id: "ultra", label: "iOS 27 Ultra" },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setBlurIntensity(lvl.id)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    theme.blurIntensity === lvl.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liquid Motion & Ambient Glow */}
          <div className="bg-white/80 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  แสงสะท้อนแอมเบียนต์ (Ambient Fluid Glow)
                </span>
                <span className="text-[11px] text-slate-500">
                  แสดงแสงเรืองรองนุ่มนวลด้านหลังกระจกตามโทนสีที่เลือก
                </span>
              </div>
              <button
                onClick={() => setAmbientGlow(!theme.ambientGlow)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  theme.ambientGlow ? "bg-sky-600" : "bg-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    theme.ambientGlow ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  ความลื่นไหลแบบสมูท (Smooth Liquid Transitions)
                </span>
                <span className="text-[11px] text-slate-500">
                  เพิ่มความนุ่มนวลของแอนิเมชันปุ่มและเมนูแบบ iOS
                </span>
              </div>
              <button
                onClick={() => setFluidMotion(!theme.fluidMotion)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  theme.fluidMotion ? "bg-sky-600" : "bg-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    theme.fluidMotion ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
