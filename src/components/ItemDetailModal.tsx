import React, { useState, useMemo } from "react";
import {
  X,
  Package,
  Layers,
  MapPin,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
} from "lucide-react";
import type { StockItem, Transaction, Employee } from "../types";
import { hasPermission } from "../utils/permissionUtils";
import { parseFlexibleDate } from "../utils/exportUtils";
import { extractAllMonths, selectTargetMonths } from "../utils/usageUtils";

interface ItemDetailModalProps {
  item: StockItem | null;
  currentUser?: Employee;
  onClose: () => void;
  transactions?: Transaction[];
  onQuickMove?: (item: StockItem, type: "in" | "out") => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  currentUser,
  onClose,
  transactions = [],
  onQuickMove,
}) => {
  const [copied, setCopied] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "in" | "out">("all");
  const [usagePeriodMonths, setUsagePeriodMonths] = useState<6 | 12 | 24 | 0>(12);

  const canReceive = hasPermission(currentUser, "receive");
  const canIssue = hasPermission(currentUser, "issue");

  const allMonths = useMemo(() => extractAllMonths(transactions), [transactions]);

  const itemHistoryData = useMemo(() => {
    if (!item) {
      return {
        allTxs: [] as Transaction[],
        inTxs: [] as Transaction[],
        outTxs: [] as Transaction[],
        totalInQty: 0,
        totalOutQty: 0,
        totalInCost: 0,
        totalOutCost: 0,
        avgMonthlyOut: 0,
        periodOutQty: 0,
        periodSpan: 1,
      };
    }

    const cleanTarget = item.barcode.trim().toLowerCase();
    const matched = transactions
      .filter((t) => t.barcode.trim().toLowerCase() === cleanTarget)
      .sort((a, b) => {
        const tA = a.timestamp ?? parseFlexibleDate(a.date, a.year, a.month);
        const tB = b.timestamp ?? parseFlexibleDate(b.date, b.year, b.month);
        return tB - tA;
      });

    const inTxs: Transaction[] = [];
    const outTxs: Transaction[] = [];
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalInCost = 0;
    let totalOutCost = 0;

    const targetMonths = selectTargetMonths(allMonths, usagePeriodMonths);
    const targetKeySet = new Set(targetMonths.map((m) => m.key));
    let periodOutQty = 0;

    for (const t of matched) {
      const qIn = t.qtyIn || 0;
      const qOut = t.qtyOut || 0;
      const price = t.unitPrice || item.unitCost || 0;
      if (qIn > 0) {
        inTxs.push(t);
        totalInQty += qIn;
        totalInCost += qOut === 0 && t.totalCost ? t.totalCost : qIn * price;
      }
      if (qOut > 0) {
        outTxs.push(t);
        totalOutQty += qOut;
        totalOutCost += qIn === 0 && t.totalCost ? t.totalCost : qOut * price;
      }
      if (qOut > 0 && t.year && t.month) {
        const y = t.year > 2400 ? t.year - 543 : t.year;
        const key = `${y}-${String(t.month).padStart(2, "0")}`;
        if (targetKeySet.has(key)) {
          periodOutQty += qOut;
        }
      }
    }

    const periodSpan = Math.max(1, targetMonths.length);
    const avgMonthlyOut = parseFloat((periodOutQty / periodSpan).toFixed(1));

    return {
      allTxs: matched,
      inTxs,
      outTxs,
      totalInQty,
      totalOutQty,
      totalInCost,
      totalOutCost,
      avgMonthlyOut,
      periodOutQty,
      periodSpan,
    };
  }, [item, transactions, allMonths, usagePeriodMonths]);

  if (!item) return null;

  const displayedTxs =
    historyFilter === "in"
      ? itemHistoryData.inTxs
      : historyFilter === "out"
      ? itemHistoryData.outTxs
      : itemHistoryData.allTxs;

  const totalValue = item.currentBalance * item.unitCost;
  const isLowStock = item.currentBalance <= item.minStock && item.minStock > 0;
  const isOutOfStock = item.currentBalance <= 0;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(item.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-slate-800 px-2 py-0.5 rounded text-amber-400 border border-slate-700">
                  {item.barcode}
                </span>
                <button
                  onClick={handleCopyBarcode}
                  className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  title="คัดลอกบาร์โค้ด"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 line-clamp-1">
                {item.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isOutOfStock
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : isLowStock
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-3">
              {isOutOfStock || isLowStock ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <div className="font-bold text-sm">
                  สถานะสต็อก:{" "}
                  {isOutOfStock
                    ? "หมดสต็อก (Out of Stock)"
                    : isLowStock
                    ? "สต็อกต่ำกว่าเกณฑ์ (Low Stock - ต้องทำการซื้อ)"
                    : "สต็อกพร้อมใช้งาน (Normal)"}
                </div>
                <div className="text-xs opacity-90">
                  คงเหลือปัจจุบัน {item.currentBalance.toLocaleString()} {item.unit} / จุดสั่งซื้อ
                  Min Stock {item.minStock.toLocaleString()} {item.unit}
                </div>
              </div>
            </div>

            {onQuickMove && (canReceive || canIssue) && (
              <div className="flex items-center gap-2">
                {canReceive && (
                  <button
                    onClick={() => {
                      onClose();
                      onQuickMove(item, "in");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                  >
                    + รับเข้า
                  </button>
                )}
                {canIssue && (
                  <button
                    onClick={() => {
                      onClose();
                      onQuickMove(item, "out");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition cursor-pointer"
                  >
                    - จ่ายออก
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Key Metrics Grid (5 Cards including Avg Monthly Usage) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">คงเหลือยกยอด</span>
              <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
                {item.forwardBalance?.toLocaleString() || "0"}
              </div>
              <span className="text-[11px] text-slate-400">{item.unit}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
              <span className="text-xs text-amber-900 font-medium">คงเหลือปัจจุบัน</span>
              <div className="text-xl font-extrabold text-amber-950 mt-0.5 font-mono">
                {item.currentBalance.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-700 font-medium">{item.unit}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-sky-900 font-semibold">ใช้เฉลี่ย/เดือน</span>
                <select
                  value={usagePeriodMonths}
                  onChange={(e) => setUsagePeriodMonths(Number(e.target.value) as any)}
                  className="text-[10px] bg-white border border-sky-200 rounded px-1 py-0.5 text-sky-800 font-semibold cursor-pointer"
                  title="เลือกช่วงเวลาคำนวณค่าเฉลี่ยต่อเดือน"
                >
                  <option value={6}>6 ด.</option>
                  <option value={12}>1 ปี</option>
                  <option value={24}>2 ปี</option>
                  <option value={0}>ทั้งหมด</option>
                </select>
              </div>
              <div className="text-lg font-extrabold text-sky-800 mt-0.5 font-mono">
                {itemHistoryData.avgMonthlyOut.toLocaleString()}
              </div>
              <span className="text-[10px] text-sky-700">
                {item.unit}/ด. (รวม {itemHistoryData.periodOutQty.toLocaleString()} ใน{" "}
                {itemHistoryData.periodSpan} ด.)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">ราคาต่อหน่วย</span>
              <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
                ฿{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">บาท / {item.unit}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">มูลค่ารวมในคลัง</span>
              <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
                ฿{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">บาท</span>
            </div>
          </div>

          {/* All-Time History Totals Banner (รับเข้าทั้งหมด & จ่ายออกทั้งหมด) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setHistoryFilter(historyFilter === "in" ? "all" : "in")}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                historyFilter === "in"
                  ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                  : "bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:bg-emerald-100/60"
              }`}
            >
              <div>
                <div
                  className={`text-xs font-bold flex items-center gap-1.5 ${
                    historyFilter === "in" ? "text-emerald-100" : "text-emerald-800"
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>ยอดรับเข้าทั้งหมดในประวัติ (คลิกกรอง)</span>
                </div>
                <div className="text-lg font-extrabold font-mono mt-0.5">
                  +{itemHistoryData.totalInQty.toLocaleString()} {item.unit}
                </div>
                <div
                  className={`text-[11px] ${
                    historyFilter === "in" ? "text-emerald-100" : "text-emerald-700"
                  }`}
                >
                  จาก {itemHistoryData.inTxs.length.toLocaleString()} รายการรับเข้า • มูลค่ารวม ฿
                  {itemHistoryData.totalInCost.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            </div>

            <div
              onClick={() => setHistoryFilter(historyFilter === "out" ? "all" : "out")}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                historyFilter === "out"
                  ? "bg-rose-700 text-white border-rose-700 shadow-sm"
                  : "bg-rose-50/60 border-rose-200 text-rose-950 hover:bg-rose-100/60"
              }`}
            >
              <div>
                <div
                  className={`text-xs font-bold flex items-center gap-1.5 ${
                    historyFilter === "out" ? "text-rose-100" : "text-rose-800"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>ยอดจ่ายออกทั้งหมดในประวัติ (คลิกกรอง)</span>
                </div>
                <div className="text-lg font-extrabold font-mono mt-0.5">
                  -{itemHistoryData.totalOutQty.toLocaleString()} {item.unit}
                </div>
                <div
                  className={`text-[11px] ${
                    historyFilter === "out" ? "text-rose-100" : "text-rose-700"
                  }`}
                >
                  จาก {itemHistoryData.outTxs.length.toLocaleString()} รายการเบิกจ่าย • มูลค่ารวม ฿
                  {itemHistoryData.totalOutCost.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Specification details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4 text-amber-600" /> ข้อมูลสินค้า
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className="text-slate-500">ชนิดสินค้า (Type):</span>
                <span className="col-span-2 font-medium text-slate-800">
                  {item.category || "-"}
                </span>

                <span className="text-slate-500">ไลน์การผลิต (Line):</span>
                <span className="col-span-2 font-medium text-slate-800">{item.line || "-"}</span>

                <span className="text-slate-500">หน่วยนับ:</span>
                <span className="col-span-2 font-medium text-slate-800">{item.unit || "-"}</span>

                <span className="text-slate-500">Min Stock:</span>
                <span className="col-span-2 font-bold text-amber-700">
                  {item.minStock?.toLocaleString() || "0"} {item.unit}
                </span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-amber-600" /> คลัง & ผู้จัดจำหน่าย
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className="text-slate-500">Supplier:</span>
                <span className="col-span-2 font-medium text-slate-800">
                  {item.supplier || "-"}
                </span>

                <span className="text-slate-500">ตำแหน่งจัดเก็บ:</span>
                <span className="col-span-2 font-medium text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {item.location || "ไม่ได้ระบุ"}
                </span>

                <span className="text-slate-500">หมายเหตุ:</span>
                <span className="col-span-2 text-slate-600 italic">{item.note || "-"}</span>
              </div>
            </div>
          </div>

          {/* Complete movement logs for this item */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> ประวัติการรับเข้า-จ่ายออกทั้งหมด (
                {displayedTxs.length.toLocaleString()} รายการ)
              </h3>

              {/* Filter Tabs for All / Incoming / Outgoing */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setHistoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    historyFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  ทั้งหมด ({itemHistoryData.allTxs.length})
                </button>
                <button
                  onClick={() => setHistoryFilter("in")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    historyFilter === "in"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  รับเข้าทั้งหมด ({itemHistoryData.inTxs.length})
                </button>
                <button
                  onClick={() => setHistoryFilter("out")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    historyFilter === "out"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  จ่ายออกทั้งหมด ({itemHistoryData.outTxs.length})
                </button>
              </div>
            </div>

            {displayedTxs.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ไม่พบบันทึกประวัติในหมวดที่เลือกสำหรับบาร์โค้ดนี้
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5">วันที่</th>
                      <th className="p-2.5">ประเภท</th>
                      <th className="p-2.5 text-right text-emerald-700">รับเข้า (In)</th>
                      <th className="p-2.5 text-right text-rose-700">จ่ายออก (Out)</th>
                      <th className="p-2.5">ผู้เบิก / ผู้บันทึก</th>
                      <th className="p-2.5">ไลน์</th>
                      <th className="p-2.5 text-right">ยอดคงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedTxs.map((tx, idx) => {
                      const hasIn = (tx.qtyIn || 0) > 0;
                      const hasOut = (tx.qtyOut || 0) > 0;
                      return (
                        <tr key={`${tx.id || "tx"}_${idx}`} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 text-slate-600 font-mono whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="p-2.5">
                            {hasIn && hasOut ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                รับ+จ่าย
                              </span>
                            ) : hasIn ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                รับเข้า
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                                จ่ายออก
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                            {hasIn ? `+${tx.qtyIn.toLocaleString()} ${item.unit}` : "-"}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                            {hasOut ? `-${tx.qtyOut.toLocaleString()} ${item.unit}` : "-"}
                          </td>
                          <td className="p-2.5 text-slate-700">{tx.employeeName || "-"}</td>
                          <td className="p-2.5 text-slate-600">{tx.line || item.line || "-"}</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            {tx.balance?.toLocaleString() ?? "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
