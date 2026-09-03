import type { Employee, PermissionKey, NavTab, StockItem, Transaction } from "../types";

export const PERMISSION_DEFINITIONS: Array<{
  key: PermissionKey;
  label: string;
  category: "เมนูหลัก (Navigation Tabs)" | "สิทธิ์การดำเนินการ (Actions)";
  description: string;
}> = [
  {
    key: "viewDashboard",
    label: "ดูแดชบอร์ดภาพรวม",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้าแดชบอร์ดสรุปยอด มูลค่าสต็อก และภาพรวมคลัง",
  },
  {
    key: "viewStock",
    label: "ดูรายการสต็อก (Stock List)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้ารายการสินค้าคงเหลือ ค้นหา และตรวจสอบจำนวน",
  },
  {
    key: "viewTransactions",
    label: "ดูรายการเบิกจ่าย (Transactions)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้ารายการประวัติการรับเข้า-เบิกจ่ายสินค้าทั้งหมด",
  },
  {
    key: "viewAlerts",
    label: "ดูเตือนสั่งซื้อ (Low Stock Alerts)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้ารายการสินค้าที่สต็อกต่ำกว่าเกณฑ์ Min Stock",
  },
  {
    key: "viewForecast",
    label: "ดูพยากรณ์สั่งซื้อ (Forecast)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้าพยากรณ์ความต้องการและแผนการสั่งซื้อสินค้า",
  },
  {
    key: "reports",
    label: "ดูรายงาน & สถิติ (Reports)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้ารายงานสรุปยอดเบิกจ่ายแยกตามไลน์และหมวดหมู่",
  },
  {
    key: "receive",
    label: "บันทึกรับเข้าสินค้า (Receive / In)",
    category: "สิทธิ์การดำเนินการ (Actions)",
    description: "มีสิทธิ์บันทึกสินค้าเข้าสต็อกทั้งจากหน้ารับ-จ่ายและปุ่มด่วน",
  },
  {
    key: "issue",
    label: "บันทึกเบิกจ่ายสินค้า (Issue / Out)",
    category: "สิทธิ์การดำเนินการ (Actions)",
    description: "มีสิทธิ์บันทึกการตัดเบิกสินค้าทั้งจากหน้ารับ-จ่ายและปุ่มด่วน",
  },
  {
    key: "addItem",
    label: "เพิ่ม/แก้ไขรายการสินค้า",
    category: "สิทธิ์การดำเนินการ (Actions)",
    description: "เพิ่มสินค้าใหม่ แก้ไขราคาต่อหน่วย หรือข้อมูลสเปกสินค้า",
  },
  {
    key: "importExport",
    label: "นำเข้า / ส่งออก Excel & CSV",
    category: "สิทธิ์การดำเนินการ (Actions)",
    description: "ดาวน์โหลดไฟล์ Excel หรือส่งออกข้อมูลตาราง",
  },
  {
    key: "manageOrderStatus",
    label: "จัดการรอบสั่งซื้อ & ติ๊กสถานะ Lot (Order Lot Management)",
    category: "สิทธิ์การดำเนินการ (Actions)",
    description: "สร้าง/บันทึกเลขที่ Lot สั่งซื้อ, ติ๊กหมายเหตุสั่งซื้อ, และล้างรอบสั่งซื้อ (หน้าเตือนสั่งซื้อ & พยากรณ์)",
  },
  {
    key: "employees",
    label: "จัดการพนักงาน & สิทธิ์ (Employees)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้าจัดการรายชื่อพนักงาน กำหนดสิทธิ์ และรหัสผ่าน",
  },
  {
    key: "backup",
    label: "ชีท & สำรองข้อมูล (Backup)",
    category: "เมนูหลัก (Navigation Tabs)",
    description: "เข้าถึงหน้าสำรองข้อมูล กู้คืน และซิงค์ Google Sheets",
  },
];

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  user: Employee | null | undefined,
  perm: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!user.perms) return false;

  // Explicit check
  if (typeof user.perms[perm] === "boolean") {
    return user.perms[perm];
  }

  // Fallback for legacy "view" permission
  if (
    perm === "viewDashboard" ||
    perm === "viewStock" ||
    perm === "viewTransactions" ||
    perm === "viewAlerts" ||
    perm === "viewForecast"
  ) {
    return user.perms.view !== false;
  }

  // Fallback for manageOrderStatus: if not explicitly defined, default to true for managers or staff with warehouse actions
  if (perm === "manageOrderStatus") {
    if (user.role === "manager" || user.perms.receive || user.perms.issue || user.perms.addItem) {
      return true;
    }
  }

  return Boolean(user.perms[perm]);
}

