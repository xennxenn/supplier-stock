import React, { useState, useEffect, useMemo } from "react";
import {
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import {
  db,
  purchaseOrdersCol,
  orderStatusCol,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  AlertCircle,
  Download,
  Printer,
  Trash2,
  Edit,
  Eye,
  ArrowRight,
  ShieldCheck,
  Percent,
  Layers,
  Sparkles,
  ChevronRight,
  X,
  Boxes,
  ShoppingBag,
  RefreshCw,
  Ban,
} from "lucide-react";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  StockItem,
  Transaction,
  Employee,
  OrderStatus,
} from "../types";
import { hasPermission } from "../utils/permissionUtils";
import { exportToCSV } from "../utils/exportUtils";
import { PrintablePurchaseOrder } from "./PrintablePurchaseOrder";
import { TwoStepConfirmModal } from "./TwoStepConfirmModal";

interface PurchaseOrdersViewProps {
  currentUser: Employee;
  items: StockItem[];
  transactions: Transaction[];
  initialNewOrder?: {
    items: PurchaseOrderItem[];
    filterSummary?: string;
    bufferPercent?: number;
  } | null;
  onClearInitialNewOrder?: () => void;
  onRefreshStock?: () => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  currentUser,
  items,
  transactions,
  initialNewOrder,
  onClearInitialNewOrder,
  onRefreshStock,
}) => {
  const canManagePO =
    currentUser.role === "admin" ||
    currentUser.role === "manager" ||
    hasPermission(currentUser, "managePurchaseOrders") ||
    hasPermission(currentUser, "manageOrderStatus");

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "lots">("orders");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>("all");
  const [search, setSearch] = useState("");

  // Editor modal/view
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Printing modal
  const [viewingPrintOrder, setViewingPrintOrder] = useState<PurchaseOrder | null>(null);

  // Buffer percentage selector for active editor
  const [editorBufferPercent, setEditorBufferPercent] = useState<number>(20);

  // Status changing dialog/state
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);

  // Subscribe to real-time purchase orders from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      purchaseOrdersCol,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as PurchaseOrder);
        // Sort newest first
        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "purchaseOrders");
      }
    );
    return () => unsub();
  }, []);

  // Handle incoming prefilled order from Alerts or Forecast
  useEffect(() => {
    if (initialNewOrder && initialNewOrder.items && initialNewOrder.items.length > 0) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const count = orders.length + 1;
      const poNum = `PO-${dateStr}-${String(count).padStart(3, "0")}`;

      const totalQty = initialNewOrder.items.reduce((s, it) => s + it.orderQty, 0);
      const totalCost = initialNewOrder.items.reduce((s, it) => s + it.totalCost, 0);

      const newOrder: PurchaseOrder = {
        id: `po_${Date.now()}`,
        poNumber: poNum,
        title: `ใบสั่งซื้อวัตถุดิบ (${initialNewOrder.items.length} รายการ)`,
        status: "new",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        safetyBufferPercent: initialNewOrder.bufferPercent || 20,
        filterSummary: initialNewOrder.filterSummary || "สร้างจากรายการที่เลือก",
        items: initialNewOrder.items,
        totalItems: initialNewOrder.items.length,
        totalOrderQty: totalQty,
        totalCost: totalCost,
      };

      setEditorBufferPercent(initialNewOrder.bufferPercent || 20);
      setEditingOrder(newOrder);
      setIsCreatingNew(true);
      setActiveTab("orders");

      if (onClearInitialNewOrder) {
        onClearInitialNewOrder();
      }
    }
  }, [initialNewOrder, orders.length, currentUser, onClearInitialNewOrder]);

  // Recalculate item recommendation based on buffer %
  const recalculateRecommendedOrder = (
    item: PurchaseOrderItem,
    bufferPercent: number
  ): number => {
    const baseDemand = item.monthlyBurnRate * 3 * (1 + bufferPercent / 100);
    const targetStock = baseDemand + item.minStock;
    const deficit = Math.max(0, targetStock - item.currentBalance);
    return Math.ceil(deficit);
  };

  // Start new empty purchase order
  const handleStartNewOrder = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const count = orders.length + 1;
    const poNum = `PO-${dateStr}-${String(count).padStart(3, "0")}`;

    const newOrder: PurchaseOrder = {
      id: `po_${Date.now()}`,
      poNumber: poNum,
      title: "ใบสั่งซื้อวัตถุดิบและอุปกรณ์ใหม่",
      status: "new",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: currentUser.name,
      createdById: currentUser.id,
      safetyBufferPercent: 20,
      items: [],
      totalItems: 0,
      totalOrderQty: 0,
      totalCost: 0,
    };

    setEditorBufferPercent(20);
    setEditingOrder(newOrder);
    setIsCreatingNew(true);
  };

  // Apply safety buffer to all items in current editor
  const handleApplyBufferPercent = (newBuffer: number) => {
    setEditorBufferPercent(newBuffer);
    if (!editingOrder) return;

    const updatedItems = editingOrder.items.map((it) => {
      const rec = recalculateRecommendedOrder(it, newBuffer);
      return {
        ...it,
        recommendedOrder: rec,
      };
    });

    setEditingOrder({
      ...editingOrder,
      safetyBufferPercent: newBuffer,
      items: updatedItems,
    });
  };

  // Set orderQty = recommendedOrder for all items in editor
  const handleApplyAllRecommended = () => {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.map((it) => {
      const qty = it.recommendedOrder > 0 ? it.recommendedOrder : 0;
      return {
        ...it,
        orderQty: qty,
        totalCost: qty * it.unitPrice,
      };
    });

    const totalQty = updatedItems.reduce((s, it) => s + it.orderQty, 0);
    const totalCost = updatedItems.reduce((s, it) => s + it.totalCost, 0);

    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      totalOrderQty: totalQty,
      totalCost,
    });
  };

  // Update specific item in editor
  const handleItemFieldChange = (
    index: number,
    field: keyof PurchaseOrderItem,
    val: any
  ) => {
    if (!editingOrder) return;
    const updated = [...editingOrder.items];
    const current = { ...updated[index] };

    if (field === "orderQty") {
      const num = Math.max(0, parseInt(val) || 0);
      current.orderQty = num;
      current.totalCost = num * current.unitPrice;
    } else if (field === "unitPrice") {
      const num = Math.max(0, parseFloat(val) || 0);
      current.unitPrice = num;
      current.totalCost = current.orderQty * num;
    } else {
      (current as any)[field] = val;
    }

    updated[index] = current;
    const totalQty = updated.reduce((s, it) => s + it.orderQty, 0);
    const totalCost = updated.reduce((s, it) => s + it.totalCost, 0);

    setEditingOrder({
      ...editingOrder,
      items: updated,
      totalItems: updated.length,
      totalOrderQty: totalQty,
      totalCost,
    });
  };

  // Remove item from editor
  const handleRemoveItem = (index: number) => {
    if (!editingOrder) return;
    const updated = editingOrder.items.filter((_, idx) => idx !== index);
    const totalQty = updated.reduce((s, it) => s + it.orderQty, 0);
    const totalCost = updated.reduce((s, it) => s + it.totalCost, 0);

    setEditingOrder({
      ...editingOrder,
      items: updated,
      totalItems: updated.length,
      totalOrderQty: totalQty,
      totalCost,
    });
  };

  // Save order to Cloud Firestore
  const handleSaveOrder = async (targetStatus?: PurchaseOrderStatus) => {
    if (!editingOrder) return;
    if (editingOrder.items.length === 0) {
      alert("กรุณาระบุรายการสินค้าในใบสั่งซื้ออย่างน้อย 1 รายการ");
      return;
    }

    const now = new Date().toISOString();
    const finalStatus: PurchaseOrderStatus = targetStatus || editingOrder.status || "new";

    const toSave: PurchaseOrder = {
      ...editingOrder,
      status: finalStatus,
      updatedAt: now,
      totalItems: editingOrder.items.length,
      totalOrderQty: editingOrder.items.reduce((s, it) => s + it.orderQty, 0),
      totalCost: editingOrder.items.reduce((s, it) => s + it.totalCost, 0),
    };

    if (finalStatus === "approved" && !toSave.approvedBy) {
      toSave.approvedBy = currentUser.name;
      toSave.approvedAt = now;
    }

    try {
      await setDoc(doc(db, "purchaseOrders", toSave.id), toSave);
      setEditingOrder(null);
      setIsCreatingNew(false);
      alert(`บันทึกใบสั่งซื้อ ${toSave.poNumber} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("Save PO error:", err);
      handleFirestoreError(err, OperationType.WRITE, `purchaseOrders/${toSave.id}`);
      alert("เกิดข้อผิดพลาดในการบันทึกใบสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // 2-Step Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    actionType: "approve" | "confirm" | "receive" | "cancel" | "delete";
    order: PurchaseOrder | null;
  }>({
    isOpen: false,
    actionType: "approve",
    order: null,
  });

  const handleOpenConfirmModal = (
    actionType: "approve" | "confirm" | "receive" | "cancel" | "delete",
    order: PurchaseOrder
  ) => {
    if (!canManagePO) {
      alert("คุณไม่มีสิทธิ์ในการดำเนินการนี้ (ต้องมีสิทธิ์ Admin, Manager หรือสิทธิ์จัดการใบสั่งซื้อ)");
      return;
    }
    setConfirmModalState({
      isOpen: true,
      actionType,
      order,
    });
  };

  const handleExecuteTwoStepAction = async (
    targetOrderOrMeta?: PurchaseOrder | { lotNumber?: string; reason?: string },
    targetAction?: "approve" | "confirm" | "receive" | "cancel" | "delete",
    maybeMeta?: { lotNumber?: string; reason?: string }
  ) => {
    let order = confirmModalState.order;
    let actionType = confirmModalState.actionType;
    let meta: { lotNumber?: string; reason?: string } | undefined;

    if (targetOrderOrMeta && typeof targetOrderOrMeta === "object" && "poNumber" in targetOrderOrMeta) {
      order = targetOrderOrMeta as PurchaseOrder;
      if (targetAction) actionType = targetAction;
      meta = maybeMeta;
    } else if (targetOrderOrMeta && typeof targetOrderOrMeta === "object") {
      meta = targetOrderOrMeta as { lotNumber?: string; reason?: string };
    }

    if (!order) return;
    setIsProcessingStatus(true);
    const now = new Date().toISOString();

    try {
      if (actionType === "approve") {
        const updatedOrder: PurchaseOrder = {
          ...order,
          status: "approved",
          approvedBy: currentUser.name,
          approvedAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, "purchaseOrders", order.id), updatedOrder);
        if (editingOrder && editingOrder.id === order.id) {
          setEditingOrder(updatedOrder);
        }
      } else if (actionType === "confirm") {
        const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
        const fallbackLot = order.lotNumber || `LOT-${dateStr}-${order.poNumber.slice(-3)}`;
        const lot = (meta?.lotNumber || fallbackLot).trim();

        const updatedOrder: PurchaseOrder = {
          ...order,
          status: "confirm",
          lotNumber: lot,
          confirmedBy: currentUser.name,
          confirmedAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, "purchaseOrders", order.id), updatedOrder);

        // Batch sync items to orderStatuses
        const batch = writeBatch(db);
        order.items.forEach((it) => {
          const ref = doc(db, "orderStatuses", it.barcode);
          batch.set(ref, {
            barcode: it.barcode,
            isOrdered: true,
            lotNumber: lot,
            updatedAt: now,
          });
        });
        await batch.commit();

        fetch("/api/order-status-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotNumber: lot, isOrdered: true }),
        }).catch((e) => console.warn("Fallback sync:", e));

        if (editingOrder && editingOrder.id === order.id) {
          setEditingOrder(updatedOrder);
        }
      } else if (actionType === "receive") {
        const updatedOrder: PurchaseOrder = {
          ...order,
          status: "received",
          receivedBy: currentUser.name,
          receivedAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, "purchaseOrders", order.id), updatedOrder);

        // Clear orderStatuses
        const batch = writeBatch(db);
        order.items.forEach((it) => {
          const ref = doc(db, "orderStatuses", it.barcode);
          batch.delete(ref);
        });
        await batch.commit();

        if (order.lotNumber) {
          fetch("/api/order-status-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lotNumber: order.lotNumber, isOrdered: false }),
          }).catch((e) => console.warn("Fallback clear:", e));
        }

        if (editingOrder && editingOrder.id === order.id) {
          setEditingOrder(updatedOrder);
        }
      } else if (actionType === "cancel") {
        const updatedOrder: PurchaseOrder = {
          ...order,
          status: "cancelled",
          cancelledBy: currentUser.name,
          cancelledAt: now,
          cancelReason: meta?.reason || "ยกเลิกโดยผู้มีสิทธิ์",
          updatedAt: now,
        };
        await setDoc(doc(db, "purchaseOrders", order.id), updatedOrder);

        // If it was in confirm/lot, remove from active orderStatuses
        if (order.status === "confirm") {
          const batch = writeBatch(db);
          order.items.forEach((it) => {
            const ref = doc(db, "orderStatuses", it.barcode);
            batch.delete(ref);
          });
          await batch.commit();
        }

        if (editingOrder && editingOrder.id === order.id) {
          setEditingOrder(updatedOrder);
        }
      } else if (actionType === "delete") {
        await deleteDoc(doc(db, "purchaseOrders", order.id));
        if (order.status === "confirm") {
          const batch = writeBatch(db);
          order.items.forEach((it) => {
            const ref = doc(db, "orderStatuses", it.barcode);
            batch.delete(ref);
          });
          await batch.commit();
        }
        if (editingOrder && editingOrder.id === order.id) {
          setEditingOrder(null);
        }
      }

      setConfirmModalState({ isOpen: false, actionType: "approve", order: null });
    } catch (err) {
      console.error("Execute 2-step action error:", err);
      alert("เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setIsProcessingStatus(false);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNum = o.poNumber.toLowerCase().includes(q);
        const matchTitle = o.title.toLowerCase().includes(q);
        const matchLot = (o.lotNumber || "").toLowerCase().includes(q);
        const matchCreated = (o.createdBy || "").toLowerCase().includes(q);
        const matchItem = o.items.some(
          (it) =>
            it.itemName.toLowerCase().includes(q) ||
            it.barcode.toLowerCase().includes(q)
        );
        if (!matchNum && !matchTitle && !matchLot && !matchCreated && !matchItem)
          return false;
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  // Active Lots list: POs in status 'confirm' (and optionally 'approved')
  const activeLots = useMemo(() => {
    return orders.filter((o) => o.status === "confirm" || o.status === "approved");
  }, [orders]);

  // Completed Lots list: POs in status 'received'
  const completedLots = useMemo(() => {
    return orders.filter((o) => o.status === "received");
  }, [orders]);

  // Export full table to CSV
  const handleExportOrderCSV = (order: PurchaseOrder) => {
    const headers = [
      "บาร์โค้ด",
      "ชื่อรายการสินค้า",
      "ไลน์",
      "Supplier",
      "หน่วย",
      "ใช้งานเฉลี่ยต่อเดือน",
      "พอใช้กี่เดือน",
      "สถานะสต็อก",
      "คงเหลือ",
      "Min Stock",
      "แนะนำสั่งซื้อ",
      "จำนวนที่ต้องการสั่งซื้อ",
      "ราคาต่อหน่วย (บาท)",
      "ค่าใช้จ่ายในการสั่งซื้อ (บาท)",
    ];

    const rows = order.items.map((it) => [
      it.barcode,
      it.itemName,
      it.line,
      it.supplier || "-",
      it.unit,
      it.monthlyBurnRate,
      it.monthsOfStock >= 999 ? "-" : it.monthsOfStock.toFixed(1),
      it.stockStatus,
      it.currentBalance,
      it.minStock,
      it.recommendedOrder,
      it.orderQty,
      it.unitPrice,
      it.totalCost,
    ]);

    exportToCSV(`ใบสั่งซื้อ_${order.poNumber}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Printable Purchase Order Modal */}
      {viewingPrintOrder && (
        <PrintablePurchaseOrder
          order={viewingPrintOrder}
          onClose={() => setViewingPrintOrder(null)}
        />
      )}

      {/* Two-Step Confirmation Modal */}
      {confirmModalState.isOpen && confirmModalState.order && (
        <TwoStepConfirmModal
          isOpen={confirmModalState.isOpen}
          onClose={() =>
            setConfirmModalState({ isOpen: false, actionType: "approve", order: null })
          }
          actionType={confirmModalState.actionType}
          order={confirmModalState.order}
          currentUser={currentUser}
          onExecute={(targetOrder, targetAction, meta) =>
            handleExecuteTwoStepAction(targetOrder, targetAction, meta)
          }
          onConfirm={(meta) => handleExecuteTwoStepAction(meta)}
          isProcessing={isProcessingStatus}
        />
      )}

      {/* Editor Screen for Create / Edit Purchase Order */}
      {editingOrder ? (
        <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-md border border-white/70 animate-in fade-in duration-200">
          {/* Cancelled PO Banner */}
          {editingOrder.status === "cancelled" && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3.5 text-rose-900">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-sm text-rose-800">
                  ใบสั่งซื้อนี้ถูกยกเลิกแล้ว (Cancelled)
                </div>
                <div>
                  ยกเลิกโดย: <span className="font-semibold">{editingOrder.cancelledBy || "-"}</span> | วันที่ยกเลิก:{" "}
                  <span className="font-semibold">
                    {editingOrder.cancelledAt
                      ? new Date(editingOrder.cancelledAt).toLocaleString("th-TH")
                      : "-"}
                  </span>
                </div>
                {editingOrder.cancelReason && (
                  <div className="p-2.5 rounded-xl bg-white/80 border border-rose-200/80 font-medium text-rose-950">
                    เหตุผลการยกเลิก: {editingOrder.cancelReason}
                  </div>
                )}
                <div className="text-slate-500 pt-0.5">
                  ข้อมูลรายการสินค้า บาร์โค้ด และการคำนวณทั้งหมดถูกบันทึกไว้อย่างปลอดภัยและสามารถตรวจสอบได้ตลอดเวลา
                </div>
              </div>
            </div>
          )}

          {/* Editor Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200/70">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 font-mono">
                  {editingOrder.poNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    editingOrder.status === "confirm"
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      : editingOrder.status === "approved"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : editingOrder.status === "received"
                      ? "bg-slate-100 text-slate-800 border border-slate-200"
                      : editingOrder.status === "cancelled"
                      ? "bg-rose-100 text-rose-800 border border-rose-200 font-bold"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  }`}
                >
                  สถานะ: {editingOrder.status.toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isCreatingNew
                  ? "สร้างใบสั่งซื้อวัตถุดิบและอุปกรณ์"
                  : editingOrder.status === "cancelled"
                  ? "รายละเอียดใบสั่งซื้อ (ยกเลิกแล้ว)"
                  : "แก้ไขใบสั่งซื้อ"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ผู้จัดทำ: {editingOrder.createdBy} · บันทึกซิงค์ Realtime บน Cloud
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewingPrintOrder(editingOrder)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>พิมพ์ฟอร์ม</span>
              </button>

              <button
                onClick={() => handleExportOrderCSV(editingOrder)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreatingNew(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              {editingOrder.status !== "cancelled" && (
                <button
                  onClick={() => handleSaveOrder()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกใบสั่งซื้อ</span>
                </button>
              )}

              {canManagePO && editingOrder.status === "new" && (
                <button
                  onClick={() => handleOpenConfirmModal("approve", editingOrder)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>อนุมัติ (2 ขั้นตอน)</span>
                </button>
              )}

              {canManagePO &&
                editingOrder.status !== "cancelled" &&
                editingOrder.status !== "received" &&
                !isCreatingNew && (
                  <button
                    onClick={() => handleOpenConfirmModal("cancel", editingOrder)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
                    title="ยกเลิกใบสั่งซื้อนี้ โดยยังเก็บข้อมูลรายการไว้ให้ดูได้"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>ยกเลิก (Cancel)</span>
                  </button>
                )}

              {canManagePO && !isCreatingNew && (
                <button
                  onClick={() => handleOpenConfirmModal("delete", editingOrder)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="ลบใบสั่งซื้อนี้ออกจากระบบถาวร (ยืนยัน 2 ขั้นตอน)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Form Top Controls: Title, Buffer %, Filter Note */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อเอกสาร / รายละเอียดใบสั่งซื้อ:
              </label>
              <input
                type="text"
                value={editingOrder.title}
                onChange={(e) => setEditingOrder({ ...editingOrder, title: e.target.value })}
                placeholder="เช่น ใบสั่งซื้อวัตถุดิบไลน์ MTO - SOMFY"
                className="w-full px-3.5 py-2 rounded-xl liquid-glass-input text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>เลือกเผื่อสต็อก (% Buffer):</span>
                <span className="font-mono text-sky-700">+{editorBufferPercent}%</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[0, 10, 20, 30, 50].map((b) => (
                  <button
                    key={b}
                    onClick={() => handleApplyBufferPercent(b)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editorBufferPercent === b
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-white/80 hover:bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    +{b}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                บันทึกหมายเหตุเพิ่มเติม:
              </label>
              <input
                type="text"
                value={editingOrder.notes || ""}
                onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                placeholder="เช่น กำหนดส่งภายในสิ้นเดือน..."
                className="w-full px-3.5 py-2 rounded-xl liquid-glass-input text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Quick Action Toolbar for Items */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-sky-50/70 border border-sky-100 mb-4">
            <div className="flex items-center gap-2 text-xs text-sky-900 font-semibold">
              <ShoppingBag className="w-4 h-4 text-sky-600" />
              <span>รายการสินค้า ({editingOrder.items.length} รายการ)</span>
              {editingOrder.filterSummary && (
                <span className="text-slate-500 font-normal">
                  · เงื่อนไข: {editingOrder.filterSummary}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyAllRecommended}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold shadow-2xs transition-colors"
              >
                เลือกจำนวนตามคำแนะนำทั้งหมด
              </button>
            </div>
          </div>

          {/* 12-Column Required Table in Editor */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xs mb-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-2 whitespace-nowrap">1. บาร์โค้ด</th>
                  <th className="py-2.5 px-3 min-w-[180px]">2. ชื่อรายการสินค้า</th>
                  <th className="py-2.5 px-2 whitespace-nowrap">3. ไลน์ / Supplier</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">4. เฉลี่ย/ด.</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">5. พอใช้</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">6. สถานะ</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">7. คงเหลือ</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">8. Min</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">
                    9. แนะนำ (+{editorBufferPercent}%)
                  </th>
                  <th className="py-2.5 px-2 text-right min-w-[120px] bg-sky-50 text-sky-900 font-bold whitespace-nowrap">
                    10. สั่งซื้อ (ชิ้น)
                  </th>
                  <th className="py-2.5 px-2 text-right min-w-[100px] whitespace-nowrap">
                    11. ราคา/หน่วย
                  </th>
                  <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                    12. รวมเงิน (฿)
                  </th>
                  <th className="py-2.5 px-2 text-center w-10">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editingOrder.items.map((it, idx) => (
                  <tr key={it.barcode + idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-mono font-medium text-slate-700 whitespace-nowrap">
                      {it.barcode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800 line-clamp-1">{it.itemName}</div>
                      <div className="text-[10px] text-slate-400">หน่วย: {it.unit}</div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-slate-700">{it.line}</div>
                      {it.supplier && <div className="text-[10px] text-slate-400">{it.supplier}</div>}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-600 tabular-nums">
                      {it.monthlyBurnRate.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          it.monthsOfStock < 1
                            ? "bg-rose-100 text-rose-800"
                            : it.monthsOfStock < 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {it.monthsOfStock >= 999 ? "-" : `${it.monthsOfStock.toFixed(1)} ด.`}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          it.stockStatus === "out"
                            ? "bg-rose-100 text-rose-800"
                            : it.stockStatus === "low"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {it.stockStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800 tabular-nums">
                      {it.currentBalance.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-500 tabular-nums">
                      {it.minStock.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700 font-semibold tabular-nums">
                      <div className="flex items-center justify-end gap-1">
                        <span>{it.recommendedOrder.toLocaleString()}</span>
                        {it.recommendedOrder !== it.orderQty && (
                          <button
                            onClick={() =>
                              handleItemFieldChange(idx, "orderQty", it.recommendedOrder)
                            }
                            title="ใช้ยอดตามแนะนำ"
                            className="text-[10px] text-sky-600 hover:text-sky-800 underline font-normal"
                          >
                            ใช้ยอดนี้
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right bg-sky-50/50">
                      <input
                        type="number"
                        min="0"
                        value={it.orderQty}
                        onChange={(e) => handleItemFieldChange(idx, "orderQty", e.target.value)}
                        className="w-24 px-2 py-1 rounded-lg border border-sky-300 text-right font-mono font-bold text-sky-950 bg-white shadow-2xs focus:ring-2 focus:ring-sky-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => handleItemFieldChange(idx, "unitPrice", e.target.value)}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-right font-mono text-slate-800 bg-white shadow-2xs focus:ring-2 focus:ring-sky-500"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      ฿{it.totalCost.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {editingOrder.items.length === 0 && (
                  <tr>
                    <td colSpan={14} className="text-center py-10 text-xs text-slate-400">
                      ยังไม่มีรายการสินค้าในใบสั่งซื้อนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Grand Summary Footer Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-sky-950 text-white shadow-xl">
            <div>
              <span className="text-slate-400 text-xs block">จำนวนรายการสินค้า:</span>
              <span className="text-xl font-bold font-mono">
                {editingOrder.items.length.toLocaleString()} รายการ
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-xs block">จำนวนชิ้นสั่งซื้อรวม:</span>
              <span className="text-xl font-bold font-mono text-sky-300">
                {editingOrder.totalOrderQty.toLocaleString()} ชิ้น
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-400 text-xs block">ประมาณการค่าใช้จ่ายรวม:</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                ฿{editingOrder.totalCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Primary View: Tabs for "ใบสั่งซื้อ (Purchase Orders)" & "จัดการ Lot การสั่งซื้อ (Lot Management)" */
        <div>
          {/* Top Title & Sub-tabs */}
          <div className="liquid-glass rounded-3xl p-5 mb-6 shadow-sm border border-white/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    ระบบใบสั่งซื้อและจัดการ Lot (Purchase Order & Lot Management)
                  </h1>
                  <p className="text-xs text-slate-500">
                    จัดการใบสั่งซื้อวัตถุดิบและอุปกรณ์ ติดตามรอบ Lot สั่งซื้อ ซิงค์คลาวด์ Realtime
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleStartNewOrder}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างใบสั่งซื้อใหม่</span>
                </button>
              </div>
            </div>

            {/* Segmented Sub-tabs */}
            <div className="flex items-center gap-2 mt-5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50 w-full sm:w-fit">
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "orders"
                    ? "bg-white text-sky-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>ใบสั่งซื้อทั้งหมด ({orders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("lots")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "lots"
                    ? "bg-white text-indigo-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>จัดการ Lot การสั่งซื้อ ({activeLots.length} รอรับของ)</span>
              </button>
            </div>
          </div>

          {/* TAB 1: ORDERS LIST VIEW */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="liquid-glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs border border-white/60">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาเลขที่ PO, Lot, ชื่อสินค้า, ผู้จัดทำ..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl liquid-glass-input text-xs"
                    />
                  </div>

                  {/* Status Pills Filter */}
                  <div className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl text-xs">
                    {(
                      [
                        { id: "all", label: "ทั้งหมด" },
                        { id: "new", label: "New (สร้างบันทึก)" },
                        { id: "approved", label: "Approved (อนุมัติแล้ว)" },
                        { id: "confirm", label: "Confirm (ออก Lot แล้ว)" },
                        { id: "received", label: "Received (ได้รับแล้ว)" },
                        { id: "cancelled", label: "Cancelled (ยกเลิกแล้ว)" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setStatusFilter(st.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          statusFilter === st.id
                            ? "bg-white text-slate-900 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-500 self-end md:self-auto">
                  พบ {filteredOrders.length} รายการ
                </div>
              </div>

              {/* Purchase Orders Table / Cards */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">เลขที่ใบสั่งซื้อ</th>
                      <th className="py-3 px-4">ชื่อเอกสาร / รายละเอียด</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3">รอบ Lot</th>
                      <th className="py-3 px-3 text-right">จำนวนรายการ</th>
                      <th className="py-3 px-3 text-right">ยอดสั่งรวม</th>
                      <th className="py-3 px-4 text-right">มูลค่ารวม (฿)</th>
                      <th className="py-3 px-3">ผู้จัดทำ</th>
                      <th className="py-3 px-4 text-center">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-sky-700 whitespace-nowrap">
                          {o.poNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 line-clamp-1">{o.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(o.createdAt).toLocaleDateString("th-TH")} · เผื่อ +
                            {o.safetyBufferPercent}%
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              o.status === "new"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : o.status === "approved"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : o.status === "confirm"
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                : o.status === "cancelled"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {o.status === "new" && <Clock className="w-3 h-3 text-amber-600" />}
                            {o.status === "approved" && (
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            )}
                            {o.status === "confirm" && (
                              <Truck className="w-3 h-3 text-indigo-600" />
                            )}
                            {o.status === "received" && (
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            )}
                            {o.status === "cancelled" && (
                              <Ban className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{o.status.toUpperCase()}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {o.lotNumber ? (
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              {o.lotNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-700 tabular-nums">
                          {o.items.length.toLocaleString()} รายการ
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-800 tabular-nums">
                          {o.totalOrderQty.toLocaleString()} ชิ้น
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ฿{o.totalCost.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 text-xs">
                          <div>{o.createdBy}</div>
                          {o.approvedBy && (
                            <div className="text-[10px] text-emerald-600">อนุมัติ: {o.approvedBy}</div>
                          )}
                          {o.cancelledBy && (
                            <div className="text-[10px] text-rose-600">ยกเลิก: {o.cancelledBy}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingOrder(o);
                                setEditorBufferPercent(o.safetyBufferPercent || 20);
                                setIsCreatingNew(false);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                              title={
                                o.status === "cancelled" || o.status === "received"
                                  ? "ดูรายละเอียดใบสั่งซื้อ"
                                  : "ดู / แก้ไขใบสั่งซื้อ"
                              }
                            >
                              {o.status === "cancelled" || o.status === "received" ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <Edit className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => setViewingPrintOrder(o)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="พิมพ์ฟอร์ม"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {canManagePO && o.status === "new" && (
                              <button
                                onClick={() => handleOpenConfirmModal("approve", o)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-colors cursor-pointer"
                                title="อนุมัติการสั่งซื้อ (ยืนยัน 2 ขั้นตอน)"
                              >
                                อนุมัติ
                              </button>
                            )}

                            {canManagePO && o.status === "approved" && (
                              <button
                                onClick={() => handleOpenConfirmModal("confirm", o)}
                                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors cursor-pointer"
                                title="ยืนยันสั่งซื้อและออก Lot (ยืนยัน 2 ขั้นตอน)"
                              >
                                ออก Lot
                              </button>
                            )}

                            {canManagePO && o.status === "confirm" && (
                              <button
                                onClick={() => handleOpenConfirmModal("receive", o)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 transition-colors cursor-pointer"
                                title="ตรวจรับสินค้าเข้าสต็อก (ยืนยัน 2 ขั้นตอน)"
                              >
                                รับของ
                              </button>
                            )}

                            {canManagePO && o.status !== "cancelled" && o.status !== "received" && (
                              <button
                                onClick={() => handleOpenConfirmModal("cancel", o)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-200 transition-colors cursor-pointer"
                                title="ยกเลิกใบสั่งซื้อ (ยังคงบันทึกข้อมูลไว้ให้ดูได้)"
                              >
                                Cancel
                              </button>
                            )}

                            {canManagePO && (
                              <button
                                onClick={() => handleOpenConfirmModal("delete", o)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ลบใบสั่งซื้อถาวร (ยืนยัน 2 ขั้นตอน)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-xs text-slate-400">
                          ไม่พบรายการใบสั่งซื้อที่ตรงกับเงื่อนไขการค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LOT MANAGEMENT VIEW */}
          {activeTab === "lots" && (
            <div className="space-y-6">
              {/* Active Lots Section */}
              <div className="liquid-glass rounded-3xl p-6 shadow-sm border border-white/60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">
                        รอบการสั่งซื้อที่กำลังดำเนินการ (Active Lots - รอรับของ)
                      </h2>
                      <p className="text-xs text-slate-500">
                        สถานะของใบสั่งซื้อที่ยืนยันออก Lot แล้ว จะคงอยู่ในระบบเตือนสั่งซื้อและพยากรณ์
                        เมื่อกด &apos;รับสินค้าเรียบร้อย&apos; สถานะ Lot จะเสร็จสิ้นและหายไปอัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 font-mono">
                    {activeLots.length} รอบ Lot
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeLots.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white/90 rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-sm font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                            {o.lotNumber || "รอออก Lot"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              o.status === "confirm"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {o.status === "confirm" ? "สั่งซื้อแล้ว / รอจัดส่ง" : "อนุมัติแล้ว"}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm mb-1">{o.title}</h3>
                        <p className="text-xs text-slate-500 font-mono mb-3">PO: {o.poNumber}</p>

                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                          <div className="flex justify-between">
                            <span className="text-slate-400">จำนวนสินค้า:</span>
                            <span className="font-bold font-mono text-slate-800">
                              {o.items.length} รายการ ({o.totalOrderQty.toLocaleString()} ชิ้น)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">มูลค่ารวม:</span>
                            <span className="font-bold font-mono text-emerald-600">
                              ฿{o.totalCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">วันที่ยืนยัน:</span>
                            <span>{new Date(o.updatedAt).toLocaleDateString("th-TH")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setViewingPrintOrder(o)}
                          className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>ดูฟอร์ม</span>
                        </button>

                        {canManagePO && o.status === "confirm" && (
                          <button
                            onClick={() => handleOpenConfirmModal("receive", o)}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>รับของ (2 ขั้นตอน)</span>
                          </button>
                        )}

                        {canManagePO && o.status === "approved" && (
                          <button
                            onClick={() => handleOpenConfirmModal("confirm", o)}
                            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>ออก Lot (2 ขั้นตอน)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {activeLots.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white/60 rounded-2xl border border-dashed border-slate-200">
                      <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-medium">
                        ขณะนี้ไม่มีรอบ Lot ที่ค้างส่ง ทุกรายการได้รับของเรียบร้อยแล้ว
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Completed Lots History */}
              <div className="liquid-glass rounded-3xl p-6 shadow-sm border border-white/60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-bold text-slate-900 text-sm">
                      ประวัติการตรวจรับสินค้าเรียบร้อยแล้ว (Received Lots History)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    เสร็จสิ้น {completedLots.length} รายการ
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-2.5 px-3">รอบ Lot</th>
                        <th className="py-2.5 px-3">เลขที่ PO</th>
                        <th className="py-2.5 px-3">ชื่อเอกสาร</th>
                        <th className="py-2.5 px-3 text-right">จำนวนชิ้น</th>
                        <th className="py-2.5 px-3 text-right">มูลค่า (฿)</th>
                        <th className="py-2.5 px-3">ผู้ตรวจรับ</th>
                        <th className="py-2.5 px-3">วันที่รับของ</th>
                        <th className="py-2.5 px-3 text-center">ฟอร์ม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {completedLots.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {o.lotNumber || "-"}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{o.poNumber}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{o.title}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {o.totalOrderQty.toLocaleString()} ชิ้น
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                            ฿{o.totalCost.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{o.receivedBy || "-"}</td>
                          <td className="py-2 px-3 text-slate-500">
                            {o.receivedAt
                              ? new Date(o.receivedAt).toLocaleDateString("th-TH")
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setViewingPrintOrder(o)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
                              title="ดูฟอร์ม"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {completedLots.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-xs text-slate-400">
                            ยังไม่มีประวัติการรับสินค้าที่เสร็จสิ้น
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
