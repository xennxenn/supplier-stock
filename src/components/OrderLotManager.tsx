import React, { useMemo } from "react";
import {
  Package,
  AlertCircle,
  BookmarkCheck,
  Trash2,
  X,
  Lock,
} from "lucide-react";
import type { OrderStatus } from "../types";

export interface OrderLotManagerProps {
  orderStatuses: OrderStatus[];
  activeLotNumber: string;
  lotInput: string;
  canManageOrderStatus: boolean;
  onLotInputChange: (value: string) => void;
  onSaveActiveLot: () => void;
  onUnlockLot: () => void;
  onClearLot: (targetLot: string) => Promise<void>;
  isClearing?: boolean;
  showClearLotModal: boolean;
  setShowClearLotModal: (show: boolean) => void;
  selectedLotToClear: string;
  setSelectedLotToClear: (lot: string) => void;
}

export const OrderLotManager: React.FC<OrderLotManagerProps> = ({
  orderStatuses,
  activeLotNumber,
  lotInput,
  canManageOrderStatus,
  onLotInputChange,
  onSaveActiveLot,
  onUnlockLot,
  onClearLot,
  isClearing = false,
  showClearLotModal,
  setShowClearLotModal,
  selectedLotToClear,
  setSelectedLotToClear,
}) => {
  // Calculate items count per Lot (including any legacy or untagged items)
  const lotStats = useMemo(() => {
    const counts = new Map<string, number>();
    orderStatuses.forEach((s) => {
      if (s.isOrdered) {
        const lot = s.lotNumber && s.lotNumber.trim() !== "" ? s.lotNumber.trim() : "ไม่ระบุ Lot";
        counts.set(lot, (counts.get(lot) || 0) + 1);
      }
    });
    return counts;
  }, [orderStatuses]);

  const uniqueLots = useMemo(() => {
    return Array.from(lotStats.keys()).sort();
  }, [lotStats]);

  const totalOrderedItems = useMemo(() => {
    return orderStatuses.filter((s) => s.isOrdered).length;
  }, [orderStatuses]);

  const effectiveSelectedLot = useMemo(() => {
    if (selectedLotToClear === "__ALL__") return "__ALL__";
    if (selectedLotToClear && uniqueLots.includes(selectedLotToClear)) {
      return selectedLotToClear;
    }
    if (activeLotNumber && uniqueLots.includes(activeLotNumber)) {
      return activeLotNumber;
    }
    return uniqueLots[0] || "";
  }, [selectedLotToClear, uniqueLots, activeLotNumber]);

  const isCurrentActiveSaved =
    Boolean(activeLotNumber) && activeLotNumber === lotInput.trim();

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Title, Status Badge & Description */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-sm">
                  รอบการสั่งซื้อ (Order Lot Management)
                </h3>
                {activeLotNumber ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Lot ที่ใช้งานอยู่: <span className="font-mono">{activeLotNumber}</span> (
                    {lotStats.get(activeLotNumber) || 0} รายการ)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    ยังไม่ได้บันทึก Lot (ล็อกการติ๊กสั่งซื้อ)
                  </span>
                )}

                {!canManageOrderStatus && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <Lock className="w-3 h-3 text-rose-500" />
                    คุณไม่มีสิทธิ์จัดการ Lot (ดูอย่างเดียว)
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                {!canManageOrderStatus
                  ? "ติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์ 'จัดการรอบสั่งซื้อ & ติ๊กหมายเหตุสั่งซื้อ' ในหน้า พนักงาน & สิทธิ์"
                  : activeLotNumber
                  ? `กำลังจัดการ Lot "${activeLotNumber}" สามารถติ๊กเลือกรายการในคอลัมน์ "หมายเหตุสั่งซื้อ" ด้านล่างได้ทันที`
                  : "เลือก Lot เดิมจาก Dropdown หรือพิมพ์เลขที่ Lot ใหม่ แล้วกด 'บันทึก Lot' ก่อนเพื่อเริ่มติ๊กสั่งซื้อ"}
              </p>
            </div>
          </div>

          {/* Right: Inputs & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Existing Lot Dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 hidden sm:inline">Lot เดิม:</span>
              <select
                disabled={!canManageOrderStatus}
                value={uniqueLots.includes(lotInput) ? lotInput : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    onLotInputChange(e.target.value);
                  }
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  -- เลือก Lot เดิมที่เคยสร้าง ({uniqueLots.length} รอบ) --
                </option>
                {uniqueLots.map((lot) => (
                  <option key={lot} value={lot}>
                    Lot: {lot} ({lotStats.get(lot) || 0} รายการ)
                  </option>
                ))}
              </select>
            </div>

            {/* 2. New / Edit Lot Input */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 hidden sm:inline">หรือระบุใหม่:</span>
              <input
                type="text"
                disabled={!canManageOrderStatus}
                value={lotInput}
                onChange={(e) => onLotInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canManageOrderStatus) {
                    onSaveActiveLot();
                  }
                }}
                placeholder="พิมพ์เลขที่ Lot เช่น LOT-2026-09A..."
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[170px] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* 3. Save / Activate Lot Button */}
            <button
              onClick={onSaveActiveLot}
              disabled={!canManageOrderStatus || !lotInput.trim()}
              title={
                !canManageOrderStatus
                  ? "คุณไม่มีสิทธิ์จัดการรอบสั่งซื้อ"
                  : !lotInput.trim()
                  ? "กรุณาระบุเลขที่ Lot ก่อนบันทึก"
                  : "บันทึกและเปิดใช้งาน Lot นี้เพื่อทำการติ๊กสั่งซื้อ"
              }
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                isCurrentActiveSaved
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              {isCurrentActiveSaved ? "บันทึกแล้ว (พร้อมติ๊ก)" : "บันทึก Lot"}
            </button>

            {/* 4. Reset / Unlock Active Lot */}
            {activeLotNumber && canManageOrderStatus && (
              <button
                onClick={onUnlockLot}
                className="px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                title="ยกเลิกการเลือก Lot เพื่อหยุดหรือเปลี่ยนรอบ"
              >
                ปลดล็อก Lot
              </button>
            )}

            {/* 5. Clear Lot Round Button */}
            {canManageOrderStatus && (
              <button
                onClick={() => {
                  const initialLot =
                    activeLotNumber && uniqueLots.includes(activeLotNumber)
                      ? activeLotNumber
                      : uniqueLots[0] || "";
                  setSelectedLotToClear(initialLot);
                  setShowClearLotModal(true);
                }}
                disabled={uniqueLots.length === 0}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ml-1 ${
                  uniqueLots.length === 0
                    ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 cursor-pointer shadow-xs"
                }`}
                title={
                  uniqueLots.length === 0
                    ? "ยังไม่มีรายการสั่งซื้อในระบบที่ต้องล้าง"
                    : "ล้างข้อมูลรายการสั่งซื้อแยกตามแต่ละรอบ Lot หรือทั้งหมด"
                }
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                ล้างข้อมูลตามรอบ Lot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Clear Lot by Round */}
      {showClearLotModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-slate-800 text-base">
                  ล้างข้อมูลรายการสั่งซื้อตามรอบ Lot
                </h3>
              </div>
              <button
                onClick={() => setShowClearLotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                เลือกรอบ Lot ที่ต้องการล้างข้อมูล
                ระบบจะยกเลิกการติ๊กสั่งซื้อของสินค้าทุกรายการที่อยู่ในรอบนี้ และซิงค์ฐานข้อมูลไปยังทุกเครื่องทันที
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกรอบ Lot ที่ต้องการล้าง:
                </label>
                <select
                  value={effectiveSelectedLot}
                  onChange={(e) => setSelectedLotToClear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  {uniqueLots.length > 1 && (
                    <option value="__ALL__">
                      ⭐ ล้างข้อมูลสั่งซื้อทั้งหมดทุกรอบ ({totalOrderedItems} รายการ)
                    </option>
                  )}
                  {uniqueLots.map((lot) => (
                    <option key={lot} value={lot}>
                      Lot: {lot} (มี {lotStats.get(lot) || 0} รายการ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span>
                    เมื่อยืนยันแล้ว รายการสั่งซื้อ{" "}
                    {effectiveSelectedLot === "__ALL__" ? (
                      <strong>ทั้งหมดทุกรอบ Lot ({totalOrderedItems} รายการ)</strong>
                    ) : (
                      <>
                        ในรอบ <strong>"{effectiveSelectedLot}"</strong> (
                        {lotStats.get(effectiveSelectedLot) || 0} รายการ)
                      </>
                    )}{" "}
                    จะถูกยกเลิกสถานะและกลับเป็น "ยังไม่สั่ง" ทันที
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearLotModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                disabled={isClearing}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (effectiveSelectedLot) {
                    onClearLot(effectiveSelectedLot);
                  }
                }}
                disabled={isClearing || !effectiveSelectedLot}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isClearing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>กำลังล้างข้อมูล...</span>
                  </span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {effectiveSelectedLot === "__ALL__"
                        ? `ยืนยันล้างทั้งหมด (${totalOrderedItems} รายการ)`
                        : `ยืนยันล้างข้อมูลรอบนี้ (${lotStats.get(effectiveSelectedLot) || 0} รายการ)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
