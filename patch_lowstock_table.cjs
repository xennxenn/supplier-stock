const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const thHTML = `
                <th
                  onClick={() => handleHeaderSort("risk")}
                  className="p-3 text-center cursor-pointer hover:bg-slate-200 transition group text-slate-700"
                  title="คลิกเพื่อเรียงตาม สถานะความเสี่ยง"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    {renderSortIcon("risk")}
                  </div>
                </th>
`;

code = code.replace(
  '                <th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>',
  thHTML + '\n                <th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>'
);

const tdHTML = `
                      <td className="p-3 text-center">
                        {r.riskLevel === "critical" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" /> วิกฤต
                          </span>
                        ) : r.riskLevel === "warning" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ต่ำกว่าเกณฑ์
                          </span>
                        ) : r.riskLevel === "overstock" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            สต็อกล้น
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> เพียงพอ
                          </span>
                        )}
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {r.monthsOfStockRemaining > 90 ? ">90" : r.monthsOfStockRemaining.toFixed(1)} ด.
                        </div>
                      </td>
`;

code = code.replace(
  '                        {it.supplier || "-"}\n                      </td>',
  '                        {it.supplier || "-"}\n                      </td>\n' + tdHTML
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched UI Table');
