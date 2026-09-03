const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes("getStoredOrderStatus")) {
  const orderStatusCode = `
export interface OrderStatus {
  barcode: string;
  isOrdered: boolean;
  lotNumber: string;
  updatedAt: string;
}

function getStoredOrderStatus(): OrderStatus[] {
  try {
    if (fs.existsSync(ORDER_STATUS_FILE)) {
      const data = fs.readFileSync(ORDER_STATUS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read order_status.json:", err);
  }
  return [];
}

app.get("/api/order-status", (req, res) => {
  res.json({ success: true, statuses: getStoredOrderStatus() });
});

app.post("/api/order-status", rateLimiter(40), (req, res) => {
  try {
    const { barcode, isOrdered, lotNumber } = req.body;
    if (!barcode) return res.status(400).json({ success: false, error: "Missing barcode" });
    const statuses = getStoredOrderStatus();
    const idx = statuses.findIndex((s) => s.barcode === barcode);
    if (idx >= 0) {
      statuses[idx] = { barcode, isOrdered: !!isOrdered, lotNumber: String(lotNumber || ""), updatedAt: new Date().toISOString() };
    } else {
      statuses.push({ barcode, isOrdered: !!isOrdered, lotNumber: String(lotNumber || ""), updatedAt: new Date().toISOString() });
    }
    fs.writeFileSync(ORDER_STATUS_FILE, JSON.stringify(statuses, null, 2), "utf-8");
    res.json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.post("/api/order-status-batch", rateLimiter(40), (req, res) => {
  try {
    const { lotNumber, isOrdered } = req.body;
    if (!lotNumber) return res.status(400).json({ success: false, error: "Missing lotNumber" });
    const statuses = getStoredOrderStatus();
    
    // Update all matching lotNumbers
    statuses.forEach(s => {
      if (s.lotNumber === lotNumber) {
        s.isOrdered = !!isOrdered;
        s.updatedAt = new Date().toISOString();
      }
    });

    fs.writeFileSync(ORDER_STATUS_FILE, JSON.stringify(statuses, null, 2), "utf-8");
    res.json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

`;

  code = code.replace(
    '// In-memory cache',
    orderStatusCode + '\n// In-memory cache'
  );

  fs.writeFileSync('server.ts', code);
  console.log('Patched server.ts successfully again');
}
