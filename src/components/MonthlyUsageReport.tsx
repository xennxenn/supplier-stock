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
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
} from "lucide-react";
import type { StockItem, Transaction } from "../types";
import { exportToCSV, exportToExcel } from "../utils/exportUtils";
import { matchesLine, matchesExactOrToken } from "../utils/filterUtils";
import {
  extractAllMonths,
  selectTargetMonths,
  computeItemUsageMap,
  normalizeYear,
  type ItemUsageStats,
} from "../utils/usageUtils";

interface MonthlyUsageReportProps {
  items: StockItem[];
  transactions: Transaction[];
  lines: string[];
  categories?: string[];
  onSelectItem?: (item: StockItem) => void;
}

type PeriodMode = 3 | 6 | 12 | 24 | 0 | "custom";

const EMPTY_USAGE: ItemUsageStats = {
  monthlyOut: {},
  monthlyIn: {},
  periodOut: 0,
  periodIn: 0,
  periodOutCost: 0,
  periodInCost: 0,
  allTimeOut: 0,
  allTimeIn: 0,
  avgMonthlyOut: 0,
  avgMonthlyIn: 0,
  activeMonthsCount: 0,
};

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
    "usage_desc" | "usage_asc" | "total_desc" | "in_desc" | "balance_desc" | "balance_asc" | "barcode" | "name"
  >("usage_desc");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  // Period selection state: 3m, 6m, 12m (1 year), 24m (2 years), 0 (all), or custom range
  const [periodMode, setPeriodMode] = useState<PeriodMode>(6);
  const [customStartKey, setCustomStartKey] = useState<string>("");
  const [customEndKey, setCustomEndKey] = useState<string>("");
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

  // All chronological months available in the dataset
  const allAvailableMonths = useMemo(() => extractAllMonths(transactions), [transactions]);

  // Initialize default custom range when switching to custom or when months load
  useEffect(() => {
    if (allAvailableMonths.length > 0) {
      if (!customEndKey) {
        setCustomEndKey(allAvailableMonths[allAvailableMonths.length - 1].key);
      }
      if (!customStartKey) {
        const startIdx = Math.max(0, allAvailableMonths.length - 6);
        setCustomStartKey(allAvailableMonths[startIdx].key);
      }
    }
  }, [allAvailableMonths, customStartKey, customEndKey]);

  // Selected target months for calculation
  const targetMonths = useMemo(() => {
    if (periodMode === "custom") {
      return selectTargetMonths(allAvailableMonths, 0, customStartKey, customEndKey);
    }
    return selectTargetMonths(allAvailableMonths, periodMode);
  }, [allAvailableMonths, periodMode, customStartKey, customEndKey]);

  const periodDescription = useMemo(() => {
    if (targetMonths.length === 0) return "ไม่มีข้อมูลเดือน";
    const first = targetMonths[0].label;
    const last = targetMonths[targetMonths.length - 1].label;
    const prefix =
      periodMode === 3
        ? "ย้อนหลัง 3 เดือน"
        : periodMode === 6
        ? "ย้อนหลัง 6 เดือน"
        : periodMode === 12
        ? "ย้อนหลัง 1 ปี (12 เดือน)"
        : periodMode === 24
        ? "ย้อนหลัง 2 ปี (24 เดือน)"
        : periodMode === 0
        ? `ทั้งหมด (${targetMonths.length} เดือน)`
        : `ช่วงเดือนที่เลือก (${targetMonths.length} เดือน)`;
    return `${prefix}: ${first} – ${last}`;
  }, [targetMonths, periodMode]);

  // Compute per-item usage over targetMonths
  const itemUsageMap = useMemo(
    () => computeItemUsageMap(transactions, targetMonths),
    [transactions, targetMonths]
  );

  // Aggregate monthly totals for the chart (respecting Line/Category/Supplier filters)
  const { monthlyTotals, periodSummary } = useMemo(() => {
    const totals: Record<
      string,
      { label: string; outQty: number; inQty: number; outCost: number; inCost: number }
    > = {};
    for (const m of targetMonths) {
      totals[m.key] = { label: m.label, outQty: 0, inQty: 0, outCost: 0, inCost: 0 };
    }

    const itemMapByBarcode = new Map<string, StockItem>(
      items.map((it) => [it.barcode.trim().toLowerCase(), it])
    );

    let totalOutQty = 0;
    let totalInQty = 0;
    let totalOutCost = 0;
    let totalInCost = 0;

    for (const t of transactions) {
      const y = normalizeYear(t.year);
      const m = t.month;
      if (y < 2020 || y > 2100 || m < 1 || m > 12) continue;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const bucket = totals[key];
      if (!bucket) continue;

      const b = t.barcode.trim().toLowerCase();
      const it = itemMapByBarcode.get(b);
      const effectiveLine = t.line?.trim() || it?.line?.trim() || "";
      const effectiveCat = it?.category?.trim() || "";
      const effectiveSup = it?.supplier?.trim() || "";

      const matchesCurrentFilter =
        (selectedLine === "all" || matchesLine(effectiveLine, selectedLine)) &&
        (selectedCategory === "all" || matchesExactOrToken(effectiveCat, selectedCategory)) &&
        (selectedSupplier === "all" || matchesExactOrToken(effectiveSup, selectedSupplier));

      if (!matchesCurrentFilter) continue;

      const qOut = t.qtyOut || 0;
      const qIn = t.qtyIn || 0;
      const uPrice = t.unitPrice || it?.unitCost || 0;

      if (qOut > 0) {
        const c = t.totalCost || qOut * uPrice;
        bucket.outQty += qOut;
        bucket.outCost += c;
        totalOutQty += qOut;
        totalOutCost += c;
      }
      if (qIn > 0) {
        const c = t.totalCost || qIn * uPrice;
        bucket.inQty += qIn;
        bucket.inCost += c;
        totalInQty += qIn;
        totalInCost += c;
      }
    }

    const span = Math.max(1, targetMonths.length);

    return {
      monthlyTotals: targetMonths.map((m) => ({
        key: m.key,
        label: m.label,
        outQty: Math.round(totals[m.key]?.outQty || 0),
        inQty: Math.round(totals[m.key]?.inQty || 0),
        cost: Math.round(totals[m.key]?.outCost || 0),
      })),
      periodSummary: {
        totalOutQty,
        totalInQty,
        totalOutCost,
        totalInCost,
        avgMonthlyOut: parseFloat((totalOutQty / span).toFixed(1)),
        avgMonthlyIn: parseFloat((totalInQty / span).toFixed(1)),
        monthsCount: targetMonths.length,
      },
    };
  }, [transactions, targetMonths, items, selectedLine, selectedCategory, selectedSupplier]);

  // Filtered stock items to display in the table
  const tableRows = useMemo(() => {
    return items
      .filter((it) => {
        if (selectedLine !== "all" && !matchesLine(it.line, selectedLine)) return false;
        if (selectedCategory !== "all" && !matchesExactOrToken(it.category, selectedCategory)) return false;
        if (selectedSupplier !== "all" && !matchesExactOrToken(it.supplier, selectedSupplier)) return false;

        if (deferredSearch.trim()) {
          const q = deferredSearch.toLowerCase().trim();
          const matchName = it.name.toLowerCase().includes(q);
          const matchCode = it.barcode.toLowerCase().includes(q);
          const matchSup = (it.supplier || "").toLowerCase().includes(q);
          const matchLine = (it.line || "").toLowerCase().includes(q);
          const matchCategory = (it.category || "").toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchSup && !matchLine && !matchCategory) return false;
        }

        const b = it.barcode.trim().toLowerCase();
        const usage = itemUsageMap.get(b) || EMPTY_USAGE;

        if (stockStatusFilter === "low") {
          if (it.currentBalance > it.minStock || it.currentBalance <= 0) return false;
        } else if (stockStatusFilter === "out") {
          if (it.currentBalance > 0) return false;
        } else if (stockStatusFilter === "ok") {
          if (it.currentBalance <= it.minStock) return false;
        } else if (stockStatusFilter === "active") {
          if (usage.periodOut <= 0 && usage.periodIn <= 0) return false;
        } else if (stockStatusFilter === "zero_usage") {
          if (usage.periodOut > 0) return false;
        }

        return true;
      })
      .map((it) => {
        const b = it.barcode.trim().toLowerCase();
        const usage = itemUsageMap.get(b) || EMPTY_USAGE;
        const monthsLeft = usage.avgMonthlyOut > 0 ? it.currentBalance / usage.avgMonthlyOut : 999;
        return {
          item: it,
          usage,
          monthsLeft,
        };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "usage_asc":
            return a.usage.avgMonthlyOut - b.usage.avgMonthlyOut;
          case "total_desc":
            return b.usage.periodOut - a.usage.periodOut;
          case "in_desc":
            return b.usage.periodIn - a.usage.periodIn;
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
            return b.usage.avgMonthlyOut - a.usage.avgMonthlyOut;
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
    periodMode,
    customStartKey,
    customEndKey,
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

  const getExportPayload = () => {
    const headers = [
      "บาร์โค้ด",
      "ชื่อรายการ",
      "ไลน์",
      "Supplier",
      "คงเหลือ",
      "Min Stock",
      ...targetMonths.map((m) => `ยอดเบิก ${m.label}`),
      "รวมรับเข้า (ตามช่วง)",
      "รวมจ่ายออก (ตามช่วง)",
      `เฉลี่ยต่อเดือน (${targetMonths.length} ด.)`,
      "พอใช้ (เดือน)",
    ];

    const rows = tableRows.map((r) => [
      r.item.barcode,
      r.item.name,
      r.item.line || "-",
      r.item.supplier || "-",
      r.item.currentBalance,
      r.item.minStock,
      ...targetMonths.map((m) => r.usage.monthlyOut[m.key] || 0),
      r.usage.periodIn,
      r.usage.periodOut,
      r.usage.avgMonthlyOut,
      r.monthsLeft >= 999 ? "ไม่มีประวัติเบิก" : r.monthsLeft.toFixed(1),
    ]);

    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportPayload();
    exportToCSV(`รายงานยอดใช้แต่ละเดือน_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportPayload();
    exportToExcel(
      `รายงานยอดใช้แต่ละเดือน_${new Date().toISOString().slice(0, 10)}`,
      "MonthlyUsage",
      headers,
      rows
    );
  };

  return (
    <div className="liquid-glass rounded-3xl p-5 mb-6 shadow-sm border border-white/60">
      {/* Header & Period Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              รายงานยอดใช้และแนวโน้มการเบิกจ่ายแต่ละเดือน (Monthly Consumption Breakdown)
            </h3>
            <p className="text-xs text-slate-500">
              {periodDescription} — คำนวณอัตราใช้เฉลี่ยต่อเดือนและยอดรับเข้า-จ่ายออกจากช่วงเวลาที่เลือก
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          {/* Period Preset Buttons */}
          <div className="flex flex-wrap items-center bg-slate-100/90 rounded-xl p-1 text-xs gap-0.5">
            {(
              [
                { mode: 3, label: "3 เดือน" },
                { mode: 6, label: "6 เดือน" },
                { mode: 12, label: "1 ปี (12 ด.)" },
                { mode: 24, label: "2 ปี (24 ด.)" },
                { mode: 0, label: "ทั้งหมด" },
                { mode: "custom", label: "เลือกช่วงเอง" },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.mode)}
                onClick={() => setPeriodMode(opt.mode)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  periodMode === opt.mode
                    ? "bg-white text-sky-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            title="ส่งออก Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="ส่งออก CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            title={isExpanded ? "ย่อส่วนนี้" : "ขยายส่วนนี้"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Custom Month Range Bar when periodMode === 'custom' */}
      {isExpanded && periodMode === "custom" && allAvailableMonths.length > 0 && (
        <div className="mt-3 p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sky-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-600" />
              กำหนดช่วงเดือนที่ต้องการคำนวณ:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">ตั้งแต่เดือน:</span>
              <select
                value={customStartKey}
                onChange={(e) => setCustomStartKey(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {allAvailableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.key})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">ถึงเดือน:</span>
              <select
                value={customEndKey}
                onChange={(e) => setCustomEndKey(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {allAvailableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.key})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-sky-800 font-semibold bg-white px-3 py-1 rounded-lg border border-sky-200">
            รวมจำนวน {targetMonths.length} เดือนในการคำนวณค่าเฉลี่ย
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-5 animate-in fade-in duration-300">
          {/* Period Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white/90 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>จำนวนเดือนที่ใช้คำนวณ</span>
                <Calendar className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono">
                {periodSummary.monthsCount}{" "}
                <span className="text-xs font-normal text-slate-500">เดือน</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{periodDescription}</div>
            </div>

            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold mb-1">
                <span>ยอดรับเข้ารวม (ในช่วงเวลา)</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-700 font-mono">
                +{periodSummary.totalInQty.toLocaleString()}{" "}
                <span className="text-xs font-normal text-emerald-600">หน่วย</span>
              </div>
              <div className="text-[11px] text-emerald-600/90 mt-0.5 font-mono">
                เฉลี่ยรับเข้า {periodSummary.avgMonthlyIn.toLocaleString()} / เดือน
              </div>
            </div>

            <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-rose-700 font-semibold mb-1">
                <span>ยอดจ่ายออกรวม (ในช่วงเวลา)</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-lg font-bold text-rose-700 font-mono">
                -{periodSummary.totalOutQty.toLocaleString()}{" "}
                <span className="text-xs font-normal text-rose-600">หน่วย</span>
              </div>
              <div className="text-[11px] text-rose-600/90 mt-0.5 font-mono">
                มูลค่าเบิก ฿{Math.round(periodSummary.totalOutCost).toLocaleString()}
              </div>
            </div>

            <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-sky-800 font-semibold mb-1">
                <span>อัตราใช้เฉลี่ยรวม / เดือน</span>
                <TrendingDown className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-lg font-bold text-sky-700 font-mono">
                {periodSummary.avgMonthlyOut.toLocaleString()}{" "}
                <span className="text-xs font-normal text-sky-600">หน่วย/ด.</span>
              </div>
              <div className="text-[11px] text-sky-700/80 mt-0.5 flex items-center gap-1">
                <Coins className="w-3 h-3" />
                <span>
                  เฉลี่ย ฿
                  {Math.round(
                    periodSummary.totalOutCost / Math.max(1, periodSummary.monthsCount)
                  ).toLocaleString()}{" "}
                  / เดือน
                </span>
              </div>
            </div>
          </div>

          {/* Top monthly usage chart */}
          {monthlyTotals.length > 0 ? (
            <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/70 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  กราฟเปรียบเทียบยอดรับเข้าและยอดจ่ายออกรายเดือน ({periodDescription})
                </span>
                <span className="text-[11px] text-slate-500">หน่วย: จำนวนชิ้น (Qty)</span>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTotals} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString()} หน่วย`,
                        name,
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
                    <Bar dataKey="inQty" name="ยอดรับเข้า (In)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="outQty" name="ยอดจ่ายออก (Out)" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={32} />
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
                  <option value="active">มีการเคลื่อนไหวในรอบที่เลือก</option>
                  <option value="zero_usage">ไม่มีการเบิกใช้ในรอบที่เลือก</option>
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
                  <option value="total_desc">ยอดเบิกออกรวมสูงสุด (ตามช่วง)</option>
                  <option value="in_desc">ยอดรับเข้ารวมสูงสุด (ตามช่วง)</option>
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
                  💡 คลิกหรือดับเบิ้ลคลิกแถวเพื่อดูประวัติรับเข้า-จ่ายออกทั้งหมดของสินค้านั้น
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
                  {targetMonths.map((m) => (
                    <th key={m.key} className="py-2.5 px-2.5 whitespace-nowrap text-right font-mono text-[11px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 whitespace-nowrap text-right bg-emerald-50/60 text-emerald-800 font-bold">
                    รวมรับเข้า
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right bg-rose-50/60 text-rose-800 font-bold">
                    รวมจ่ายออก
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right bg-sky-50/60 text-sky-900 font-bold">
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
                      title="คลิกเพื่อดูรายละเอียดและประวัติรับเข้า-จ่ายออกทั้งหมด"
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
                      {targetMonths.map((m) => {
                        const val = r.usage.monthlyOut[m.key] || 0;
                        return (
                          <td
                            key={m.key}
                            className={`py-2 px-2.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${
                              val > 0 ? "text-slate-800 font-medium" : "text-slate-300"
                            }`}
                          >
                            {val > 0 ? val.toLocaleString() : "-"}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 bg-emerald-50/30 whitespace-nowrap tabular-nums">
                        {r.usage.periodIn > 0 ? `+${r.usage.periodIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700 bg-rose-50/30 whitespace-nowrap tabular-nums">
                        {r.usage.periodOut > 0 ? `-${r.usage.periodOut.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-sky-700 bg-sky-50/40 whitespace-nowrap tabular-nums">
                        {r.usage.avgMonthlyOut.toLocaleString()}
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
                    <td colSpan={9 + targetMonths.length} className="text-center py-8 text-xs text-slate-400">
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
