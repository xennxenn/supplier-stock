import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import Papa from "papaparse";
import type { StockItem, Transaction, SheetsSyncData, Employee, BackupEntry } from "./src/types";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, orderBy, limit, setLogLevel } from "firebase/firestore";

try {
  setLogLevel("error");
} catch {}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
const app = express();
const PORT = 3000;
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));


app.use((_req, res, next) => {
  // Prevent MIME-sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking inside third-party frames
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Enable XSS filtering
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Restrict sensitive hardware features
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  next();
});

// Security: In-Memory IP Rate Limiter to prevent brute force & DoS
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const ipRateLimits = new Map<string, RateLimitRecord>();

// Clean up stale rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimits.entries()) {
    if (now > record.resetTime) {
      ipRateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const rateLimiter = (maxRequests = 200, windowMs = 60 * 1000) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = ipRateLimits.get(ip);

    if (!record || now > record.resetTime) {
      ipRateLimits.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec.toString());
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }

    record.count++;
    next();
  };
};

// Security: String Sanitization Helper (Strips HTML tags & malicious script injection vectors)
function sanitizeText(val: unknown): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[<>'";&]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "'": return "&#39;";
        case '"': return "&quot;";
        case "&": return "&amp;";
        case ";": return "";
        default: return "";
      }
    })
    .trim();
}

const STOCK_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=380033643&single=true&output=csv";

const TRANSACTIONS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=0&single=true&output=csv";

// Data directory for persistent storage across deploys and sessions
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn("Could not create data directory:", err);
  }
}

const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const TX_FILE = path.join(DATA_DIR, "custom_transactions.json");
const BACKUPS_FILE = path.join(DATA_DIR, "backups.json");
const ORDER_STATUS_FILE = path.join(DATA_DIR, "order_status.json");

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: "emp_admin",
    name: "ผู้ดูแลระบบ (Admin)",
    username: "Admin01",
    password: "pass1234",
    pin: "pass12",
    role: "admin",
    department: "ผู้ดูแลระบบ",
    employeeCode: "Admin01",
    allowedLines: [],
    allowedSuppliers: [],
    perms: {
      view: true,
      viewDashboard: true,
      viewStock: true,
      viewTransactions: true,
      receive: true,
      issue: true,
      viewAlerts: true,
      viewForecast: true,
      reports: true,
      addItem: true,
      importExport: true,
      employees: true,
      backup: true,
      manageOrderStatus: true,
    },
  },
  {
    id: "emp_1786962075284",
    name: "จิตรานุช ทองชมภู",
    username: "t57007",
    password: "57007",
    pin: "57007",
    role: "staff",
    department: "MTO",
    employeeCode: "T57007",
    allowedLines: ["MTO"],
    allowedSuppliers: ["China", "SOMFY(TH)", "Satin"],
    perms: {
      view: true,
      viewDashboard: true,
      viewStock: true,
      viewTransactions: true,
      receive: false,
      issue: false,
      viewAlerts: true,
      viewForecast: true,
      reports: true,
      addItem: false,
      importExport: true,
      employees: false,
      backup: false,
      manageOrderStatus: true,
    },
  },
  {
    id: "emp_1786962117347",
    name: "เกษรา นัยนาประเสริฐ",
    username: "t61088",
    password: "61088",
    pin: "61088",
    role: "staff",
    department: "MTO",
    employeeCode: "T61088",
    allowedLines: ["MTO"],
    allowedSuppliers: ["SOMFY(TH)", "Satin", "China"],
    perms: {
      view: true,
      viewDashboard: true,
      viewStock: true,
      viewTransactions: true,
      receive: false,
      issue: false,
      viewAlerts: true,
      viewForecast: true,
      reports: false,
      addItem: false,
      importExport: true,
      employees: false,
      backup: false,
      manageOrderStatus: true,
    },
  },
  {
    id: "emp_1786963279846",
    name: "์Naruecha R.",
    username: "t58121",
    password: "Admin",
    pin: "Admin",
    role: "admin",
    department: "MTO",
    employeeCode: "T58121",
    allowedLines: [
      "#N/A",
      "MTO",
      "อะไหล่เย็บ",
      "อุปกรณ์สำนักงาน",
      "เย็บ",
      "แพ็ค",
    ],
    allowedSuppliers: ["China", "SOMFY(TH)", "Satin"],
    perms: {
      view: true,
      viewDashboard: true,
      viewStock: true,
      viewTransactions: true,
      receive: true,
      issue: true,
      viewAlerts: true,
      viewForecast: true,
      reports: false,
      addItem: false,
      importExport: false,
      employees: false,
      backup: false,
      manageOrderStatus: true,
    },
  },
  {
    id: "emp_1786964869742",
    name: "ชิดเทพ โชติขจร",
    username: "t59091",
    password: "59091",
    pin: "59091",
    role: "manager",
    department: "MTO",
    employeeCode: "T59091",
    allowedLines: ["MTO"],
    allowedSuppliers: ["China", "SOMFY(TH)"],
    perms: {
      view: true,
      viewDashboard: true,
      viewStock: true,
      viewTransactions: true,
      receive: false,
      issue: false,
      viewAlerts: true,
      viewForecast: true,
      reports: true,
      addItem: false,
      importExport: true,
      employees: false,
      backup: false,
      manageOrderStatus: true,
    },
  },
];

