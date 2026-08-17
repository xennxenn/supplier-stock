import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  Building2,
  TrendingDown,
  Printer,
  PieChart as PieIcon,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { StockItem, Transaction, SheetsSyncData } from "../types";
import { exportToExcel, exportToCSV } from "../utils/exportUtils";

interface ReportsViewProps {
  data: SheetsSyncData | null;
  items: StockItem[];
  transactions: Transaction[];
}

const COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  data,
  items,
  transactions,
}) => {
  const [reportTab, setReportTab] = useState<"monthly" | "lines" | "suppliers">("monthly");

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const map = new Map<
      string,
      {
        monthLabel: string;
        inQty: number;
        outQty: number;
        totalCost: number;
        txCount: number;
      }
    >();

    for (const t of transactions) {
      if (t.year && t.month) {
        const key = `${t.year}-${String(t.month).padStart(2, "0")}`;
        const cur = map.get(key) || {
          monthLabel: key,
          inQty: 0,
          outQty: 0,
          totalCost: 0,
          txCount: 0,
        };
        cur.inQty += t.qtyIn || 0;
        cur.outQty += t.qtyOut || 0;
        cur.totalCost += t.totalCost || 0;
        cur.txCount += 1;
        map.set(key, cur);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.monthLabel.localeCompare(b.monthLabel))
      .slice(-12);
  }, [transactions]);

  // Line stats
  const lineStats = useMemo(() => {
    const map = new Map<
      string,
      {
        line: string;
        itemCount: number;
        totalValue: number;
        totalOutQty: number;
        totalOutCost: number;
      }
    >();

    for (const item of items) {
      const l = item.line || "ไม่ระบุ";
      const cur = map.get(l) || {
        line: l,
        itemCount: 0,
        totalValue: 0,
        totalOutQty: 0,
        totalOutCost: 0,
      };
      cur.itemCount += 1;
      cur.totalValue += (item.currentBalance || 0) * (item.unitCost || 0);
      map.set(l, cur);
    }

    for (const t of transactions) {
      const l = t.line || "ไม่ระบุ";
      const cur = map.get(l) || {
        line: l,
        itemCount: 0,
        totalValue: 0,
        totalOutQty: 0,
        totalOutCost: 0,
      };
      cur.totalOutQty += t.qtyOut || 0;
      cur.totalOutCost += t.totalCost || 0;
      map.set(l, cur);
    }

    return Array.from(map.values()).sort((a, b) => b.totalOutCost - a.totalOutCost);
  }, [items, transactions]);

  // Supplier stats
  const supplierStats = useMemo(() => {
    const map = new Map<
      string,
      { supplier: string; itemCount: number; totalValue: number }
    >();

    for (const it of items) {
      const s = it.supplier || "ไม่ระบุ Supplier";
      const cur = map.get(s) || { supplier: s, itemCount: 0, totalValue: 0 };
      cur.itemCount += 1;
      cur.totalValue += (it.currentBalance || 0) * (it.unitCost || 0);
      map.set(s, cur);
    }

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (reportTab === "monthly") {
      const headers = ["เดือน/ปี", "จำนวนรายการ (Transactions)", "รับเข้า (หน่วย)", "จ่ายออก (หน่วย)", "ค่าใช้จ่ายรวม (บาท)"];
      const rows = monthlyStats.map((m) => [m.monthLabel, m.txCount, m.inQty, m.outQty, parseFloat(m.totalCost.toFixed(2))]);
      exportToCSV("REPORT_MONTHLY_TREND", headers, rows);
    } else if (reportTab === "lines") {
      const headers = ["ไลน์การผลิต (Line)", "จำนวน SKU ในไลน์", "มูลค่าสต็อกปัจจุบัน (บาท)", "จำนวนชิ้นที่เบิกจ่าย (ชิ้น)", "ค่าใช้จ่ายรวม (บาท)"];
      const rows = lineStats.map((l) => [l.line, l.itemCount, parseFloat(l.totalValue.toFixed(2)), l.totalOutQty, parseFloat(l.totalOutCost.toFixed(2))]);
      exportToCSV("REPORT_BY_PRODUCTION_LINE", headers, rows);
    } else {
      const headers = ["ผู้จัดจำหน่าย (Supplier)", "จำนวน SKU ที่สั่งซื้อ", "มูลค่าสต็อกปัจจุบัน (บาท)"];
      const rows = supplierStats.map((s) => [s.supplier, s.itemCount, parseFloat(s.totalValue.toFixed(2))]);
      exportToCSV("REPORT_BY_SUPPLIER", headers, rows);
    }
  };

  const handleExportExcel = () => {
    if (reportTab === "monthly") {
      const headers = ["เดือน/ปี", "จำนวนรายการ (Transactions)", "รับเข้า (หน่วย)", "จ่ายออก (หน่วย)", "ค่าใช้จ่ายรวม (บาท)"];
      const rows = monthlyStats.map((m) => [m.monthLabel, m.txCount, m.inQty, m.outQty, parseFloat(m.totalCost.toFixed(2))]);
      exportToExcel("REPORT_MONTHLY_TREND", "MonthlyReport", headers, rows);
    } else if (reportTab === "lines") {
      const headers = ["ไลน์การผลิต (Line)", "จำนวน SKU ในไลน์", "มูลค่าสต็อกปัจจุบัน (บาท)", "จำนวนชิ้นที่เบิกจ่าย (ชิ้น)", "ค่าใช้จ่ายรวม (บาท)"];
      const rows = lineStats.map((l) => [l.line, l.itemCount, parseFloat(l.totalValue.toFixed(2)), l.totalOutQty, parseFloat(l.totalOutCost.toFixed(2))]);
      exportToExcel("REPORT_BY_PRODUCTION_LINE", "LineReport", headers, rows);
    } else {
      const headers = ["ผู้จัดจำหน่าย (Supplier)", "จำนวน SKU ที่สั่งซื้อ", "มูลค่าสต็อกปัจจุบัน (บาท)"];
      const rows = supplierStats.map((s) => [s.supplier, s.itemCount, parseFloat(s.totalValue.toFixed(2))]);
      exportToExcel("REPORT_BY_SUPPLIER", "SupplierReport", headers, rows);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            รายงานและสถิติการใช้งานคลังสินค้า (Stock Reports & Analytics)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            สรุปข้อมูลค่าใช้จ่าย ปริมาณการเบิกจ่ายตามสายการผลิต และมูลค่าคลังสินค้า
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
            title="ส่งออกรายงานเป็น Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออก Excel</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition cursor-pointer"
            title="ส่งออกรายงานเป็น CSV (.csv)"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setReportTab("monthly")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportTab === "monthly"
              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          สรุปรายเดือน (Monthly Trend)
        </button>
        <button
          onClick={() => setReportTab("lines")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportTab === "lines"
              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ตามไลน์การผลิต (By Line)
        </button>
        <button
          onClick={() => setReportTab("suppliers")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportTab === "suppliers"
              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ตามผู้จัดจำหน่าย (Suppliers)
        </button>
      </div>

      {/* Monthly Report Tab */}
      {reportTab === "monthly" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              กราฟค่าใช้จ่ายการเบิกจ่ายรายเดือน (Monthly Expense ฿)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyStats}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [
                      "฿" + Number(val).toLocaleString(),
                      "ค่าใช้จ่ายรวม",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalCost"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-slate-700">เดือน/ปี</th>
                  <th className="p-3 text-right text-slate-700">จำนวนรายการ (Transactions)</th>
                  <th className="p-3 text-right text-emerald-700">รับเข้า (Inflow)</th>
                  <th className="p-3 text-right text-amber-700">จ่ายออก (Outflow)</th>
                  <th className="p-3 text-right text-slate-700">ค่าใช้จ่ายรวม (Total Cost)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyStats.map((m) => (
                  <tr key={m.monthLabel} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-800">
                      {m.monthLabel}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {m.txCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      +{m.inQty.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      -{m.outQty.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ฿{m.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Line Report Tab */}
      {reportTab === "lines" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              สัดส่วนค่าใช้จ่ายตามไลน์การผลิต
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineStats.slice(0, 10)}>
                  <XAxis dataKey="line" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [
                      "฿" + Number(val).toLocaleString(),
                      "ค่าใช้จ่าย",
                    ]}
                  />
                  <Bar dataKey="totalOutCost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-slate-700">ไลน์การผลิต (Line)</th>
                  <th className="p-3 text-right text-slate-700">จำนวน SKU ในไลน์</th>
                  <th className="p-3 text-right text-slate-700">มูลค่าสต็อกปัจจุบัน</th>
                  <th className="p-3 text-right text-slate-700">จำนวนชิ้นที่เบิกจ่าย</th>
                  <th className="p-3 text-right text-amber-700">ค่าใช้จ่ายรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineStats.map((l) => (
                  <tr key={l.line} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{l.line}</td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {l.itemCount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-700">
                      ฿{l.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-800">
                      {l.totalOutQty.toLocaleString()} ชิ้น
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ฿{l.totalOutCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Report Tab */}
      {reportTab === "suppliers" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-slate-700">ผู้จัดจำหน่าย (Supplier)</th>
                  <th className="p-3 text-right text-slate-700">จำนวน SKU ที่สั่งซื้อ</th>
                  <th className="p-3 text-right text-emerald-700">มูลค่าสต็อกปัจจุบัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierStats.map((s) => (
                  <tr key={s.supplier} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{s.supplier}</td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {s.itemCount.toLocaleString()} SKU
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      ฿{s.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
