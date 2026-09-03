const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

// 1. Add state
code = code.replace(
  'const [currentLotNumber, setCurrentLotNumber] = useState("");',
  \`const [currentLotNumber, setCurrentLotNumber] = useState("");
  
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
\`
);

// 2. Change handleToggleOrderStatus
const newToggle = \`
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
    
    // Optimistic update for checking
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
      fetchOrderStatuses();
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
        fetchOrderStatuses();
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
        fetchOrderStatuses();
      } catch (e) {
        console.error(e);
      }
    }

    setConfirmModal(null);
    setConfirmText("");
    setSelectedClearLot("");
  };
\`;

code = code.replace(/const handleToggleOrderStatus = async.*?catch \(e\) {.*?alert\("เกิดข้อผิดพลาดในการบันทึกสถานะ"\);\n    }\n  };/s, newToggle);

// 3. Add Modal and Clear Lot Dropdown UI
const clearLotUI = \`
      {/* Clear Lot UI */}
      {activeLots.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">ล้างหมายเหตุสั่งซื้อแบบกลุ่ม (Lot):</span>
          <select
            value={selectedClearLot}
            onChange={(e) => setSelectedClearLot(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
          >
            <option value="">-- เลือก Lot ที่ของเข้ามาแล้ว --</option>
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
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            ล้างสถานะทั้ง Lot
          </button>
        </div>
      )}
\`;

code = code.replace(
  '{/* Reorder Table */}',
  clearLotUI + '\n      {/* Reorder Table */}'
);

const modalUI = \`
      {/* Confirm Clear Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              ยืนยันการล้างสถานะ (ของมาแล้ว)
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmModal.type === "single" 
                ? \`ล้างสถานะรายการ \${confirmModal.item?.name}\` 
                : \`ล้างสถานะทุกรายการใน Lot: \${confirmModal.lotNumber}\`}
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
\`;

code = code.replace(
  '</div>\n    </div>\n  );\n};',
  modalUI + '\n    </div>\n    </div>\n  );\n};'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched UI for Modal');
