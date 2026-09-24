import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  X,
  Lock,
  FileCheck,
  Ban,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { PurchaseOrder, PurchaseOrderStatus, Employee } from "../types";

export type POActionType =
  | "approve"
  | "confirm"
  | "receive"
  | "cancel"
  | "delete";

interface TwoStepConfirmModalProps {
  order: PurchaseOrder;
  actionType: POActionType;
  currentUser: Employee;
  customLotNumber?: string;
  isOpen?: boolean;
  isProcessing?: boolean;
  onClose: () => void;
  onExecute?: (order: PurchaseOrder, actionType: POActionType, meta?: { lotNumber?: string; reason?: string }) => Promise<void>;
  onConfirm?: (meta?: { lotNumber?: string; reason?: string }) => Promise<void>;
}

export const TwoStepConfirmModal: React.FC<TwoStepConfirmModalProps> = ({
  order,
  actionType,
  currentUser,
  customLotNumber,
  isOpen = true,
  isProcessing: externalIsProcessing = false,
  onClose,
  onExecute,
  onConfirm,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [lotInput, setLotInput] = useState(customLotNumber || order.lotNumber || "");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBusy = isProcessing || externalIsProcessing;

  const getActionDetails = () => {
    switch (actionType) {
      case "approve":
        return {
          title: "อนุมัติใบสั่งซื้อ (Approve)",
          targetStatus: "Approved",
          icon: FileCheck,
          accentColor: "emerald",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
          step1Desc: `คุณกำลังจะอนุมัติใบสั่งซื้อ ${order.poNumber} ยอดรวม ฿${order.totalCost.toLocaleString()} (${order.totalItems} รายการ)`,
          step2Desc: "ยืนยันการอนุมัติใบสั่งซื้ออย่างเป็นทางการ ข้อมูลจะบันทึกพร้อมชื่อผู้อนุมัติในระบบ",
          badgeText: "ขั้นตอนอนุมัติ (Step 1 -> Approved)",
        };
      case "confirm":
        return {
          title: "ยืนยันสั่งซื้อและออก Lot (Confirm Order)",
          targetStatus: "Confirm",
          icon: Sparkles,
          accentColor: "sky",
          btnColor: "bg-sky-600 hover:bg-sky-700 text-white",
          step1Desc: `คุณกำลังยืนยันว่าได้ส่งใบสั่งซื้อไปยังผู้ขายแล้ว และจะกำหนดเลขที่ Lot สำหรับติดตามการจัดส่ง`,
          step2Desc: "รายการสินค้าทั้งหมดในใบสั่งซื้อนี้จะถูกอัปเดตสถานะ 'สั่งซื้อแล้วรอจัดส่ง' ในหน้าเตือนสั่งซื้อและพยากรณ์อัตโนมัติ",
          badgeText: "ขั้นตอนออก Lot (Approved -> Confirm)",
        };
      case "receive":
        return {
          title: "ตรวจรับสินค้าเรียบร้อย (Mark as Received)",
          targetStatus: "Received",
          icon: CheckCircle2,
          accentColor: "teal",
          btnColor: "bg-teal-600 hover:bg-teal-700 text-white",
          step1Desc: `คุณกำลังบันทึกว่าได้รับสินค้าครบถ้วนตามใบสั่งซื้อ ${order.poNumber} (Lot: ${order.lotNumber || "-"})`,
          step2Desc: "เมื่อยืนยัน เลขที่ Lot นี้จะเสร็จสิ้นและหายไปจากรายการ Lot ค้างส่งอัตโนมัติ",
          badgeText: "ขั้นตอนรับสินค้า (Confirm -> Received)",
        };
      case "cancel":
        return {
          title: "ยกเลิกใบสั่งซื้อ (Cancel Order)",
          targetStatus: "Cancelled",
          icon: Ban,
          accentColor: "amber",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
          step1Desc: `คุณต้องการยกเลิกใบสั่งซื้อ ${order.poNumber} (รายการข้อมูลจะยังคงอยู่ สามารถเปิดดูรายละเอียดได้ตลอดเวลา)`,
          step2Desc: "การยกเลิกจะปลดล็อคสถานะค้างส่งในหน้าเตือนสั่งซื้อ และบันทึกเหตุผลการยกเลิกไว้ในระบบ",
          badgeText: "ขั้นตอนยกเลิกเอกสาร (Cancel)",
        };
      case "delete":
        return {
          title: "ลบใบสั่งซื้อถาวร (Delete Order)",
          targetStatus: "Deleted",
          icon: Trash2,
          accentColor: "rose",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
          step1Desc: `คำเตือน: คุณกำลังจะลบใบสั่งซื้อ ${order.poNumber} ออกจากระบบอย่างถาวร`,
          step2Desc: "การลบจะไม่สามารถกู้คืนได้ หากต้องการเก็บบันทึกประวัติไว้ แนะนำให้เลือก 'ยกเลิก (Cancel)' แทน",
          badgeText: "ขั้นตอนลบถาวร (Permanent Delete)",
        };
    }
  };

  const details = getActionDetails();
  const Icon = details.icon;

  const handleStep1Next = () => {
    if (actionType === "confirm" && !lotInput.trim()) {
      setErrorMessage("กรุณาระบุเลขที่ Lot การสั่งซื้อ");
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      if (typeof onExecute === "function") {
        await onExecute(order, actionType, {
          lotNumber: lotInput.trim() || undefined,
          reason: cancelReason.trim() || undefined,
        });
      } else if (typeof onConfirm === "function") {
        await onConfirm({
          lotNumber: lotInput.trim() || undefined,
          reason: cancelReason.trim() || undefined,
        });
      } else {
        throw new Error("ไม่มีฟังก์ชันสำหรับดำเนินการ (No execute handler)");
      }
      onClose();
    } catch (err: any) {
      console.error("Execute action error:", err);
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl liquid-glass border border-white/80 shadow-2xl p-6 text-slate-900 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div
            className={`p-3 rounded-2xl ${
              actionType === "delete"
                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                : actionType === "cancel"
                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
            }`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {details.badgeText}
              </span>
              <span className="text-xs font-bold text-sky-700">
                ยืนยันขั้นตอนที่ {step} จาก 2
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              {details.title}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              เลขที่เอกสาร: {order.poNumber} {order.lotNumber ? `(Lot: ${order.lotNumber})` : ""}
            </p>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step >= 1 ? "bg-sky-600" : "bg-slate-200"
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step >= 2
                ? actionType === "delete"
                  ? "bg-rose-600"
                  : actionType === "cancel"
                  ? "bg-amber-600"
                  : "bg-emerald-600"
                : "bg-slate-200"
            }`}
          />
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: REVIEW & INPUTS */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">{details.step1Desc}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400">รายการสินค้า:</span>{" "}
                  <span className="font-bold">{order.totalItems} รายการ</span>
                </div>
                <div>
                  <span className="text-slate-400">จำนวนสั่งรวม:</span>{" "}
                  <span className="font-bold">{order.totalOrderQty.toLocaleString()} หน่วย</span>
                </div>
                <div>
                  <span className="text-slate-400">งบประมาณรวม:</span>{" "}
                  <span className="font-bold text-emerald-700">฿{order.totalCost.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">สถานะปัจจุบัน:</span>{" "}
                  <span className="font-bold uppercase">{order.status}</span>
                </div>
              </div>
            </div>

            {/* If Confirming: require/edit Lot number */}
            {actionType === "confirm" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  ระบุเลขที่ Lot สำหรับติดตามการสั่งซื้อ:
                </label>
                <input
                  type="text"
                  value={lotInput}
                  onChange={(e) => setLotInput(e.target.value)}
                  placeholder="เช่น LOT-202609-001"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  เลข Lot นี้จะนำไปแสดงในหน้าเตือนสั่งซื้อและพยากรณ์ เพื่อบอกสถานะการจัดส่ง
                </p>
              </div>
            )}

            {/* If Cancelling: ask for reason */}
            {actionType === "cancel" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  เหตุผลในการยกเลิก (สามารถเว้นว่างได้):
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="เช่น เปลี่ยนแปลงแผนการผลิต / ผู้ขายสินค้าหมดสต็อก..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {/* Security permission stamp */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 text-[11px] text-sky-900">
              <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>
                ผู้ดำเนินการ: <strong>{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleStep1Next}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md transition cursor-pointer"
              >
                <span>ถัดไป: ยืนยันขั้นที่ 2</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FINAL CONFIRMATION */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                actionType === "delete"
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : actionType === "cancel"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>ยืนยันครั้งที่ 2 (Final Confirmation)</span>
              </div>
              <p>{details.step2Desc}</p>
              {actionType === "confirm" && (
                <div className="p-2 rounded-lg bg-white/80 border border-emerald-200 font-mono text-xs font-bold text-slate-900">
                  Lot Number ที่จะบันทึก: {lotInput}
                </div>
              )}
              {actionType === "cancel" && cancelReason && (
                <div className="p-2 rounded-lg bg-white/80 border border-amber-200 text-xs text-slate-700">
                  เหตุผล: {cancelReason}
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              การกดปุ่มยืนยันด้านล่างนี้จะทำการบันทึกและซิงค์ข้อมูลบน Cloud Firestore ทันที
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isProcessing}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                ← ย้อนกลับ
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50 ${details.btnColor}`}
                >
                  {isProcessing ? (
                    <span>กำลังประมวลผล...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ยืนยันครั้งที่ 2 อย่างเป็นทางการ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
