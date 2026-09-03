const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. imports
code = code.replace(
  'import type { StockItem, Transaction, ForecastItem, Employee } from "../types";',
  'import type { StockItem, Transaction, ForecastItem, Employee, OrderStatus } from "../types";\nimport { useEffect } from "react";'
);

// 2. add state and fetch
const stateCode = `
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);

  const fetchOrderStatuses = async () => {
    try {
      const res = await fetch("/api/order-status");
      const data = await res.json();
      if (data.success && data.statuses) {
        setOrderStatuses(data.statuses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrderStatuses();
  }, []);
`;

code = code.replace(
  'const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");',
  'const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");\n' + stateCode
);

// 3. update rendering to include lot info
const newRenderCode = `
                      <td className="p-3 text-right">
                        {f.recommendedOrder > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              +{f.recommendedOrder.toLocaleString()} {it.unit}
                            </span>
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
                        ) : (
                          <span className="text-slate-400 text-[11px]">เพียงพอ</span>
                        )}
                      </td>
`;

// we need to be careful with replace
code = code.replace(/<td className="p-3 text-right">\s*\{f.recommendedOrder > 0 \? \(\s*<span className="font-bold text-amber-700 font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">\s*\+\{f.recommendedOrder.toLocaleString\(\)\} \{it.unit\}\s*<\/span>\s*\) : \(\s*<span className="text-slate-400 text-\[11px\]">เพียงพอ<\/span>\s*\)\}\s*<\/td>/, newRenderCode.trim());

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Patched ForecastPlanningView');
