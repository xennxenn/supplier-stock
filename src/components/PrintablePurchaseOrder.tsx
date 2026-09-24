import React from "react";
import { Printer, X, Download, ShieldCheck, CheckCircle2, Ban } from "lucide-react";
import type { PurchaseOrder } from "../types";
import { exportToCSV } from "../utils/exportUtils";
import { useTheme } from "../context/ThemeContext";

interface PrintablePurchaseOrderProps {
  order: PurchaseOrder;
  onClose: () => void;
}

export const PrintablePurchaseOrder: React.FC<PrintablePurchaseOrderProps> = ({
  order,
  onClose,
}) => {
  const { theme } = useTheme();

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
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

    exportToCSV(`ใบสั่งซื้อ_${order.poNumber}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const getStatusText = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "new":
        return "New (สร้างบันทึกข้อมูล)";
      case "approved":
        return "Approved (อนุมัติสั่งซื้อ)";
      case "confirm":
        return `Confirm (ยืนยันสั่งซื้อแล้ว / ${order.lotNumber || "รอระบุ Lot"})`;
      case "received":
        return "Received (ได้รับสินค้าเรียบร้อย)";
      case "cancelled":
        return "Cancelled (ยกเลิกแล้ว)";
      default:
        return status;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Floating Action Bar (Hidden when printing) */}
      <div className="fixed top-4 right-6 z-60 flex items-center gap-2 print:hidden no-print">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-lg border border-slate-200 transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export CSV</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-lg transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>พิมพ์ใบสั่งซื้อ (Print)</span>
        </button>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-lg transition-colors"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* A4 Document Container */}
      <div className="bg-white text-slate-900 w-full max-w-4xl p-8 sm:p-12 rounded-3xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-full print:rounded-none">
        {/* Company Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {theme.logoUrl && (
                <img
                  src={theme.logoUrl}
                  alt="Company Logo"
                  className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-1 bg-white"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-slate-900">
                    {theme.logoText || "PASAYA"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                    SUPPLIER ACCESSORIES STOCK
                  </span>
                </div>
                <h1 className="text-lg font-bold text-slate-800 mt-1">
                  ใบสั่งซื้อวัตถุดิบและอุปกรณ์ (PURCHASE ORDER)
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  บริษัท พาซาย่า จำกัด · คลังพัสดุและจัดซื้ออุปกรณ์การผลิต
                </p>
              </div>
            </div>

            <div className="text-right sm:self-start">
              <div className="text-sm font-bold text-slate-800">
                เลขที่ใบสั่งซื้อ: <span className="font-mono text-base text-sky-700">{order.poNumber}</span>
              </div>
              {order.lotNumber && (
                <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                  เลขที่รอบ Lot: <span className="font-mono">{order.lotNumber}</span>
                </div>
              )}
              <div className="text-xs text-slate-500 mt-1">วันที่ออกเอกสาร: {formattedDate}</div>
              <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${
                order.status === "cancelled"
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : "bg-slate-100 text-slate-700"
              }`}>
                สถานะ: {getStatusText(order.status)}
              </div>
              {order.status === "cancelled" && order.cancelReason && (
                <div className="text-[11px] text-rose-600 mt-1">
                  เหตุผล: {order.cancelReason}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PO Details & Context */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">ชื่อเอกสาร / รายละเอียด:</span>
            <span className="font-bold text-slate-800 text-sm">{order.title}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">ผู้จัดทำ (Created By):</span>
            <span className="font-semibold text-slate-800">{order.createdBy}</span>
            {order.filterSummary && (
              <span className="block text-[11px] text-slate-500 mt-0.5">{order.filterSummary}</span>
            )}
          </div>
          <div>
            <span className="text-slate-400 block font-medium">ผู้อนุมัติ / ยืนยัน:</span>
            <span className="font-semibold text-slate-800">
              {order.approvedBy || order.confirmedBy || "รอดำเนินการอนุมัติ"}
            </span>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              เผื่อการใช้วัตถุดิบ: +{order.safetyBufferPercent}%
            </span>
          </div>
        </div>

        {/* 12-Column Required Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-800 text-white font-semibold">
                <th className="py-2.5 px-2 text-center w-8">#</th>
                <th className="py-2.5 px-2">1. บาร์โค้ด</th>
                <th className="py-2.5 px-3">2. ชื่อรายการสินค้า</th>
                <th className="py-2.5 px-2">3. ไลน์ / Supplier</th>
                <th className="py-2.5 px-2 text-right">4. เฉลี่ย/ด.</th>
                <th className="py-2.5 px-2 text-center">5. พอใช้</th>
                <th className="py-2.5 px-2 text-center">6. สถานะ</th>
                <th className="py-2.5 px-2 text-right">7. คงเหลือ</th>
                <th className="py-2.5 px-2 text-right">8. Min</th>
                <th className="py-2.5 px-2 text-right">9. แนะนำ</th>
                <th className="py-2.5 px-2 text-right bg-sky-900 text-sky-100 font-bold">10. สั่งซื้อ</th>
                <th className="py-2.5 px-2 text-right">11. ราคา/หน่วย</th>
                <th className="py-2.5 px-3 text-right bg-slate-900">12. รวมเงิน (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {order.items.map((it, idx) => (
                <tr key={it.barcode + idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-2 font-mono font-medium text-slate-700 whitespace-nowrap">
                    {it.barcode}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800">
                    <div>{it.itemName}</div>
                    <div className="text-[10px] text-slate-400">หน่วย: {it.unit}</div>
                  </td>
                  <td className="py-2 px-2 text-slate-600">
                    <div>{it.line}</div>
                    {it.supplier && <div className="text-[10px] text-slate-400">{it.supplier}</div>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-600 tabular-nums">
                    {it.monthlyBurnRate.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-center font-medium whitespace-nowrap">
                    {it.monthsOfStock >= 999 ? "-" : `${it.monthsOfStock.toFixed(1)} ด.`}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
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
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 tabular-nums">
                    {it.currentBalance.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-500 tabular-nums">
                    {it.minStock.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-600 tabular-nums">
                    {it.recommendedOrder.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-sky-900 bg-sky-50 tabular-nums">
                    {it.orderQty.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-600 tabular-nums">
                    ฿{it.unitPrice.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50 tabular-nums">
                    ฿{it.totalCost.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={10} className="py-3 px-4 text-right">
                  ยอดรวมจำนวนสั่งซื้อทั้งหมด ({order.items.length} รายการ):
                </td>
                <td className="py-3 px-2 text-right font-mono text-sky-900 text-xs">
                  {order.totalOrderQty.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right text-slate-600">รวมเป็นเงิน:</td>
                <td className="py-3 px-3 text-right font-mono text-sm text-slate-900">
                  ฿{order.totalCost.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes if any */}
        {order.notes && (
          <div className="mb-8 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900">
            <span className="font-bold">หมายเหตุเพิ่มเติม: </span>
            <span>{order.notes}</span>
          </div>
        )}

        {/* 3 Signature Blocks */}
        <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-xs text-center print:break-inside-avoid">
          <div className="p-4 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium mb-12">ผู้จัดทำใบสั่งซื้อ (Prepared By)</div>
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
            <div className="font-bold text-slate-800">{order.createdBy}</div>
            <div className="text-[10px] text-slate-400">วันที่: {formattedDate}</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium mb-12">ผู้อนุมัติสั่งซื้อ (Approved By)</div>
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
            <div className="font-bold text-slate-800">{order.approvedBy || "...................................."}</div>
            <div className="text-[10px] text-slate-400">
              วันที่: {order.approvedAt ? new Date(order.approvedAt).toLocaleDateString("th-TH") : "......../......../........"}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium mb-12">ผู้รับมอบสินค้า (Received By)</div>
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
            <div className="font-bold text-slate-800">{order.receivedBy || "...................................."}</div>
            <div className="text-[10px] text-slate-400">
              วันที่: {order.receivedAt ? new Date(order.receivedAt).toLocaleDateString("th-TH") : "......../......../........"}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
          เอกสารใบสั่งซื้อสร้างจากระบบ Supplier Accessories Stock (PASAYA) · ข้อมูลซิงค์ Realtime บน Cloud
        </div>
      </div>
    </div>
  );
};
