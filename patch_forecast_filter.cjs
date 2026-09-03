const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. Add state
code = code.replace(
  '  const [selectedRisk, setSelectedRisk] = useState<"all" | "critical" | "warning" | "ok" | "overstock">("all");\n  const [sortField, setSortField] = useState<ForecastSortField>("estimatedCost");',
  '  const [selectedRisk, setSelectedRisk] = useState<"all" | "critical" | "warning" | "ok" | "overstock">("all");\n  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");\n  const [sortField, setSortField] = useState<ForecastSortField>("estimatedCost");'
);

// 2. Add to filteredItems
code = code.replace(
  '      if (selectedRisk !== "all" && f.riskLevel !== selectedRisk) return false;\n\n      return true;\n    });\n  }, [forecastItems, search, selectedLine, selectedCategory, selectedSupplier, selectedRisk]);',
  `      if (selectedRisk !== "all" && f.riskLevel !== selectedRisk) return false;
      
      const oStatus = orderStatuses.find(s => s.barcode === f.item.barcode);
      const isOrdered = oStatus?.isOrdered || false;
      if (filterOrderStatus === "ordered" && !isOrdered) return false;
      if (filterOrderStatus === "not_ordered" && isOrdered) return false;

      return true;
    });
  }, [forecastItems, search, selectedLine, selectedCategory, selectedSupplier, selectedRisk, filterOrderStatus, orderStatuses]);`
);

// 3. Add to UI
const filterHtml = `
          {/* Order Status filter */}
          <div>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">หมายเหตุ: แสดงทั้งหมด</option>
              <option value="ordered">สั่งซื้อแล้วรอจัดส่ง</option>
              <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
            </select>
          </div>
`;

code = code.replace(
  '          {/* Supplier filter */}\n          <div>\n            <select\n              value={selectedSupplier}',
  filterHtml + '\n          {/* Supplier filter */}\n          <div>\n            <select\n              value={selectedSupplier}'
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Patched ForecastPlanningView filters');
