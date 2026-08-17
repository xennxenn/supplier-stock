import React, { useState, useEffect } from "react";
import {
  ArrowDownUp,
  PlusCircle,
  MinusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  User,
  Layers,
  Sparkles,
  Lock,
} from "lucide-react";
import type { StockItem, Transaction, Employee } from "../types";
import { hasPermission } from "../utils/permissionUtils";

interface MoveFormViewProps {
  items: StockItem[];
  currentUser: Employee;
  initialItem?: StockItem | null;
  initialType?: "in" | "out";
  onRecordTransaction: (tx: Partial<Transaction>) => void;
  onClearInitial?: () => void;
}

export const MoveFormView: React.FC<MoveFormViewProps> = ({
  items,
  currentUser,
  initialItem,
  initialType = "out",
  onRecordTransaction,
  onClearInitial,
}) => {
  const canReceive = hasPermission(currentUser, "receive");
  const canIssue = hasPermission(currentUser, "issue");

  // Determine valid initial move type based on user permissions
  const defaultMoveType: "in" | "out" =
    canReceive && !canIssue
      ? "in"
      : !canReceive && canIssue
      ? "out"
      : (initialType === "in" ? "in" : "out");

  const [moveType, setMoveType] = useState<"in" | "out">(defaultMoveType);
  const [selectedBarcode, setSelectedBarcode] = useState(initialItem?.barcode || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [empCode, setEmpCode] = useState(currentUser.employeeCode || "510220");
  const [empName, setEmpName] = useState(currentUser.name || "พนักงาน");
  const [selectedLine, setSelectedLine] = useState(initialItem?.line || "แพ็ค");
  const [note, setNote] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const activeItem = items.find((i) => i.barcode === selectedBarcode);

  useEffect(() => {
    if (initialItem) {
      setSelectedBarcode(initialItem.barcode);
      if (initialItem.line) setSelectedLine(initialItem.line);
    }
  }, [initialItem]);

  useEffect(() => {
    // Keep moveType strictly aligned if permissions don't allow current selection
    if (moveType === "in" && !canReceive && canIssue) {
      setMoveType("out");
    } else if (moveType === "out" && !canIssue && canReceive) {
      setMoveType("in");
    }
  }, [canReceive, canIssue, moveType]);

  // Autocomplete search
  const filteredSuggestions = items
    .filter(
      (it) =>
        it.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (moveType === "in" && !canReceive) {
      alert("คุณไม่มีสิทธิ์บันทึกรับเข้าสินค้า (Receive Restricted)");
      return;
    }
    if (moveType === "out" && !canIssue) {
      alert("คุณไม่มีสิทธิ์บันทึกเบิกจ่ายสินค้า (Issue Restricted)");
      return;
    }

    if (!activeItem) {
      alert("กรุณาเลือกรายการสินค้า");
      return;
    }

    if (qty <= 0) {
      alert("กรุณาระบุจำนวนที่มากกว่า 0");
      return;
    }

    if (moveType === "out" && qty > activeItem.currentBalance) {
      const confirmExceed = window.confirm(
        `คำเตือน: จำนวนที่จ่ายออก (${qty}) มากกว่ายอดคงเหลือปัจจุบัน (${activeItem.currentBalance}). ต้องการดำเนินการต่อหรือไม่?`
      );
      if (!confirmExceed) return;
    }

    const today = new Date();
    const thaiMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const dateFormatted = `${today.getDate()}-${thaiMonths[today.getMonth()]}-${today.getFullYear()}`;

    const newBalance =
      moveType === "in"
        ? activeItem.currentBalance + qty
        : activeItem.currentBalance - qty;

    const unitPrice = activeItem.unitCost || 0;
    const totalCost = Number((qty * unitPrice).toFixed(2));
    const status = newBalance <= activeItem.minStock ? "ต้องทำการซื้อ" : "ok";

    const newTx: Partial<Transaction> = {
      date: dateFormatted,
      barcode: activeItem.barcode,
      itemName: activeItem.name,
      unit: activeItem.unit || "ชิ้น",
      qtyIn: moveType === "in" ? qty : 0,
      qtyOut: moveType === "out" ? qty : 0,
      employeeId: empCode,
      employeeName: empName,
      line: selectedLine || activeItem.line || "แพ็ค",
      unitPrice,
      totalCost,
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      balance: newBalance,
      minStock: activeItem.minStock,
      status,
      type: moveType,
    };

    onRecordTransaction(newTx);
    setSuccessMsg(
      `บันทึกรายการ ${moveType === "in" ? "รับเข้า" : "จ่ายออก"} สินค้า [${
        activeItem.barcode
      }] จำนวน ${qty} ${activeItem.unit} สำเร็จ!`
    );

    // Reset qty
    setQty(1);
    setNote("");
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-amber-500" />
              บันทึกการรับเข้า - เบิกจ่ายสินค้า (Stock Movement)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ทำรายการรับสินค้าเข้าสต็อก หรือตัดเบิกจ่ายใช้งานตามไลน์การผลิต
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {canReceive && (
              <button
                type="button"
                onClick={() => setMoveType("in")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  moveType === "in"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>รับเข้า (Inflow)</span>
              </button>
            )}
            {canIssue && (
              <button
                type="button"
                onClick={() => setMoveType("out")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  moveType === "out"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                <span>จ่ายออก (Outflow)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* No Permission Warning */}
      {!canReceive && !canIssue && (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-2">
          <Lock className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold">จำกัดสิทธิ์การเข้าใช้งานโมดูลรับเข้า-เบิกจ่าย</h3>
          <p className="text-xs text-rose-600">
            บัญชีของคุณไม่มีสิทธิ์ในการบันทึกรับเข้าสินค้า (Receive) หรือบันทึกเบิกจ่ายสินค้า (Issue)
            กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อขอสิทธิ์การใช้งาน
          </p>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {(canReceive || canIssue) && (
        <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Item Selection & Details */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-amber-500" />
                1. เลือกรายการสินค้า (Scan or Search Barcode)
              </h3>

              {/* Barcode Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="พิมพ์บาร์โค้ดหรือชื่อรายการเพื่อค้นหา..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsSearching(true);
                  }}
                  onFocus={() => setIsSearching(true)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />

                {/* Autocomplete dropdown */}
                {isSearching && searchTerm && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {filteredSuggestions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">
                        ไม่พบรายการสินค้าที่ตรงกับคำค้น
                      </div>
                    ) : (
                      filteredSuggestions.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedBarcode(item.barcode);
                            if (item.line) setSelectedLine(item.line);
                            setIsSearching(false);
                            setSearchTerm("");
                          }}
                          className="p-3 hover:bg-amber-50 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded mr-2">
                              {item.barcode}
                            </span>
                            <span className="text-slate-900 font-medium">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-slate-500 shrink-0">
                            คงเหลือ: {item.currentBalance} {item.unit}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Item Info Box */}
              {activeItem ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {activeItem.barcode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {activeItem.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        ชนิด: {activeItem.category} | ไลน์: {activeItem.line || "-"} | Supplier:{" "}
                        {activeItem.supplier || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400">คงเหลือปัจจุบัน</span>
                      <div className="text-base font-extrabold text-slate-800 mt-0.5">
                        {activeItem.currentBalance.toLocaleString()} {activeItem.unit}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400">Min Stock</span>
                      <div className="text-base font-extrabold text-amber-700 mt-0.5">
                        {activeItem.minStock.toLocaleString()} {activeItem.unit}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400">ราคา/หน่วย</span>
                      <div className="text-base font-extrabold text-slate-800 mt-0.5">
                        ฿{activeItem.unitCost.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  ยังไม่ได้เลือกรายการสินค้า (พิมพ์ค้นหาด้านบนหรือเลือกจากตารางสต็อก)
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Transaction Input Form */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                2. ข้อมูลการทำรายการ
              </h3>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวน ({activeItem?.unit || "ชิ้น"}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Line */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไลน์การผลิต (Line) *
                </label>
                <input
                  type="text"
                  value={selectedLine}
                  onChange={(e) => setSelectedLine(e.target.value)}
                  placeholder="เช่น แพ็ค, ตัดเย็บ, ตรวจสอบ..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Employee ID & Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสพนักงาน
                  </label>
                  <input
                    type="text"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="เช่น 510220"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้เบิก/รับ
                  </label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Calculated Total Cost */}
              {activeItem && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>มูลค่ารายการนี้:</span>
                    <span className="font-bold text-slate-900">
                      ฿{(qty * activeItem.unitCost).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 mt-1">
                    <span>ยอดคงเหลือหลังทำรายการ:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {moveType === "in"
                        ? activeItem.currentBalance + qty
                        : activeItem.currentBalance - qty}{" "}
                      {activeItem.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!activeItem}
                className={`w-full py-3 rounded-xl text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${
                  moveType === "in"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {moveType === "in" ? (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>ยืนยันบันทึกรับเข้าคลัง</span>
                  </>
                ) : (
                  <>
                    <MinusCircle className="w-4 h-4" />
                    <span>ยืนยันบันทึกตัดจ่ายออก</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      )}
    </div>
  );
};
