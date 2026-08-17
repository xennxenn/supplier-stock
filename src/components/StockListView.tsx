import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Copy,
  Check,
  FileSpreadsheet,
  Coins,
  Boxes,
} from "lucide-react";
import type { StockItem } from "../types";
import { exportToExcel, exportToCSV } from "../utils/exportUtils";

interface StockListViewProps {
  items: StockItem[];
  onSelectItem: (item: StockItem) => void;
  onQuickMove: (item: StockItem, type: "in" | "out") => void;
  categories: string[];
  lines: string[];
}

type StockSortField =
  | "barcode"
  | "name"
  | "category"
  | "line"
  | "forwardBalance"
  | "qty"
  | "minStock"
  | "cost"
  | "value"
  | "status";

export const StockListView: React.FC<StockListViewProps> = ({
  items,
  onSelectItem,
  onQuickMove,
  categories,
  lines,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "low" | "out" | "ok">("all");
  const [sortField, setSortField] = useState<StockSortField>("barcode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract unique suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.supplier) set.add(it.supplier);
    }
    return Array.from(set).sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchBarcode = item.barcode.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchSupplier = (item.supplier || "").toLowerCase().includes(q);
        const matchLocation = (item.location || "").toLowerCase().includes(q);
        if (!matchBarcode && !matchName && !matchSupplier && !matchLocation) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }

      // Line
      if (selectedLine !== "all" && item.line !== selectedLine) {
        return false;
      }

      // Supplier
      if (selectedSupplier !== "all" && item.supplier !== selectedSupplier) {
        return false;
      }

      // Status
      if (stockStatusFilter === "low") {
        if (item.currentBalance > item.minStock || item.currentBalance <= 0) return false;
      } else if (stockStatusFilter === "out") {
        if (item.currentBalance > 0) return false;
      } else if (stockStatusFilter === "ok") {
        if (item.currentBalance <= item.minStock) return false;
      }

      return true;
    });
  }, [items, search, selectedCategory, selectedLine, selectedSupplier, stockStatusFilter]);

  // Sort
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let res = 0;
      switch (sortField) {
        case "barcode":
          res = a.barcode.localeCompare(b.barcode);
          break;
        case "name":
          res = a.name.localeCompare(b.name);
          break;
        case "category":
          res = (a.category || "").localeCompare(b.category || "");
          break;
        case "line":
          res = (a.line || "").localeCompare(b.line || "");
          break;
        case "forwardBalance":
          res = (a.forwardBalance || 0) - (b.forwardBalance || 0);
          break;
        case "qty":
          res = a.currentBalance - b.currentBalance;
          break;
        case "minStock":
          res = (a.minStock || 0) - (b.minStock || 0);
          break;
        case "cost":
          res = a.unitCost - b.unitCost;
          break;
        case "value":
          res = a.currentBalance * a.unitCost - b.currentBalance * b.unitCost;
          break;
        case "status": {
          const statusA = a.currentBalance <= 0 ? 0 : a.currentBalance <= a.minStock ? 1 : 2;
          const statusB = b.currentBalance <= 0 ? 0 : b.currentBalance <= b.minStock ? 1 : 2;
          res = statusA - statusB;
          break;
        }
        default:
          res = 0;
      }
      return sortOrder === "asc" ? res : -res;
    });
  }, [filteredItems, sortField, sortOrder]);

  const handleHeaderSort = (field: StockSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (["qty", "forwardBalance", "minStock", "cost", "value"].includes(field)) {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    }
  };

  const renderSortIcon = (field: StockSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 font-bold" />
    );
  };

  // Filtered dataset KPI stats
  const totalFilteredValue = useMemo(() => {
    return sortedItems.reduce((acc, item) => acc + (item.currentBalance || 0) * (item.unitCost || 0), 0);
  }, [sortedItems]);

  const totalFilteredUnits = useMemo(() => {
    return sortedItems.reduce((acc, item) => acc + (item.currentBalance || 0), 0);
  }, [sortedItems]);

  const totalFilteredLowStock = useMemo(() => {
    return sortedItems.filter((i) => i.currentBalance <= i.minStock && i.minStock > 0).length;
  }, [sortedItems]);

  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleCopyBarcode = (barcode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(barcode);
    setCopiedId(barcode);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getExportData = () => {
    const headers = [
      "Barcode",
      "ชื่อรายการ",
      "ชนิด",
      "หน่วย",
      "ไลน์",
      "คงเหลือยกยอด",
      "คงเหลือปัจจุบัน",
      "Min Stock",
      "ราคาต่อหน่วย",
      "มูลค่ารวม (บาท)",
      "Supplier",
      "Location",
      "สถานะ",
    ];

    const rows = sortedItems.map((it) => [
      it.barcode || "",
      it.name || "",
      it.category || "",
      it.unit || "",
      it.line || "",
      it.forwardBalance || 0,
      it.currentBalance || 0,
      it.minStock || 0,
      it.unitCost || 0,
      parseFloat(((it.currentBalance || 0) * (it.unitCost || 0)).toFixed(2)),
      it.supplier || "",
      it.location || "",
      it.currentBalance <= 0
        ? "หมดสต็อก"
        : it.currentBalance <= it.minStock
        ? "ต่ำกว่าเกณฑ์"
        : "ปกติ",
    ]);

    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    exportToCSV("PASAYA_STOCK_MASTER", headers, rows);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    exportToExcel("PASAYA_STOCK_MASTER", "StockMaster", headers, rows);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header & Quick stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            รายการสต็อกสินค้า (Master Stock Items)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            พบทั้งหมด <span className="font-bold text-slate-800">{sortedItems.length.toLocaleString()}</span> จาก{" "}
            {items.length.toLocaleString()} รายการ (หน้า {currentPage}/{totalPages})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
            title="ส่งออก Excel (.xlsx) ตามเงื่อนไขที่กรองไว้"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออก Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition cursor-pointer"
            title="ส่งออก CSV (.csv) ตามเงื่อนไขที่กรองไว้"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* Dynamic KPI summary cards that change with filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>รายการสินค้าที่เลือก (SKUs)</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {sortedItems.length.toLocaleString()} <span className="text-xs font-normal text-slate-500">SKU</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>จำนวนคงเหลือรวม</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-blue-600 font-mono">
            {totalFilteredUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">หน่วย</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>มูลค่าสต็อกรวม (ที่เลือก)</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 font-mono">
            ฿{totalFilteredValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>สินค้าต้องสั่งซื้อ / ต่ำกว่า Min</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-amber-600 font-mono">
            {totalFilteredLowStock.toLocaleString()} <span className="text-xs font-normal text-slate-500">SKU</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ด, ชื่อรายการสินค้า, Supplier, Location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ชนิดสินค้าทั้งหมด ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Line Filter */}
          <div>
            <select
              value={selectedLine}
              onChange={(e) => {
                setSelectedLine(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ไลน์ทั้งหมด ({lines.length})</option>
              {lines.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => {
                setSelectedSupplier(e.target.value);
                setCurrentPage(1);
              }}
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

        {/* Status pill toggles & Sort options */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 mr-1">สถานะสต็อก:</span>
            <button
              onClick={() => {
                setStockStatusFilter("all");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                stockStatusFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => {
                setStockStatusFilter("low");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                stockStatusFilter === "low"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              ต่ำกว่า Min Stock
            </button>
            <button
              onClick={() => {
                setStockStatusFilter("out");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                stockStatusFilter === "out"
                  ? "bg-rose-600 text-white font-bold"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              หมดสต็อก (0)
            </button>
            <button
              onClick={() => {
                setStockStatusFilter("ok");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                stockStatusFilter === "ok"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              ปกติ
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">เรียงตาม:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="barcode">บาร์โค้ด</option>
              <option value="name">ชื่อสินค้า</option>
              <option value="qty">คงเหลือ</option>
              <option value="cost">ราคาต่อหน่วย</option>
              <option value="value">มูลค่ารวม</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="สลับลำดับ มาก-น้อย"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value={25}>25 / หน้า</option>
              <option value={50}>50 / หน้า</option>
              <option value={100}>100 / หน้า</option>
              <option value={200}>200 / หน้า</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stock Items Table */}
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
                    <span>บาร์โค้ด (Barcode)</span>
                    {renderSortIcon("barcode")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("name")}
                  className="p-3 min-w-[240px] cursor-pointer hover:bg-slate-200 transition group text-slate-800"
                  title="คลิกเพื่อเรียงตาม ชื่อรายการสินค้า"
                >
                  <div className="flex items-center gap-1">
                    <span>ชื่อรายการสินค้า</span>
                    {renderSortIcon("name")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("category")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ชนิดสินค้า"
                >
                  <div className="flex items-center gap-1">
                    <span>ชนิด (Type)</span>
                    {renderSortIcon("category")}
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
                  onClick={() => handleHeaderSort("forwardBalance")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ยกยอด"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ยกยอด</span>
                    {renderSortIcon("forwardBalance")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("qty")}
                  className="p-3 text-right font-bold text-amber-700 cursor-pointer hover:bg-slate-200 transition group"
                  title="คลิกเพื่อเรียงตาม คงเหลือปัจจุบัน"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>คงเหลือปัจจุบัน</span>
                    {renderSortIcon("qty")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("minStock")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม Min Stock"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Min Stock</span>
                    {renderSortIcon("minStock")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("cost")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ราคาต่อหน่วย"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ราคา/หน่วย</span>
                    {renderSortIcon("cost")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("value")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม มูลค่ารวม"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>มูลค่ารวม</span>
                    {renderSortIcon("value")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("status")}
                  className="p-3 text-center cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม สถานะ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    {renderSortIcon("status")}
                  </div>
                </th>
                <th className="p-3 text-center w-28 text-slate-700">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                    ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isLow = item.currentBalance <= item.minStock && item.minStock > 0;
                  const isOut = item.currentBalance <= 0;
                  const totalVal = item.currentBalance * item.unitCost;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className="hover:bg-amber-50/40 transition cursor-pointer group"
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{item.barcode}</span>
                          <button
                            onClick={(e) => handleCopyBarcode(item.barcode, e)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition"
                            title="คัดลอกบาร์โค้ด"
                          >
                            {copiedId === item.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 group-hover:text-amber-800">
                          {item.name}
                        </div>
                        {item.supplier && (
                          <div className="text-[10px] text-slate-400">
                            Supplier: {item.supplier}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {item.category || "ทั่วไป"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{item.line || "-"}</td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {item.forwardBalance?.toLocaleString() || "0"}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isOut
                              ? "text-rose-600"
                              : isLow
                              ? "text-amber-600"
                              : "text-slate-900"
                          }`}
                        >
                          {item.currentBalance.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          {item.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {item.minStock?.toLocaleString() || "0"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        ฿{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-emerald-700">
                        ฿{totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            หมดสต็อก
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> ต้องซื้อ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            ปกติ
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onQuickMove(item, "in")}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                            title="รับเข้าสต็อก"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onQuickMove(item, "out")}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            title="ตัดจ่ายออก"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectItem(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            แสดง {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, sortedItems.length)} จาก{" "}
            {sortedItems.length.toLocaleString()} รายการ
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-800">
              หน้า {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
