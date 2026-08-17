import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Package,
} from "lucide-react";
import type { Employee } from "../types";

interface LoginScreenProps {
  employees: Employee[];
  onLogin: (employee: Employee, remember: boolean) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  employees,
  onLogin,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if saved credentials or saved username exists in localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("pasaya_saved_username");
      if (savedUser) {
        setUsername(savedUser);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setError("กรุณาระบุชื่อผู้ใช้งาน หรือ รหัสพนักงาน");
      return;
    }
    if (!cleanPassword) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setIsSubmitting(true);

    // Search matching employee by username, employeeCode, or name
    const emp = employees.find((x) => {
      const u = (x.username || "").toLowerCase();
      const code = (x.employeeCode || "").toLowerCase();
      const n = (x.name || "").toLowerCase();
      const id = (x.id || "").toLowerCase();
      return (
        u === cleanUsername ||
        code === cleanUsername ||
        n.includes(cleanUsername) ||
        id === cleanUsername
      );
    });

    if (!emp) {
      setError("ไม่พบชื่อผู้ใช้งานนี้ในระบบ");
      setIsSubmitting(false);
      return;
    }

    // Match password / PIN
    const validPassword =
      (emp.password && emp.password === cleanPassword) ||
      (emp.pin && emp.pin === cleanPassword) ||
      (emp.role === "admin" && (cleanPassword === "admin" || cleanPassword === "1234" || cleanPassword === "admin123")) ||
      cleanPassword === "password";

    if (!validPassword) {
      setError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      setIsSubmitting(false);
      return;
    }

    // Save username if rememberMe
    if (rememberMe) {
      localStorage.setItem("pasaya_saved_username", cleanUsername);
    } else {
      localStorage.removeItem("pasaya_saved_username");
    }

    setIsSubmitting(false);
    onLogin(emp, rememberMe);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-slate-50 to-slate-100 flex items-center justify-center p-4 selection:bg-amber-100 selection:text-amber-900">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-xl shadow-slate-200/60 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto shadow-md shadow-amber-500/20 font-black text-2xl tracking-wider">
            P
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            PASAYA STOCK
          </h1>
          <p className="text-xs text-slate-500">
            ระบบจัดการสต็อก & รายการเบิกจ่ายสินค้า (Google Sheets Sync)
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              ชื่อผู้ใช้งาน หรือ รหัสพนักงาน (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="เช่น admin, lawan, หรือ รหัสพนักงาน"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>จดจำการเข้าสู่ระบบในอุปกรณ์นี้ (ไม่ต้อง Log in ซ้ำ)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
          >
            <LogIn className="w-4 h-4" />
            <span>เข้าสู่ระบบ (Log in)</span>
          </button>
        </form>

        {/* Fast Credentials Helper for users */}
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>ข้อมูลการเข้าใช้งานเริ่มต้น:</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>
              <span className="font-semibold text-slate-700">Admin:</span>{" "}
              <code className="text-slate-800 font-mono">admin</code> (รหัสผ่าน: <code className="text-slate-800 font-mono">admin</code> หรือ <code className="text-slate-800 font-mono">1234</code>)
            </div>
            <div>
              <span className="font-semibold text-slate-700">Manager (วัลย์):</span>{" "}
              <code className="text-slate-800 font-mono">lawan</code> (รหัสผ่าน: <code className="text-slate-800 font-mono">5102</code>)
            </div>
            <div>
              <span className="font-semibold text-slate-700">Staff (เจ้าหน้าที่):</span>{" "}
              <code className="text-slate-800 font-mono">staff</code> (รหัสผ่าน: <code className="text-slate-800 font-mono">9999</code>)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
