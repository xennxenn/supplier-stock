const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const tdHTML = `
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 cursor-pointer accent-amber-600"
                            checked={isOrdered}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleToggleOrderStatus(it, checked, checked ? currentLotNumber : (oStatus?.lotNumber || ""));
                            }}
                          />
                          {isOrdered && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                              Lot: {oStatus?.lotNumber}
                            </span>
                          )}
                        </div>
                      </td>
`;

code = code.replace(
  '<td className="p-3 text-slate-700 font-medium">\n                        {it.supplier || "-"}\n                      </td>',
  '<td className="p-3 text-slate-700 font-medium">\n                        {it.supplier || "-"}\n                      </td>\n' + tdHTML
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched UI Row');
