import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import {
  FileSpreadsheet,
  Search,
  Download,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCcw,
} from "lucide-react";
import type { Transaction, StockItem, Employee } from "../types";
import { exportToExcel, exportToCSV, parseFlexibleDate } from "../utils/exportUtils";
import { hasPermission } from "../utils/permissionUtils";
import { matchesLine, matchesExactOrToken } from "../utils/filterUtils";

interface TransactionsViewProps {
  transactions: Transaction[];
  lines: string[];
  stockItems?: StockItem[];
  currentUser?: Employee;
  onSelectItem?: (item: StockItem) => void;
}

type SortField =
  | "date"
  | "barcode"
  | "itemName"
  | "supplier"
  | "qtyIn"
  | "qtyOut"
  | "qty"
  | "employee"
  | "line"
  | "unitPrice"
  | "totalCost"
  | "balance"
  | "status";

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  lines,
  stockItems = [],
  currentUser,
  onSelectItem,
}) => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedType, setSelectedType] = useState<"all" | "in" | "out">("all");
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const INITIAL_BATCH = 80;
  const BATCH_INCREMENT = 80;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [showAllDirectly, setShowAllDirectly] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Map barcodes to Supplier, Line, and StockItem in one pass
  const { barcodeSupplierMap, barcodeLineMap, barcodeItemMap, uniqueSuppliers } = useMemo(() => {
    const supMap = new Map<string, string>();
    const lineMap = new Map<string, string>();
    const itemMap = new Map<string, StockItem>();
    const supSet = new Set<string>();

    for (const item of stockItems) {
      const code = item.barcode.trim().toLowerCase();
      if (!code) continue;
      if (item.supplier) {
        supMap.set(code, item.supplier);
        if (item.supplier !== "-") supSet.add(item.supplier);
      }
      if (item.line) {
        lineMap.set(code, item.line);
      }
      if (!itemMap.has(code)) {
        itemMap.set(code, item);
      }
    }

    return {
      barcodeSupplierMap: supMap,
      barcodeLineMap: lineMap,
      barcodeItemMap: itemMap,
      uniqueSuppliers: Array.from(supSet).sort((a, b) => a.localeCompare(b, "th")),
    };
  }, [stockItems]);

  const handleRowDoubleClick = (tx: Transaction) => {
    if (!onSelectItem) return;
    const cleanCode = tx.barcode.trim().toLowerCase();
    const existing = barcodeItemMap.get(cleanCode);
    if (existing) {
      onSelectItem(existing);
    } else {
      const supp = barcodeSupplierMap.get(cleanCode) || "";
      const fallbackItem: StockItem = {
        id: tx.id || `item-${tx.barcode}`,
        barcode: tx.barcode,
        name: tx.itemName,
        category: "ทั่วไป",
        line: tx.line || barcodeLineMap.get(cleanCode) || "",
        supplier: supp !== "-" ? supp : "",
        unit: tx.unit || "ชิ้น",
        forwardBalance: 0,
        currentBalance: tx.balance || 0,
        qty: tx.balance || 0,
        minStock: tx.minStock || 0,
        unitCost: tx.unitPrice || 0,
        image: "",
        location: "-",
        note: "",
        updatedAt: tx.date,
      };
      onSelectItem(fallbackItem);
    }
  };

  // Extract unique months and years from data
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const t of transactions) {
      if (t.year && t.year >= 2000 && t.year <= 2100) {
        set.add(t.year);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  // Base filtered transactions (applying all filters EXCEPT type, so we can show accurate In/Out tab counts)
  const baseFiltered = useMemo(() => {
    const q = deferredSearch ? deferredSearch.toLowerCase().trim() : "";

    return transactions.filter((t) => {
      if ((t.qtyIn || 0) <= 0 && (t.qtyOut || 0) <= 0) return false;
      if (!t.barcode || t.barcode === "0") return false;

      const cleanBarcode = t.barcode.trim().toLowerCase();
      const supp = barcodeSupplierMap.get(cleanBarcode) || "";
      const effectiveLine = t.line?.trim() || barcodeLineMap.get(cleanBarcode) || "";

      if (q) {
        const matchBarcode = t.barcode.toLowerCase().includes(q);
        const matchName = t.itemName.toLowerCase().includes(q);
        const matchEmpName = (t.employeeName || "").toLowerCase().includes(q);
        const matchEmpId = (t.employeeId || "").toLowerCase().includes(q);
        const matchDate = (t.date || "").toLowerCase().includes(q);
        const matchSupplier = supp.toLowerCase().includes(q);
        const matchLine = effectiveLine.toLowerCase().includes(q);

        if (
          !matchBarcode &&
          !matchName &&
          !matchEmpName &&
          !matchEmpId &&
          !matchDate &&
          !matchSupplier &&
          !matchLine
        ) {
          return false;
        }
      }

      if (selectedLine !== "all" && !matchesLine(effectiveLine, selectedLine)) {
        return false;
      }

      if (selectedSupplier !== "all" && !matchesExactOrToken(supp, selectedSupplier)) {
        return false;
      }

      if (selectedStatus !== "all" && t.status !== selectedStatus) return false;
      if (selectedMonth !== "all" && t.month !== Number(selectedMonth)) return false;
      if (selectedYear !== "all" && t.year !== Number(selectedYear)) return false;

      return true;
    });
  }, [
    transactions,
    deferredSearch,
    selectedLine,
    selectedSupplier,
    selectedStatus,
    selectedMonth,
    selectedYear,
    barcodeSupplierMap,
    barcodeLineMap,
  ]);

  // Compute complete Incoming & Outgoing summary statistics from baseFiltered
  const baseStats = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let totalQtyIn = 0;
    let totalQtyOut = 0;
    let totalCostIn = 0;
    let totalCostOut = 0;

    for (const t of baseFiltered) {
      const qIn = t.qtyIn || 0;
      const qOut = t.qtyOut || 0;
      const price = t.unitPrice || 0;
      if (qIn > 0) {
        inCount++;
        totalQtyIn += qIn;
        totalCostIn += qOut === 0 && t.totalCost ? t.totalCost : qIn * price;
      }
      if (qOut > 0) {
        outCount++;
        totalQtyOut += qOut;
        totalCostOut += qIn === 0 && t.totalCost ? t.totalCost : qOut * price;
      }
    }

    return {
      allCount: baseFiltered.length,
      inCount,
      outCount,
      totalQtyIn,
      totalQtyOut,
      totalCostIn,
      totalCostOut,
      totalCostAll: totalCostIn + totalCostOut,
    };
  }, [baseFiltered]);

  // Apply selectedType ("all" | "in" | "out")
  const filtered = useMemo(() => {
    if (selectedType === "all") return baseFiltered;
    if (selectedType === "in") return baseFiltered.filter((t) => (t.qtyIn || 0) > 0);
    return baseFiltered.filter((t) => (t.qtyOut || 0) > 0);
  }, [baseFiltered, selectedType]);

  // Fast sorting using pre-computed timestamp when sorting by date
  const sortedTransactions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "date": {
          const timeA = a.timestamp ?? parseFlexibleDate(a.date, a.year, a.month);
          const timeB = b.timestamp ?? parseFlexibleDate(b.date, b.year, b.month);
          result = timeA - timeB;
          break;
        }
        case "barcode":
          result = (a.barcode || "").localeCompare(b.barcode || "");
          break;
        case "itemName":
          result = (a.itemName || "").localeCompare(b.itemName || "");
          break;
        case "supplier": {
          const suppA = barcodeSupplierMap.get(a.barcode.trim().toLowerCase()) || "";
          const suppB = barcodeSupplierMap.get(b.barcode.trim().toLowerCase()) || "";
          result = suppA.localeCompare(suppB);
          break;
        }
        case "qtyIn":
          result = (a.qtyIn || 0) - (b.qtyIn || 0);
          break;
        case "qtyOut":
          result = (a.qtyOut || 0) - (b.qtyOut || 0);
          break;
        case "qty": {
          const qtyA = (a.qtyIn || 0) + (a.qtyOut || 0);
          const qtyB = (b.qtyIn || 0) + (b.qtyOut || 0);
          result = qtyA - qtyB;
          break;
        }
        case "employee":
          result = (a.employeeName || a.employeeId || "").localeCompare(
            b.employeeName || b.employeeId || ""
          );
          break;
        case "line": {
          const lineA = a.line || barcodeLineMap.get(a.barcode.trim().toLowerCase()) || "";
          const lineB = b.line || barcodeLineMap.get(b.barcode.trim().toLowerCase()) || "";
          result = lineA.localeCompare(lineB);
          break;
        }
        case "unitPrice":
          result = (a.unitPrice || 0) - (b.unitPrice || 0);
          break;
        case "totalCost":
          result = (a.totalCost || 0) - (b.totalCost || 0);
          break;
        case "balance":
          result = (a.balance || 0) - (b.balance || 0);
          break;
        case "status":
          result = (a.status || "").localeCompare(b.status || "");
          break;
        default:
          result = 0;
      }
      return sortDirection === "asc" ? result : -result;
    });
  }, [filtered, sortField, sortDirection, barcodeSupplierMap, barcodeLineMap]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (["date", "qtyIn", "qtyOut", "qty", "totalCost", "unitPrice", "balance"].includes(field)) {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  };

  // Reset visible count when filters or sorting change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [
    deferredSearch,
    selectedType,
    selectedLine,
    selectedSupplier,
    selectedStatus,
    selectedMonth,
    selectedYear,
    sortField,
    sortDirection,
  ]);

  // Displayed transactions for single-page continuous scrolling
  const displayedTransactions = useMemo(() => {
    if (showAllDirectly) return sortedTransactions;
    return sortedTransactions.slice(0, visibleCount);
  }, [sortedTransactions, visibleCount, showAllDirectly]);

  // Automatic infinite continuous scroll when user scrolls down
  useEffect(() => {
    if (showAllDirectly || visibleCount >= sortedTransactions.length) return;
    const el = sentinelRef.current;
    if (!el) return;

    let isFetching = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) {
          isFetching = true;
          setVisibleCount((prev) => Math.min(prev + BATCH_INCREMENT, sortedTransactions.length));
          setTimeout(() => {
            isFetching = false;
          }, 80);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showAllDirectly, visibleCount, sortedTransactions.length]);

  const hasActiveFilters =
    search !== "" ||
    selectedType !== "all" ||
    selectedLine !== "all" ||
    selectedSupplier !== "all" ||
    selectedStatus !== "all" ||
    selectedMonth !== "all" ||
    selectedYear !== "all";

  const resetAllFilters = () => {
    setSearch("");
    setSelectedType("all");
    setSelectedLine("all");
    setSelectedSupplier("all");
    setSelectedStatus("all");
    setSelectedMonth("all");
    setSelectedYear("all");
  };

  const getExportData = () => {
    const headers = [
      "DATE",
      "BARCODE",
      "รายการ",
      "Supplier",
      "หน่วย",
      "รับเข้า (In)",
      "จ่ายออก (Out)",
      "รหัสพนักงาน",
      "ชื่อผู้เบิก",
      "ไลน์",
      "ราคาต่อหน่วย",
      "ค่าใช้จ่ายต่อรายการ",
      "เดือน",
      "ปี",
      "คงเหลือ",
      "Min Stock",
      "สถานะ",
    ];

    const rows = sortedTransactions.map((t) => {
      const cleanCode = t.barcode.trim().toLowerCase();
      return [
        t.date || "",
        t.barcode || "",
        t.itemName || "",
        barcodeSupplierMap.get(cleanCode) || "",
        t.unit || "",
        t.qtyIn || 0,
        t.qtyOut || 0,
        t.employeeId || "",
        t.employeeName || "",
        t.line || barcodeLineMap.get(cleanCode) || "",
        t.unitPrice || 0,
        t.totalCost || 0,
        t.month || "",
        t.year || "",
        t.balance || 0,
        t.minStock || 0,
        t.status || "",
      ];
    });

    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    exportToCSV("ACCESSORIES_TRANSACTIONS", headers, rows);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    exportToExcel("ACCESSORIES_TRANSACTIONS", "Disbursements", headers, rows);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-500 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-500 font-bold" />
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            ประวัติการรับเข้า-เบิกจ่ายทั้งหมด (All Receipts & Disbursements History)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แสดงผล{" "}
            <span className="font-bold text-slate-800">
              {sortedTransactions.length.toLocaleString()}
            </span>{" "}
            รายการ (จากประวัติทั้งหมด {transactions.length.toLocaleString()} รายการ • รับเข้า{" "}
            {baseStats.inCount.toLocaleString()} รายการ / จ่ายออก{" "}
            {baseStats.outCount.toLocaleString()} รายการ)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างตัวกรองทั้งหมด</span>
            </button>
          )}
          {hasPermission(currentUser, "importExport") && (
            <>
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                title="ส่งออกไฟล์ Excel (.xlsx) ตามเงื่อนไขที่กรองไว้"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ส่งออก Excel (.xlsx)</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition cursor-pointer"
                title="ส่งออกไฟล์ CSV (.csv) ตามเงื่อนไขที่กรองไว้"
              >
                <Download className="w-4 h-4" />
                <span>ส่งออก CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Summary KPI Cards (Click to filter All / All In / All Out) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: All History */}
        <div
          onClick={() => setSelectedType("all")}
          className={`p-4 rounded-xl border shadow-sm flex items-center justify-between cursor-pointer transition ${
            selectedType === "all"
              ? "bg-slate-900 text-white border-slate-900 ring-2 ring-amber-400"
              : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span
              className={`text-xs font-semibold ${
                selectedType === "all" ? "text-amber-300" : "text-slate-500"
              }`}
            >
              ประวัติรับ-จ่ายทั้งหมด (คลิกดูทั้งหมด)
            </span>
            <div className="text-xl font-extrabold mt-0.5 font-mono">
              {baseStats.allCount.toLocaleString()} รายการ
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                selectedType === "all" ? "text-slate-300" : "text-slate-400"
              }`}
            >
              รับเข้า {baseStats.inCount.toLocaleString()} • จ่ายออก{" "}
              {baseStats.outCount.toLocaleString()} ครั้ง
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedType === "all"
                ? "bg-white/10 text-amber-400"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Incoming (รับเข้าทั้งหมด) */}
        <div
          onClick={() => setSelectedType(selectedType === "in" ? "all" : "in")}
          className={`p-4 rounded-xl border shadow-sm flex items-center justify-between cursor-pointer transition ${
            selectedType === "in"
              ? "bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-300"
              : "bg-white text-slate-900 border-emerald-200 hover:bg-emerald-50/40"
          }`}
        >
          <div>
            <span
              className={`text-xs font-semibold ${
                selectedType === "in" ? "text-emerald-100" : "text-emerald-700"
              }`}
            >
              ข้อมูลรับเข้าทั้งหมด (คลิกดูเฉพาะรับเข้า)
            </span>
            <div
              className={`text-xl font-extrabold mt-0.5 font-mono ${
                selectedType === "in" ? "text-white" : "text-emerald-600"
              }`}
            >
              +{baseStats.totalQtyIn.toLocaleString()} หน่วย
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                selectedType === "in" ? "text-emerald-100" : "text-slate-500"
              }`}
            >
              รวม {baseStats.inCount.toLocaleString()} รายการ • ฿
              {baseStats.totalCostIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedType === "in"
                ? "bg-white/15 text-white"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Total Outgoing (จ่ายออกทั้งหมด) */}
        <div
          onClick={() => setSelectedType(selectedType === "out" ? "all" : "out")}
          className={`p-4 rounded-xl border shadow-sm flex items-center justify-between cursor-pointer transition ${
            selectedType === "out"
              ? "bg-rose-700 text-white border-rose-700 ring-2 ring-rose-300"
              : "bg-white text-slate-900 border-rose-200 hover:bg-rose-50/40"
          }`}
        >
          <div>
            <span
              className={`text-xs font-semibold ${
                selectedType === "out" ? "text-rose-100" : "text-rose-700"
              }`}
            >
              ข้อมูลจ่ายออกทั้งหมด (คลิกดูเฉพาะจ่ายออก)
            </span>
            <div
              className={`text-xl font-extrabold mt-0.5 font-mono ${
                selectedType === "out" ? "text-white" : "text-rose-600"
              }`}
            >
              -{baseStats.totalQtyOut.toLocaleString()} หน่วย
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                selectedType === "out" ? "text-rose-100" : "text-slate-500"
              }`}
            >
              รวม {baseStats.outCount.toLocaleString()} รายการ • ฿
              {baseStats.totalCostOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedType === "out"
                ? "bg-white/15 text-white"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Total Cost Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              มูลค่าเบิกจ่ายออกรวม (Out Cost)
            </span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
              ฿{baseStats.totalCostOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              มูลค่ารับเข้า: ฿
              {baseStats.totalCostIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
            ฿
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        {/* Quick Type Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-700 mr-1">มุมมองประวัติ:</span>
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedType === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด ({baseStats.allCount.toLocaleString()})
            </button>
            <button
              onClick={() => setSelectedType("in")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedType === "in"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>
                ดูรับเข้าทั้งหมด ({baseStats.inCount.toLocaleString()} รายการ | +
                {baseStats.totalQtyIn.toLocaleString()})
              </span>
            </button>
            <button
              onClick={() => setSelectedType("out")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedType === "out"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                ดูจ่ายออกทั้งหมด ({baseStats.outCount.toLocaleString()} รายการ | -
                {baseStats.totalQtyOut.toLocaleString()})
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ด, รายการ, ผู้เบิก, Supplier, วันที่..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ประเภท: ทั้งหมด ({baseStats.allCount.toLocaleString()})</option>
              <option value="in">เฉพาะรับเข้า (In: {baseStats.inCount.toLocaleString()})</option>
              <option value="out">เฉพาะจ่ายออก (Out: {baseStats.outCount.toLocaleString()})</option>
            </select>
          </div>

          {/* Line */}
          <div>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ไลน์: ทั้งหมด ({lines.length})</option>
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
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Supplier: ทั้งหมด ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Month / Year */}
          <div className="flex gap-1.5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ทุกเดือน</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  ด.{m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ทุกปี</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Sort Selection Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-slate-600 font-semibold">จัดเรียงข้อมูล:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  setSortField("date");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  sortField === "date" && sortDirection === "desc"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>📅 วันที่: ล่าสุด ไป ก่อน (Newest)</span>
              </button>
              <button
                onClick={() => {
                  setSortField("date");
                  setSortDirection("asc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  sortField === "date" && sortDirection === "asc"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>📅 วันที่: ก่อน ไป ล่าสุด (Oldest)</span>
              </button>
              <button
                onClick={() => {
                  setSortField("qtyIn");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === "qtyIn" && sortDirection === "desc"
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ยอดรับเข้ามากสุด
              </button>
              <button
                onClick={() => {
                  setSortField("qtyOut");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === "qtyOut" && sortDirection === "desc"
                    ? "bg-rose-600 text-white font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ยอดจ่ายออกมากสุด
              </button>
              <button
                onClick={() => {
                  setSortField("totalCost");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === "totalCost" && sortDirection === "desc"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ค่าใช้จ่ายสูงสุด
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80">
              💡 ดับเบิ้ลคลิกแถวเพื่อดูรายละเอียดสินค้าและประวัติทั้งหมดของสินค้านั้น
            </span>
            <button
              onClick={() => setShowAllDirectly(!showAllDirectly)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                showAllDirectly
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="สลับระหว่างการโหลดต่อเนื่อง กับ แสดงข้อมูลทั้งหมดทันที"
            >
              {showAllDirectly ? "แสดงครบทั้งหมดแล้ว" : "เลื่อนดูต่อเนื่อง (Scroll)"}
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 select-none border-b border-slate-200">
              <tr>
                <th className="p-3 w-12 text-center text-slate-500">#</th>
                <th
                  onClick={() => handleHeaderSort("date")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม วันที่"
                >
                  <div className="flex items-center gap-1">
                    <span>วันที่ (DATE)</span>
                    {renderSortIndicator("date")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("barcode")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม บาร์โค้ด"
                >
                  <div className="flex items-center gap-1">
                    <span>บาร์โค้ด</span>
                    {renderSortIndicator("barcode")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("itemName")}
                  className="p-3 min-w-[220px] cursor-pointer hover:bg-slate-200 transition group text-slate-800"
                  title="คลิกเพื่อเรียงตาม ชื่อสินค้า"
                >
                  <div className="flex items-center gap-1">
                    <span>รายการสินค้า</span>
                    {renderSortIndicator("itemName")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("supplier")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม Supplier"
                >
                  <div className="flex items-center gap-1">
                    <span>Supplier</span>
                    {renderSortIndicator("supplier")}
                  </div>
                </th>
                <th className="p-3 text-center text-slate-700">ประเภท</th>
                <th
                  onClick={() => handleHeaderSort("qtyIn")}
                  className="p-3 text-right cursor-pointer hover:bg-emerald-100/60 transition group text-emerald-800 bg-emerald-50/40"
                  title="คลิกเพื่อเรียงตาม จำนวนรับเข้า"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>รับเข้า (In)</span>
                    {renderSortIndicator("qtyIn")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("qtyOut")}
                  className="p-3 text-right cursor-pointer hover:bg-rose-100/60 transition group text-rose-800 bg-rose-50/40"
                  title="คลิกเพื่อเรียงตาม จำนวนจ่ายออก"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>จ่ายออก (Out)</span>
                    {renderSortIndicator("qtyOut")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("employee")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ผู้เบิก"
                >
                  <div className="flex items-center gap-1">
                    <span>ผู้เบิก / ผู้บันทึก</span>
                    {renderSortIndicator("employee")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("line")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ไลน์"
                >
                  <div className="flex items-center gap-1">
                    <span>ไลน์</span>
                    {renderSortIndicator("line")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("unitPrice")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ราคาต่อหน่วย"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ราคา/หน่วย</span>
                    {renderSortIndicator("unitPrice")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("totalCost")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ค่าใช้จ่าย"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ค่าใช้จ่าย</span>
                    {renderSortIndicator("totalCost")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("balance")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม คงเหลือ"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>คงเหลือ</span>
                    {renderSortIndicator("balance")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("status")}
                  className="p-3 text-center cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม สถานะ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    {renderSortIndicator("status")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-400 text-sm">
                    ไม่พบบันทึกการเบิกจ่ายตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx, idx) => {
                  const globalIdx = idx + 1;
                  const cleanCode = tx.barcode.trim().toLowerCase();
                  const hasIn = (tx.qtyIn || 0) > 0;
                  const hasOut = (tx.qtyOut || 0) > 0;
                  const supp = barcodeSupplierMap.get(cleanCode) || "-";
                  const effectiveLine = tx.line || barcodeLineMap.get(cleanCode) || "-";

                  return (
                    <tr
                      key={`${tx.id || "tx"}_${idx}`}
                      onDoubleClick={() => handleRowDoubleClick(tx)}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 48px" }}
                      className="hover:bg-amber-50/50 transition cursor-pointer select-none group"
                      title="ดับเบิ้ลคลิกเพื่อดูรายละเอียดและประวัติทั้งหมดของรายการสินค้านี้"
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">{globalIdx}</td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{tx.date}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{tx.barcode}</td>
                      <td className="p-3 font-medium text-slate-900">{tx.itemName}</td>
                      <td className="p-3 text-slate-600">
                        <span className="truncate max-w-[130px] inline-block" title={supp}>
                          {supp}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {hasIn && hasOut ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              รับเข้า
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              จ่ายออก
                            </span>
                          </div>
                        ) : hasIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            รับเข้า
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            จ่ายออก
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold bg-emerald-50/20 whitespace-nowrap">
                        {hasIn ? (
                          <span className="text-emerald-600">
                            +{tx.qtyIn.toLocaleString()}{" "}
                            <span className="text-[10px] font-normal text-slate-400">
                              {tx.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold bg-rose-50/20 whitespace-nowrap">
                        {hasOut ? (
                          <span className="text-rose-600">
                            -{tx.qtyOut.toLocaleString()}{" "}
                            <span className="text-[10px] font-normal text-slate-400">
                              {tx.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 font-medium">{tx.employeeName || "-"}</div>
                        {tx.employeeId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {tx.employeeId}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{effectiveLine}</td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        ฿
                        {tx.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ||
                          "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        ฿
                        {tx.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ||
                          "0"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800">
                        {tx.balance?.toLocaleString() ?? "-"}
                      </td>
                      <td className="p-3 text-center">
                        {tx.status === "ต้องทำการซื้อ" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> ต้องซื้อ
                          </span>
                        ) : tx.status ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {tx.status}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Continuous scroll sentinel */}
        <div ref={sentinelRef} className="h-4 w-full" />

        {/* Continuous Scroll Info Bar */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">
              แสดง {displayedTransactions.length.toLocaleString()} จาก{" "}
              {sortedTransactions.length.toLocaleString()} รายการ
            </span>
            {displayedTransactions.length < sortedTransactions.length && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                เลื่อนลงเพื่อดูข้อมูลเพิ่มอัตโนมัติ
              </span>
            )}
            {displayedTransactions.length >= sortedTransactions.length &&
              sortedTransactions.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
                  ✓ แสดงครบทุกรายการแล้ว
                </span>
              )}
          </div>

          <div className="flex items-center gap-2">
            {displayedTransactions.length < sortedTransactions.length && (
              <>
                <button
                  onClick={() =>
                    setVisibleCount((prev) => Math.min(prev + 200, sortedTransactions.length))
                  }
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition cursor-pointer shadow-2xs"
                >
                  โหลดเพิ่ม +200 รายการ
                </button>
                <button
                  onClick={() => setShowAllDirectly(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition cursor-pointer shadow-2xs"
                >
                  แสดงทั้งหมด ({sortedTransactions.length.toLocaleString()})
                </button>
              </>
            )}
            {showAllDirectly && sortedTransactions.length > INITIAL_BATCH && (
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
    </div>
  );
};
