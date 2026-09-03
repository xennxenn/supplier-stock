const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

code = code.replace(
  '      await fetch("/api/order-status", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ barcode: item.barcode, isOrdered, lotNumber })\n      });\n      fetchOrderStatuses();',
  '      await fetch("/api/order-status", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ barcode: item.barcode, isOrdered, lotNumber })\n      });'
);

code = code.replace(
  '        await fetch("/api/order-status", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ barcode: targetItem.barcode, isOrdered: false, lotNumber: "" })\n        });\n        fetchOrderStatuses();',
  '        await fetch("/api/order-status", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ barcode: targetItem.barcode, isOrdered: false, lotNumber: "" })\n        });'
);

code = code.replace(
  '        await fetch("/api/order-status-batch", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ lotNumber: targetLot, isOrdered: false })\n        });\n        fetchOrderStatuses();',
  '        await fetch("/api/order-status-batch", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ lotNumber: targetLot, isOrdered: false })\n        });'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched race conditions');
