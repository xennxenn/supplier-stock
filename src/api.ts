import type { SheetsSyncData, Transaction, Employee, BackupEntry } from "./types";
import Papa from "papaparse";
import { parseFlexibleDate } from "./utils/exportUtils";
import {
  db,
  employeesCol,
  doc,
  writeBatch,
  getDocs,
  OperationType,
  handleFirestoreError,
} from "./lib/firebase";

const STOCK_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=380033643&single=true&output=csv";

const TRANSACTIONS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=0&single=true&output=csv";

export async function fetchSheetsData(force = false): Promise<SheetsSyncData> {
  // Try backend proxy first
  try {
    const url = `/api/sync-sheets${force ? "?force=true" : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as SheetsSyncData;
      if (data.success && data.stockItems?.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Backend proxy fetch failed, falling back to direct client-side fetch", err);
  }

  // Fallback to direct client-side fetch from Google Sheets
  return fetchSheetsDataDirect();
}

const parseNum = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const clean = String(val).replace(/,/g, "").trim();
  if (clean === "" || isNaN(Number(clean))) return 0;
  return Number(clean);
};

export async function fetchSheetsDataDirect(): Promise<SheetsSyncData> {
  const [resStock, resTx] = await Promise.all([
    fetch(STOCK_SHEET_URL),
    fetch(TRANSACTIONS_SHEET_URL),
  ]);

  const [textStock, textTx] = await Promise.all([
    resStock.text(),
    resTx.text(),
  ]);

  const parsedStock = Papa.parse<string[]>(textStock, {
    header: false,
    skipEmptyLines: true,
  });
  const stockRows = parsedStock.data.slice(1);

  const stockItems = stockRows
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

      let status: "ok" | "low" | "out" = "ok";
      if (currentBalance <= 0) status = "out";
      else if (currentBalance <= minStock) status = "low";

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
      let month = parseNum(r[11]);
      let year = parseNum(r[12]);

      if (!month || !year) {
        const parsedTime = parseFlexibleDate(date);
        if (parsedTime > 0) {
          const d = new Date(parsedTime);
          if (!month) month = d.getMonth() + 1;
          if (!year) year = d.getFullYear();
        }
      }

      const balance = parseNum(r[13]);
      const minStock = parseNum(r[14]);
      const status = (r[15] || "").trim();

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
        type: qtyIn > 0 ? ("in" as const) : ("out" as const),
      };
    })
    .filter((t) => t.barcode !== "" || t.itemName !== "");

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

  return {
    success: true,
    syncedAt: new Date().toISOString(),
    totalStockItems: stockItems.length,
    totalTransactions: transactions.length,
    stockItems,
    recentTransactions: transactions,
    stats: {
      totalValue: Math.round(totalValue),
      totalSkus: stockItems.length,
      lowStockCount,
      outOfStockCount,
      currentMonthOutQty: 0,
      currentMonthCost: 0,
      uniqueLines,
      uniqueCategories,
      uniqueSuppliers,
      monthlySummary: [],
      lineDistribution: [],
      categoryDistribution: [],
    },
    sourceUrls: {
      stockSheet: STOCK_SHEET_URL,
      transactionsSheet: TRANSACTIONS_SHEET_URL,
    },
  };
}

export async function saveTransactionOnline(tx: Transaction): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
  try {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tx),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || "Server response error" };
  } catch (err: any) {
    console.warn("Could not post transaction to server online endpoint:", err);
    return { success: false, error: err.message };
  }
}

export async function loginOnline(username: string, password: string): Promise<{ success: boolean; employee?: Employee; allEmployees?: Employee[]; error?: string }> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    return { success: false, error: data.error || "เข้าสู่ระบบไม่สำเร็จ" };
  } catch (err: any) {
    console.warn("Server login request failed:", err);
    return { success: false, error: err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" };
  }
}

export async function fetchEmployeesOnline(): Promise<Employee[] | null> {
  // 1. Try reading from Firestore directly
  try {
    const snap = await getDocs(employeesCol);
    if (!snap.empty) {
      const list = snap.docs.map((d) => d.data() as Employee);
      if (list.length > 0) {
        return list;
      }
    }
  } catch (firestoreErr) {
    handleFirestoreError(firestoreErr, OperationType.LIST, "employees");
  }

  // 2. Fallback to server API
  try {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.employees) && data.employees.length > 0) {
        return data.employees;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch employees from server:", err);
  }
  return null;
}

export async function saveEmployeesOnline(employees: Employee[]): Promise<boolean> {
  let firestoreOk = false;
  // 1. Write to Firestore directly for instant real-time sync across all devices
  try {
    const batch = writeBatch(db);
    const snap = await getDocs(employeesCol);
    const incomingIds = new Set(employees.map((e) => e.id));
    
    // Delete removed employees from Firestore
    snap.docs.forEach((docSnap) => {
      if (!incomingIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // Upsert all employees in Firestore
    employees.forEach((emp) => {
      batch.set(doc(db, "employees", emp.id), emp);
    });

    await batch.commit();
    firestoreOk = true;
  } catch (firestoreErr) {
    handleFirestoreError(firestoreErr, OperationType.WRITE, "employees");
  }

  // 2. Also save to server API to keep server filesystem & in-memory store in sync
  try {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.success === true || firestoreOk;
    }
  } catch (err) {
    console.warn("Failed to save employees to server API:", err);
  }
  return firestoreOk;
}

export async function fetchBackupsOnline(): Promise<BackupEntry[] | null> {
  try {
    const res = await fetch("/api/backups");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        return data.backups;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch backups from server:", err);
  }
  return null;
}

export async function saveBackupOnline(backup: BackupEntry): Promise<boolean> {
  try {
    const res = await fetch("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to save backup to server:", err);
    return false;
  }
}

export async function deleteBackupOnline(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/backups/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to delete backup from server:", err);
    return false;
  }
}
