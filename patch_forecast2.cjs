const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

const newRenderCode = `
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {f.recommendedOrder > 0 ? (
                            <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              +{f.recommendedOrder.toLocaleString()} {it.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">เพียงพอ</span>
                          )}
                          {(() => {
                            const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                            if (oStatus?.isOrdered) {
                              return (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                  สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
`;

code = code.replace(/<td className="p-3 text-right">\s*<div className="flex flex-col items-end gap-1">\s*\{f.recommendedOrder > 0 \? \(\s*<span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">\s*\+\{f.recommendedOrder.toLocaleString\(\)\} \{it.unit\}\s*<\/span>\s*\) : \(\s*<span className="text-slate-400 text-\[11px\]">เพียงพอ<\/span>\s*\)\}\s*\{\(\(\) => \{[^}]+\}\(\)\}\s*<\/div>\s*<\/td>/s, newRenderCode.trim());

// We actually need to fix my previous bad regex that might have failed or succeeded
code = code.replace(/<td className="p-3 text-right">\s*\{f.recommendedOrder > 0 \? \([^<]+<div className="flex flex-col items-end gap-1">[\s\S]+?เพียงพอ<\/span>\s*\)\}\s*<\/td>/g, newRenderCode.trim());

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Patched ForecastPlanningView again');
