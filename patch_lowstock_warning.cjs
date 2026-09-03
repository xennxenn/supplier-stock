const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

code = code.replace(
  '<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">\n                            ต่ำกว่าเกณฑ์\n                          </span>',
  '<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">\n                            สั่งซื้อ 6M\n                          </span>'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched warning text');
