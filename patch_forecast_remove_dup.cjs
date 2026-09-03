const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

const originalCell = `
                      <td className="p-3 text-right">
                        {f.recommendedOrder > 0 ? (
                          <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            +{f.recommendedOrder.toLocaleString()} {it.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">เพียงพอ</span>
                        )}
                      </td>
`;

code = code.replace(
  /<td className="p-3 text-right">\s*<div className="flex flex-col items-end gap-1">\s*\{f\.recommendedOrder > 0 \? \([\s\S]+?\}\s*<\/div>\s*<\/td>/,
  originalCell.trim()
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Removed duplicate ordered label in Forecast view');
