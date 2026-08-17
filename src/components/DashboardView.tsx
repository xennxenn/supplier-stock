import React, { useState, useMemo } from "react";
import {
  Package,
  CircleDollarSign,
  AlertTriangle,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { StockItem, Transaction, SheetsSyncData, NavTab } from "../types";

interface DashboardViewProps {
  data: SheetsSyncData | null;
  items: StockItem[];
  transactions: Transaction[];
  onNavigate: (tab: NavTab) => void;
  onSelectItem: (item: StockItem) => void;
  isSyncing: boolean;
  onSync: () => void;
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

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  items,
  transactions,
  onNavigate,
  onSelectItem,
  isSyncing,
  onSync,
}) => {
  // Filter States
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");

  // Extract unique filter options
  const uniqueLines = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.line) set.add(it.line);
    }
    return Array.from(set).sort();
  }, [items]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [items]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.supplier) set.add(it.supplier);
    }
    return Array.from(set).sort();
  }, [items]);

  // Filtered Stock Items based on active filters
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (selectedLine !== "all" && it.line !== selectedLine) return false;
      if (selectedCategory !== "all" && it.category !== selectedCategory) return false;
      if (selectedSupplier !== "all" && it.supplier !== selectedSupplier) return false;
      return true;
    });
  }, [items, selectedLine, selectedCategory, selectedSupplier]);

  // Barcode map for fast item lookup in transactions
  const itemBarcodeSet = useMemo(() => {
    return new Set(filteredItems.map((i) => i.barcode.trim().toLowerCase()));
  }, [filteredItems]);

  // Filtered Transactions corresponding to active filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedLine !== "all" && t.line !== selectedLine) return false;
      if (selectedCategory !== "all" || selectedSupplier !== "all") {
        if (!itemBarcodeSet.has(t.barcode.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [transactions, selectedLine, selectedCategory, selectedSupplier, itemBarcodeSet]);

  const isFiltered = selectedLine !== "all" || selectedCategory !== "all" || selectedSupplier !== "all";

  // KPIs
  const totalValue = filteredItems.reduce(
    (acc, it) => acc + (it.currentBalance || 0) * (it.unitCost || 0),
    0
  );
  const lowStockItems = filteredItems.filter(
    (it) => it.currentBalance <= it.minStock && it.minStock > 0
  );
  const outOfStockItems = filteredItems.filter((it) => it.currentBalance <= 0);

  // Top issued items
  const itemUsageMap = new Map<
    string,
    { barcode: string; name: string; unit: string; totalOut: number; totalCost: number }
  >();

  for (const t of filteredTransactions) {
    if (t.qtyOut > 0) {
      const cur = itemUsageMap.get(t.barcode) || {
        barcode: t.barcode,
        name: t.itemName,
        unit: t.unit,
        totalOut: 0,
        totalCost: 0,
      };
      cur.totalOut += t.qtyOut;
      cur.totalCost += t.totalCost;
      itemUsageMap.set(t.barcode, cur);
    }
  }

  const topIssuedItems = Array.from(itemUsageMap.values())
    .sort((a, b) => b.totalOut - a.totalOut)
    .slice(0, 8);

  // Monthly summary calculated dynamically from filtered transactions
  const monthlyChartData = useMemo(() => {
    const monthMap = new Map<string, { inQty: number; outQty: number; cost: number }>();
    for (const t of filteredTransactions) {
      if (t.month && t.year) {
        const key = `${t.year}-${String(t.month).padStart(2, "0")}`;
        const cur = monthMap.get(key) || { inQty: 0, outQty: 0, cost: 0 };
        cur.inQty += t.qtyIn || 0;
        cur.outQty += t.qtyOut || 0;
        cur.cost += t.totalCost || 0;
        monthMap.set(key, cur);
      }
    }
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .reverse()
      .map(([monthLabel, d]) => ({
        monthLabel,
        inQty: d.inQty,
        outQty: d.outQty,
        cost: Math.round(d.cost),
      }));
  }, [filteredTransactions]);

  // Category breakdown for filtered items
  const categoryChartData = useMemo(() => {
    const catMap = new Map<string, { itemCount: number; totalValue: number }>();
    for (const item of filteredItems) {
      const c = item.category || "อื่นๆ";
      const cur = catMap.get(c) || { itemCount: 0, totalValue: 0 };
      cur.itemCount += 1;
      cur.totalValue += item.currentBalance * item.unitCost;
      catMap.set(c, cur);
    }
    return Array.from(catMap.entries())
      .sort((a, b) => b[1].itemCount - a[1].itemCount)
      .slice(0, 6)
      .map(([category, d]) => ({
        category,
        itemCount: d.itemCount,
        totalValue: Math.round(d.totalValue),
      }));
  }, [filteredItems]);

  const clearFilters = () => {
    setSelectedLine("all");
    setSelectedCategory("all");
    setSelectedSupplier("all");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            <span>✨ ข้อมูลซิงค์อัตโนมัติจาก Google Sheets</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            ภาพรวมคลังสินค้า PASAYA STOCK
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            ตรวจสอบสถานะสต็อก การเบิกจ่ายสินค้า การแจ้งเตือนสั่งซื้อ และสถิติการใช้งานแบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "กำลังซิงค์ข้อมูล..." : "อัปเดตข้อมูลชีท"}</span>
          </button>
          <button
            onClick={() => onNavigate("movement")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition cursor-pointer"
          >
            <span>+ บันทึกรับ-จ่าย</span>
          </button>
        </div>
      </div>

      {/* Dashboard Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              ตัวกรองข้อมูลแดชบอร์ด (Dashboard Filters)
            </h3>
            {isFiltered && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                กรอง {filteredItems.length} จาก {items.length} รายการ
              </span>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>ล้างตัวกรองทั้งหมด</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
          {/* Line Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              ไลน์การผลิต (Line)
            </label>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ไลน์ทั้งหมด ({uniqueLines.length})</option>
              {uniqueLines.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              ชนิดสินค้า (Category)
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ชนิดสินค้าทั้งหมด ({uniqueCategories.length})</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              ผู้จัดจำหน่าย (Supplier)
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SKU */}
        <div
          onClick={() => onNavigate("stock")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              รายการสินค้า (SKU) {isFiltered ? "(กรอง)" : ""}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {filteredItems.length.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>
              {isFiltered ? `จากทั้งหมด ${items.length} รายการ` : `ชนิดสินค้า: ${uniqueCategories.length} หมวดหมู่`}
            </span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Total Inventory Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              มูลค่าสต็อกรวม {isFiltered ? "(กรอง)" : ""}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 mt-2">
            ฿{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            คำนวณจากยอดคงเหลือ x ราคาต่อหน่วย
          </div>
        </div>

        {/* Low Stock & Need Reorder */}
        <div
          onClick={() => onNavigate("alerts")}
          className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition cursor-pointer group bg-gradient-to-br from-white to-amber-50/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              เตือนสั่งซื้อ / ต่ำกว่า Min
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2 flex items-baseline gap-2">
            {lowStockItems.length.toLocaleString()}
            <span className="text-xs font-medium text-slate-500">
              รายการ ({outOfStockItems.length} หมดสต็อก)
            </span>
          </div>
          <div className="text-xs text-amber-800 mt-1 flex items-center gap-1 font-medium">
            <span>คลิกดูรายการที่ต้องสั่งซื้อ</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-amber-700 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Total Transactions logged */}
        <div
          onClick={() => onNavigate("transactions")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ประวัติการเบิกจ่าย {isFiltered ? "(กรอง)" : ""}
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {filteredTransactions.length.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>บันทึกความเคลื่อนไหว</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Movement Trend */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                แนวโน้มการเบิกจ่าย & รับเข้ารายเดือน {isFiltered ? `(${selectedLine !== 'all' ? `ไลน์ ${selectedLine}` : 'กรองแล้ว'})` : ""}
              </h3>
              <p className="text-xs text-slate-500">
                จำนวนชิ้นที่เบิกจ่าย vs รับเข้าคลัง (ย้อนหลัง)
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
              ข้อมูลชีท
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    Number(value).toLocaleString() + " ชิ้น",
                    name === "outQty" ? "จ่ายออก" : "รับเข้า",
                  ]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                />
                <Legend
                  formatter={(value) => (value === "outQty" ? "จ่ายออก" : "รับเข้า")}
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Bar dataKey="outQty" fill="#f59e0b" name="outQty" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inQty" fill="#10b981" name="inQty" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Value Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-base font-bold text-slate-900">
              สัดส่วนชนิดสินค้า (Top Categories)
            </h3>
            <p className="text-xs text-slate-500">
              สัดส่วนจำนวน SKU ตามชนิดสินค้า
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  dataKey="itemCount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                  paddingAngle={3}
                >
                  {categoryChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} รายการ`, "จำนวน SKU"]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-slate-100">
            {categoryChartData.slice(0, 4).map((cat, idx) => (
              <div key={cat.category} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-slate-600 truncate">{cat.category}</span>
                <span className="font-bold text-slate-800 ml-auto font-mono">
                  {cat.itemCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Section: Top Used Items & Urgent Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Low Stock Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  สินค้าสต็อกต่ำ / ต้องสั่งซื้อด่วน
                </h3>
                <p className="text-[11px] text-slate-500">
                  {lowStockItems.length} รายการที่ยอดคงเหลือต่ำกว่าเกณฑ์
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("alerts")}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <span>ดูทั้งหมด</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 bg-slate-50 rounded-xl">
              ยอดคงเหลือทุกรายการอยู่ในเกณฑ์ปกติ
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockItems.slice(0, 5).map((item) => {
                const percent = Math.min(
                  100,
                  Math.round((item.currentBalance / (item.minStock || 1)) * 100)
                );
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl transition cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {item.barcode}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.line || "ไม่ระบุไลน์"}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                        {item.name}
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            percent <= 20
                              ? "bg-rose-500"
                              : percent <= 50
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-rose-600">
                        {item.currentBalance.toLocaleString()} / {item.minStock.toLocaleString()}{" "}
                        {item.unit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ขาดอีก {(item.minStock - item.currentBalance).toLocaleString()} {item.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 10 Most Issued Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  รายการเบิกใช้สูงสุด (Top Usage)
                </h3>
                <p className="text-[11px] text-slate-500">
                  สินค้าที่มีการเบิกจ่ายใช้งานมากที่สุด
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("transactions")}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <span>ประวัติเบิกจ่าย</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {topIssuedItems.slice(0, 5).map((it, idx) => (
              <div
                key={it.barcode}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {it.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      บาร์โค้ด: {it.barcode}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-amber-700">
                    {it.totalOut.toLocaleString()} {it.unit}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ฿{it.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
