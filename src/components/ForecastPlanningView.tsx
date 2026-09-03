import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Calendar,
  Download,
  Search,
  AlertTriangle,
  Package,
  Layers,
  ChevronRight,
  Calculator,
  Clock,
  CircleDollarSign,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Info,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { StockItem, Transaction, ForecastItem, Employee, OrderStatus } from "../types";
import { useEffect } from "react";
import { exportToExcel, exportToCSV } from "../utils/exportUtils";
import { hasPermission } from "../utils/permissionUtils";

interface ForecastPlanningViewProps {
  items: StockItem[];
  transactions: Transaction[];
  lines: string[];
  categories: string[];
  currentUser?: Employee;
  onSelectItem: (item: StockItem) => void;
  onQuickMove: (item: StockItem, type: "in" | "out") => void;
}

type ForecastSortField =
  | "barcode"
  | "name"
  | "line"
  | "balance"
  | "burnRate"
  | "monthsRemaining"
  | "projectedDemand"
  | "recommendedOrder"
  | "estimatedCost"
  | "risk";

export const ForecastPlanningView: React.FC<ForecastPlanningViewProps> = ({
  items,
  transactions,
  lines,
  categories,
  currentUser,
  onSelectItem,
  onQuickMove,
}) => {
  const canReceive = hasPermission(currentUser, "receive");
  const canExport = hasPermission(currentUser, "importExport");
  // Forecast horizon in months (3, 6, 9, 12)
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 9 | 12>(6);
  const [bufferPercent, setBufferPercent] = useState<number>(10); // +10% default growth/safety buffer
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState<"all" | "critical" | "warning" | "ok" | "overstock">("all");
  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");
  const [sortField, setSortField] = useState<ForecastSortField>("estimatedCost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);

  

  const fetchOrderStatuses = async () => {
    try {
      const res = await fetch("/api/order-status");
      const data = await res.json();
      if (data.success && data.statuses) {
        setOrderStatuses(data.statuses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrderStatuses();
  }, []);


  // Calculate historical monthly burn rate per SKU from transactions
  // Determine date span of transactions
  const { burnRateMap, monthsSpan } = useMemo(() => {
    const usageMap = new Map<string, number>();
    const monthKeySet = new Set<string>();

    for (const t of transactions) {
      if (t.qtyOut > 0) {
        const b = t.barcode.trim().toLowerCase();
        usageMap.set(b, (usageMap.get(b) || 0) + t.qtyOut);
        if (t.year && t.month) {
          monthKeySet.add(`${t.year}-${t.month}`);
        }
      }
    }

    // If monthKeySet is small or 0, default span to minimum 3 months
    const calculatedSpan = Math.max(3, monthKeySet.size || 6);

    const burnRates = new Map<string, number>();
    usageMap.forEach((totalOut, barcode) => {
      burnRates.set(barcode, totalOut / calculatedSpan);
    });

    return { burnRateMap: burnRates, monthsSpan: calculatedSpan };
  }, [transactions]);

  // Extract unique suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.supplier) set.add(it.supplier);
    }
    return Array.from(set).sort();
  }, [items]);

  // Generate Forecast analysis for all items
  const forecastItems: ForecastItem[] = useMemo(() => {
    return items.map((item) => {
      const bKey = item.barcode.trim().toLowerCase();
      // Historical monthly average consumption
      let monthlyBurnRate = burnRateMap.get(bKey) || 0;

      // If no past transactions found in sheet, estimate baseline from minStock / 3
      if (monthlyBurnRate === 0 && item.minStock > 0) {
        monthlyBurnRate = Math.max(0.5, item.minStock / 3);
      }

      // Projected total demand over forecastHorizon
      const projectedDemand = Math.ceil(
        monthlyBurnRate * forecastHorizon * (1 + bufferPercent / 100)
      );

      // Months of stock remaining
      const monthsOfStockRemaining =
        monthlyBurnRate > 0 ? item.currentBalance / monthlyBurnRate : 999;

      // Recommended order to cover projected demand + minStock safety target
      const targetStockLevel = projectedDemand + item.minStock;
      const deficit = Math.max(0, targetStockLevel - item.currentBalance);
      const recommendedOrder = deficit;
      const estimatedCost = recommendedOrder * item.unitCost;

      // Risk classification
      let riskLevel: ForecastItem["riskLevel"] = "ok";
      if (monthsOfStockRemaining < 1 || (item.currentBalance <= 0 && monthlyBurnRate > 0)) {
        riskLevel = "critical";
      } else if (monthsOfStockRemaining < forecastHorizon) {
        riskLevel = "warning";
      } else if (monthsOfStockRemaining > forecastHorizon * 2.5 && item.currentBalance > 50) {
        riskLevel = "overstock";
      }

      return {
        item,
        monthlyBurnRate: parseFloat(monthlyBurnRate.toFixed(1)),
        projectedDemand,
        monthsOfStockRemaining: parseFloat(monthsOfStockRemaining.toFixed(1)),
        recommendedOrder,
        estimatedCost,
        riskLevel,
        forecastPeriodMonths: forecastHorizon,
      };
    });
  }, [items, burnRateMap, forecastHorizon, bufferPercent]);

  // Filter items
  const filteredItems = useMemo(() => {
    return forecastItems.filter((f) => {
      if (search) {
        const q = search.toLowerCase();
        const matchBarcode = f.item.barcode.toLowerCase().includes(q);
        const matchName = f.item.name.toLowerCase().includes(q);
        const matchSupplier = (f.item.supplier || "").toLowerCase().includes(q);
        if (!matchBarcode && !matchName && !matchSupplier) return false;
      }

      if (selectedLine !== "all" && f.item.line !== selectedLine) return false;
      if (selectedCategory !== "all" && f.item.category !== selectedCategory) return false;
      if (selectedSupplier !== "all" && f.item.supplier !== selectedSupplier) return false;
      if (selectedRisk !== "all" && f.riskLevel !== selectedRisk) return false;
      
      const oStatus = orderStatuses.find(s => s.barcode === f.item.barcode);
      const isOrdered = oStatus?.isOrdered || false;
      if (filterOrderStatus === "ordered" && !isOrdered) return false;
      if (filterOrderStatus === "not_ordered" && isOrdered) return false;

      return true;
    });
  }, [forecastItems, search, selectedLine, selectedCategory, selectedSupplier, selectedRisk, filterOrderStatus, orderStatuses]);

  // Sort items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let res = 0;
      switch (sortField) {
        case "barcode":
          res = a.item.barcode.localeCompare(b.item.barcode);
          break;
        case "name":
          res = a.item.name.localeCompare(b.item.name);
          break;
        case "line":
          res = (a.item.line || "").localeCompare(b.item.line || "");
          break;
        case "balance":
          res = a.item.currentBalance - b.item.currentBalance;
          break;
        case "burnRate":
          res = a.monthlyBurnRate - b.monthlyBurnRate;
          break;
        case "monthsRemaining":
          res = a.monthsOfStockRemaining - b.monthsOfStockRemaining;
          break;
        case "projectedDemand":
          res = a.projectedDemand - b.projectedDemand;
          break;
        case "recommendedOrder":
          res = a.recommendedOrder - b.recommendedOrder;
          break;
        case "estimatedCost":
          res = a.estimatedCost - b.estimatedCost;
          break;
        case "risk": {
          const riskWeight = { critical: 4, warning: 3, overstock: 2, ok: 1 };
          res = (riskWeight[a.riskLevel] || 0) - (riskWeight[b.riskLevel] || 0);
          break;
        }
        default:
          res = 0;
      }
      return sortOrder === "asc" ? res : -res;
    });
  }, [filteredItems, sortField, sortOrder]);

  const handleHeaderSort = (field: ForecastSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (["burnRate", "projectedDemand", "recommendedOrder", "estimatedCost", "risk"].includes(field)) {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    }
  };

  const renderSortIcon = (field: ForecastSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 font-bold" />
    );
  };

  // High-level KPI aggregations for filtered dataset
  const totalRecommendedBudget = useMemo(() => {
    return sortedItems.reduce((acc, f) => acc + f.estimatedCost, 0);
  }, [sortedItems]);

  const totalProjectedDemandQty = useMemo(() => {
    return sortedItems.reduce((acc, f) => acc + f.projectedDemand, 0);
  }, [sortedItems]);

  const criticalCount = useMemo(() => {
    return sortedItems.filter((f) => f.riskLevel === "critical").length;
  }, [sortedItems]);

  const warningCount = useMemo(() => {
    return sortedItems.filter((f) => f.riskLevel === "warning").length;
  }, [sortedItems]);

  // Chart data: Budget by category
  const chartCategoryData = useMemo(() => {
    const map = new Map<string, { currentVal: number; demandVal: number; orderVal: number }>();
    for (const f of sortedItems) {
      const cat = f.item.category || "ทั่วไป";
      const cur = map.get(cat) || { currentVal: 0, demandVal: 0, orderVal: 0 };
      cur.currentVal += f.item.currentBalance * f.item.unitCost;
      cur.demandVal += f.projectedDemand * f.item.unitCost;
      cur.orderVal += f.estimatedCost;
      map.set(cat, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].orderVal - a[1].orderVal)
      .slice(0, 6)
      .map(([cat, val]) => ({
        category: cat,
        "สต็อกปัจจุบัน (฿)": Math.round(val.currentVal),
        "ความต้องการใช้ (฿)": Math.round(val.demandVal),
        "งบสั่งซื้อเพิ่ม (฿)": Math.round(val.orderVal),
      }));
  }, [sortedItems]);

  const getExportData = () => {
    const headers = [
      "Barcode",
      "ชื่อรายการสินค้า",
      "ชนิด",
      "ไลน์",
      "หน่วย",
      "คงเหลือปัจจุบัน",
      "Min Stock",
      "อัตราการใช้เฉลี่ยต่อเดือน (หน่วย/เดือน)",
      `ความต้องการใช้ล่วงหน้า ${forecastHorizon} เดือน (+${bufferPercent}%)`,
      "จำนวนสต็อกจะพอใช้ (เดือน)",
      "จำนวนแนะนำให้สั่งซื้อ (หน่วย)",
      "ราคาต่อหน่วย (บาท)",
      "งบประมาณสั่งซื้อ (บาท)",
      "ระดับความเสี่ยง",
      "Supplier",
    ];

    const rows = sortedItems.map((f) => [
      f.item.barcode || "",
      f.item.name || "",
      f.item.category || "",
      f.item.line || "",
      f.item.unit || "",
      f.item.currentBalance || 0,
      f.item.minStock || 0,
      f.monthlyBurnRate || 0,
      f.projectedDemand || 0,
      f.monthsOfStockRemaining > 90 ? ">90" : f.monthsOfStockRemaining,
      f.recommendedOrder || 0,
      f.item.unitCost || 0,
      parseFloat(f.estimatedCost.toFixed(2)),
      f.riskLevel === "critical"
        ? "วิกฤต (หมดใน < 1 เดือน)"
        : f.riskLevel === "warning"
        ? `ไม่พอ ${forecastHorizon} เดือน`
        : f.riskLevel === "overstock"
        ? "สต็อกล้น"
        : "เพียงพอ",
      f.item.supplier || "",
    ]);

    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    exportToCSV(`PASAYA_DEMAND_FORECAST_${forecastHorizon}M`, headers, rows);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    exportToExcel(`PASAYA_DEMAND_FORECAST_${forecastHorizon}M`, `Forecast_${forecastHorizon}M`, headers, rows);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 rounded-2xl p-6 text-slate-900 shadow-xs border border-amber-200/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>ระบบพยากรณ์ความต้องการ & วางแผนสั่งซื้อล่วงหน้า (Demand Forecasting)</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            การวางแผนสั่งซื้อล่วงหน้า {forecastHorizon} เดือน
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            วิเคราะห์อัตราการเบิกจ่ายจริงเฉลี่ยต่อเดือน (ย้อนหลัง {monthsSpan} เดือน)
            เพื่อคำนวณปริมาณสินค้าที่ต้องสั่งซื้อและงบประมาณล่วงหน้าได้อย่างแม่นยำ
          </p>
        </div>

        {/* Horizon Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 flex items-center gap-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              ช่วงเวลา:
            </span>
            {([3, 6, 9, 12] as const).map((m) => (
              <button
                key={m}
                onClick={() => setForecastHorizon(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  forecastHorizon === m
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {m} เดือน
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              title="ส่งออกไฟล์ Excel (.xlsx) ตามเงื่อนไขที่กรองไว้"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs transition cursor-pointer"
              title="ส่งออกไฟล์ CSV (.csv) ตามเงื่อนไขที่กรองไว้"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">งบสั่งซื้อที่แนะนำ ({forecastHorizon} เดือน)</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              ฿{totalRecommendedBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
              เพื่อรองรับความต้องการ + Min Stock
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">สินค้าวิกฤต (หมดใน &lt; 1 เดือน)</div>
            <div className="text-xl font-extrabold text-rose-600 font-mono mt-0.5">
              {criticalCount.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">SKU</span>
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-0.5">
              ต้องดำเนินการสั่งซื้อด่วนที่สุด
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">สินค้าต้องสั่งใน {forecastHorizon} เดือน</div>
            <div className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">
              {warningCount.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">SKU</span>
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
              สต็อกไม่พอใช้ตลอดระยะ {forecastHorizon} เดือน
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">ปริมาณความต้องการรวม ({forecastHorizon}M)</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {totalProjectedDemandQty.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">หน่วย</span>
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-0.5">
              รวมบัฟเฟอร์ความปลอดภัย +{bufferPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Chart: Current Stock vs Demand vs Order budget */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">
              เปรียบเทียบมูลค่าสต็อกปัจจุบัน / ความต้องการใช้ / งบประมาณสั่งซื้อ ตามกลุ่มสินค้า (Top Categories)
            </h3>
          </div>
          <span className="text-xs text-slate-400">หน่วย: บาท (THB)</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartCategoryData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `฿${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="สต็อกปัจจุบัน (฿)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ความต้องการใช้ (฿)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="งบสั่งซื้อเพิ่ม (฿)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ด, รายการสินค้า, Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Line */}
          <div>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ไลน์ทั้งหมด ({lines.length})</option>
              {lines.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ชนิดสินค้าทั้งหมด ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">หมายเหตุ: แสดงทั้งหมด</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
            </select>
          </div>

          {/* Supplier */}
          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Supplier ทั้งหมด ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Risk Toggles & Sorting Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-semibold mr-1">สถานะความเสี่ยง:</span>
            <button
              onClick={() => setSelectedRisk("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedRisk === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด ({forecastItems.length})
            </button>
            <button
              onClick={() => setSelectedRisk("critical")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedRisk === "critical"
                  ? "bg-rose-600 text-white font-bold"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              วิกฤต (&lt; 1 เดือน) ({criticalCount})
            </button>
            <button
              onClick={() => setSelectedRisk("warning")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedRisk === "warning"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              ต้องสั่งซื้อใน {forecastHorizon} เดือน ({warningCount})
            </button>
            <button
              onClick={() => setSelectedRisk("ok")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedRisk === "ok"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              สต็อกเพียงพอ
            </button>
            <button
              onClick={() => setSelectedRisk("overstock")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedRisk === "overstock"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              สต็อกล้น (&gt; 2x)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-slate-500">Buffer เผื่อ:</span>
              {[0, 10, 20, 30].map((b) => (
                <button
                  key={b}
                  onClick={() => setBufferPercent(b)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                    bufferPercent === b
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  +{b}%
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-500">เรียงตาม:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="estimatedCost">งบประมาณสั่งซื้อ</option>
                <option value="recommendedOrder">จำนวนแนะนำสั่งซื้อ</option>
                <option value="burnRate">อัตราการใช้ต่อเดือน</option>
                <option value="monthsRemaining">เดือนที่สต็อกพอใช้</option>
                <option value="balance">คงเหลือปัจจุบัน</option>
                <option value="name">ชื่อสินค้า</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                title="สลับลำดับ มาก-น้อย"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 select-none border-b border-slate-200">
              <tr>
                <th className="p-3 w-12 text-center text-slate-500">#</th>
                <th
                  onClick={() => handleHeaderSort("barcode")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม บาร์โค้ด"
                >
                  <div className="flex items-center gap-1">
                    <span>บาร์โค้ด</span>
                    {renderSortIcon("barcode")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("name")}
                  className="p-3 min-w-[220px] cursor-pointer hover:bg-slate-200 transition group text-slate-800"
                  title="คลิกเพื่อเรียงตาม ชื่อรายการสินค้า"
                >
                  <div className="flex items-center gap-1">
                    <span>ชื่อรายการสินค้า</span>
                    {renderSortIcon("name")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("line")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ไลน์"
                >
                  <div className="flex items-center gap-1">
                    <span>ไลน์</span>
                    {renderSortIcon("line")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("balance")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม คงเหลือปัจจุบัน"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>คงเหลือ</span>
                    {renderSortIcon("balance")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("burnRate")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม อัตราการใช้เฉลี่ย/เดือน"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ใช้เฉลี่ย/ด.</span>
                    {renderSortIcon("burnRate")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("monthsRemaining")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม จำนวนเดือนที่พอใช้"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>พอใช้ (เดือน)</span>
                    {renderSortIcon("monthsRemaining")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("projectedDemand")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ความต้องการใช้"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ความต้องการ {forecastHorizon}ด. (+{bufferPercent}%)</span>
                    {renderSortIcon("projectedDemand")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("recommendedOrder")}
                  className="p-3 text-right font-bold text-amber-700 cursor-pointer hover:bg-slate-200 transition group"
                  title="คลิกเพื่อเรียงตาม แนะนำสั่งซื้อ"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>แนะนำสั่งซื้อ ({forecastHorizon}M)</span>
                    {renderSortIcon("recommendedOrder")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("estimatedCost")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม งบประมาณสั่งซื้อ"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>งบประมาณสั่งซื้อ</span>
                    {renderSortIcon("estimatedCost")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("risk")}
                  className="p-3 text-center cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม สถานะความเสี่ยง"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    {renderSortIcon("risk")}
                  </div>
                </th>
                <th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>
                <th className="p-3 text-center w-20 text-slate-700">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                    ไม่พบรายการที่ตรงกับเงื่อนไขการกรอง
                  </td>
                </tr>
              ) : (
                sortedItems.slice(0, 100).map((f, idx) => {
                  const it = f.item;
                  return (
                    <tr
                      key={it.id || idx}
                      onClick={() => onSelectItem(it)}
                      className="hover:bg-amber-50/40 transition cursor-pointer"
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {it.barcode}
                      </td>
                      <td className="p-3 font-medium text-slate-900">
                        <div>{it.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>ชนิด: {it.category}</span>
                          {it.supplier && <span>| Supplier: {it.supplier}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{it.line || "-"}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={it.currentBalance <= 0 ? "text-rose-600" : "text-slate-900"}>
                          {it.currentBalance.toLocaleString()}
                        </span>{" "}
                        <span className="text-[10px] text-slate-400">{it.unit}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {f.monthlyBurnRate.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            f.monthsOfStockRemaining < 1
                              ? "bg-rose-100 text-rose-800"
                              : f.monthsOfStockRemaining < forecastHorizon
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {f.monthsOfStockRemaining > 90 ? ">90" : f.monthsOfStockRemaining} ด.
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800">
                        {f.projectedDemand.toLocaleString()} {it.unit}
                      </td>
                      <td className="p-3 text-right">
                        {f.recommendedOrder > 0 ? (
                          <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            +{f.recommendedOrder.toLocaleString()} {it.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">เพียงพอ</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {f.estimatedCost > 0
                          ? `฿${f.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "-"}
                      </td>
                                            <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {f.riskLevel === "critical" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" /> วิกฤต
                            </span>
                          ) : f.riskLevel === "warning" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              สั่งซื้อ {forecastHorizon}M
                            </span>
                          ) : f.riskLevel === "overstock" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              สต็อกล้น
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              เพียงพอ
                            </span>
                          )}
                          {(() => {
                            const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                            if (oStatus?.isOrdered) {
                              return (
                                <div className="mt-1">
                                  <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                    สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onQuickMove(it, "in")}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                        >
                          + รับเข้า
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sortedItems.length > 100 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs text-center text-slate-500">
            แสดง 100 รายการแรกจากทั้งหมด {sortedItems.length.toLocaleString()} รายการ (ส่งออก Excel หรือ CSV เพื่อดูข้อมูลครบทั้งหมด)
          </div>
        )}
      </div>

    </div>
  );
};
