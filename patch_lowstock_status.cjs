const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

// 1. Add Transaction to imports
code = code.replace(
  'import type { StockItem, Employee, OrderStatus } from "../types";',
  'import type { StockItem, Employee, OrderStatus, Transaction } from "../types";'
);

// 2. Add transactions to Props
code = code.replace(
  'interface LowStockAlertsViewProps {\n  items: StockItem[];',
  'interface LowStockAlertsViewProps {\n  items: StockItem[];\n  transactions: Transaction[];'
);

// 3. Destructure transactions
code = code.replace(
  '  items,\n  lines,\n  currentUser,',
  '  items,\n  transactions,\n  lines,\n  currentUser,'
);

// 4. Add risk to LowStockSortField
code = code.replace(
  '  | "estimatedCost"\n  | "supplier";',
  '  | "estimatedCost"\n  | "supplier"\n  | "risk";'
);

// 5. Calculate burn rate
const burnRateCode = `
  // Calculate historical monthly burn rate per SKU from transactions
  const { burnRateMap, monthsSpan } = useMemo(() => {
    const usageMap = new Map<string, number>();
    const monthKeySet = new Set<string>();

    for (const t of transactions) {
      if (t.qtyOut > 0) {
        const b = t.barcode.trim().toLowerCase();
        usageMap.set(b, (usageMap.get(b) || 0) + t.qtyOut);
        if (t.year && t.month) {
          monthKeySet.add(\`\${t.year}-\${t.month}\`);
        }
      }
    }

    const calculatedSpan = Math.max(3, monthKeySet.size || 6);

    const burnRates = new Map<string, number>();
    usageMap.forEach((totalOut, barcode) => {
      burnRates.set(barcode, totalOut / calculatedSpan);
    });

    return { burnRateMap: burnRates, monthsSpan: calculatedSpan };
  }, [transactions]);
`;

code = code.replace(
  'const lowStockItems = useMemo(() => {',
  burnRateCode + '\n  const lowStockItems = useMemo(() => {'
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched top');
