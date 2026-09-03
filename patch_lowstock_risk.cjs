const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

const riskCalcCode = `
      // Calculate risk similarly to Forecast Planning
      const bKey = it.barcode.trim().toLowerCase();
      let monthlyBurnRate = burnRateMap.get(bKey) || 0;
      if (monthlyBurnRate === 0 && it.minStock > 0) {
        monthlyBurnRate = Math.max(0.5, it.minStock / 3);
      }
      const monthsOfStockRemaining = monthlyBurnRate > 0 ? it.currentBalance / monthlyBurnRate : 999;
      
      let riskLevel: "critical" | "warning" | "ok" | "overstock" = "ok";
      if (monthsOfStockRemaining < 1 || (it.currentBalance <= 0 && monthlyBurnRate > 0)) {
        riskLevel = "critical";
      } else if (monthsOfStockRemaining < 6) { // Default forecast horizon
        riskLevel = "warning";
      } else if (monthsOfStockRemaining > 15 && it.currentBalance > 50) {
        riskLevel = "overstock";
      }

      return {
        item: it,
        targetStock,
        deficit,
        estimatedCost,
        percentOfMin,
        riskLevel,
        monthsOfStockRemaining,
      };
`;

code = code.replace(
  /return \{\s*item: it,\s*targetStock,\s*deficit,\s*estimatedCost,\s*percentOfMin,\s*\};/,
  riskCalcCode
);

const riskSortCode = `
        case "risk":
          const riskWeight = { critical: 4, warning: 3, ok: 2, overstock: 1 };
          res = riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
          break;
`;

code = code.replace(
  'case "supplier":\n          res = (a.item.supplier || "").localeCompare(b.item.supplier || "");\n          break;',
  'case "supplier":\n          res = (a.item.supplier || "").localeCompare(b.item.supplier || "");\n          break;\n' + riskSortCode
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched risk calculations');