/**
 * Check if user can access a specific navigation tab
 */
export function canAccessTab(
  user: Employee | null | undefined,
  tab: NavTab
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  switch (tab) {
    case "dashboard":
      return hasPermission(user, "viewDashboard") || hasPermission(user, "view");
    case "stock":
      return hasPermission(user, "viewStock") || hasPermission(user, "view");
    case "transactions":
      return hasPermission(user, "viewTransactions");
    case "movement":
      return hasPermission(user, "receive") || hasPermission(user, "issue");
    case "alerts":
      return hasPermission(user, "viewAlerts") || hasPermission(user, "view");
    case "forecast":
      return hasPermission(user, "viewForecast") || hasPermission(user, "view");
    case "reports":
      return hasPermission(user, "reports");
    case "employees":
      return hasPermission(user, "employees");
    case "backup":
      return hasPermission(user, "backup");
    default:
      return true;
  }
}

/**
 * Robust line matcher that handles trimming, partial containment, sub-departments
 */
export function isLineAllowed(
  line: string | undefined | null,
  allowedLines: string[] | undefined | null
): boolean {
  if (!allowedLines || allowedLines.length === 0 || allowedLines.includes("ALL")) {
    return true;
  }
  if (!line || !line.trim()) {
    // Unassigned lines are only visible if user has ALL lines
    return false;
  }

  const cleanLine = line.trim().toLowerCase();

  return allowedLines.some((allowed) => {
    const cleanAllowed = (allowed || "").trim().toLowerCase();
    if (!cleanAllowed) return false;
    if (cleanAllowed === "all") return true;

    return (
      cleanLine === cleanAllowed ||
      cleanLine.includes(cleanAllowed) ||
      cleanAllowed.includes(cleanLine)
    );
  });
}

/**
 * Robust supplier matcher
 */
export function isSupplierAllowed(
  supplier: string | undefined | null,
  allowedSuppliers: string[] | undefined | null
): boolean {
  if (!allowedSuppliers || allowedSuppliers.length === 0 || allowedSuppliers.includes("ALL")) {
    return true;
  }
  if (!supplier || !supplier.trim()) {
    return false;
  }

  const cleanSup = supplier.trim().toLowerCase();

  return allowedSuppliers.some((allowed) => {
    const cleanAllowed = (allowed || "").trim().toLowerCase();
    if (!cleanAllowed) return false;
    if (cleanAllowed === "all") return true;

    return (
      cleanSup === cleanAllowed ||
      cleanSup.includes(cleanAllowed) ||
      cleanAllowed.includes(cleanSup)
    );
  });
}

/**
 * Filter items by user's line and supplier permissions
 */
export function getScopedStockItems(
  items: StockItem[],
  user: Employee | null | undefined
): StockItem[] {
  if (!user || user.role === "admin") return items;

  return items.filter((item) => {
    const lineOk = isLineAllowed(item.line, user.allowedLines);
    const supOk = isSupplierAllowed(item.supplier, user.allowedSuppliers);
    return lineOk && supOk;
  });
}

/**
 * Filter transactions by user's line and supplier permissions
 * Uses fallback to item master if transaction line is not explicitly stamped
 */
export function getScopedTransactions(
  transactions: Transaction[],
  items: StockItem[],
  user: Employee | null | undefined
): Transaction[] {
  if (!user || user.role === "admin") return transactions;

  const itemMap = new Map(
    items.map((it) => [it.barcode.trim().toLowerCase(), it])
  );

  return transactions.filter((tx) => {
    const masterItem = itemMap.get(tx.barcode.trim().toLowerCase());
    const effectiveLine = tx.line || masterItem?.line || "";
    const effectiveSupplier = masterItem?.supplier || "";

    const lineOk = isLineAllowed(effectiveLine, user.allowedLines);
    const supOk = isSupplierAllowed(effectiveSupplier, user.allowedSuppliers);
    return lineOk && supOk;
  });
}
