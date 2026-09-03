const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

const oldSpan = '<span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">';
const newSpan = '<div className="mt-1"><span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">';

code = code.replace(
  oldSpan,
  newSpan
);

code = code.replace(
  'สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})\\n                                </span>',
  'สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})\\n                                </span>\\n                                </div>'
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Fixed margin for status');
