import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Download,
  ShoppingBag,
  Search,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Calculator,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Coins,
  Boxes,
} from "lucide-react";
import type { StockItem, Employee, OrderStatus, Transaction } from "../types";
import { exportToExcel, exportToCSV } from "../utils/exportUtils";
import { hasPermission } from "../utils/permissionUtils";

interface LowStockAlertsViewProps {
  items: StockItem[];
  transactions: Transaction[];
  lines: string[];
  currentUser?: Employee;
  onSelectItem: (item: StockItem) => void;
  onQuickMove: (item: StockItem, type: "in" | "out") => void;
}

type LowStockSortField =
  | "barcode"
  | "name"
  | "line"
  | "balance"
  | "minStock"
  | "deficit"
  | "cost"
  | "estimatedCost"
  | "supplier"
  | "risk";

export const LowStockAlertsView: React.FC<LowStockAlertsViewProps> = ({
  items,
  transactions,
  lines,
  currentUser,
  onSelectItem,
  onQuickMove,
}) => {
  const canReceive = hasPermission(currentUser, "receive");
  const canExport = hasPermission(currentUser, "importExport");
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [safetyBufferPercent, setSafetyBufferPercent] = useState<number>(30); // 30% buffer over min stock
  const [sortField, setSortField] = useState<LowStockSortField>("estimatedCost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");
  const [currentLotNumber, setCurrentLotNumber] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "single" | "lot";
    item?: StockItem;
    lotNumber?: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [selectedClearLot, setSelectedClearLot] = useState<string>("");

  const activeLots = useMemo(() => {
    const lots = new Set<string>();
    orderStatuses.forEach(s => {
      if (s.isOrdered && s.lotNumber) lots.add(s.lotNumber);
    });
    return Array.from(lots).sort();
  }, [orderStatuses]);

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

  const handleToggleOrderStatus = async (item: StockItem, isOrdered: boolean, lotNumber: string) => {
    if (isOrdered && !lotNumber) {
      alert("กรุณาระบุเลขที่ Lot เพื่อกำกับ");
      return;
    }
    if (!isOrdered) {
      setConfirmText("");
      setConfirmModal({ isOpen: true, type: "single", item });
      return;
    }
    
    // Optimistic update
    setOrderStatuses((prev) => {
      const idx = prev.findIndex(s => s.barcode === item.barcode);
      const newStatus = { barcode: item.barcode, isOrdered, lotNumber, updatedAt: new Date().toISOString() };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newStatus;
        return next;
      }
      return [...prev, newStatus];
    });

    try {
      await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: item.barcode, isOrdered, lotNumber })
      });
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการบันทึกสถานะ");
    }
  };

  const executeClearStatus = async () => {
    if (confirmText !== "confirm") {
      alert("กรุณาพิมพ์คำว่า 'confirm' ให้ถูกต้อง");
      return;
    }
    
    if (!confirmModal) return;

    if (confirmModal.type === "single" && confirmModal.item) {
      // Optimistic update single
      const targetItem = confirmModal.item;
      setOrderStatuses((prev) => {
        const idx = prev.findIndex(s => s.barcode === targetItem.barcode);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], isOrdered: false };
          return next;
        }
        return prev;
      });

      try {
        await fetch("/api/order-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: targetItem.barcode, isOrdered: false, lotNumber: "" })
        });
      } catch (e) {
        console.error(e);
      }
    } else if (confirmModal.type === "lot" && confirmModal.lotNumber) {
      const targetLot = confirmModal.lotNumber;
      // Optimistic update batch
      setOrderStatuses((prev) => {
        return prev.map(s => s.lotNumber === targetLot ? { ...s, isOrdered: false } : s);
      });

      try {
        await fetch("/api/order-status-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotNumber: targetLot, isOrdered: false })
        });
      } catch (e) {
        console.error(e);
      }
    }

    setConfirmModal(null);
    setConfirmText("");
    setSelectedClearLot("");
  };


  // Low stock items: where currentBalance <= minStock and minStock > 0
  
  // Calculate historical monthly burn rate per SKU from transactions
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

    const calculatedSpan = Math.max(3, monthKeySet.size || 6);

    const burnRates = new Map<string, number>();
    usageMap.forEach((totalOut, barcode) => {
      burnRates.set(barcode, totalOut / calculatedSpan);
    });

    return { burnRateMap: burnRates, monthsSpan: calculatedSpan };
  }, [transactions]);

  const lowStockItems = useMemo(() => {
    return items.filter((it) => it.currentBalance <= it.minStock && it.minStock > 0);
  }, [items]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of lowStockItems) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [lowStockItems]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of lowStockItems) {
      if (it.supplier) set.add(it.supplier);
    }
    return Array.from(set).sort();
  }, [lowStockItems]);

  const filtered = useMemo(() => {
    return lowStockItems.filter((it) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !it.barcode.toLowerCase().includes(q) &&
          !it.name.toLowerCase().includes(q) &&
          !(it.supplier || "").toLowerCase().includes(q) &&
          !(it.category || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (selectedLine !== "all" && it.line !== selectedLine) return false;
      if (selectedCategory !== "all" && it.category !== selectedCategory) return false;
      if (selectedSupplier !== "all" && it.supplier !== selectedSupplier) return false;
      const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
      const isOrdered = oStatus?.isOrdered || false;
      if (filterOrderStatus === "ordered" && !isOrdered) return false;
      if (filterOrderStatus === "not_ordered" && isOrdered) return false;

      return true;
    });
  }, [lowStockItems, search, selectedLine, selectedCategory, selectedSupplier, filterOrderStatus, orderStatuses]);

  // Compute reorder quantities and estimated costs
  const reorderCalculations = useMemo(() => {
    const calculated = filtered.map((it) => {
      const targetStock = Math.ceil(it.minStock * (1 + safetyBufferPercent / 100));
      const deficit = Math.max(0, targetStock - it.currentBalance);
      const estimatedCost = deficit * it.unitCost;
      const percentOfMin = Math.round((it.currentBalance / (it.minStock || 1)) * 100);
      
      // Calculate risk similarly to Forecast Planning
      const bKey = it.barcode.trim().toLowerCase();
      let monthlyBurnRate = burnRateMap.get(bKey) || 0;
      if (monthlyBurnRate === 0 && it.minStock > 0) {
        monthlyBurnRate = Math.max(0.5, it.minStock / 3);
      }
      const monthsOfStockRemaining = monthlyBurnRate > 0 ? it.currentBalance / monthlyBurnRate : 999;
      
      let riskLevel: "critical" | "warning" | "ok" | "overstock" = "ok";
      if (monthsOfStockRemaining < 1 || (it.currentBalance <= 0 && monthlyBurnRate > 0)) {
        riskLevel = "critical";
      } else if (monthsOfStockRemaining < 6) { // Default forecast horizon
        riskLevel = "warning";
      } else if (monthsOfStockRemaining > 15 && it.currentBalance > 50) {
        riskLevel = "overstock";
      }

      return {
        item: it,
        targetStock,
        deficit,
        estimatedCost,
        percentOfMin,
        riskLevel,
        monthsOfStockRemaining,
      };

    });

    return calculated.sort((a, b) => {
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
        case "minStock":
          res = a.item.minStock - b.item.minStock;
          break;
        case "deficit":
          res = a.deficit - b.deficit;
          break;
        case "cost":
          res = a.item.unitCost - b.item.unitCost;
          break;
        case "estimatedCost":
          res = a.estimatedCost - b.estimatedCost;
          break;
        case "supplier":
          res = (a.item.supplier || "").localeCompare(b.item.supplier || "");
          break;

        case "risk":
          const riskWeight = { critical: 4, warning: 3, ok: 2, overstock: 1 };
          res = riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
          break;

        default:
          res = 0;
      }
      return sortOrder === "asc" ? res : -res;
    });
  }, [filtered, safetyBufferPercent, sortField, sortOrder]);

  const handleHeaderSort = (field: LowStockSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (["deficit", "estimatedCost", "minStock"].includes(field)) {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    }
  };

  const renderSortIcon = (field: LowStockSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 font-bold" />
    );
  };

  const totalEstimatedCost = useMemo(
    () => reorderCalculations.reduce((sum, r) => sum + r.estimatedCost, 0),
    [reorderCalculations]
  );
  const totalUnitsToOrder = useMemo(
    () => reorderCalculations.reduce((sum, r) => sum + r.deficit, 0),
    [reorderCalculations]
  );

  const getExportData = () => {
    const headers = [
      "Barcode",
      "ชื่อรายการสินค้า",
      "ชนิด",
      "หน่วย",
      "ไลน์",
      "คงเหลือปัจจุบัน",
      "Min Stock",
      `จำนวนแนะนำให้สั่งซื้อ (+${safetyBufferPercent}%)`,
      "ราคาต่อหน่วย (บาท)",
      "ประมาณการค่าใช้จ่าย (บาท)",
      "Supplier",
      "ตำแหน่งจัดเก็บ",
    ];

    const rows = reorderCalculations.map((r) => [
      r.item.barcode || "",
      r.item.name || "",
      r.item.category || "",
      r.item.unit || "",
      r.item.line || "",
      r.item.currentBalance || 0,
      r.item.minStock || 0,
      r.deficit || 0,
      r.item.unitCost || 0,
      parseFloat(r.estimatedCost.toFixed(2)),
      r.item.supplier || "",
      r.item.location || "",
    ]);

    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    exportToCSV("PASAYA_PURCHASE_REORDER_LIST", headers, rows);
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    exportToExcel("PASAYA_PURCHASE_REORDER_LIST", "ReorderPlan", headers, rows);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 p-6 rounded-2xl text-slate-900 shadow-xs border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>ระบบแจ้งเตือนสต็อกต่ำ & แนะนำการสั่งซื้อ (Reorder Planning)</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            รายการสินค้าที่ต้องสั่งซื้อ ({filtered.length} รายการ)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            คำนวณจากเกณฑ์ Min Stock พร้อมเผื่อ Safety Stock สำหรับกระบวนการผลิต
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              title="ส่งออกใบสั่งซื้อ Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs transition cursor-pointer"
              title="ส่งออกใบสั่งซื้อ CSV (.csv)"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500">จำนวน SKU ที่ต้องสั่งซื้อ (ที่เลือก)</span>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">
            {filtered.length.toLocaleString()} รายการ
          </div>
          <span className="text-xs text-slate-400">
            จากทั้งหมด {lowStockItems.length} รายการที่ต่ำกว่า Min
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500">จำนวนชิ้นที่แนะนำให้สั่งซื้อ</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {totalUnitsToOrder.toLocaleString()} หน่วย
          </div>
          <span className="text-xs text-slate-400">
            คำนวณเติมเต็มเป้าหมาย + Buffer {safetyBufferPercent}%
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500">ประมาณการงบประมาณสั่งซื้อ</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">
            ฿{totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <span className="text-xs text-slate-400">
            คำนวณจากราคาต่อหน่วยของแต่ละ Supplier
          </span>
        </div>
      </div>

      {/* Filters & Safety Buffer Setting */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ด, รายการ, Supplier, ชนิด..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Line filter */}
          <div>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
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

          {/* Category filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ชนิดสินค้าทั้งหมด ({uniqueCategories.length})</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          
          {/* Order Status filter */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">สถานะหมายเหตุทั้งหมด</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
            </select>
          </div>

          {/* Supplier filter */}
          <div>
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

        {/* Safety buffer setting & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-slate-700">Safety Buffer เผื่อสั่งซื้อ:</span>
            </div>
            {[0, 20, 30, 50].map((pct) => (
              <button
                key={pct}
                onClick={() => setSafetyBufferPercent(pct)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  safetyBufferPercent === pct
                    ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                +{pct}% {pct === 0 ? "(พอดี Min)" : ""}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">เรียงตาม:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="estimatedCost">งบประมาณสั่งซื้อสูงสุด</option>
              <option value="deficit">จำนวนขาดสูงสุด</option>
              <option value="balance">คงเหลือน้อยสุด</option>
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

      
      {/* Global Lot Number Input */}
      <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-slate-800">เลขที่ Lot ปัจจุบันสำหรับการสั่งซื้อ:</span>
          <input 
            type="text" 
            placeholder="ระบุเลขที่ Lot..." 
            value={currentLotNumber}
            onChange={(e) => setCurrentLotNumber(e.target.value)}
            className="px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
          />
          <span className="text-xs text-slate-500 hidden xl:inline">(พิมพ์เลขที่ Lot ก่อนติ๊กด้านล่าง)</span>
        </div>
        
        {activeLots.length > 0 && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <span className="text-xs font-semibold text-slate-700">ล้างหมายเหตุ:</span>
            <select
              value={selectedClearLot}
              onChange={(e) => setSelectedClearLot(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[120px]"
            >
              <option value="">-- เลือก Lot --</option>
              {activeLots.map(lot => (
                <option key={lot} value={lot}>{lot}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (selectedClearLot) {
                  setConfirmText("");
                  setConfirmModal({ isOpen: true, type: "lot", lotNumber: selectedClearLot });
                } else {
                  alert("กรุณาเลือก Lot ก่อน");
                }
              }}
              disabled={!selectedClearLot}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 whitespace-nowrap"
            >
              ล้าง Lot นี้
            </button>
          </div>
        )}
      </div>

      {/* Reorder Table */}
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
                  title="คลิกเพื่อเรียงตาม คงเหลือ"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>คงเหลือ</span>
                    {renderSortIcon("balance")}
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
                  onClick={() => handleHeaderSort("deficit")}
                  className="p-3 text-right font-bold text-amber-700 cursor-pointer hover:bg-slate-200 transition group"
                  title="คลิกเพื่อเรียงตาม แนะนำสั่งซื้อ"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>แนะนำสั่งซื้อ (+{safetyBufferPercent}%)</span>
                    {renderSortIcon("deficit")}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("cost")}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม ราคา/หน่วย"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ราคา/หน่วย</span>
                    {renderSortIcon("cost")}
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
                  onClick={() => handleHeaderSort("supplier")}
                  className="p-3 cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม Supplier"
                >
                  <div className="flex items-center gap-1">
                    <span>Supplier</span>
                    {renderSortIcon("supplier")}
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

                <th className="p-3 text-center w-24 text-slate-700">ทำรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reorderCalculations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400 text-sm">
                    ไม่มีรายการสินค้าที่ต้องสั่งซื้อตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                reorderCalculations.map((r, idx) => {
                  const it = r.item;
                  const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                  const isOrdered = oStatus?.isOrdered || false;

                  return (
                    <tr
                      key={it.id}
                      onClick={() => onSelectItem(it)}
                      className={`transition cursor-pointer ${isOrdered ? "bg-emerald-50/70 hover:bg-emerald-100" : "hover:bg-amber-50/40"}`}
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {it.barcode}
                      </td>
                      <td className="p-3 font-medium text-slate-900">
                        <div>{it.name}</div>
                        <div className="text-[10px] text-slate-400">
                          ชนิด: {it.category} | คลัง: {it.location || "-"}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{it.line || "-"}</td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-rose-600 font-mono">
                          {it.currentBalance.toLocaleString()}
                        </span>{" "}
                        <span className="text-[10px] text-slate-400">{it.unit}</span>
                        <div className="text-[10px] text-slate-400">
                          ({r.percentOfMin}% ของ Min)
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {it.minStock.toLocaleString()} {it.unit}
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          +{r.deficit.toLocaleString()} {it.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        ฿{it.unitCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        ฿{r.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {it.supplier || "-"}
                      </td>

                      <td className="p-3 text-center">
                        {r.riskLevel === "critical" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" /> วิกฤต
                          </span>
                        ) : r.riskLevel === "warning" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            สั่งซื้อ 6M
                          </span>
                        ) : r.riskLevel === "overstock" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            สต็อกล้น
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> เพียงพอ
                          </span>
                        )}
<div className="text-[9px] text-slate-400 mt-0.5">
                          {r.monthsOfStockRemaining > 90 ? ">90" : r.monthsOfStockRemaining.toFixed(1)} ด.
                        </div>
                        {isOrdered && (
                          <div className="mt-1">
                            <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              สั่งซื้อรอจัดส่ง (Lot: {oStatus?.lotNumber || "-"})
                            </span>
                          </div>
                        )}
                      </td>


                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 cursor-pointer accent-amber-600"
                            checked={isOrdered}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleToggleOrderStatus(it, checked, checked ? currentLotNumber : (oStatus?.lotNumber || ""));
                            }}
                          />
                          {isOrdered && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                              Lot: {oStatus?.lotNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {canReceive ? (
                          <button
                            onClick={() => onQuickMove(it, "in")}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                          >
                            + รับเข้า
                          </button>
                        ) : (
                          <button
                            onClick={() => onSelectItem(it)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                          >
                            ดูข้อมูล
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Confirm Clear Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              ยืนยันการล้างสถานะ (ของมาแล้ว)
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmModal.type === "single" 
                ? `ล้างสถานะรายการ ${confirmModal.item?.name}` 
                : `ล้างสถานะทุกรายการใน Lot: ${confirmModal.lotNumber}`}
            </p>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4">
              <p className="text-xs text-amber-800 font-medium">
                การล้างสถานะนี้หมายความว่าสินค้าได้ถูกจัดส่งเรียบร้อยแล้ว พิมพ์ <span className="font-mono font-bold text-rose-600 bg-white px-1 py-0.5 rounded border border-amber-100">confirm</span> ในช่องด้านล่างเพื่อยืนยัน
              </p>
            </div>
            <input
              type="text"
              placeholder="พิมพ์ confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeClearStatus}
                disabled={confirmText !== "confirm"}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
              >
                ยืนยันการล้างสถานะ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
