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
  | "purchaseOrders"
  | "monthlyUsage"
  | "reports"
  | "employees"
  | "backup"
  | "settings";

export interface PurchaseOrderItem {
  barcode: string;              // 1. บาร์โค้ด
  itemName: string;             // 2. ชื่อรายการสินค้า
  line: string;                 // 3. ไลน์
  supplier: string;             // 3. Supplier
  unit: string;
  monthlyBurnRate: number;      // 4. ใช้งานเฉลี่ยต่อเดือน
  monthsOfStock: number;        // 5. พอใช้กี่เดือน
  stockStatus: string;          // 6. สถานะ
  currentBalance: number;       // 7. คงเหลือ
  minStock: number;             // 8. Min Stock
  recommendedOrder: number;     // 9. แนะนำสั่งซื้อ (ตาม % เผื่อ)
  orderQty: number;             // 10. จำนวนที่ต้องการสั่งซื้อ (เลือกตามคำแนะนำหรือระบุเอง)
  unitPrice: number;            // 11. ราคาต่อหน่วย
  totalCost: number;            // 12. ค่าใช้จ่ายในการสั่งซื้อ
  note?: string;
}

export type PurchaseOrderStatus = "new" | "approved" | "confirm" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  poNumber: string;             // เช่น PO-202609-001
  lotNumber?: string;           // เช่น LOT-202609-001 เมื่อ Confirm
  title: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdById?: string;
  approvedBy?: string;
  approvedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  safetyBufferPercent: number;  // เผื่อกี่ %
  filterSummary?: string;       // เงื่อนไข Filter ที่ดึงมา
  items: PurchaseOrderItem[];
  totalItems: number;
  totalOrderQty: number;
  totalCost: number;
  notes?: string;
}

export type LiquidGlassPalette =
  | "ios-liquid-azure"
  | "emerald-aurora"
  | "pasaya-amber-luxe"
  | "neon-violet"
  | "titanium-frost"
  | "rose-gold"
  | "custom";

export interface LiquidGlassThemeConfig {
  palette: LiquidGlassPalette;
  blurIntensity: "subtle" | "medium" | "deep" | "ultra";
  fluidMotion: boolean;
  ambientGlow: boolean;
  isDarkGlass: boolean;
  customPrimaryColor?: string; // Hex color code e.g. #0ea5e9
  customBgTone?: string;       // Light/slate/frost/pearl
  logoUrl?: string;            // Base64 or URL of custom company logo
  logoText?: string;           // Custom company/brand title
}

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
  | "purchaseOrders"
  | "reports"
  | "addItem"
  | "importExport"
  | "employees"
  | "backup"
  | "manageOrderStatus"
  | "managePurchaseOrders";

export type EmployeePermissions = {
  view?: boolean;
  viewDashboard?: boolean;
  viewStock?: boolean;
  viewTransactions?: boolean;
  receive?: boolean;
  issue?: boolean;
  viewAlerts?: boolean;
  viewForecast?: boolean;
  purchaseOrders?: boolean;
  reports?: boolean;
  addItem?: boolean;
  importExport?: boolean;
  employees?: boolean;
  backup?: boolean;
  manageOrderStatus?: boolean;
  managePurchaseOrders?: boolean;
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