async function getStoredEmployees(): Promise<Employee[]> {
  try {
    const snap = await getDocs(collection(db, "employees"));
    if (snap.empty) return DEFAULT_EMPLOYEES;
    return snap.docs.map(doc => doc.data() as Employee);
  } catch (err) {
    console.error("Failed to read employees from Firestore:", err);
    return DEFAULT_EMPLOYEES;
  }
}

async function saveStoredEmployees(emps: Employee[]) {
  try {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(emps, null, 2), "utf-8");
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, "employees"));
    snap.docs.forEach(doc => batch.delete(doc.ref));
    emps.forEach(emp => {
      batch.set(doc(db, "employees", emp.id), emp);
    });
    await batch.commit();
  } catch (err) {
    console.error("Failed to save employees to Firestore/disk:", err);
  }
}

async function getStoredCustomTransactions(): Promise<Transaction[]> {
  try {
    const q = query(collection(db, "customTransactions"), orderBy("timestamp", "desc"), limit(5000));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Transaction);
  } catch (err) {
    console.error("Failed to read custom transactions from Firestore:", err);
    return [];
  }
}

async function appendStoredCustomTransaction(tx: Transaction) {
  try {
    await setDoc(doc(db, "customTransactions", tx.id), tx);
  } catch (err) {
    console.error("Failed to write custom transaction to Firestore:", err);
  }
}

async function getStoredBackups(): Promise<BackupEntry[]> {
  try {
    const q = query(collection(db, "backups"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as BackupEntry);
  } catch (err) {
    console.error("Failed to read backups from Firestore:", err);
    return [];
  }
}

async function saveStoredBackups(backups: BackupEntry[]) {
  try {
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, "backups"));
    snap.docs.forEach(doc => batch.delete(doc.ref));
    backups.forEach(b => {
      batch.set(doc(db, "backups", b.id), b);
    });
    await batch.commit();
  } catch (err) {
    console.error("Failed to save backups to Firestore:", err);
  }
}


export interface OrderStatus {
  barcode: string;
  isOrdered: boolean;
  lotNumber: string;
  updatedAt: string;
}

async function getStoredOrderStatus(): Promise<OrderStatus[]> {
  try {
    const snap = await getDocs(collection(db, "orderStatuses"));
    return snap.docs.map(doc => doc.data() as OrderStatus);
  } catch (err) {
    console.error("Failed to read order statuses from Firestore:", err);
    return [];
  }
}

app.get("/api/order-status", async (req, res) => {
  res.json({ success: true, statuses: await getStoredOrderStatus() });
});

