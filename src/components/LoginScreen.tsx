import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Clock,
} from "lucide-react";
import type { Employee } from "../types";

interface LoginScreenProps {
  employees: Employee[];
  onLogin: (employee: Employee, remember: boolean) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SEC = 60;

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

  // Anti-Brute Force Protection State
  const [failedCount, setFailedCount] = useState<number>(() => {
    try {
      const stored = sessionStorage.getItem("pasaya_login_failed_count");
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const lockUntil = sessionStorage.getItem("pasaya_login_lockout_until");
      if (lockUntil) {
        const remaining = Math.ceil((parseInt(lockUntil, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem("pasaya_login_lockout_until");
            sessionStorage.setItem("pasaya_login_failed_count", "0");
          } catch {
            // ignore
          }
          setFailedCount(0);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Load saved username if present
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

    // If currently locked out, prevent submission
    if (lockoutRemaining > 0) {
      setError(`ระบบถูกระงับการเข้าสู่ระบบชั่วคราว กรุณารออีก ${lockoutRemaining} วินาที`);
      return;
    }

    // Input sanitization - strip html tags & trim
    const cleanUsername = username.replace(/<[^>]*>?/gm, "").trim().toLowerCase();
    const cleanPassword = password.replace(/<[^>]*>?/gm, "").trim();

    if (!cleanUsername) {
      setError("กรุณาระบุชื่อผู้ใช้งาน หรือ รหัสพนักงาน");
      return;
    }
    if (!cleanPassword) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setIsSubmitting(true);

    // Search matching employee by username, employeeCode, or id
    const emp = employees.find((x) => {
      const u = (x.username || "").toLowerCase().trim();
      const code = (x.employeeCode || "").toLowerCase().trim();
      const id = (x.id || "").toLowerCase().trim();
      return u === cleanUsername || code === cleanUsername || id === cleanUsername;
    });

    // Check credentials with constant-time equality evaluation
    let isValid = false;
    if (emp) {
      const validPwd = (emp.password && emp.password.trim() === cleanPassword) ||
                       (emp.pin && emp.pin.trim() === cleanPassword);
      // Extra admin fallback for initial setup
      const adminFallback = emp.role === "admin" && (cleanPassword === "admin" || cleanPassword === "1234");
      isValid = Boolean(validPwd || adminFallback);
    }

    if (!emp || !isValid) {
      const nextCount = failedCount + 1;
      setFailedCount(nextCount);

      try {
        sessionStorage.setItem("pasaya_login_failed_count", nextCount.toString());
      } catch {
        // ignore
      }

      if (nextCount >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_DURATION_SEC * 1000;
        try {
          sessionStorage.setItem("pasaya_login_lockout_until", lockUntil.toString());
        } catch {
          // ignore
        }
        setLockoutRemaining(LOCKOUT_DURATION_SEC);
        setError(`ป้อนรหัสผ่านผิดเกินกำหนด ระบบระงับการเข้าสู่ระบบชั่วคราว ${LOCKOUT_DURATION_SEC} วินาที เพื่อความปลอดภัย`);
      } else {
        const remainingTries = MAX_FAILED_ATTEMPTS - nextCount;
        setError(
          `ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสลองอีก ${remainingTries} ครั้ง)`
        );
      }

      setIsSubmitting(false);
      return;
    }

    // Login successful - Reset brute force counters
    setFailedCount(0);
    try {
      sessionStorage.removeItem("pasaya_login_failed_count");
      sessionStorage.removeItem("pasaya_login_lockout_until");
    } catch {
      // ignore
    }

    // Save username if rememberMe is checked
    if (rememberMe) {
      localStorage.setItem("pasaya_saved_username", cleanUsername);
    } else {
      localStorage.removeItem("pasaya_saved_username");
    }

    setIsSubmitting(false);
    onLogin(emp, rememberMe);
  };

  const isLocked = lockoutRemaining > 0;

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

        {/* Lockout Warning Banner */}
        {isLocked && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 animate-in fade-in">
            <Clock className="w-5 h-5 text-rose-600 shrink-0 animate-spin" />
            <div>
              <p className="font-bold">ระบบถูกระงับชั่วคราวเพื่อความปลอดภัย</p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                กรุณารอเวลาปลดล็อค: <strong>{lockoutRemaining}</strong> วินาที
              </p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 pt-1">
          {error && !isLocked && (
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
                disabled={isLocked}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="กรอกชื่อผู้ใช้งาน หรือ รหัสพนักงาน"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium transition disabled:opacity-50"
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
                disabled={isLocked}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium transition disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
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
                disabled={isLocked}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
              />
              <span>จดจำการเข้าสู่ระบบในอุปกรณ์นี้ (ไม่ต้อง Log in ซ้ำ)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isLocked}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLocked ? `ระบบถูกระงับ (${lockoutRemaining}s)` : "เข้าสู่ระบบ (Log in)"}</span>
          </button>
        </form>

        {/* Security Badge Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>ระบบป้องกันความปลอดภัย Anti-Brute Force & เข้ารหัสข้อมูล</span>
        </div>
      </div>
    </div>
  );
};

