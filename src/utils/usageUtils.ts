import type { Transaction } from "../types";

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export interface MonthMeta {
  key: string; // "YYYY-MM"
  year: number;
  month: number;
  label: string; // e.g., "ก.ย. 67"
}

export interface ItemUsageStats {
  monthlyOut: Record<string, number>;
  monthlyIn: Record<string, number>;
  periodOut: number;
  periodIn: number;
  periodOutCost: number;
  periodInCost: number;
  allTimeOut: number;
  allTimeIn: number;
  avgMonthlyOut: number;
  avgMonthlyIn: number;
  activeMonthsCount: number;
}

const monthsWeakCache = new WeakMap<Transaction[], MonthMeta[]>();
const burnRateWeakCache = new WeakMap<
  Transaction[],
  { burnRateMap: Map<string, number>; monthsSpan: number }
>();
const usageMapWeakCache = new WeakMap<
  Transaction[],
  Map<string, Map<string, ItemUsageStats>>
>();

/**
 * Normalize year (if Buddhist year > 2400, convert to CE)
 */
export function normalizeYear(y: number): number {
  if (!y || isNaN(y)) return 0;
  if (y > 2400) return y - 543;
  if (y < 100) return y >= 50 ? 2500 + y - 543 : 2000 + y;
  return y;
}

/**
 * Fast WeakMap-cached monthly burn rate per SKU across all transactions
 * Shared by LowStockAlertsView, ForecastPlanningView, and PurchaseOrdersView
 */
export function computeBurnRateData(transactions: Transaction[]): {
  burnRateMap: Map<string, number>;
  monthsSpan: number;
} {
  if (!transactions || transactions.length === 0) {
    return { burnRateMap: new Map(), monthsSpan: 6 };
  }

  const cached = burnRateWeakCache.get(transactions);
  if (cached) return cached;

  const usageMap = new Map<string, number>();
  const monthKeySet = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (!t || !(t.qtyOut > 0)) continue;
    const rawBarcode = typeof t.barcode === "string" ? t.barcode : String(t.barcode || "");
    const b = rawBarcode.trim().toLowerCase();
    if (!b || b === "0") continue;

    usageMap.set(b, (usageMap.get(b) || 0) + t.qtyOut);
    if (t.year && t.month) {
      monthKeySet.add(`${t.year}-${t.month}`);
    }
  }

  const calculatedSpan = Math.max(3, monthKeySet.size || 6);
  const burnRates = new Map<string, number>();
  usageMap.forEach((totalOut, barcode) => {
    burnRates.set(barcode, totalOut / calculatedSpan);
  });

  const result = { burnRateMap: burnRates, monthsSpan: calculatedSpan };
  burnRateWeakCache.set(transactions, result);
  return result;
}

/**
 * Extract all valid chronological months present in transactions (WeakMap cached)
 */
export function extractAllMonths(transactions: Transaction[]): MonthMeta[] {
  if (!transactions || transactions.length === 0) return [];
  const cached = monthsWeakCache.get(transactions);
  if (cached) return cached;

  const keysMap = new Map<string, MonthMeta>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (!t) continue;
    const y = normalizeYear(t.year);
    const m = t.month;
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12 && (t.qtyOut > 0 || t.qtyIn > 0)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!keysMap.has(key)) {
        const thaiMonth = THAI_MONTHS_SHORT[m - 1] || `ด.${m}`;
        const shortYear = String(y + 543).slice(-2);
        keysMap.set(key, {
          key,
          year: y,
          month: m,
          label: `${thaiMonth} ${shortYear}`,
        });
      }
    }
  }

  const result = Array.from(keysMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  monthsWeakCache.set(transactions, result);
  return result;
}

/**
 * Filter month list by preset months count (e.g. 3, 6, 12, 24, or 0 for all) or custom range
 */
export function selectTargetMonths(
  allMonths: MonthMeta[],
  monthsCount: number,
  customStartKey?: string,
  customEndKey?: string
): MonthMeta[] {
  if (allMonths.length === 0) return [];

  if (customStartKey || customEndKey) {
    const start = customStartKey || "0000-00";
    const end = customEndKey || "9999-99";
    const actualStart = start <= end ? start : end;
    const actualEnd = start <= end ? end : start;
    return allMonths.filter((m) => m.key >= actualStart && m.key <= actualEnd);
  }

  if (!monthsCount || monthsCount <= 0 || monthsCount >= allMonths.length) {
    return allMonths;
  }

  return allMonths.slice(-monthsCount);
}

/**
 * Compute per-item usage map for a given set of transactions and target months (WeakMap cached)
 */
export function computeItemUsageMap(
  transactions: Transaction[],
  targetMonths: MonthMeta[]
): Map<string, ItemUsageStats> {
  if (!transactions || transactions.length === 0) {
    return new Map();
  }

  const cacheKey =
    targetMonths.length > 0
      ? `${targetMonths[0].key}_${targetMonths[targetMonths.length - 1].key}_${targetMonths.length}`
      : "empty";

  let byTxCache = usageMapWeakCache.get(transactions);
  if (byTxCache) {
    const existing = byTxCache.get(cacheKey);
    if (existing) return existing;
  } else {
    byTxCache = new Map();
    usageMapWeakCache.set(transactions, byTxCache);
  }

  const targetKeySet = new Set(targetMonths.map((m) => m.key));
  const span = Math.max(1, targetMonths.length);
  const itemMap = new Map<string, ItemUsageStats>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (!t || !t.barcode) continue;
    const rawBarcode = typeof t.barcode === "string" ? t.barcode : String(t.barcode || "");
    const b = rawBarcode.trim().toLowerCase();
    if (!b || b === "0") continue;

    const qOut = t.qtyOut || 0;
    const qIn = t.qtyIn || 0;
    if (qOut <= 0 && qIn <= 0) continue;

    let rec = itemMap.get(b);
    if (!rec) {
      rec = {
        monthlyOut: {},
        monthlyIn: {},
        periodOut: 0,
        periodIn: 0,
        periodOutCost: 0,
        periodInCost: 0,
        allTimeOut: 0,
        allTimeIn: 0,
        avgMonthlyOut: 0,
        avgMonthlyIn: 0,
        activeMonthsCount: 0,
      };
      itemMap.set(b, rec);
    }

    rec.allTimeOut += qOut;
    rec.allTimeIn += qIn;

    const y = normalizeYear(t.year);
    const m = t.month;
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (qOut > 0) {
        rec.monthlyOut[key] = (rec.monthlyOut[key] || 0) + qOut;
      }
      if (qIn > 0) {
        rec.monthlyIn[key] = (rec.monthlyIn[key] || 0) + qIn;
      }

      if (targetKeySet.has(key)) {
        rec.periodOut += qOut;
        rec.periodIn += qIn;
        const unitPrice = t.unitPrice || 0;
        if (qOut > 0) {
          rec.periodOutCost += t.totalCost || qOut * unitPrice;
        }
        if (qIn > 0) {
          rec.periodInCost += t.totalCost || qIn * unitPrice;
        }
      }
    }
  }

  itemMap.forEach((rec) => {
    rec.avgMonthlyOut = parseFloat((rec.periodOut / span).toFixed(1));
    rec.avgMonthlyIn = parseFloat((rec.periodIn / span).toFixed(1));
    let activeCount = 0;
    for (const m of targetMonths) {
      if ((rec.monthlyOut[m.key] || 0) > 0) activeCount++;
    }
    rec.activeMonthsCount = activeCount;
  });

  byTxCache.set(cacheKey, itemMap);
  return itemMap;
}
