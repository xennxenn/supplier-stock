const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

code = code.replace(
  'if (selectedSupplier !== "all" && it.supplier !== selectedSupplier) return false;',
  'if (selectedSupplier !== "all" && it.supplier !== selectedSupplier) return false;\n      const oStatus = orderStatuses.find(s => s.barcode === it.barcode);\n      const isOrdered = oStatus?.isOrdered || false;\n      if (filterOrderStatus === "ordered" && !isOrdered) return false;\n      if (filterOrderStatus === "not_ordered" && isOrdered) return false;'
);

code = code.replace(
  '[lowStockItems, search, selectedLine, selectedCategory, selectedSupplier]',
  '[lowStockItems, search, selectedLine, selectedCategory, selectedSupplier, filterOrderStatus, orderStatuses]'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched LowStockAlertsView filter');
