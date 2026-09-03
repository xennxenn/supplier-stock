const fs = require('fs');

let file = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. Add setDoc, doc, db imports
file = file.replace(
  'import { onSnapshot } from "firebase/firestore";',
  'import { onSnapshot, setDoc, doc, deleteDoc } from "firebase/firestore";'
);
file = file.replace(
  'import { orderStatusCol } from "../lib/firebase";',
  'import { orderStatusCol, db } from "../lib/firebase";'
);

// 2. Add state for activeLotNumber inside component
file = file.replace(
  'const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);',
  'const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);\n  const [activeLotNumber, setActiveLotNumber] = useState<string>("");\n  const [lotInput, setLotInput] = useState<string>("");\n  \n  const handleToggleOrderStatus = async (barcode: string, checked: boolean) => {\n    if (!activeLotNumber) {\n      alert("กรุณาบันทึกเลขที่ Lot ปัจจุบันก่อนทำการสั่งซื้อ");\n      return;\n    }\n    try {\n      const ref = doc(db, "orderStatuses", barcode);\n      if (checked) {\n        await setDoc(ref, { barcode, isOrdered: true, lotNumber: activeLotNumber, updatedAt: new Date().toISOString() });\n      } else {\n        await deleteDoc(ref);\n      }\n    } catch (err) {\n      console.error(err);\n    }\n  };\n  \n  const uniqueLots = useMemo(() => {\n    const lots = new Set<string>();\n    orderStatuses.forEach(s => {\n      if (s.lotNumber) lots.add(s.lotNumber);\n    });\n    return Array.from(lots);\n  }, [orderStatuses]);'
);

// 3. Add UI for setting Lot Number
const lotUI = `
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">รอบการสั่งซื้อ (Lot Number)</h3>
            <p className="text-slate-500 text-xs">กำหนดเลข Lot สำหรับรายการสั่งซื้อเพื่ออ้างอิง</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            list="lot-list"
            value={lotInput}
            onChange={(e) => setLotInput(e.target.value)}
            placeholder="กรอก หรือเลือกเลขที่ Lot"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="lot-list">
            {uniqueLots.map(l => <option key={l} value={l} />)}
          </datalist>
          <button 
            onClick={() => {
              if (!lotInput.trim()) { alert("กรุณาระบุเลขที่ Lot"); return; }
              setActiveLotNumber(lotInput.trim());
            }}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            บันทึก Lot
          </button>
        </div>
      </div>
      
      {activeLotNumber && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2 text-indigo-800 text-sm">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          <span>Lot ปัจจุบันสำหรับการสั่งซื้อ: <strong className="font-bold">{activeLotNumber}</strong></span>
        </div>
      )}
`;
file = file.replace(
  '{/* Forecast Data Table */}',
  lotUI + '\n      {/* Forecast Data Table */}'
);

// 4. Add the missing <td> for หมายเหตุสั่งซื้อ (column 12)
// I need to find where the risk cell (11) ends.
// Looking at my previous cat output:
// 884: <td className="p-3 text-center">
// ...
// 917: </td>
// 918: 
// 919: <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
const riskCellEndStr = `                        </div>\n                      </td>`;
const newTdStr = `                        </div>\n                      </td>\n\n                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>\n                        <div className="flex items-center justify-center">\n                          <input \n                            type="checkbox" \n                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"\n                            disabled={!activeLotNumber}\n                            title={!activeLotNumber ? "กรุณาบันทึก Lot ปัจจุบันก่อนทำการเลือก" : "เลือกเข้า Lot สั่งซื้อ"}\n                            checked={orderStatuses.some(s => s.barcode === it.barcode && s.isOrdered)}\n                            onChange={(e) => handleToggleOrderStatus(it.barcode, e.target.checked)}\n                          />\n                        </div>\n                      </td>`;

file = file.replace(riskCellEndStr, newTdStr);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', file);
