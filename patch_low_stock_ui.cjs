const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const orderStatusSelect = `
          {/* Order Status filter */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">สถานะหมายเหตุทั้งหมด</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
            </select>
          </div>
`;

code = code.replace(
  '{/* Supplier filter */}',
  orderStatusSelect + '\n          {/* Supplier filter */}'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched UI 1');
