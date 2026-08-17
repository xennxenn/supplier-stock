import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Navbar } from "./components/Navbar";
import { DashboardView } from "./components/DashboardView";
import { StockListView } from "./components/StockListView";
import { TransactionsView } from "./components/TransactionsView";
import { MoveFormView } from "./components/MoveFormView";
import { LowStockAlertsView } from "./components/LowStockAlertsView";
import { ForecastPlanningView } from "./components/ForecastPlanningView";
import { ReportsView } from "./components/ReportsView";
import { EmployeesView } from "./components/EmployeesView";
import { BackupExportView } from "./components/BackupExportView";
import { ItemDetailModal } from "./components/ItemDetailModal";
import { LoginScreen } from "./components/LoginScreen";
import {
  fetchSheetsData,
  saveTransactionOnline,
  fetchEmployeesOnline,
  saveEmployeesOnline,
} from "./api";
import type {
  StockItem,
  Transaction,
  Employee,
  SheetsSyncData,
  BackupEntry,
  NavTab,
} from "./types";
import { INITIAL_EMPLOYEES } from "./data/defaultEmployees";
import {
  getScopedStockItems,
  getScopedTransactions,
  canAccessTab,
  hasPermission,
} from "./utils/permissionUtils";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [items, setItems] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [syncData, setSyncData] = useState<SheetsSyncData | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Authentication & Persistent Session in localStorage
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem("pasaya_stock_employees");
      if (saved) {
        const parsed: Employee[] = JSON.parse(saved);
        // Ensure standard admin has the current updated credentials
        return parsed.map((emp) => {
          if (emp.id === "emp_admin") {
            const defaultAdmin = INITIAL_EMPLOYEES.find((x) => x.id === "emp_admin");
            if (defaultAdmin) {
              return { ...emp, username: defaultAdmin.username, password: defaultAdmin.password, pin: defaultAdmin.pin, employeeCode: defaultAdmin.employeeCode };
            }
          }
          return emp;
        });
      }
      return INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const saved = localStorage.getItem("pasaya_current_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
      const sessionSaved = sessionStorage.getItem("pasaya_current_user");
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed && parsed.id) return parsed;
      }
    } catch {
      // ignore
    }
    return null; // Require login on new devices / unauthenticated browsers
  });

  // Modals & UI States
  const [selectedDetailItem, setSelectedDetailItem] = useState<StockItem | null>(null);
  const [movePrefill, setMovePrefill] = useState<{
    item: StockItem;
    type: "in" | "out";
  } | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "ok" | "error" = "ok") => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync with Google Sheets
  const performSync = useCallback(async (force = false, silent = false) => {
    if (!silent) setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await fetchSheetsData(force);
      if (data && data.stockItems && data.stockItems.length > 0) {
        setSyncData(data);
        setItems(data.stockItems);
        setTransactions(
          data.recentTransactions?.length > 0
            ? data.recentTransactions
            : []
        );
        setLastSyncedAt(data.syncedAt);
        localStorage.setItem("pasaya_stock_cache", JSON.stringify(data));
        if (!silent) {
          showToast(
            `ซิงค์ข้อมูล Google Sheets สำเร็จ! โหลด ${data.totalStockItems.toLocaleString()} รายการสต็อก และ ${data.totalTransactions.toLocaleString()} ประวัติเบิกจ่าย`
          );
        }
      } else {
        throw new Error("ไม่พบข้อมูลจาก Google Sheets");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      if (!silent) {
        setSyncError(err.message || "การซิงค์ข้อมูลล้มเหลว");
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets", "error");
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Sync employees with server across all devices
  const syncEmployees = useCallback(async () => {
    try {
      const serverEmps = await fetchEmployeesOnline();
      if (serverEmps && Array.isArray(serverEmps) && serverEmps.length > 0) {
        setEmployees(serverEmps);
        localStorage.setItem("pasaya_stock_employees", JSON.stringify(serverEmps));
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updatedSelf = serverEmps.find((e) => e.id === prev.id);
          if (!updatedSelf) return prev;
          if (JSON.stringify(prev) !== JSON.stringify(updatedSelf)) {
            return updatedSelf;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn("Failed to sync employees from server:", e);
    }
  }, []);

  // Initial load & periodic background sync
  useEffect(() => {
    // Check local cache first
    try {
      const cached = localStorage.getItem("pasaya_stock_cache");
      if (cached) {
        const parsed = JSON.parse(cached) as SheetsSyncData;
        if (parsed?.stockItems?.length > 0) {
          setSyncData(parsed);
          setItems(parsed.stockItems);
          setTransactions(parsed.recentTransactions || []);
          setLastSyncedAt(parsed.syncedAt);
        }
      }
    } catch (e) {
      console.warn("Failed to load local cache", e);
    }

    // Initial server fetch
    syncEmployees();
    performSync(false);

    // Periodic background sync
    const sheetsTimer = setInterval(() => {
      performSync(false, true);
    }, 45000);

    const empTimer = setInterval(() => {
      syncEmployees();
    }, 30000);

    // Sync on window/tab focus
    const handleFocus = () => {
      syncEmployees();
      performSync(false, true);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(sheetsTimer);
      clearInterval(empTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [performSync, syncEmployees]);

  // Tab permission guard: If current user doesn't have permission to view activeTab, auto-redirect
  useEffect(() => {
    if (!currentUser) return;
    if (!canAccessTab(currentUser, activeTab)) {
      const allTabs: NavTab[] = [
        "dashboard",
        "stock",
        "transactions",
        "movement",
        "alerts",
        "forecast",
        "reports",
        "employees",
        "backup",
      ];
      const firstAllowed = allTabs.find((t) => canAccessTab(currentUser, t));
      if (firstAllowed) {
        setActiveTab(firstAllowed);
      }
    }
  }, [currentUser, activeTab]);

  // Handle saving employees (Persisted both to server and localStorage)
  const handleSaveEmployees = async (newEmps: Employee[]) => {
    setEmployees(newEmps);
    localStorage.setItem("pasaya_stock_employees", JSON.stringify(newEmps));
    if (currentUser) {
      const updatedSelf = newEmps.find((e) => e.id === currentUser.id);
      if (updatedSelf) setCurrentUser(updatedSelf);
    }
    // Save to persistent server so it syncs across all devices & deploys
    try {
      await saveEmployeesOnline(newEmps);
    } catch (err) {
      console.warn("Could not save employees online:", err);
    }
    showToast("บันทึกข้อมูลพนักงานเรียบร้อยแล้ว (ซิงค์ทุกเครื่อง)");
  };

  // Quick action from table or modal to record movement (With strict permission check)
  const handleQuickMove = (item: StockItem, type: "in" | "out") => {
    if (type === "in" && !hasPermission(currentUser, "receive")) {
      showToast("คุณไม่มีสิทธิ์บันทึกรับเข้าสินค้า", "error");
      return;
    }
    if (type === "out" && !hasPermission(currentUser, "issue")) {
      showToast("คุณไม่มีสิทธิ์บันทึกเบิกจ่ายสินค้า", "error");
      return;
    }

    setSelectedDetailItem(null);
    setMovePrefill({ item, type });
    setActiveTab("movement");
  };

  // Record a new transaction (In or Out) with strict permission checks
  const handleRecordTransaction = async (txData: Partial<Transaction>) => {
    const isOut = (txData.qtyOut || 0) > 0 || txData.type === "out";
    const isIn = (txData.qtyIn || 0) > 0 || txData.type === "in";

    if (isOut && !hasPermission(currentUser, "issue")) {
      showToast("คุณไม่มีสิทธิ์บันทึกเบิกจ่ายสินค้า", "error");
      return;
    }
    if (isIn && !hasPermission(currentUser, "receive")) {
      showToast("คุณไม่มีสิทธิ์บันทึกรับเข้าสินค้า", "error");
      return;
    }

    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: txData.date || new Date().toISOString().slice(0, 10),
      barcode: txData.barcode || "",
      itemName: txData.itemName || "",
      unit: txData.unit || "ชิ้น",
      qtyIn: txData.qtyIn || 0,
      qtyOut: txData.qtyOut || 0,
      employeeId: txData.employeeId || currentUser?.id || "",
      employeeName: txData.employeeName || currentUser?.name || "",
      line: txData.line || "",
      unitPrice: txData.unitPrice || 0,
      totalCost: txData.totalCost || 0,
      month: txData.month || new Date().getMonth() + 1,
      year: txData.year || new Date().getFullYear(),
      balance: txData.balance || 0,
      minStock: txData.minStock || 0,
      status: txData.status || "ok",
      type: txData.type,
    };

    // Optimistically update transactions state
    setTransactions((prev) => [newTx, ...prev]);

    // Optimistically update item stock balance
    setItems((prev) =>
      prev.map((it) => {
        if (it.barcode.trim().toLowerCase() === newTx.barcode.trim().toLowerCase()) {
          const updatedBalance =
            newTx.qtyIn > 0
              ? it.currentBalance + newTx.qtyIn
              : it.currentBalance - newTx.qtyOut;
          return {
            ...it,
            currentBalance: updatedBalance,
            qty: updatedBalance,
            updatedAt: new Date().toISOString(),
          };
        }
        return it;
      })
    );

    // Save online to centralized server
    try {
      await saveTransactionOnline(newTx);
    } catch (e) {
      console.warn("Could not save to online server, stored locally:", e);
    }

    showToast("บันทึกรายการสำเร็จ! อัปเดตสต็อกเรียลไทม์");
  };

  // Restore snapshot backup
  const handleRestoreBackup = (backup: BackupEntry) => {
    if (backup.data?.items && backup.data.items.length > 0) {
      setItems(backup.data.items);
      setTransactions(backup.data.txs || []);
      showToast(`กู้คืนข้อมูลจากสำรอง (${new Date(backup.ts).toLocaleString("th-TH")}) สำเร็จ!`);
    }
  };

  // Global All Lines & Suppliers (for employee editing configuration)
  const allUniqueLines = useMemo(
    () => Array.from(new Set(items.map((i) => i.line).filter(Boolean))).sort(),
    [items]
  );
  const allUniqueSuppliers = useMemo(
    () => Array.from(new Set(items.map((i) => i.supplier).filter(Boolean))).sort(),
    [items]
  );

  // Scoped Stock Items based on currentUser line and supplier permissions
  const scopedItems = useMemo(() => {
    return getScopedStockItems(items, currentUser);
  }, [items, currentUser]);

  // Scoped Transactions based on currentUser line and supplier permissions
  const scopedTransactions = useMemo(() => {
    return getScopedTransactions(transactions, items, currentUser);
  }, [transactions, items, currentUser]);

  // Scoped unique lines for dropdown filter options
  const uniqueLines = useMemo(() => {
    if (
      !currentUser ||
      currentUser.role === "admin" ||
      !currentUser.allowedLines ||
      currentUser.allowedLines.length === 0 ||
      currentUser.allowedLines.includes("ALL")
    ) {
      return allUniqueLines;
    }
    return allUniqueLines.filter((l) => currentUser.allowedLines!.includes(l));
  }, [allUniqueLines, currentUser]);

  // Scoped unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(scopedItems.map((i) => i.category).filter(Boolean))
    ).sort();
  }, [scopedItems]);

  const lowStockCount = scopedItems.filter(
    (i) => i.currentBalance <= i.minStock && i.minStock > 0
  ).length;

  const handleLoginSuccess = (
    emp: Employee,
    remember: boolean,
    allEmps?: Employee[]
  ) => {
    setCurrentUser(emp);
    if (allEmps && allEmps.length > 0) {
      setEmployees(allEmps);
      localStorage.setItem("pasaya_stock_employees", JSON.stringify(allEmps));
    }
    if (remember) {
      localStorage.setItem("pasaya_current_user", JSON.stringify(emp));
    } else {
      sessionStorage.setItem("pasaya_current_user", JSON.stringify(emp));
      localStorage.removeItem("pasaya_current_user");
    }
    showToast(`ยินดีต้อนรับคุณ ${emp.name}`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("pasaya_current_user");
    sessionStorage.removeItem("pasaya_current_user");
    showToast("ออกจากระบบเรียบร้อยแล้ว");
  };

  if (!currentUser) {
    return (
      <LoginScreen
        employees={employees}
        onLogin={handleLoginSuccess}
        onSyncEmployees={(liveEmps) => {
          setEmployees(liveEmps);
          localStorage.setItem("pasaya_stock_employees", JSON.stringify(liveEmps));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 fade-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
              toast.type === "error"
                ? "bg-rose-900 text-white border-rose-800"
                : "bg-slate-900 text-white border-slate-800"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        onSync={() => performSync(true)}
        lastSyncedAt={lastSyncedAt}
        totalStock={scopedItems.length}
        totalTxs={scopedTransactions.length}
        lowStockCount={lowStockCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Access scope indicator banner for restricted users */}
        {currentUser.role !== "admin" &&
          ((currentUser.allowedLines && currentUser.allowedLines.length > 0) ||
            (currentUser.allowedSuppliers &&
              currentUser.allowedSuppliers.length > 0)) && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-bold">จำกัดสิทธิ์การเข้าถึงข้อมูลเฉพาะบุคคล:</span>
                {currentUser.allowedLines && currentUser.allowedLines.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                    ไลน์: {currentUser.allowedLines.join(", ")}
                  </span>
                )}
                {currentUser.allowedSuppliers && currentUser.allowedSuppliers.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-semibold border border-indigo-200">
                    Supplier: {currentUser.allowedSuppliers.join(", ")}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                (แสดง {scopedItems.length.toLocaleString()} จาก {items.length.toLocaleString()} รายการ)
              </span>
            </div>
          )}

        {/* Sync error banner if any */}
        {syncError && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                กำลังแสดงข้อมูลที่บันทึกไว้ในแคช (การซิงค์ล่าสุด: {syncError})
              </span>
            </div>
            <button
              onClick={() => performSync(true)}
              className="font-bold underline hover:text-amber-700 ml-2 cursor-pointer"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Views */}
        {activeTab === "dashboard" && (
          <DashboardView
            data={syncData}
            items={scopedItems}
            transactions={scopedTransactions}
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectItem={(item) => setSelectedDetailItem(item)}
            isSyncing={isSyncing}
            onSync={() => performSync(true)}
          />
        )}

        {activeTab === "stock" && (
          <StockListView
            items={scopedItems}
            currentUser={currentUser}
            onSelectItem={(item) => setSelectedDetailItem(item)}
            onQuickMove={handleQuickMove}
            categories={uniqueCategories}
            lines={uniqueLines}
          />
        )}

        {activeTab === "transactions" && (
          <TransactionsView
            transactions={scopedTransactions}
            lines={uniqueLines}
            stockItems={scopedItems}
            currentUser={currentUser}
          />
        )}

        {activeTab === "movement" && (
          <MoveFormView
            items={scopedItems}
            currentUser={currentUser}
            initialItem={movePrefill?.item || null}
            initialType={movePrefill?.type || "out"}
            onRecordTransaction={handleRecordTransaction}
            onClearInitial={() => setMovePrefill(null)}
          />
        )}

        {activeTab === "alerts" && (
          <LowStockAlertsView
            items={scopedItems}
            lines={uniqueLines}
            currentUser={currentUser}
            onSelectItem={(item) => setSelectedDetailItem(item)}
            onQuickMove={handleQuickMove}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastPlanningView
            items={scopedItems}
            transactions={scopedTransactions}
            lines={uniqueLines}
            categories={uniqueCategories}
            currentUser={currentUser}
            onSelectItem={(item) => setSelectedDetailItem(item)}
            onQuickMove={handleQuickMove}
          />
        )}

        {activeTab === "reports" && (
          <ReportsView
            data={syncData}
            items={scopedItems}
            transactions={scopedTransactions}
            currentUser={currentUser}
          />
        )}

        {activeTab === "employees" && (
          <EmployeesView
            employees={employees}
            currentUser={currentUser}
            availableLines={allUniqueLines}
            availableSuppliers={allUniqueSuppliers}
            onSaveEmployees={handleSaveEmployees}
          />
        )}

        {activeTab === "backup" && (
          <BackupExportView
            data={syncData}
            items={items}
            transactions={transactions}
            isSyncing={isSyncing}
            onSync={() => performSync(true)}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>

      {/* Item Details Modal */}
      {selectedDetailItem && (
        <ItemDetailModal
          item={selectedDetailItem}
          currentUser={currentUser}
          onClose={() => setSelectedDetailItem(null)}
          transactions={transactions}
          onQuickMove={handleQuickMove}
        />
      )}
    </div>
  );
}
