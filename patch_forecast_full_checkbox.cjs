const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. Add State
const stateToAdd = `
  const [currentLotNumber, setCurrentLotNumber] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "single" | "lot";
    item?: any;
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

  const handleToggleOrderStatus = async (item: any, isOrdered: boolean, lotNumber: string) => {
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
          body: JSON.stringify({ barcode: targetItem.barcode, isOrdered: false })
        });
      } catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาดในการบันทึกสถานะ");
      }
    } else if (confirmModal.type === "lot" && confirmModal.lotNumber) {
      const targetLot = confirmModal.lotNumber;
      setOrderStatuses((prev) => prev.map(s => s.lotNumber === targetLot ? { ...s, isOrdered: false } : s));

      try {
        await fetch("/api/order-status/clear-lot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotNumber: targetLot })
        });
      } catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาดในการล้างสถานะ Lot");
      }
    }
    
    setConfirmModal(null);
  };
`;

code = code.replace(
  /const \[orderStatuses, setOrderStatuses\] = useState<OrderStatus\[\]>\(\[\]\);/,
  'const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);\n' + stateToAdd
);

// 2. Add lot UI above the table
const lotUI = `
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
`;
code = code.replace(
  /\{\/\* Forecast Table \*\/\}/,
  lotUI.trim() + '\n\n      {/* Forecast Table */}'
);

// 3. Add column to table header
code = code.replace(
  '<th className="p-3 text-center w-20 text-slate-700">จัดการ</th>',
  '<th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>\n                <th className="p-3 text-center w-20 text-slate-700">จัดการ</th>'
);
// Also increase colspan in empty state
code = code.replace(
  '<td colSpan={12} className="text-center py-12 text-slate-400 text-sm">',
  '<td colSpan={13} className="text-center py-12 text-slate-400 text-sm">'
);

// 4. Modify table row to include checkbox column and hover style based on isOrdered
code = code.replace(
  'className="hover:bg-amber-50/40 transition cursor-pointer"',
  'className={`transition cursor-pointer ${(() => { const o = orderStatuses.find(s => s.barcode === it.barcode); return o?.isOrdered ? "bg-emerald-50/70 hover:bg-emerald-100" : "hover:bg-amber-50/40"; })()}`}'
);

const checkboxCell = `
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 cursor-pointer accent-amber-600"
                            checked={(() => { const o = orderStatuses.find(s => s.barcode === it.barcode); return o?.isOrdered || false; })()}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                              handleToggleOrderStatus(it, checked, checked ? currentLotNumber : (oStatus?.lotNumber || ""));
                            }}
                          />
                          {(() => {
                            const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                            if (oStatus?.isOrdered) {
                              return (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                  Lot: {oStatus?.lotNumber}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
`;

code = code.replace(
  /<td className="p-3 text-center" onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*<button\s*onClick=\{\(\) => onQuickMove\(it, "in"\)\}/,
  checkboxCell.trim() + '\n                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>\n                        <button\n                          onClick={() => onQuickMove(it, "in")}'
);

// 5. Add Modal to end of component
const modalHtml = `
      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">ยืนยันการยกเลิกสถานะ</h3>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                {confirmModal.type === "single"
                  ? \`คุณต้องการยกเลิกสถานะสั่งซื้อของ \${confirmModal.item?.name} ใช่หรือไม่?\`
                  : \`คุณต้องการยกเลิกสถานะสั่งซื้อของสินค้าทุกรายการใน Lot: \${confirmModal.lotNumber} ใช่หรือไม่?\`}
              </p>
              
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  พิมพ์คำว่า "confirm" เพื่อยืนยัน
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="confirm"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeClearStatus}
                  disabled={confirmText !== "confirm"}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50"
                >
                  ยืนยันล้างสถานะ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  /    <\/div>\n  \);\n};\n/,
  modalHtml + '    </div>\n  );\n};\n'
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Successfully patched ForecastPlanningView full checkbox logic');
