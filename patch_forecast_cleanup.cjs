const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. Remove column header
code = code.replace(
  '<th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>\\n                <th className="p-3 text-center w-20 text-slate-700">จัดการ</th>',
  '<th className="p-3 text-center w-20 text-slate-700">จัดการ</th>'
);

// 2. Reduce colspan
code = code.replace(
  '<td colSpan={13} className="text-center py-12 text-slate-400 text-sm">',
  '<td colSpan={12} className="text-center py-12 text-slate-400 text-sm">'
);

// 3. Remove checkbox cell
const checkboxCellRegex = /<td className="p-3 text-center" onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*<div className="flex flex-col items-center gap-1">\s*<input[\s\S]*?<\/div>\s*<\/td>/;
code = code.replace(checkboxCellRegex, '');

// 4. Revert row class
const rowClassRegex = /className=\{\`transition cursor-pointer \$\{\(\(\) => \{ const o = orderStatuses\.find\(s => s\.barcode === it\.barcode\); return o\?\.isOrdered \? "bg-emerald-50\/70 hover:bg-emerald-100" : "hover:bg-amber-50\/40"; \}\)\(\)\}\`\}/;
code = code.replace(rowClassRegex, 'className="hover:bg-amber-50/40 transition cursor-pointer"');

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Cleaned up forecast table');
