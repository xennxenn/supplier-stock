const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

code = code.replace(
  'สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})\\n                                </span>\\n                              );',
  'สั่งซื้อรอจัดส่ง (Lot: {oStatus.lotNumber || "-"})\\n                                </span>\\n                                </div>\\n                              );'
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Fixed div');
