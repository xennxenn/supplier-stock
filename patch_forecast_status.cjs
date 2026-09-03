const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

const statusCode = `
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {f.riskLevel === "critical" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" /> วิกฤต
                            </span>
                          ) : f.riskLevel === "warning" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              สั่งซื้อ {forecastHorizon}M
                            </span>
                          ) : f.riskLevel === "overstock" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              สต็อกล้น
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              เพียงพอ
                            </span>
                          )}
                          {(() => {
                            const oStatus = orderStatuses.find(s => s.barcode === it.barcode);
                            if (oStatus?.isOrdered) {
                              return (
                                <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                  สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
`;

code = code.replace(
  /<td className="p-3 text-center">\s*\{f\.riskLevel === "critical" \? \([\s\S]+?เพียงพอ\s*<\/span>\s*\)\}\s*<\/td>/,
  statusCode.trim()
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Patched ForecastPlanningView Status');
