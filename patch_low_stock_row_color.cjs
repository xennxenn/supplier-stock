const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

code = code.replace(
  'const it = r.item;',
  'const it = r.item;\n                  const oStatus = orderStatuses.find(s => s.barcode === it.barcode);\n                  const isOrdered = oStatus?.isOrdered || false;'
);

code = code.replace(
  'className="hover:bg-amber-50/40 transition cursor-pointer"',
  'className={`transition cursor-pointer ${isOrdered ? "bg-emerald-50/70 hover:bg-emerald-100" : "hover:bg-amber-50/40"}`}'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched row color');
