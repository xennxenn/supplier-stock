import React from "react";
import {
  X,
  Package,
  Layers,
  MapPin,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { StockItem, Transaction, Employee } from "../types";
import { hasPermission } from "../utils/permissionUtils";

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
  const [copied, setCopied] = React.useState(false);
  const canReceive = hasPermission(currentUser, "receive");
  const canIssue = hasPermission(currentUser, "issue");

  if (!item) return null;

  const itemTxs = transactions.filter((t) => t.barcode === item.barcode);
  const totalValue = item.currentBalance * item.unitCost;
  const isLowStock = item.currentBalance <= item.minStock && item.minStock > 0;
  const isOutOfStock = item.currentBalance <= 0;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(item.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in duration-150"
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
                  className="text-slate-400 hover:text-white transition p-1"
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
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
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
                  คงเหลือปัจจุบัน {item.currentBalance.toLocaleString()}{" "}
                  {item.unit} / จุดสั่งซื้อ Min Stock{" "}
                  {item.minStock.toLocaleString()} {item.unit}
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

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">คงเหลือยกยอด</span>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {item.forwardBalance?.toLocaleString() || "0"}
              </div>
              <span className="text-[11px] text-slate-400">{item.unit}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
              <span className="text-xs text-amber-900 font-medium">
                คงเหลือปัจจุบัน
              </span>
              <div className="text-xl font-extrabold text-amber-950 mt-0.5">
                {item.currentBalance.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-700 font-medium">
                {item.unit}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">ราคาต่อหน่วย</span>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                ฿{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">บาท / {item.unit}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">มูลค่ารวมในคลัง</span>
              <div className="text-lg font-bold text-emerald-700 mt-0.5">
                ฿{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">บาท</span>
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
                <span className="col-span-2 font-medium text-slate-800">
                  {item.line || "-"}
                </span>

                <span className="text-slate-500">หน่วยนับ:</span>
                <span className="col-span-2 font-medium text-slate-800">
                  {item.unit || "-"}
                </span>

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
                <span className="col-span-2 text-slate-600 italic">
                  {item.note || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent movement logs for this item */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> ประวัติการเบิก-จ่าย
                ({itemTxs.length} รายการ)
              </h3>
            </div>

            {itemTxs.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ยังไม่มีบันทึกประวัติการเบิกจ่ายสำหรับบาร์โค้ดนี้
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">วันที่</th>
                      <th className="p-2.5">ประเภท</th>
                      <th className="p-2.5">จำนวน</th>
                      <th className="p-2.5">ผู้เบิก</th>
                      <th className="p-2.5">ไลน์</th>
                      <th className="p-2.5 text-right">ยอดคงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemTxs.slice(0, 15).map((tx, idx) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-600">{tx.date}</td>
                        <td className="p-2.5">
                          {tx.qtyIn > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              รับเข้า
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                              เบิกจ่าย
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {tx.qtyIn > 0
                            ? `+${tx.qtyIn.toLocaleString()}`
                            : `-${tx.qtyOut.toLocaleString()}`}{" "}
                          {item.unit}
                        </td>
                        <td className="p-2.5 text-slate-700">
                          {tx.employeeName || "-"}
                        </td>
                        <td className="p-2.5 text-slate-600">{tx.line || "-"}</td>
                        <td className="p-2.5 text-right font-mono text-slate-800">
                          {tx.balance?.toLocaleString() || "-"}
                        </td>
                      </tr>
                    ))}
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
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
