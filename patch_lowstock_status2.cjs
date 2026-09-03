const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const tdHTML = `
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {r.monthsOfStockRemaining > 90 ? ">90" : r.monthsOfStockRemaining.toFixed(1)} ด.
                        </div>
                        {isOrdered && (
                          <div className="mt-1">
                            <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              สั่งซื้อรอจัดส่ง (Lot: {oStatus?.lotNumber || "-"})
                            </span>
                          </div>
                        )}
`;

code = code.replace(
  '                        <div className="text-[9px] text-slate-400 mt-0.5">\n                          {r.monthsOfStockRemaining > 90 ? ">90" : r.monthsOfStockRemaining.toFixed(1)} ด.\n                        </div>',
  tdHTML.trim()
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched LowStockAlertsView Status Column');
