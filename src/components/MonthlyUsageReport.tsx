import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  TrendingDown,
  Calendar,
  Layers,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  Package,
  Tag,
  Truck,
  Info,
  X,
} from "lucide-react";
import type { StockItem, Transaction } from "../types";
import { exportToCSV } from "../utils/exportUtils";

interface MonthlyUsageReportProps {
  items: StockItem[];
  transactions: Transaction[];
  lines: string[];
  categories?: string[];
  onSelectItem?: (item: StockItem) => void;
}

export const MonthlyUsageReport: React.FC<MonthlyUsageReportProps> = ({
  items,
  transactions,
  lines,
  categories,
  onSelectItem,
}) => {
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "low" | "out" | "ok" | "active" | "zero_usage"
  >("all");
  const [sortBy, setSortBy] = useState<
    "usage_desc" | "usage_asc" | "total_desc" | "balance_desc" | "balance_asc" | "barcode" | "name"
  >("usage_desc");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [monthsToShow, setMonthsToShow] = useState<6 | 12>(6);
  const [isExpanded, setIsExpanded] = useState(true);

  const INITIAL_BATCH = 60;
  const BATCH_INCREMENT = 60;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [showAllDirectly, setShowAllDirectly] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Extract unique categories and suppliers
  const uniqueCategories = useMemo(() => {
    if (categories && categories.length > 0) return categories;
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [items, categories]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.supplier) set.add(it.supplier);
    }
    return Array.from(set).sort();
  }, [items]);

  // Month names in Thai
  const THAI_MONTHS = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  // Extract all chronological unique month keys from transactions
  const monthKeyList = useMemo(() => {
    const keysMap = new Map<string, { year: number; month: number; label: string }>();

    transactions.forEach((t) => {
      if (t.year && t.month && t.qtyOut > 0) {
        const key = `${t.year}-${String(t.month).padStart(2, "0")}`;
        if (!keysMap.has(key)) {
          const thaiMonth = THAI_MONTHS[t.month - 1] || `ด.${t.month}`;
          const shortYear = (t.year + 543).toString().slice(-2);
          keysMap.set(key, {
            year: t.year,
            month: t.month,
            label: `${thaiMonth} ${shortYear}`,
          });
        }
      }
    });

    const sorted = Array.from(keysMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.slice(-monthsToShow);
  }, [transactions, monthsToShow]);

  // Aggregate monthly totals and per-item monthly consumption
  const { monthlyTotals, itemUsageMap } = useMemo(() => {
    // Totals for overall chart
    const totals: Record<string, { label: string; outQty: number; cost: number }> = {};
    monthKeyList.forEach(([key, meta]) => {
      totals[key] = { label: meta.label, outQty: 0, cost: 0 };
    });

    // Item-level map: barcode -> { [monthKey]: qtyOut, totalOut, avgMonthly }
    const itemMap = new Map<
      string,
      {
        monthly: Record<string, number>;
        totalOut: number;
        avgMonthly: number;
      }
    >();

    transactions.forEach((t) => {
      if (t.qtyOut > 0 && t.year && t.month) {
        const key = `${t.year}-${String(t.month).padStart(2, "0")}`;
        if (totals[key]) {
          totals[key].outQty += t.qtyOut;
          totals[key].cost += t.totalCost || t.qtyOut * (t.unitPrice || 0);
        }

        const b = t.barcode.trim().toLowerCase();
        if (!itemMap.has(b)) {
          itemMap.set(b, {
            monthly: {},
            totalOut: 0,
            avgMonthly: 0,
          });
        }
        const record = itemMap.get(b)!;
        record.monthly[key] = (record.monthly[key] || 0) + t.qtyOut;
        record.totalOut += t.qtyOut;
      }
    });

    const span = Math.max(1, monthKeyList.length);
    itemMap.forEach((rec) => {
      rec.avgMonthly = parseFloat((rec.totalOut / span).toFixed(1));
    });

    return {
      monthlyTotals: Object.entries(totals).map(([key, data]) => ({
        key,
        label: data.label,
        outQty: Math.round(data.outQty),
        cost: Math.round(data.cost),
      })),
      itemUsageMap: itemMap,
    };
  }, [transactions, monthKeyList]);

  // Filtered stock items to display in the table
  const tableRows = useMemo(() => {
    return items
      .filter((it) => {
        if (selectedLine !== "all" && it.line !== selectedLine) return false;
        if (selectedCategory !== "all" && it.category !== selectedCategory) return false;
        if (selectedSupplier !== "all" && it.supplier !== selectedSupplier) return false;

        if (deferredSearch.trim()) {
          const q = deferredSearch.toLowerCase();
          const matchName = it.name.toLowerCase().includes(q);
          const matchCode = it.barcode.toLowerCase().includes(q);
          const matchSup = (it.supplier || "").toLowerCase().includes(q);
          const matchLine = (it.line || "").toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchSup && !matchLine) return false;
        }

        const b = it.barcode.trim().toLowerCase();
        const usage = itemUsageMap.get(b) || { monthly: {}, totalOut: 0, avgMonthly: 0 };

        if (stockStatusFilter === "low") {
          if (it.currentBalance > it.minStock || it.currentBalance <= 0) return false;
        } else if (stockStatusFilter === "out") {
          if (it.currentBalance > 0) return false;
        } else if (stockStatusFilter === "ok") {
          if (it.currentBalance <= it.minStock) return false;
        } else if (stockStatusFilter === "active") {
          if (usage.avgMonthly <= 0) return false;
        } else if (stockStatusFilter === "zero_usage") {
          if (usage.avgMonthly > 0) return false;
        }

        return true;
      })
      .map((it) => {
        const b = it.barcode.trim().toLowerCase();
        const usage = itemUsageMap.get(b) || { monthly: {}, totalOut: 0, avgMonthly: 0 };
        const monthsLeft = usage.avgMonthly > 0 ? it.currentBalance / usage.avgMonthly : 999;
        return {
          item: it,
          usage,
          monthsLeft,
        };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "usage_asc":
            return a.usage.avgMonthly - b.usage.avgMonthly;
          case "total_desc":
            return b.usage.totalOut - a.usage.totalOut;
          case "balance_desc":
            return b.item.currentBalance - a.item.currentBalance;
          case "balance_asc":
            return a.item.currentBalance - b.item.currentBalance;
          case "barcode":
            return a.item.barcode.localeCompare(b.item.barcode);
          case "name":
            return a.item.name.localeCompare(b.item.name);
          case "usage_desc":
          default:
            return b.usage.avgMonthly - a.usage.avgMonthly;
        }
      });
  }, [
    items,
    selectedLine,
    selectedCategory,
    selectedSupplier,
    stockStatusFilter,
    sortBy,
    deferredSearch,
    itemUsageMap,
  ]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [
    deferredSearch,
    selectedLine,
    selectedCategory,
    selectedSupplier,
    stockStatusFilter,
    sortBy,
    monthsToShow,
  ]);

  // Displayed rows for continuous scrolling
  const displayedRows = useMemo(() => {
    if (showAllDirectly) return tableRows;
    return tableRows.slice(0, visibleCount);
  }, [tableRows, visibleCount, showAllDirectly]);

  // Automatic infinite continuous scroll when user scrolls down
  useEffect(() => {
    if (showAllDirectly || visibleCount >= tableRows.length) return;
    const el = sentinelRef.current;
    if (!el) return;

    let isFetching = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) {
          isFetching = true;
          setVisibleCount((prev) => Math.min(prev + BATCH_INCREMENT, tableRows.length));
          setTimeout(() => {
            isFetching = false;
          }, 120);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showAllDirectly, visibleCount, tableRows.length]);

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedLine !== "all" ||
    selectedCategory !== "all" ||
    selectedSupplier !== "all" ||
    stockStatusFilter !== "all" ||
    sortBy !== "usage_desc";

  const handleResetFilters = () => {
    setSearch("");
    setSelectedLine("all");
    setSelectedCategory("all");
    setSelectedSupplier("all");
    setStockStatusFilter("all");
    setSortBy("usage_desc");
  };

  const handleExportCSV = () => {
    const headers = [
      "บาร์โค้ด",
      "ชื่อรายการ",
      "ไลน์",
      "Supplier",
      "คงเหลือ",
      "Min Stock",
      ...monthKeyList.map(([, meta]) => `ยอดใช้ ${meta.label}`),
      "ยอดใช้รวม",
      "เฉลี่ยต่อเดือน",
      "พอใช้ (เดือน)",
    ];

    const rows = tableRows.map((r) => [
      r.item.barcode,
      r.item.name,
      r.item.line || "-",
      r.item.supplier || "-",
      r.item.currentBalance,
      r.item.minStock,
      ...monthKeyList.map(([key]) => r.usage.monthly[key] || 0),
      r.usage.totalOut,
      r.usage.avgMonthly,
      r.monthsLeft >= 999 ? "ไม่มีประวัติเบิก" : r.monthsLeft.toFixed(1),
    ]);

    exportToCSV(`รายงานยอดใช้แต่ละเดือน_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="liquid-glass rounded-3xl p-5 mb-6 shadow-sm border border-white/60">
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              รายงานยอดใช้และแนวโน้มการเบิกจ่ายแต่ละเดือน (Monthly Consumption Breakdown)
            </h3>
            <p className="text-xs text-slate-500">
              วิเคราะห์สถิติการใช้งานย้อนหลัง {monthsToShow} เดือน เพื่อประกอบการตัดสินใจสั่งซื้อวัตถุดิบ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-slate-100/80 rounded-xl p-1 text-xs">
            <button
              onClick={() => setMonthsToShow(6)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                monthsToShow === 6
                  ? "bg-white text-sky-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ย้อนหลัง 6 เดือน
            </button>
            <button
              onClick={() => setMonthsToShow(12)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                monthsToShow === 12
                  ? "bg-white text-sky-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ย้อนหลัง 12 เดือน
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors shadow-2xs"
            title="ส่งออก CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
            title={isExpanded ? "ย่อส่วนนี้" : "ขยายส่วนนี้"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-5 animate-in fade-in duration-300">
          {/* Top monthly usage chart */}
          {monthlyTotals.length > 0 ? (
            <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/70 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  กราฟรวมจำนวนและค่าใช้จ่ายการเบิกจ่ายรายเดือน
                </span>
                <span className="text-[11px] text-slate-500">หน่วย: จำนวนชิ้น (Qty)</span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTotals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === "outQty" ? `${Number(val).toLocaleString()} ชิ้น` : `฿${Number(val).toLocaleString()}`,
                        name === "outQty" ? "ยอดจ่ายออก" : "มูลค่ารวม (บาท)",
                      ]}
                      contentStyle={{
                        borderRadius: "1rem",
                        background: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="outQty" name="ยอดจ่ายออก (ชิ้น)" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              ยังไม่มีข้อมูลการเบิกจ่ายในรอบเดือนที่เลือก
            </div>
          )}

          {/* Filters for breakdown table */}
          <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาบาร์โค้ด, ชื่อรายการ, Supplier, ไลน์..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="ล้างข้อความค้นหา"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Line */}
              <div>
                <select
                  value={selectedLine}
                  onChange={(e) => setSelectedLine(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="all">ทุกลายน์ ({lines.length})</option>
                  {lines.map((l) => (
                    <option key={l} value={l}>
                      ไลน์: {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="all">ทุกหมวดหมู่ ({uniqueCategories.length})</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier */}
              <div>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="all">ทุก Supplier ({uniqueSuppliers.length})</option>
                  {uniqueSuppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Status & Activity */}
              <div>
                <select
                  value={stockStatusFilter}
                  onChange={(e: any) => setStockStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="all">สถานะ: ทั้งหมด</option>
                  <option value="active">มีการเบิกจ่ายในรอบ</option>
                  <option value="zero_usage">ไม่มีการเบิกใช้</option>
                  <option value="low">ต่ำกว่า Min Stock</option>
                  <option value="out">หมดสต็อก (0)</option>
                  <option value="ok">สต็อกปกติ</option>
                </select>
              </div>
            </div>

            {/* Bottom row of filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 flex items-center gap-1 font-medium text-[11px]">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  เรียงตาม:
                </span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
                >
                  <option value="usage_desc">ยอดใช้เฉลี่ยสูงสุด</option>
                  <option value="usage_asc">ยอดใช้เฉลี่ยน้อยสุด</option>
                  <option value="total_desc">ยอดเบิกรวมสูงสุด</option>
                  <option value="balance_desc">สต็อกคงเหลือมากสุด</option>
                  <option value="balance_asc">สต็อกคงเหลือน้อยสุด</option>
                  <option value="barcode">รหัสบาร์โค้ด</option>
                  <option value="name">ชื่อสินค้า (ก-ฮ / A-Z)</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-700 hover:bg-slate-300 transition text-[11px] font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    ล้างตัวกรอง
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg">
                  💡 ดับเบิ้ลคลิกแถวเพื่อดูรายละเอียดสินค้า
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  แสดง {tableRows.length.toLocaleString()} รายการ
                </span>
              </div>
            </div>
          </div>

          {/* Table Breakdown per SKU */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 whitespace-nowrap">บาร์โค้ด</th>
                  <th className="py-2.5 px-3 min-w-[180px]">ชื่อรายการสินค้า</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">ไลน์</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">คงเหลือ</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Min Stock</th>
                  {monthKeyList.map(([, meta]) => (
                    <th key={meta.label} className="py-2.5 px-3 whitespace-nowrap text-right font-mono">
                      {meta.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 whitespace-nowrap text-right bg-sky-50/50 text-sky-900 font-bold">
                    เฉลี่ย/ด.
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">พอใช้กี่เดือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.map((r, idx) => {
                  const isLow = r.item.currentBalance <= r.item.minStock;
                  return (
                    <tr
                      key={`${r.item.id || r.item.barcode}_${r.item.line || ""}_${idx}`}
                      onDoubleClick={() => onSelectItem?.(r.item)}
                      onClick={() => onSelectItem?.(r.item)}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 48px" }}
                      className="hover:bg-amber-50/50 transition-colors cursor-pointer group select-none"
                      title="ดับเบิ้ลคลิกเพื่อดูรายละเอียดสินค้า"
                    >
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 font-medium whitespace-nowrap">
                        {r.item.barcode}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800 line-clamp-1">{r.item.name}</div>
                        {r.item.supplier && (
                          <div className="text-[10px] text-slate-400">Supplier: {r.item.supplier}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {r.item.line || "-"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isLow ? "text-rose-600" : "text-slate-800"}>
                          {r.item.currentBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {r.item.minStock.toLocaleString()}
                      </td>
                      {monthKeyList.map(([key]) => {
                        const val = r.usage.monthly[key] || 0;
                        return (
                          <td
                            key={key}
                            className={`py-2 px-3 text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${
                              val > 0 ? "text-slate-800 font-medium" : "text-slate-300"
                            }`}
                          >
                            {val > 0 ? val.toLocaleString() : "-"}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-mono font-bold text-sky-700 bg-sky-50/40 whitespace-nowrap tabular-nums">
                        {r.usage.avgMonthly.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {r.monthsLeft >= 999 ? (
                          <span className="text-[10px] text-slate-400">-</span>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.monthsLeft < 1
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : r.monthsLeft < 3
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {r.monthsLeft.toFixed(1)} เดือน
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={7 + monthKeyList.length} className="text-center py-8 text-xs text-slate-400">
                      ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Continuous scroll sentinel */}
          <div ref={sentinelRef} className="h-4 w-full" />

          {/* Continuous Scroll Info Bar */}
          <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">
                แสดง {displayedRows.length.toLocaleString()} จาก {tableRows.length.toLocaleString()} รายการ
              </span>
              {displayedRows.length < tableRows.length && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  เลื่อนลงเพื่อดูข้อมูลเพิ่มอัตโนมัติ
                </span>
              )}
              {displayedRows.length >= tableRows.length && tableRows.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
                  ✓ แสดงครบทุกรายการแล้ว
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {displayedRows.length < tableRows.length && (
                <>
                  <button
                    onClick={() => setVisibleCount((prev) => Math.min(prev + 200, tableRows.length))}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition cursor-pointer shadow-2xs"
                  >
                    โหลดเพิ่ม +200 รายการ
                  </button>
                  <button
                    onClick={() => setShowAllDirectly(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition cursor-pointer shadow-2xs"
                  >
                    แสดงทั้งหมด ({tableRows.length.toLocaleString()})
                  </button>
                </>
              )}
              {showAllDirectly && tableRows.length > INITIAL_BATCH && (
                <button
                  onClick={() => {
                    setShowAllDirectly(false);
                    setVisibleCount(INITIAL_BATCH);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs transition cursor-pointer"
                >
                  ย่อกลับ (แสดงทีละชุด)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
