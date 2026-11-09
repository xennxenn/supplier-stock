import type { SheetsSyncData } from "../types";

const DB_NAME = "pasaya_stock_idb_v1";
const STORE_NAME = "sync_cache";
const CACHE_KEY = "latest_sheets_data";
const LS_FALLBACK_KEY = "pasaya_stock_cache";

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open error"));
  });
}

/**
 * Load full cached SheetsSyncData from IndexedDB (or fallback to localStorage)
 */
export async function loadCachedSheetsData(): Promise<SheetsSyncData | null> {
  try {
    const db = await openCacheDB();
    const data = await new Promise<SheetsSyncData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(CACHE_KEY);
      getReq.onsuccess = () => resolve((getReq.result as SheetsSyncData) || null);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    if (data && data.stockItems?.length > 0 && data.recentTransactions?.length > 0) {
      return data;
    }
  } catch {
    // Fallback to localStorage below
  }

  return loadCachedSheetsDataSync();
}

/**
 * Synchronous initial load from localStorage for instant 0ms first render
 */
export function loadCachedSheetsDataSync(): SheetsSyncData | null {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SheetsSyncData;
    if (parsed && parsed.stockItems?.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save full SheetsSyncData to IndexedDB (all 25,000+ transactions) + lightweight newest slice to localStorage
 */
export async function saveCachedSheetsData(data: SheetsSyncData): Promise<void> {
  // 1. Save complete untruncated dataset to IndexedDB
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(data, CACHE_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
    db.close();
  } catch (err) {
    console.warn("IndexedDB cache write skipped:", err);
  }

  // 2. Also save stockItems + newest 2,500 transactions to localStorage for synchronous 0ms boot
  try {
    const lsData: SheetsSyncData = {
      ...data,
      recentTransactions: data.recentTransactions?.slice(0, 2500) || [],
    };
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(lsData));
  } catch {
    // If 2,500 exceeds localStorage quota, store stockItems + newest 800 transactions
    try {
      const compactData: SheetsSyncData = {
        ...data,
        recentTransactions: data.recentTransactions?.slice(0, 800) || [],
      };
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(compactData));
    } catch {
      try {
        const itemsOnlyData: SheetsSyncData = {
          ...data,
          recentTransactions: [],
        };
        localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(itemsOnlyData));
      } catch {
        // Ignore quota errors since IndexedDB holds the full dataset
      }
    }
  }
}
