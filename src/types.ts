/**
 * Data structures for PASAYA Stock & Disbursement Management
 */

export interface StockItem {
  id: string;
  barcode: string;          // Col A: บาร์โค้ด
  name: string;             // Col B: ชื่อรายการสินค้า
  category: string;         // Col C: ชนิด
  unit: string;             // Col D: หน่วย
  line: string;             // Col E: ไลน์
  forwardBalance: number;   // Col F: ยอดคงเหลือ ยกยอด
  currentBalance: number;   // Col G: ยอดคงเหลือ ปัจจุบัน (qty)
  qty: number;              // Alias to currentBalance for UI compatibility
  minStock: number;         // Col H: Min Stock
  unitCost: number;         // Col I: ราคาต่อหน่วย
  image: string;            // Col J: รูปภาพประกอบ
  master?: string;          // Col K: Mater // เว้นว่างไว้
  supplier: string;         // Col L: Supplier
  note: string;             // Col M: หมายเหตุ
  location: string;         // Col N: Location
  status?: "ok" | "low" | "out" | "reorder";
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  date: string;             // Col A: วันที่
  barcode: string;          // Col B: บาร์โค้ด
  itemName: string;         // Col C: ชื่อรายการสินค้า
  unit: string;             // Col D: หน่วย
  qtyIn: number;            // Col E: จำนวนรับเข้า
  qtyOut: number;           // Col F: จำนวนจ่ายออก
  employeeId: string;       // Col G: รหัสพนักงาน
  employeeName: string;     // Col H: ชื่อผู้เบิก
  line: string;             // Col I: ไลน์
  unitPrice: number;        // Col J: ราคาต่อหน่วย
  totalCost: number;        // Col K: ค่าใช้จ่ายต่อรายการ
  month: number;            // Col L: เดือน
  year: number;             // Col M: ปี
  balance: number;          // Col N: คงเหลือ
  minStock: number;         // Col O: Min Stock
  status: string;           // Col P: สถานะ (เช่น 'ok', 'ต้องทำการซื้อ')
  type?: "in" | "out";
}

export interface SheetsSyncData {
  success: boolean;
  syncedAt: string;
  totalStockItems: number;
  totalTransactions: number;
  stockItems: StockItem[];
  recentTransactions: Transaction[];
  stats: {
    totalValue: number;
    totalSkus: number;
    lowStockCount: number;
    outOfStockCount: number;
    currentMonthOutQty: number;
    currentMonthCost: number;
    uniqueLines: string[];
    uniqueCategories: string[];
    uniqueSuppliers: string[];
    monthlySummary: Array<{
      monthLabel: string;
      inQty: number;
      outQty: number;
      cost: number;
    }>;
    lineDistribution: Array<{
      line: string;
      itemCount: number;
      totalValue: number;
      outQty: number;
    }>;
    categoryDistribution: Array<{
      category: string;
      itemCount: number;
      totalValue: number;
    }>;
  };
  sourceUrls: {
    stockSheet: string;
    transactionsSheet: string;
  };
}

export type NavTab =
  | "dashboard"
  | "stock"
  | "transactions"
  | "movement"
  | "alerts"
  | "forecast"
  | "reports"
  | "employees"
  | "backup";

export interface ForecastItem {
  item: StockItem;
  monthlyBurnRate: number; // average units consumed per month
  monthsOfStockRemaining: number; // current stock / burn rate
  projectedDemand: number; // burn rate * forecast months * (1 + buffer)
  deficit: number; // projected shortage
  recommendedOrder: number; // amount to order
  estimatedCost: number; // recommendedOrder * unitCost
  riskLevel: "critical" | "warning" | "ok" | "overstock";
}

export type PermissionKey =
  | "view"
  | "viewDashboard"
  | "viewStock"
  | "viewTransactions"
  | "receive"
  | "issue"
  | "viewAlerts"
  | "viewForecast"
  | "reports"
  | "addItem"
  | "importExport"
  | "employees"
  | "backup"
  | "manageOrderStatus";

export type EmployeePermissions = {
  view?: boolean;
  viewDashboard?: boolean;
  viewStock?: boolean;
  viewTransactions?: boolean;
  receive?: boolean;
  issue?: boolean;
  viewAlerts?: boolean;
  viewForecast?: boolean;
  reports?: boolean;
  addItem?: boolean;
  importExport?: boolean;
  employees?: boolean;
  backup?: boolean;
  manageOrderStatus?: boolean;
  [key: string]: boolean | undefined;
};

export interface Employee {
  id: string;
  name: string;
  username?: string;
  password?: string;
  pin: string;
  role: "admin" | "manager" | "staff";
  department: string;
  employeeCode?: string;
  perms: EmployeePermissions;
  allowedLines?: string[]; // Allowed production lines (empty or containing "ALL" means all lines)
  allowedSuppliers?: string[]; // Allowed suppliers (empty or containing "ALL" means all suppliers)
  updatedAt?: string;
}

export interface BackupEntry {
  id: string;
  ts: string;
  itemsCount: number;
  txCount: number;
  kind: string;
  data: {
    items: StockItem[];
    txs: Transaction[];
  };
}

export interface Settings {
  backupInterval: "daily" | "weekly" | "monthly" | string;
  autoSyncIntervalMinutes: number;
  lastSyncTime?: string;
}

export interface OrderStatus {
  barcode: string;
  isOrdered: boolean;
  lotNumber: string;
  updatedAt: string;
}
