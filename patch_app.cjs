const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<LowStockAlertsView\n            items={scopedItems}\n            lines={uniqueLines}',
  '<LowStockAlertsView\n            items={scopedItems}\n            transactions={scopedTransactions}\n            lines={uniqueLines}'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx');
