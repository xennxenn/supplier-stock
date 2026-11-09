import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { doc, setDoc, onSnapshot, writeBatch, deleteDoc } from "firebase/firestore";
import {
  db,
  orderStatusCol,
  getOrderStatusDocId,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import {
  AlertTriangle,
  Download,
  ShoppingBag,
  Search,
  CheckCircle2,
  Package,
  Layers,
  Calculator,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Boxes,
  Calendar,
  AlertCircle,
} from "lucide-react";
import type {
  StockItem,
  Employee,
  OrderStatus,
  Transaction,
  PurchaseOrderItem,
} from "../types";
import { exportToExcel, exportToCSV } from "../utils/exportUtils";
import { hasPermission } from "../utils/permissionUtils";
import { matchesLineMulti, matchesExactOrTokenMulti } from "../utils/filterUtils";
import { computeBurnRateData } from "../utils/usageUtils";
import { OrderLotManager } from "./OrderLotManager";
import { MultiSelectFilter } from "./MultiSelectFilter";

interface LowStockAlertsViewProps {
  items: StockItem[];
  transactions: Transaction[];
  lines: string[];
  currentUser?: Employee;
  onSelectItem: (item: StockItem) => void;
  onQuickMove: (item: StockItem, type: "in" | "out") => void;
  onCreatePurchaseOrder?: (
    items: PurchaseOrderItem[],
    filterSummary: string,
    bufferPercent: number
  ) => void;
  onNavigateToMonthly?: () => void;
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

const INITIAL_BATCH = 50;
const BATCH_INCREMENT = 60;

export const LowStockAlertsView: React.FC<LowStockAlertsViewProps> = ({
  items,
  transactions,
  lines,
  currentUser,
  onSelectItem,
  onQuickMove,
  onCreatePurchaseOrder,
  onNavigateToMonthly,
}) => {
  const canReceive = hasPermission(currentUser, "receive");
  const canExport = hasPermission(currentUser, "importExport");
  const canManageOrderStatus = hasPermission(currentUser, "manageOrderStatus");

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [safetyBufferPercent, setSafetyBufferPercent] = useState<number>(30); // 30% buffer over min stock
  const [alertCriteria, setAlertCriteria] = useState<"minStock" | "includeZero">("minStock");
  const [sortField, setSortField] = useState<LowStockSortField>("estimatedCost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const [showAllDirectly, setShowAllDirectly] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const showNotice = (text: string, type: "ok" | "error" = "error") => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const [activeLotNumber, setActiveLotNumber] = useState<string>(() => {
    try {
      return localStorage.getItem("pasaya_active_order_lot") || "";
    } catch {
      return "";
    }
  });
  const [lotInput, setLotInput] = useState<string>(() => {
    try {
      return localStorage.getItem("pasaya_active_order_lot") || "";
    } catch {
      return "";
    }
  });
  const [showClearLotModal, setShowClearLotModal] = useState<boolean>(false);
  const [selectedLotToClear, setSelectedLotToClear] = useState<string>("");
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // O(1) lookup map for orderStatuses by barcode
  const orderStatusMap = useMemo(() => {
    const map = new Map<string, OrderStatus>();
    for (let i = 0; i < orderStatuses.length; i++) {
      const s = orderStatuses[i];
      if (s && s.barcode) {
        map.set(String(s.barcode).trim(), s);
      }
    }
    return map;
  }, [orderStatuses]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      orderStatusCol,
      (snapshot) => {
        const statuses = snapshot.docs.map((d) => d.data() as OrderStatus);
        setOrderStatuses(statuses);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "orderStatuses");
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSaveActiveLot = () => {
    if (!canManageOrderStatus) {
      showNotice("คุณไม่มีสิทธิ์จัดการรอบสั่งซื้อ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์");
      return;
    }
    const trimmed = String(lotInput || "").trim();
    if (!trimmed) {
      showNotice("กรุณาระบุ หรือเลือกเลขที่ Lot การสั่งซื้อก่อนกดบันทึก");
      return;
    }
    setActiveLotNumber(trimmed);
    try {
      localStorage.setItem("pasaya_active_order_lot", trimmed);
    } catch {}
    showNotice(`บันทึกและเปิดใช้งานรอบ Lot "${trimmed}" เรียบร้อยแล้ว`, "ok");
  };

  const handleUnlockLot = () => {
    setActiveLotNumber("");
    setLotInput("");
    try {
      localStorage.removeItem("pasaya_active_order_lot");
    } catch {}
  };

  const handleToggleOrderStatus = async (barcode: string, checked: boolean) => {
    if (!canManageOrderStatus) {
      showNotice("คุณไม่มีสิทธิ์จัดการรอบสั่งซื้อ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์");
      return;
    }
    if (!activeLotNumber) {
      showNotice("กรุณาสร้างหรือเลือกเลขที่ Lot และกดปุ่ม 'บันทึก Lot' ด้านบนก่อนทำการติ๊กสั่งซื้อ");
      return;
    }
    const cleanBarcode = String(barcode || "").trim();
    if (!cleanBarcode) return;

    // Optimistic UI update
    const updatedAt = new Date().toISOString();
    setOrderStatuses((prev) => {
      const without = prev.filter((s) => String(s?.barcode || "").trim() !== cleanBarcode);
      if (!checked) return without;
      return [
        ...without,
        {
          barcode: cleanBarcode,
          isOrdered: true,
          lotNumber: activeLotNumber,
          updatedAt,
        },
      ];
    });

    try {
      const ref = doc(db, "orderStatuses", getOrderStatusDocId(cleanBarcode));
      if (checked) {
        await setDoc(ref, {
          barcode: cleanBarcode,
          isOrdered: true,
          lotNumber: activeLotNumber,
          updatedAt,
        });
        fetch("/api/order-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: cleanBarcode,
            isOrdered: true,
            lotNumber: activeLotNumber,
          }),
        }).catch((err) => console.warn("Sync order status fallback:", err));
      } else {
        await deleteDoc(ref);
        fetch("/api/order-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: cleanBarcode,
            isOrdered: false,
            lotNumber: "",
          }),
        }).catch((err) => console.warn("Sync order status fallback:", err));
      }
    } catch (err) {
      console.error("Error updating order status:", err);
      showNotice("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleClearLot = async (targetLot: string) => {
    if (!canManageOrderStatus) {
      showNotice("คุณไม่มีสิทธิ์จัดการรอบสั่งซื้อ กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    if (!targetLot) return;

    setIsClearing(true);
    try {
      const cleanTarget = String(targetLot).trim().toLowerCase();
      const isMatch = (s: OrderStatus) => {
        if (!s || !s.isOrdered) return false;
        const sLot = typeof s.lotNumber === "string" ? s.lotNumber.trim() : String(s.lotNumber || "").trim();
        if (cleanTarget === "__all__") return true;
        if (cleanTarget === "ไม่ระบุ lot" || cleanTarget === "unspecified") {
          return !sLot;
        }
        return sLot.toLowerCase() === cleanTarget;
      };

      const toDelete = orderStatuses.filter(isMatch);

      // 1. Optimistic UI update immediately
      const toDeleteBarcodes = new Set(toDelete.map((s) => String(s.barcode || "").trim()));
      setOrderStatuses((prev) =>
        prev.filter((s) => !toDeleteBarcodes.has(String(s?.barcode || "").trim()))
      );

      // 2. Delete documents in Firestore in chunks of 400
      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 400) {
          const chunk = toDelete.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((s) => {
            if (s.barcode) {
              batch.delete(doc(db, "orderStatuses", getOrderStatusDocId(s.barcode)));
            }
          });
          await batch.commit();
        }
      }

      // 3. Sync through server endpoint
      fetch("/api/order-status-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotNumber: targetLot, isOrdered: false }),
      }).catch((err) => console.warn("Sync batch clear fallback:", err));

      // 4. Reset active lot if it was cleared
      if (
        cleanTarget === "__all__" ||
        String(activeLotNumber || "").trim().toLowerCase() === cleanTarget
      ) {
        setActiveLotNumber("");
        setLotInput("");
        try {
          localStorage.removeItem("pasaya_active_order_lot");
        } catch {}
      }

      setShowClearLotModal(false);
      setSelectedLotToClear("");
      showNotice("ล้างข้อมูลรอบการสั่งซื้อเรียบร้อยแล้ว", "ok");
    } catch (err) {
      console.error("Error clearing lot:", err);
      showNotice("เกิดข้อผิดพลาดในการล้างข้อมูล Lot");
    } finally {
      setIsClearing(false);
    }
  };

  // WeakMap-cached monthly burn rate per SKU from transactions
  const { burnRateMap } = useMemo(() => computeBurnRateData(transactions), [transactions]);

  // Low stock items according to selected criteria
  const lowStockItems = useMemo(() => {
    if (alertCriteria === "includeZero") {
      return items.filter(
        (it) =>
          (it.currentBalance ?? 0) <= 0 ||
          ((it.currentBalance ?? 0) <= (it.minStock ?? 0) && (it.minStock ?? 0) > 0)
      );
    }
    return items.filter(
      (it) => (it.currentBalance ?? 0) <= (it.minStock ?? 0) && (it.minStock ?? 0) > 0
    );
  }, [items, alertCriteria]);

  const outOfStockZeroMinCount = useMemo(() => {
    return items.filter((it) => (it.currentBalance ?? 0) <= 0 && (it.minStock ?? 0) <= 0).length;
  }, [items]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of lowStockItems) {
      if (it.category && it.category.trim()) set.add(it.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [lowStockItems]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const it of lowStockItems) {
      if (it.supplier && it.supplier.trim()) set.add(it.supplier.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [lowStockItems]);

  // Step 1: Filter by search, line, category, supplier (decoupled from orderStatuses)
  const baseFiltered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return lowStockItems.filter((it) => {
      if (q) {
        const b = String(it.barcode || "").toLowerCase();
        const n = String(it.name || "").toLowerCase();
        const s = String(it.supplier || "").toLowerCase();
        const c = String(it.category || "").toLowerCase();
        if (!b.includes(q) && !n.includes(q) && !s.includes(q) && !c.includes(q)) {
          return false;
        }
      }

      if (selectedLines.length > 0) {
        if (!matchesLineMulti(it.line, selectedLines)) return false;
      }

      if (selectedCategories.length > 0) {
        if (!matchesExactOrTokenMulti(it.category, selectedCategories)) return false;
      }

      if (selectedSuppliers.length > 0) {
        if (!matchesExactOrTokenMulti(it.supplier, selectedSuppliers)) return false;
      }

      return true;
    });
  }, [lowStockItems, deferredSearch, selectedLines, selectedCategories, selectedSuppliers]);

  // Step 2: Only filter by orderStatusMap when filterOrderStatus !== "all"
  const filtered = useMemo(() => {
    if (filterOrderStatus === "all") return baseFiltered;
    return baseFiltered.filter((it) => {
      const oStatus = orderStatusMap.get(String(it.barcode || "").trim());
      const isOrdered = Boolean(oStatus?.isOrdered);
      return filterOrderStatus === "ordered" ? isOrdered : !isOrdered;
    });
  }, [baseFiltered, filterOrderStatus, orderStatusMap]);

  // Compute reorder quantities and estimated costs
  const reorderCalculations = useMemo(() => {
    const calculated = filtered.map((it) => {
      const balance = it.currentBalance ?? 0;
      const minStock = it.minStock ?? 0;
      const unitCost = it.unitCost ?? 0;
      const effectiveMin = minStock > 0 ? minStock : 1;
      const targetStock = Math.ceil(effectiveMin * (1 + safetyBufferPercent / 100));
      const deficit = Math.max(0, targetStock - balance);
      const estimatedCost = deficit * unitCost;
      const percentOfMin = minStock > 0 ? Math.round((balance / minStock) * 100) : 0;

      const bKey = String(it.barcode || "").trim().toLowerCase();
      let monthlyBurnRate = burnRateMap.get(bKey) || 0;
      if (monthlyBurnRate === 0 && minStock > 0) {
        monthlyBurnRate = Math.max(0.5, minStock / 3);
      }
      const monthsOfStockRemaining = monthlyBurnRate > 0 ? balance / monthlyBurnRate : 999;

      let riskLevel: "critical" | "warning" | "ok" | "overstock" = "ok";
      if (monthsOfStockRemaining < 1 || (balance <= 0 && (monthlyBurnRate > 0 || minStock >= 0))) {
        riskLevel = "critical";
      } else if (monthsOfStockRemaining < 6) {
        riskLevel = "warning";
      } else if (monthsOfStockRemaining > 15 && balance > 50) {
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
          res = String(a.item.barcode || "").localeCompare(String(b.item.barcode || ""));
          break;
        case "name":
          res = String(a.item.name || "").localeCompare(String(b.item.name || ""), "th");
          break;
        case "line":
          res = String(a.item.line || "").localeCompare(String(b.item.line || ""), "th");
          break;
        case "balance":
          res = (a.item.currentBalance ?? 0) - (b.item.currentBalance ?? 0);
          break;
        case "minStock":
          res = (a.item.minStock ?? 0) - (b.item.minStock ?? 0);
          break;
        case "deficit":
          res = a.deficit - b.deficit;
          break;
        case "cost":
          res = (a.item.unitCost ?? 0) - (b.item.unitCost ?? 0);
          break;
        case "estimatedCost":
          res = a.estimatedCost - b.estimatedCost;
          break;
        case "supplier":
          res = String(a.item.supplier || "").localeCompare(String(b.item.supplier || ""), "th");
          break;
        case "risk": {
          const riskWeight = { critical: 4, warning: 3, ok: 2, overstock: 1 };
          res = riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
          break;
        }
        default:
          res = 0;
      }
      return sortOrder === "asc" ? res : -res;
    });
  }, [filtered, safetyBufferPercent, sortField, sortOrder, burnRateMap]);

  // Reset progressive batch count when filters change
  useEffect(() => {
    if (!showAllDirectly) {
      setVisibleCount(INITIAL_BATCH);
    }
  }, [
    deferredSearch,
    selectedLines,
    selectedCategories,
    selectedSuppliers,
    filterOrderStatus,
    alertCriteria,
    sortField,
    sortOrder,
    showAllDirectly,
  ]);

  // Progressive infinite scroll via IntersectionObserver
  useEffect(() => {
    if (showAllDirectly) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) =>
            prev < reorderCalculations.length
              ? Math.min(prev + BATCH_INCREMENT, reorderCalculations.length)
              : prev
          );
        }
      },
      { rootMargin: "320px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reorderCalculations.length, showAllDirectly]);

  const displayedCalculations = useMemo(() => {
    if (showAllDirectly || visibleCount >= reorderCalculations.length) {
      return reorderCalculations;
    }
    return reorderCalculations.slice(0, visibleCount);
  }, [reorderCalculations, visibleCount, showAllDirectly]);

  const handleHeaderSort = (field: LowStockSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (["deficit", "estimatedCost", "minStock", "risk"].includes(field)) {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    }
  };

  const renderSortIcon = (field: LowStockSortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-500 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-500 font-bold" />
    );
  };

  const { totalEstimatedCost, totalUnitsToOrder } = useMemo(() => {
    let cost = 0;
    let units = 0;
    for (let i = 0; i < reorderCalculations.length; i++) {
      cost += reorderCalculations[i].estimatedCost;
      units += reorderCalculations[i].deficit;
    }
    return { totalEstimatedCost: cost, totalUnitsToOrder: units };
  }, [reorderCalculations]);

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
      r.item.currentBalance ?? 0,
      r.item.minStock ?? 0,
      r.deficit || 0,
      r.item.unitCost ?? 0,
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

  const handleCreatePurchaseOrderFromFiltered = () => {
    if (!onCreatePurchaseOrder) return;
    const filterParts = [];
    if (selectedLines.length > 0) filterParts.push(`ไลน์: ${selectedLines.join(", ")}`);
    if (selectedCategories.length > 0) filterParts.push(`หมวด: ${selectedCategories.join(", ")}`);
    if (selectedSuppliers.length > 0) filterParts.push(`Supplier: ${selectedSuppliers.join(", ")}`);
    if (search) filterParts.push(`ค้นหา: "${search}"`);
    if (filterOrderStatus !== "all") {
      filterParts.push(
        `สถานะ: ${filterOrderStatus === "ordered" ? "สั่งแล้ว" : "ยังไม่ได้สั่ง"}`
      );
    }
    const filterContext =
      filterParts.length > 0 ? filterParts.join(" | ") : "รายการที่กรองทั้งหมด";

    const poItems: PurchaseOrderItem[] = reorderCalculations.map((r) => {
      const bKey = String(r.item.barcode || "").trim().toLowerCase();
      let burnRate = burnRateMap.get(bKey) || 0;
      if (burnRate === 0 && (r.item.minStock ?? 0) > 0) {
        burnRate = Math.max(0.5, (r.item.minStock ?? 0) / 3);
      }

      return {
        barcode: r.item.barcode,
        itemName: r.item.name,
        line: r.item.line || "-",
        supplier: r.item.supplier || "-",
        unit: r.item.unit || "ชิ้น",
        monthlyBurnRate: parseFloat(burnRate.toFixed(1)),
        monthsOfStock: r.monthsOfStockRemaining,
        stockStatus:
          (r.item.currentBalance ?? 0) <= 0
            ? "out"
            : (r.item.currentBalance ?? 0) <= (r.item.minStock ?? 0)
            ? "low"
            : "ok",
        currentBalance: r.item.currentBalance ?? 0,
        minStock: r.item.minStock ?? 0,
        recommendedOrder: r.deficit,
        orderQty: r.deficit,
        unitPrice: r.item.unitCost || 0,
        totalCost: r.estimatedCost,
      };
    });

    onCreatePurchaseOrder(
      poItems,
      `ดึงจากหน้าเตือนสั่งซื้อ (${filterContext})`,
      safetyBufferPercent
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Inline Notice / Feedback Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-sm ${
            notice.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 p-6 rounded-2xl text-slate-900 shadow-xs border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>ระบบแจ้งเตือนสต็อกต่ำ & แนะนำการสั่งซื้อ (Reorder Planning)</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            รายการสินค้าที่ต้องสั่งซื้อ ({filtered.length.toLocaleString()} รายการ)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            คำนวณจากเกณฑ์ Min Stock พร้อมเผื่อ Safety Stock สำหรับกระบวนการผลิต (คลิกหรือดับเบิลคลิกที่รายการเพื่อดูประวัติรับเข้า-จ่ายออก)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToMonthly && (
            <button
              onClick={onNavigateToMonthly}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs hover:shadow-xs transition cursor-pointer"
              title="ดูรายงานอัตราการใช้งานเฉลี่ยและสถิติรายเดือน"
            >
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>ดูใช้งานแต่ละเดือน</span>
            </button>
          )}

          {onCreatePurchaseOrder && (
            <button
              onClick={handleCreatePurchaseOrderFromFiltered}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md hover:shadow-lg transition cursor-pointer"
              title="สร้างใบสั่งซื้อเฉพาะรายการที่ Filter ณ ตอนนี้"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>สร้างใบสั่งซื้อจากที่กรอง ({reorderCalculations.length.toLocaleString()})</span>
            </button>
          )}

          {canExport && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500">จำนวน SKU ที่ต้องสั่งซื้อ (ที่เลือก)</span>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">
            {filtered.length.toLocaleString()} รายการ
          </div>
          <span className="text-xs text-slate-400">
            จากทั้งหมด {lowStockItems.length.toLocaleString()} รายการในเกณฑ์แจ้งเตือน
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
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ด, รายการ, Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Line Multi-Select filter */}
          <div>
            <MultiSelectFilter
              label="ไลน์ผลิต"
              placeholder="เลือกไลน์ (ทั้งหมด)"
              options={lines.map((l) => ({ value: l, label: l }))}
              selectedValues={selectedLines}
              onChange={setSelectedLines}
              icon={Layers}
            />
          </div>

          {/* Category Multi-Select filter */}
          <div>
            <MultiSelectFilter
              label="หมวดหมู่"
              placeholder="เลือกหมวดหมู่ (ทั้งหมด)"
              options={uniqueCategories.map((c) => ({ value: c, label: c }))}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              icon={Package}
            />
          </div>

          {/* Supplier Multi-Select filter */}
          <div>
            <MultiSelectFilter
              label="Supplier"
              placeholder="เลือก Supplier (ทั้งหมด)"
              options={uniqueSuppliers.map((s) => ({ value: s, label: s }))}
              selectedValues={selectedSuppliers}
              onChange={setSelectedSuppliers}
              icon={Boxes}
            />
          </div>

          {/* Order Status filter */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 h-[38px]"
            >
              <option value="all">สถานะสั่งซื้อทั้งหมด</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {(selectedLines.length > 0 ||
          selectedCategories.length > 0 ||
          selectedSuppliers.length > 0 ||
          search.trim() !== "" ||
          filterOrderStatus !== "all") && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1">ตัวกรองที่เลือก:</span>

            {selectedLines.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-medium"
              >
                <span>ไลน์: {l}</span>
                <button
                  onClick={() => setSelectedLines((prev) => prev.filter((x) => x !== l))}
                  className="text-sky-400 hover:text-sky-700 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}

            {selectedCategories.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-medium"
              >
                <span>หมวด: {c}</span>
                <button
                  onClick={() => setSelectedCategories((prev) => prev.filter((x) => x !== c))}
                  className="text-indigo-400 hover:text-indigo-700 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}

            {selectedSuppliers.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium"
              >
                <span>Supplier: {s}</span>
                <button
                  onClick={() => setSelectedSuppliers((prev) => prev.filter((x) => x !== s))}
                  className="text-emerald-400 hover:text-emerald-700 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}

            {filterOrderStatus !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                <span>
                  สถานะ: {filterOrderStatus === "ordered" ? "สั่งซื้อแล้ว" : "ยังไม่ได้สั่งซื้อ"}
                </span>
                <button
                  onClick={() => setFilterOrderStatus("all")}
                  className="text-amber-400 hover:text-amber-700 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium">
                <span>ค้นหา: &quot;{search}&quot;</span>
                <button
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-700 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            <button
              onClick={() => {
                setSelectedLines([]);
                setSelectedCategories([]);
                setSelectedSuppliers([]);
                setFilterOrderStatus("all");
                setSearch("");
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 ml-auto px-2 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}

        {/* Safety buffer setting, Criteria mode & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
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

            {outOfStockZeroMinCount > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setAlertCriteria((prev) =>
                      prev === "minStock" ? "includeZero" : "minStock"
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    alertCriteria === "includeZero"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  title="แสดงรวมรายการที่ยอดคงเหลือ ≤ 0 แม้ยังไม่ได้ตั้งค่า Min Stock ในชีท"
                >
                  {alertCriteria === "includeZero"
                    ? `✓ รวมสินค้าหมดสต็อกทั้งหมด (+${outOfStockZeroMinCount})`
                    : `รวมสินค้าหมดที่ยังไม่ตั้ง Min (+${outOfStockZeroMinCount})`}
                </button>
              </div>
            )}
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
              <option value="risk">ความเสี่ยงสูงสุด</option>
              <option value="name">ชื่อสินค้า</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="สลับลำดับ มาก-น้อย"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Lot Management Bar & Modal */}
      <OrderLotManager
        orderStatuses={orderStatuses}
        activeLotNumber={activeLotNumber}
        lotInput={lotInput}
        canManageOrderStatus={canManageOrderStatus}
        onLotInputChange={setLotInput}
        onSaveActiveLot={handleSaveActiveLot}
        onUnlockLot={handleUnlockLot}
        onClearLot={handleClearLot}
        isClearing={isClearing}
        showClearLotModal={showClearLotModal}
        setShowClearLotModal={setShowClearLotModal}
        selectedLotToClear={selectedLotToClear}
        setSelectedLotToClear={setSelectedLotToClear}
      />

      {/* Reorder Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 select-none border-b border-slate-200">
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
              {displayedCalculations.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                    {items.length === 0
                      ? "กำลังโหลดข้อมูลรายการสต็อก..."
                      : "ไม่มีรายการสินค้าที่ต้องสั่งซื้อตามเงื่อนไขที่เลือก"}
                  </td>
                </tr>
              ) : (
                displayedCalculations.map((r, idx) => {
                  const it = r.item;
                  const cleanCode = String(it.barcode || "").trim();
                  const oStatus = orderStatusMap.get(cleanCode);
                  const isOrdered = Boolean(oStatus?.isOrdered);
                  const lotLabel = oStatus?.lotNumber ? String(oStatus.lotNumber).trim() : "-";
                  const isCurrentLot =
                    isOrdered && Boolean(activeLotNumber) && lotLabel === activeLotNumber;
                  const balance = it.currentBalance ?? 0;
                  const minStock = it.minStock ?? 0;
                  const unitCost = it.unitCost ?? 0;

                  return (
                    <tr
                      key={`${it.id || cleanCode}_${idx}`}
                      onClick={() => onSelectItem(it)}
                      onDoubleClick={() => onSelectItem(it)}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
                      className={`transition cursor-pointer ${
                        isOrdered
                          ? "bg-emerald-50/70 hover:bg-emerald-100"
                          : "hover:bg-amber-50/40"
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{cleanCode}</td>
                      <td className="p-3 font-medium text-slate-900">
                        <div>{it.name}</div>
                        <div className="text-[10px] text-slate-400">
                          ชนิด: {it.category || "-"} | คลัง: {it.location || "-"}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{it.line || "-"}</td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-rose-600 font-mono">
                          {balance.toLocaleString()}
                        </span>{" "}
                        <span className="text-[10px] text-slate-400">{it.unit}</span>
                        <div className="text-[10px] text-slate-400">
                          ({r.percentOfMin}% ของ Min)
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {minStock.toLocaleString()} {it.unit}
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          +{r.deficit.toLocaleString()} {it.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        ฿{unitCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        ฿{r.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{it.supplier || "-"}</td>

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
                          {r.monthsOfStockRemaining > 90
                            ? ">90"
                            : r.monthsOfStockRemaining.toFixed(1)}{" "}
                          ด.
                        </div>
                        {isOrdered && (
                          <div className="mt-1">
                            <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              สั่งซื้อรอจัดส่ง (Lot: {lotLabel})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* หมายเหตุสั่งซื้อ */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center gap-1">
                          <label
                            className={`inline-flex items-center gap-1.5 ${
                              !activeLotNumber || !canManageOrderStatus
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                            }`}
                            title={
                              !canManageOrderStatus
                                ? "คุณไม่มีสิทธิ์จัดการสถานะสั่งซื้อ (กำหนดได้ในเมนู พนักงาน & สิทธิ์)"
                                : !activeLotNumber
                                ? "กรุณาสร้างหรือเลือก และกด 'บันทึก Lot' ด้านบนก่อนทำการติ๊กสั่งซื้อ"
                                : isOrdered
                                ? `คลิกเพื่อยกเลิกสถานะสั่งซื้อ (Lot: ${lotLabel})`
                                : `คลิกเพื่อบันทึกสั่งซื้อเข้า Lot: ${activeLotNumber}`
                            }
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed accent-indigo-600"
                              disabled={!activeLotNumber || !canManageOrderStatus}
                              checked={isOrdered}
                              onChange={(e) =>
                                handleToggleOrderStatus(cleanCode, e.target.checked)
                              }
                            />
                            <span
                              className={`text-[11px] font-medium select-none ${
                                isOrdered ? "text-emerald-700 font-semibold" : "text-slate-400"
                              }`}
                            >
                              {isOrdered ? "สั่งซื้อแล้ว" : "ยังไม่สั่ง"}
                            </span>
                          </label>

                          {isOrdered && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isCurrentLot
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
                              }`}
                              title={`เลขที่รอบ Lot: ${lotLabel}`}
                            >
                              Lot: {lotLabel}
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

        {/* Progressive Scroll Sentinel */}
        {!showAllDirectly && displayedCalculations.length < reorderCalculations.length && (
          <div
            ref={sentinelRef}
            className="px-5 py-3 bg-amber-50/40 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600"
          >
            <span>
              กำลังแสดง {displayedCalculations.length.toLocaleString()} จาก{" "}
              {reorderCalculations.length.toLocaleString()} รายการ (เลื่อนลงเพื่อโหลดเพิ่มอัตโนมัติ)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + BATCH_INCREMENT * 2, reorderCalculations.length)
                  )
                }
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                โหลดเพิ่ม +120 รายการ
              </button>
              <button
                type="button"
                onClick={() => setShowAllDirectly(true)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
              >
                แสดงทั้งหมดทันที ({reorderCalculations.length.toLocaleString()})
              </button>
            </div>
          </div>
        )}

        {/* Table footer summary */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-medium">
            แสดง {displayedCalculations.length.toLocaleString()} จากทั้งหมด{" "}
            {reorderCalculations.length.toLocaleString()} รายการที่ต้องสั่งซื้อ
          </div>
          <div className="text-slate-500">
            ยอดรวมแนะนำสั่งซื้อทั้งหมด:{" "}
            <span className="font-bold text-slate-800">
              {totalUnitsToOrder.toLocaleString()} ชิ้น
            </span>{" "}
            | ประมาณการงบประมาณรวม:{" "}
            <span className="font-bold text-amber-700">
              ฿{totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
