const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

code = code.replace(
  'const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");',
  'const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");\n  const [currentLotNumber, setCurrentLotNumber] = useState("");'
);

const lotInputHTML = `
      {/* Global Lot Number Input */}
      <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-3">
        <Package className="w-5 h-5 text-amber-600" />
        <span className="text-sm font-semibold text-slate-800">เลขที่ Lot ปัจจุบันสำหรับการสั่งซื้อ:</span>
        <input 
          type="text" 
          placeholder="ระบุเลขที่ Lot..." 
          value={currentLotNumber}
          onChange={(e) => setCurrentLotNumber(e.target.value)}
          className="px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
        />
        <span className="text-xs text-slate-500">(พิมพ์เลขที่ Lot ที่นี่ก่อนทำการติ๊กหมายเหตุสั่งซื้อด้านล่าง)</span>
      </div>
`;

code = code.replace(
  '{/* Reorder Table */}',
  lotInputHTML + '\n      {/* Reorder Table */}'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched Global Lot');
