const fs = require('fs');
let code = fs.readFileSync('src/components/LowStockAlertsView.tsx', 'utf8');

// Add imports
code = code.replace(
  'import React, { useState, useMemo } from "react";',
  'import React, { useState, useMemo, useEffect } from "react";'
);
code = code.replace(
  'import type { StockItem, Employee } from "../types";',
  'import type { StockItem, Employee, OrderStatus } from "../types";'
);

const stateAndFetchCode = `
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "ordered" | "not_ordered">("all");

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

  const handleToggleOrderStatus = async (item: StockItem, isOrdered: boolean, lotNumber: string) => {
    if (isOrdered && !lotNumber) {
      alert("กรุณาระบุเลขที่ Lot เพื่อกำกับ");
      return;
    }
    if (!isOrdered) {
      const confirmClear = prompt("การของล้างสถานะนี้ หมายความว่าของเข้ามาแล้ว พิมพ์ 'confirm' เพื่อยืนยัน:");
      if (confirmClear !== "confirm") {
        return;
      }
    }
    
    // Optimistic update
    setOrderStatuses((prev) => {
      const idx = prev.findIndex(s => s.barcode === item.barcode);
      const newStatus = { barcode: item.barcode, isOrdered, lotNumber, updatedAt: new Date().toISOString() };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newStatus;
        return next;
      }
      return [...prev, newStatus];
    });

    try {
      await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: item.barcode, isOrdered, lotNumber })
      });
      fetchOrderStatuses();
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการบันทึกสถานะ");
    }
  };
`;

code = code.replace(
  'const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");',
  'const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");\n' + stateAndFetchCode
);

fs.writeFileSync('src/components/LowStockAlertsView.tsx', code);
console.log('Patched LowStockAlertsView state');
