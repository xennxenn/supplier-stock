const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const thHTML = `
                <th className="p-3 text-center text-slate-700 w-40">หมายเหตุสั่งซื้อ</th>
`;

code = code.replace(
  '<th className="p-3 text-center w-24 text-slate-700">ทำรายการ</th>',
  thHTML + '\n                <th className="p-3 text-center w-24 text-slate-700">ทำรายการ</th>'
);

const tdHTML = `
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1 items-center">
                          <input 
                            type="text" 
                            placeholder="ระบุเลขที่ Lot" 
                            className="w-full text-xs px-2 py-1 border border-slate-200 rounded outline-none focus:border-amber-400"
                            value={oStatus?.lotNumber || ""}
                            onChange={(e) => {
                              // Local state update would be better, but we can't easily without a specific component.
                              // So we just update orderStatuses array directly for the UI binding? No, need a local form or just trigger onChange
                            }}
                            onBlur={(e) => {
                              if (!oStatus?.isOrdered) {
                                // If not ordered, just save the lot number temporarily? No, they must tick to save.
                                // It's better to manage it. Let's create a local state for lot inputs.
                              }
                            }}
                          />
                        </div>
                      </td>
`;

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched UI TH');