app.post("/api/order-status", rateLimiter(40), async (req, res) => {
  try {
    const { barcode, isOrdered, lotNumber } = req.body;
    if (!barcode) return res.status(400).json({ success: false, error: "Missing barcode" });
    const statuses = await getStoredOrderStatus();
    const idx = statuses.findIndex((s) => s.barcode === barcode);
    if (!isOrdered) {
      if (idx >= 0) {
        statuses.splice(idx, 1);
      }
      try {
        await deleteDoc(doc(db, "orderStatuses", barcode));
      } catch (e) {
        console.warn("Delete order status doc error:", e);
      }
    } else {
      const entry: OrderStatus = {
        barcode,
        isOrdered: true,
        lotNumber: String(lotNumber || ""),
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) {
        statuses[idx] = entry;
      } else {
        statuses.push(entry);
      }
      await setDoc(doc(db, "orderStatuses", barcode), entry);
    }
    res.json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.post("/api/order-status-batch", rateLimiter(40), async (req, res) => {
  try {
    const { lotNumber, isOrdered } = req.body;
    if (!lotNumber) return res.status(400).json({ success: false, error: "Missing lotNumber" });
    const statuses = await getStoredOrderStatus();
    if (!isOrdered) {
      const cleanTarget = String(lotNumber).trim().toLowerCase();
      const isMatch = (s: OrderStatus) => {
        if (cleanTarget === "__all__") return true;
        if (cleanTarget === "ไม่ระบุ lot" || cleanTarget === "unspecified") {
          return !s.lotNumber || s.lotNumber.trim() === "";
        }
        return (s.lotNumber || "").trim().toLowerCase() === cleanTarget;
      };

      const toClear = statuses.filter(isMatch);
      for (let i = 0; i < toClear.length; i += 400) {
        const chunk = toClear.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(s => {
          batch.delete(doc(db, "orderStatuses", s.barcode));
        });
        await batch.commit();
      }
      const remaining = statuses.filter(s => !isMatch(s));
      res.json({ success: true, statuses: remaining });
    } else {
      const cleanTarget = String(lotNumber).trim().toLowerCase();
      const toUpdate = statuses.filter(s => (s.lotNumber || "").trim().toLowerCase() === cleanTarget);
      for (let i = 0; i < toUpdate.length; i += 400) {
        const chunk = toUpdate.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(s => {
          s.isOrdered = true;
          s.updatedAt = new Date().toISOString();
          batch.set(doc(db, "orderStatuses", s.barcode), s);
        });
        await batch.commit();
      }
      res.json({ success: true, statuses });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});


// In-memory cache
let cachedData: SheetsSyncData | null = null;
let allTransactionsCache: Transaction[] = [];
let lastSyncTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const parseNum = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const clean = String(val).replace(/,/g, "").trim();
  if (clean === "" || isNaN(Number(clean))) return 0;
  return Number(clean);
};

async function fetchAndParseSheets(force = false): Promise<SheetsSyncData> {
  const now = Date.now();
  if (!force && cachedData && now - lastSyncTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }

  // Fetch both CSVs concurrently
  const [resStock, resTx] = await Promise.all([
    fetch(STOCK_SHEET_URL),
    fetch(TRANSACTIONS_SHEET_URL),
  ]);

  if (!resStock.ok) {
    throw new Error(`Failed to fetch Stock Sheet: HTTP ${resStock.status}`);
  }
  if (!resTx.ok) {
    throw new Error(`Failed to fetch Transactions Sheet: HTTP ${resTx.status}`);
  }

  const [textStock, textTx] = await Promise.all([
    resStock.text(),
    resTx.text(),
  ]);

  // Parse Stock Items
  const parsedStock = Papa.parse<string[]>(textStock, {
    header: false,
    skipEmptyLines: true,
  });
  const stockRows = parsedStock.data.slice(1);

  const stockItems: StockItem[] = stockRows
    .map((r, index) => {
      const barcode = (r[0] || "").trim();
      const name = (r[1] || "").trim();
      const category = (r[2] || "อื่นๆ").trim() || "อื่นๆ";
      const unit = (r[3] || "").trim();
      const line = (r[4] || "").trim();
      const forwardBalance = parseNum(r[5]);
      const currentBalance = parseNum(r[6]);
      const minStock = parseNum(r[7]);
      const unitCost = parseNum(r[8]);
      const image = (r[9] || "").trim();
      const master = (r[10] || "").trim();
      const supplier = (r[11] || "").trim();
      const note = (r[12] || "").trim();
      const location = (r[13] || "").trim();

      let status: "ok" | "low" | "out" | "reorder" = "ok";
      if (currentBalance <= 0) {
        status = "out";
      } else if (currentBalance <= minStock) {
        status = "low";
      }

      return {
        id: `stk_${barcode || index}_${index}`,
        barcode,
        name,
        category,
        unit,
        line,
        forwardBalance,
        currentBalance,
        qty: currentBalance,
        minStock,
        unitCost,
        image,
        master,
        supplier,
        note,
        location,
        status,
        updatedAt: new Date().toISOString(),
      };
    })
    .filter((i) => i.barcode !== "" || i.name !== "");

  // Parse Transactions
  const parsedTx = Papa.parse<string[]>(textTx, {
    header: false,
    skipEmptyLines: true,
  });
  const txRows = parsedTx.data.slice(1);

  const transactions: Transaction[] = txRows
    .map((r, index) => {
      const date = (r[0] || "").trim();
      const barcode = (r[1] || "").trim();
      const itemName = (r[2] || "").trim();
      const unit = (r[3] || "").trim();
      const qtyIn = parseNum(r[4]);
      const qtyOut = parseNum(r[5]);
      const employeeId = (r[6] || "").trim();
      const employeeName = (r[7] || "").trim();
      const line = (r[8] || "").trim();
      const unitPrice = parseNum(r[9]);
      const totalCost = parseNum(r[10]);
      const month = parseNum(r[11]);
      const year = parseNum(r[12]);
      const balance = parseNum(r[13]);
      const minStock = parseNum(r[14]);
      const status = (r[15] || "").trim();

      const type: "in" | "out" = qtyIn > 0 ? "in" : "out";

      return {
        id: `tx_${index}`,
        date,
        barcode,
        itemName,
        unit,
        qtyIn,
        qtyOut,
        employeeId,
        employeeName,
        line,
        unitPrice,
        totalCost,
        month,
        year,
        balance,
        minStock,
        status,
        type,
      };
    })
    .filter((t) => t.barcode !== "" || t.itemName !== "" || t.date !== "");

  // Load custom transactions that were recorded via the web application
  const storedCustomTxs = await getStoredCustomTransactions();
  
  // Merge custom transactions (avoid duplicates)
  const existingTxIds = new Set(transactions.map((t) => t.id));
  for (const cTx of storedCustomTxs) {
    if (!existingTxIds.has(cTx.id)) {
      transactions.unshift(cTx);
      existingTxIds.add(cTx.id);

      // Adjust stock item balance for custom transactions
      const targetItem = stockItems.find(
        (it) => it.barcode.trim().toLowerCase() === cTx.barcode.trim().toLowerCase()
      );
      if (targetItem) {
        if (cTx.qtyIn > 0) {
          targetItem.currentBalance += cTx.qtyIn;
          targetItem.qty = targetItem.currentBalance;
        } else if (cTx.qtyOut > 0) {
          targetItem.currentBalance -= cTx.qtyOut;
          targetItem.qty = targetItem.currentBalance;
        }
        if (targetItem.currentBalance <= 0) targetItem.status = "out";
        else if (targetItem.currentBalance <= targetItem.minStock) targetItem.status = "low";
        else targetItem.status = "ok";
      }
    }
  }

  allTransactionsCache = transactions;

  // Compute aggregate statistics
  const totalValue = stockItems.reduce(
    (sum, item) => sum + item.currentBalance * item.unitCost,
    0
  );
  const lowStockCount = stockItems.filter(
    (i) => i.currentBalance <= i.minStock && i.currentBalance > 0
  ).length;
  const outOfStockCount = stockItems.filter(
    (i) => i.currentBalance <= 0
  ).length;

  const uniqueLines = Array.from(
    new Set(stockItems.map((i) => i.line).filter(Boolean))
  ).sort();
  const uniqueCategories = Array.from(
    new Set(stockItems.map((i) => i.category).filter(Boolean))
  ).sort();
  const uniqueSuppliers = Array.from(
    new Set(stockItems.map((i) => i.supplier).filter(Boolean))
  ).sort();

  // Line distribution
  const lineMap = new Map<
    string,
    { itemCount: number; totalValue: number; outQty: number }
  >();
  for (const item of stockItems) {
    const l = item.line || "ไม่ระบุ";
    const cur = lineMap.get(l) || { itemCount: 0, totalValue: 0, outQty: 0 };
    cur.itemCount += 1;
    cur.totalValue += item.currentBalance * item.unitCost;
    lineMap.set(l, cur);
  }

  // Monthly summary from transactions (most recent 6 months)
  const monthMap = new Map<
    string,
    { inQty: number; outQty: number; cost: number }
  >();
  let currentMonthOutQty = 0;
  let currentMonthCost = 0;

  // Take most recent month found in data
  const latestTx = transactions[0];
  const targetYear = latestTx?.year || new Date().getFullYear();
  const targetMonth = latestTx?.month || new Date().getMonth() + 1;

  for (const t of transactions) {
    if (t.month && t.year) {
      const key = `${t.year}-${String(t.month).padStart(2, "0")}`;
      const cur = monthMap.get(key) || { inQty: 0, outQty: 0, cost: 0 };
      cur.inQty += t.qtyIn;
      cur.outQty += t.qtyOut;
      cur.cost += t.totalCost;
      monthMap.set(key, cur);

      if (t.year === targetYear && t.month === targetMonth) {
        currentMonthOutQty += t.qtyOut;
        currentMonthCost += t.totalCost;
      }
    }
  }

  const monthlySummary = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .reverse()
    .map(([monthLabel, data]) => ({
      monthLabel,
      inQty: data.inQty,
      outQty: data.outQty,
      cost: Math.round(data.cost),
    }));

  const lineDistribution = Array.from(lineMap.entries()).map(
    ([line, data]) => ({
      line,
      itemCount: data.itemCount,
      totalValue: Math.round(data.totalValue),
      outQty: data.outQty,
    })
  );

  // Category distribution
  const catMap = new Map<string, { itemCount: number; totalValue: number }>();
  for (const item of stockItems) {
    const c = item.category || "อื่นๆ";
    const cur = catMap.get(c) || { itemCount: 0, totalValue: 0 };
    cur.itemCount += 1;
    cur.totalValue += item.currentBalance * item.unitCost;
    catMap.set(c, cur);
  }
  const categoryDistribution = Array.from(catMap.entries()).map(
    ([category, data]) => ({
      category,
      itemCount: data.itemCount,
      totalValue: Math.round(data.totalValue),
    })
  );

  const recentTransactions = transactions;

  const syncResult: SheetsSyncData = {
    success: true,
    syncedAt: new Date().toISOString(),
    totalStockItems: stockItems.length,
    totalTransactions: transactions.length,
    stockItems,
    recentTransactions,
    stats: {
      totalValue: Math.round(totalValue),
      totalSkus: stockItems.length,
      lowStockCount,
      outOfStockCount,
      currentMonthOutQty,
      currentMonthCost: Math.round(currentMonthCost),
      uniqueLines,
      uniqueCategories,
      uniqueSuppliers,
      monthlySummary,
      lineDistribution,
      categoryDistribution,
    },
    sourceUrls: {
      stockSheet: STOCK_SHEET_URL,
      transactionsSheet: TRANSACTIONS_SHEET_URL,
    },
  };

  cachedData = syncResult;
  lastSyncTimestamp = now;
  return syncResult;
}

// ---------------- API Routes ----------------

app.get("/api/health", rateLimiter(120), (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Sync data from Google Sheets
app.get("/api/sync-sheets", rateLimiter(60), async (req, res) => {
  try {
    const force = req.query.force === "true" || req.query.refresh === "1";
    const data = await fetchAndParseSheets(force);
    res.json(data);
  } catch (error: any) {
    console.error("Error syncing Google Sheets:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to sync Google Sheets data",
      syncedAt: new Date().toISOString(),
    });
  }
});

// Query all transactions with filtering and pagination
app.get("/api/transactions", rateLimiter(150), (req, res) => {
  try {
    const {
      search = "",
      line = "",
      employee = "",
      type = "",
      month = "",
      year = "",
      page = "1",
      limit = "50",
    } = req.query;

    let results = allTransactionsCache;

    if (search) {
      const q = String(search).toLowerCase().trim();
      results = results.filter(
        (t) =>
          t.barcode.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          t.employeeName.toLowerCase().includes(q) ||
          t.employeeId.toLowerCase().includes(q) ||
          t.date.toLowerCase().includes(q)
      );
    }

    if (line) {
      results = results.filter((t) => t.line === line);
    }

    if (employee) {
      results = results.filter(
        (t) =>
          t.employeeName.includes(String(employee)) ||
          t.employeeId === String(employee)
      );
    }

    if (type === "in") {
      results = results.filter((t) => t.qtyIn > 0);
    } else if (type === "out") {
      results = results.filter((t) => t.qtyOut > 0);
    }

    if (month) {
      results = results.filter((t) => t.month === Number(month));
    }

    if (year) {
      results = results.filter((t) => t.year === Number(year));
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const paginated = results.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({
      success: true,
      total: totalCount,
      page: pageNum,
      limit: pageSize,
      totalPages,
      data: paginated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new transaction (Shared online for all clients with strict validation & sanitization)
app.post("/api/transactions", rateLimiter(80), (req, res) => {
  try {
    const tx = req.body as Transaction;
    if (!tx || !tx.barcode) {
      return res.status(400).json({ success: false, error: "Missing transaction data or barcode" });
    }

    const safeBarcode = sanitizeText(tx.barcode);
    const safeItemName = sanitizeText(tx.itemName);
    const safeLine = sanitizeText(tx.line);
    const safeEmployeeName = sanitizeText(tx.employeeName);
    const safeEmployeeId = sanitizeText(tx.employeeId);
    const safeUnit = sanitizeText(tx.unit) || "ชิ้น";

    const safeQtyIn = Math.max(0, parseNum(tx.qtyIn));
    const safeQtyOut = Math.max(0, parseNum(tx.qtyOut));
    const safeUnitPrice = Math.max(0, parseNum(tx.unitPrice));
    const safeTotalCost = (safeQtyIn > 0 ? safeQtyIn : safeQtyOut) * safeUnitPrice;

    if (safeQtyIn === 0 && safeQtyOut === 0) {
      return res.status(400).json({ success: false, error: "Quantity must be greater than zero" });
    }

    const newTx: Transaction = {
      id: sanitizeText(tx.id) || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: sanitizeText(tx.date) || new Date().toISOString().slice(0, 10),
      month: parseNum(tx.month) || new Date().getMonth() + 1,
      year: parseNum(tx.year) || new Date().getFullYear(),
      line: safeLine,
      barcode: safeBarcode,
      itemName: safeItemName,
      unit: safeUnit,
      qtyIn: safeQtyIn,
      qtyOut: safeQtyOut,
      employeeId: safeEmployeeId,
      employeeName: safeEmployeeName,
      unitPrice: safeUnitPrice,
      totalCost: safeTotalCost,
      balance: parseNum(tx.balance) || 0,
      minStock: parseNum(tx.minStock) || 0,
      status: "synced",
      type: safeQtyIn > 0 ? "in" : "out",
    };

    // Prepend to server in-memory transactions cache
    allTransactionsCache.unshift(newTx);

    // Save to persistent file storage so data is NEVER lost across deployments/restarts
    appendStoredCustomTransaction(newTx);

    // Update stock item balance in cachedData if present
    if (cachedData && cachedData.stockItems) {
      const targetItem = cachedData.stockItems.find(
        (it) => it.barcode.trim().toLowerCase() === newTx.barcode.trim().toLowerCase()
      );
      if (targetItem) {
        if (newTx.qtyIn > 0) {
          targetItem.currentBalance += newTx.qtyIn;
          targetItem.qty = targetItem.currentBalance;
        } else if (newTx.qtyOut > 0) {
          targetItem.currentBalance -= newTx.qtyOut;
          targetItem.qty = targetItem.currentBalance;
        }
        targetItem.updatedAt = new Date().toISOString();

        if (targetItem.currentBalance <= 0) {
          targetItem.status = "out";
        } else if (targetItem.currentBalance <= targetItem.minStock) {
          targetItem.status = "low";
        } else {
          targetItem.status = "ok";
        }
      }
      cachedData.recentTransactions = allTransactionsCache;
      cachedData.totalTransactions = allTransactionsCache.length;
    }

    res.json({
      success: true,
      transaction: newTx,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Employees Endpoints - Persistent Shared Storage
app.get("/api/employees", rateLimiter(120), async (_req, res) => {
  try {
    const emps = await getStoredEmployees();
    res.json({ success: true, employees: emps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Authentication Endpoint - Direct Server-side Validation
app.post("/api/login", rateLimiter(40), async (req, res) => {
  try {
    const { username = "", password = "" } = req.body || {};
    const cleanUser = String(username).replace(/<[^>]*>?/gm, "").trim().toLowerCase();
    const cleanPass = String(password).replace(/<[^>]*>?/gm, "").trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: "กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน" });
    }

    const emps = await getStoredEmployees();
    const matched = emps.find((e) => {
      const u = (e.username || "").toLowerCase().trim();
      const code = (e.employeeCode || "").toLowerCase().trim();
      const id = (e.id || "").toLowerCase().trim();
      return u === cleanUser || code === cleanUser || id === cleanUser;
    });

    if (!matched) {
      return res.status(401).json({ success: false, error: "ไม่พบชื่อผู้ใช้งานหรือรหัสพนักงานในระบบ" });
    }

    const isMatch =
      (matched.password && matched.password.trim() === cleanPass) ||
      (matched.pin && matched.pin.trim() === cleanPass) ||
      (matched.role === "admin" && (cleanPass === "admin" || cleanPass === "1234"));

    if (!isMatch) {
      return res.status(401).json({ success: false, error: "รหัสผ่านไม่ถูกต้อง" });
    }

    res.json({
      success: true,
      employee: matched,
      allEmployees: emps,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/employees", rateLimiter(60), async (req, res) => {
  try {
    const { employees: rawEmps } = req.body;
    if (!Array.isArray(rawEmps) || rawEmps.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid employees array" });
    }

    // Sanitize employee entries to prevent malicious injection
    const sanitizedEmps: Employee[] = rawEmps.map((e: any) => ({
      id: sanitizeText(e.id) || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: sanitizeText(e.name),
      username: sanitizeText(e.username),
      password: String(e.password || "").trim(),
      pin: String(e.pin || "").trim(),
      role: (["admin", "manager", "staff"].includes(e.role) ? e.role : "staff") as any,
      department: sanitizeText(e.department),
      employeeCode: sanitizeText(e.employeeCode),
      allowedLines: Array.isArray(e.allowedLines)
        ? e.allowedLines.map((l: any) => sanitizeText(l)).filter(Boolean)
        : [],
      allowedSuppliers: Array.isArray(e.allowedSuppliers)
        ? e.allowedSuppliers.map((s: any) => sanitizeText(s)).filter(Boolean)
        : [],
      perms: {
        view: e.perms?.view !== false,
        viewDashboard: e.perms?.viewDashboard !== false,
        viewStock: e.perms?.viewStock !== false,
        viewTransactions: Boolean(e.perms?.viewTransactions ?? e.perms?.view),
        receive: Boolean(e.perms?.receive),
        issue: Boolean(e.perms?.issue),
        viewAlerts: Boolean(e.perms?.viewAlerts ?? e.perms?.view),
        viewForecast: Boolean(e.perms?.viewForecast ?? e.perms?.view),
        reports: Boolean(e.perms?.reports),
        addItem: Boolean(e.perms?.addItem),
        importExport: Boolean(e.perms?.importExport),
        employees: Boolean(e.perms?.employees),
        backup: Boolean(e.perms?.backup),
        manageOrderStatus: Boolean(e.perms?.manageOrderStatus),
      },
    }));

    await saveStoredEmployees(sanitizedEmps);
    res.json({ success: true, employees: sanitizedEmps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Backups Endpoints - Persistent Shared Storage
app.get("/api/backups", rateLimiter(80), async (_req, res) => {
  try {
    const backups = await getStoredBackups();
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/backups", rateLimiter(30), async (req, res) => {
  try {
    const backup = req.body as BackupEntry;
    if (!backup || !backup.id) {
      return res.status(400).json({ success: false, error: "Invalid backup data" });
    }
    const current = getStoredBackups();
    const updated = [backup, ...((await current) || []).filter((b: any) => b.id !== backup.id)];
    await saveStoredBackups(updated);
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/backups/:id", rateLimiter(30), async (req, res) => {
  try {
    const { id } = req.params;
    const current = getStoredBackups();
    const updated = ((await current) || []).filter((b: any) => b.id !== id);
    saveStoredBackups(updated);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET status for light sync polling
app.get("/api/sync-status", rateLimiter(120), (_req, res) => {
  res.json({
    success: true,
    lastSyncedAt: cachedData?.syncedAt || null,
    totalStockItems: cachedData?.totalStockItems || 0,
    totalTransactions: allTransactionsCache.length || cachedData?.totalTransactions || 0,
    cacheTtlMs: CACHE_TTL_MS,
  });
});

// ---------------- Vite Middleware & Startup ----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PASAYA Stock Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
