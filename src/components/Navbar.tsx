import React from "react";
import {
  LayoutDashboard,
  Package,
  ArrowDownUp,
  FileSpreadsheet,
  AlertTriangle,
  BarChart3,
  Users,
  Database,
  RefreshCw,
  CheckCircle2,
  Lock,
  LogOut,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import type { Employee, NavTab } from "../types";
import { canAccessTab } from "../utils/permissionUtils";

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentUser: Employee;
  onLogout: () => void;
  isSyncing: boolean;
  onSync: () => void;
  lastSyncedAt: string | null;
  totalStock: number;
  totalTxs: number;
  lowStockCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  isSyncing,
  onSync,
  lastSyncedAt,
  totalStock,
  lowStockCount,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    highlight?: boolean;
  }> = [
    { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    {
      id: "stock",
      label: "รายการสต็อก (Stock)",
      icon: Package,
      badge: totalStock > 0 ? totalStock : undefined,
    },
    {
      id: "transactions",
      label: "รายการเบิกจ่าย",
      icon: FileSpreadsheet,
    },
    {
      id: "movement",
      label: "บันทึกรับ-จ่าย",
      icon: ArrowDownUp,
    },
    {
      id: "alerts",
      label: "เตือนสั่งซื้อ",
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: "forecast",
      label: "พยากรณ์สั่งซื้อ (Forecast)",
      icon: TrendingUp,
      highlight: true,
    },
    { id: "reports", label: "รายงาน & สถิติ", icon: BarChart3 },
    {
      id: "employees",
      label: "พนักงาน & สิทธิ์",
      icon: Users,
    },
    {
      id: "backup",
      label: "ชีท & สำรองข้อมูล",
      icon: Database,
    },
  ];

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "ยังไม่ได้ซิงค์";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200/90 shadow-xs sticky top-0 z-40">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-xs tracking-wider">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Accessories Stock
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Google Sheets Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                ระบบจัดการสต็อก & รายการเบิกจ่ายสินค้า
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sync Button */}
            <button
              id="sync-sheets-btn"
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition disabled:opacity-60 cursor-pointer"
              title="ดึงข้อมูลล่าสุดจาก Google Sheets"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-600 ${
                  isSyncing ? "animate-spin" : ""
                }`}
              />
              <span>{isSyncing ? "กำลังซิงค์..." : "ซิงค์ชีท"}</span>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                ({formatLastSync(lastSyncedAt)})
              </span>
            </button>

            {/* Direct Google Sheets Link (Only for Admin) */}
            {currentUser.role === "admin" && (
              <a
                href="https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=380033643&single=true&output=csv"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition"
                title="ดูข้อมูลดิบ Google Sheets (เฉพาะแอดมิน)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>เปิดชีทต้นฉบับ</span>
              </a>
            )}

            {/* Current user & logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-amber-700 font-semibold">
                  {currentUser.role === "admin"
                    ? "ผู้ดูแลระบบ (Admin)"
                    : currentUser.role === "manager"
                    ? "หัวหน้างาน (Manager)"
                    : "พนักงาน (Staff)"}
                </div>
              </div>
              <button
                id="logout-btn"
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex space-x-1.5 overflow-x-auto py-2.5 scrollbar-none">
          {navItems.map((item) => {
            const hasPerm = canAccessTab(currentUser, item.id);
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => {
                  if (hasPerm) setActiveTab(item.id);
                }}
                disabled={!hasPerm}
                className={`relative inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : hasPerm
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : "text-slate-300 cursor-not-allowed opacity-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-500"}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-slate-950 text-amber-300"
                        : item.id === "alerts"
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {item.badge.toLocaleString()}
                  </span>
                )}
                {!hasPerm && <Lock className="w-3 h-3 text-slate-400 ml-1" />}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
