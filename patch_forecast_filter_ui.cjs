const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

const filterHtml = `
          {/* Order Status */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">หมายเหตุ: แสดงทั้งหมด</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
            </select>
          </div>
`;

code = code.replace(
  /\{\/\* Supplier \*\/\}\s*<div>/,
  filterHtml.trim() + '\n\n          {/* Supplier */}\n          <div>'
);
// Make the grid 5 cols instead of 4 so they fit
code = code.replace(
  'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"',
  'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"'
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Patched Filter UI');
