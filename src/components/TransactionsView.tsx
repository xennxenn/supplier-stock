import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import {
  FileSpreadsheet,
  Search,
  Download,
  Calendar,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Info,
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

  const INITIAL_BATCH = 60;
  const BATCH_INCREMENT = 60;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [showAllDirectly, setShowAllDirectly] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Map barcodes to Supplier
  const barcodeSupplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of stockItems) {
      if (item.supplier) {
        map.set(item.barcode.trim().toLowerCase(), item.supplier);
      }
    }
    return map;
  }, [stockItems]);

  // Map barcodes to Item Line (fallback for transactions with missing line stamp)
  const barcodeLineMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of stockItems) {
      if (item.line) map.set(item.barcode.trim().toLowerCase(), item.line);
    }
    return map;
  }, [stockItems]);

  // Map barcodes to StockItem for quick double-click lookup
  const barcodeItemMap = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const item of stockItems) {
      const code = item.barcode.trim().toLowerCase();
      if (!map.has(code)) {
        map.set(code, item);
      }
    }
    return map;
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
        line: tx.line || "",
        supplier: supp !== "-" ? supp : "",
        unit: tx.unit || "ชิ้น",
        forwardBalance: 0,
        currentBalance: tx.balance || 0,
        qty: tx.balance || 0,
        minStock: 0,
        unitCost: tx.unitPrice || 0,
        image: "",
        location: "-",
        note: "",
        updatedAt: tx.date,
      };
      onSelectItem(fallbackItem);
    }
  };

  // Unique Suppliers list
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const item of stockItems) {
      if (item.supplier) set.add(item.supplier);
    }
    return Array.from(set).sort();
  }, [stockItems]);

  // Extract unique months and years from data
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const t of transactions) {
      if (t.year) set.add(t.year);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const cleanBarcode = t.barcode.trim().toLowerCase();
      const supp = barcodeSupplierMap.get(cleanBarcode) || "";
      const effectiveLine = t.line?.trim() || barcodeLineMap.get(cleanBarcode) || "";

      if (deferredSearch) {
        const q = deferredSearch.toLowerCase().trim();
        const matchBarcode = t.barcode.toLowerCase().includes(q);
        const matchName = t.itemName.toLowerCase().includes(q);
        const matchEmpName = (t.employeeName || "").toLowerCase().includes(q);
        const matchEmpId = (t.employeeId || "").toLowerCase().includes(q);
        const matchDate = (t.date || "").toLowerCase().includes(q);
        const matchSupplier = supp.toLowerCase().includes(q);
        const matchLine = effectiveLine.toLowerCase().includes(q);

        if (!matchBarcode && !matchName && !matchEmpName && !matchEmpId && !matchDate && !matchSupplier && !matchLine) {
          return false;
        }
      }

      if (selectedType === "in" && t.qtyIn <= 0) return false;
      if (selectedType === "out" && t.qtyOut <= 0) return false;

      if (selectedLine !== "all" && !matchesLine(effectiveLine, selectedLine)) {
        return false;
      }

      if (selectedSupplier !== "all" && !matchesExactOrToken(supp, selectedSupplier)) {
        return false;
      }

      if (selectedStatus !== "all" && t.status !== selectedStatus) return false;

      if (selectedMonth !== "all" && t.month !== Number(selectedMonth)) return false;
      if (selectedYear !== "all" && t.year !== Number(selectedYear)) return false;

      // Filter out rows with no date
      if (!t.date || t.date.trim() === "") return false;

      return true;
    });
  }, [
    transactions,
    deferredSearch,
    selectedType,
    selectedLine,
    selectedSupplier,
    selectedStatus,
    selectedMonth,
    selectedYear,
    barcodeSupplierMap,
    barcodeLineMap,
  ]);

  // Sort transactions with robust handlers
  const sortedTransactions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "date": {
          const timeA = parseFlexibleDate(a.date, a.year, a.month);
          const timeB = parseFlexibleDate(b.date, b.year, b.month);
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
        case "qty": {
          const qtyA = (a.qtyIn || 0) + (a.qtyOut || 0);
          const qtyB = (b.qtyIn || 0) + (b.qtyOut || 0);
          result = qtyA - qtyB;
          break;
        }
        case "employee":
          result = (a.employeeName || a.employeeId || "").localeCompare(b.employeeName || b.employeeId || "");
          break;
        case "line":
          result = (a.line || "").localeCompare(b.line || "");
          break;
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
  }, [filtered, sortField, sortDirection, barcodeSupplierMap]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // For numbers/costs/dates default to desc, for text asc
      if (["date", "qty", "totalCost", "unitPrice", "balance"].includes(field)) {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  };

  // Reset visible count when filters or sorting change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [search, selectedType, selectedLine, selectedSupplier, selectedStatus, selectedMonth, selectedYear, sortField, sortDirection]);

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
          }, 120);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showAllDirectly, visibleCount, sortedTransactions.length]);

  // Summary of filtered dataset
  const totalQtyIn = useMemo(
    () => sortedTransactions.reduce((sum, t) => sum + (t.qtyIn || 0), 0),
    [sortedTransactions]
  );
  const totalQtyOut = useMemo(
    () => sortedTransactions.reduce((sum, t) => sum + (t.qtyOut || 0), 0),
    [sortedTransactions]
  );
  const totalCostSum = useMemo(
    () => sortedTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0),
    [sortedTransactions]
  );

  const getExportData = () => {
    const headers = [
      "DATE",
      "BARCODE",
      "รายการ",
      "Supplier",
      "หน่วย",
      "รับเข้า",
      "จ่ายออก",
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

    const rows = sortedTransactions.map((t) => [
      t.date || "",
      t.barcode || "",
      t.itemName || "",
      barcodeSupplierMap.get(t.barcode.trim().toLowerCase()) || "",
      t.unit || "",
      t.qtyIn || 0,
      t.qtyOut || 0,
      t.employeeId || "",
      t.employeeName || "",
      t.line || "",
      t.unitPrice || 0,
      t.totalCost || 0,
      t.month || "",
      t.year || "",
      t.balance || 0,
      t.minStock || 0,
      t.status || "",
    ]);

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
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 font-bold" />
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            บันทึกรายการเบิกจ่าย (Disbursement & Receipts History)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            พบทั้งหมด <span className="font-bold text-slate-800">{sortedTransactions.length.toLocaleString()}</span> จาก{" "}
            {transactions.length.toLocaleString()} รายการ
          </p>
        </div>

        {hasPermission(currentUser, "importExport") && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500">ยอดรับเข้ารวม (ช่วงที่เลือก)</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">
              +{totalQtyIn.toLocaleString()} ชิ้น
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500">ยอดจ่ายออกรวม (ช่วงที่เลือก)</span>
            <div className="text-lg font-bold text-amber-600 mt-0.5">
              -{totalQtyOut.toLocaleString()} ชิ้น
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500">มูลค่าค่าใช้จ่ายรวม</span>
            <div className="text-lg font-bold text-slate-800 mt-0.5">
              ฿{totalCostSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
            ฿
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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
              <option value="all">ประเภท: ทั้งหมด</option>
              <option value="in">รับเข้า (In)</option>
              <option value="out">จ่ายออก (Out)</option>
            </select>
          </div>

          {/* Line */}
          <div>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ไลน์: ทั้งหมด</option>
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
                  setSortField("qty");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === "qty" && sortDirection === "desc"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                จำนวนมากสุด
              </button>
              <button
                onClick={() => {
                  setSortField("totalCost");
                  setSortDirection("desc");
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === "totalCost" && sortDirection === "desc"
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ค่าใช้จ่ายสูงสุด
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80">
              💡 ดับเบิ้ลคลิกแถวเพื่อดูรายละเอียดสินค้า
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
                  onClick={() => handleHeaderSort("qty")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม จำนวน"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>จำนวน</span>
                    {renderSortIndicator("qty")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("employee")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ผู้เบิก"
                >
                  <div className="flex items-center gap-1">
                    <span>ผู้เบิก (รหัส)</span>
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
                  <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                    ไม่พบบันทึกการเบิกจ่ายตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx, idx) => {
                  const globalIdx = idx + 1;
                  const isIn = tx.qtyIn > 0;
                  const supp = barcodeSupplierMap.get(tx.barcode.trim().toLowerCase()) || "-";

                  return (
                    <tr
                      key={`${tx.id || "tx"}_${idx}`}
                      onDoubleClick={() => handleRowDoubleClick(tx)}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 48px" }}
                      className="hover:bg-amber-50/50 transition cursor-pointer select-none group"
                      title="ดับเบิ้ลคลิกเพื่อดูรายละเอียดของรายการสินค้านี้"
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {tx.barcode}
                      </td>
                      <td className="p-3 font-medium text-slate-900">
                        {tx.itemName}
                      </td>
                      <td className="p-3 text-slate-600">
                        <span className="truncate max-w-[130px] inline-block" title={supp}>
                          {supp}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            รับเข้า
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            จ่ายออก
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={isIn ? "text-emerald-600" : "text-rose-600"}>
                          {isIn
                            ? `+${tx.qtyIn.toLocaleString()}`
                            : `-${tx.qtyOut.toLocaleString()}`}
                        </span>{" "}
                        <span className="text-[10px] text-slate-400">{tx.unit}</span>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 font-medium">
                          {tx.employeeName || "-"}
                        </div>
                        {tx.employeeId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {tx.employeeId}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{tx.line || "-"}</td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        ฿{tx.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        ฿{tx.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800">
                        {tx.balance?.toLocaleString() || "-"}
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
              แสดง {displayedTransactions.length.toLocaleString()} จาก {sortedTransactions.length.toLocaleString()} รายการ
            </span>
            {displayedTransactions.length < sortedTransactions.length && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                เลื่อนลงเพื่อดูข้อมูลเพิ่มอัตโนมัติ
              </span>
            )}
            {displayedTransactions.length >= sortedTransactions.length && sortedTransactions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
                ✓ แสดงครบทุกรายการแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {displayedTransactions.length < sortedTransactions.length && (
              <>
                <button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 200, sortedTransactions.length))}
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
