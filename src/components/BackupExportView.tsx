import React, { useState, useEffect } from "react";
import {
  Database,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Clock,
  Trash2,
  RotateCcw,
} from "lucide-react";
import type { StockItem, Transaction, BackupEntry, SheetsSyncData } from "../types";
import {
  fetchBackupsOnline,
  saveBackupOnline,
  deleteBackupOnline,
} from "../api";

interface BackupExportViewProps {
  data: SheetsSyncData | null;
  items: StockItem[];
  transactions: Transaction[];
  isSyncing: boolean;
  onSync: () => void;
  onRestoreBackup: (backup: BackupEntry) => void;
}

export const BackupExportView: React.FC<BackupExportViewProps> = ({
  data,
  items,
  transactions,
  isSyncing,
  onSync,
  onRestoreBackup,
}) => {
  const [backups, setBackups] = useState<BackupEntry[]>(() => {
    try {
      const saved = localStorage.getItem("pasaya_stock_backups");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchBackupsOnline().then((serverBackups) => {
      if (serverBackups && serverBackups.length > 0) {
        setBackups(serverBackups);
        localStorage.setItem("pasaya_stock_backups", JSON.stringify(serverBackups));
      }
    });
  }, []);

  const handleCreateBackup = async () => {
    const newBackup: BackupEntry = {
      id: `backup_${Date.now()}`,
      ts: new Date().toISOString(),
      itemsCount: items.length,
      txCount: transactions.length,
      kind: "Manual Snapshot",
      data: {
        items,
        txs: transactions,
      },
    };

    const updated = [newBackup, ...backups].slice(0, 15);
    setBackups(updated);
    localStorage.setItem("pasaya_stock_backups", JSON.stringify(updated));
    await saveBackupOnline(newBackup);
    setMsg("บันทึกจุดสำรองข้อมูลสำเร็จ (บันทึกบนเซิร์ฟเวอร์เรียบร้อย)!");
    setTimeout(() => setMsg(""), 4000);
  };

  const handleDeleteBackup = async (id: string) => {
    const updated = backups.filter((b) => b.id !== id);
    setBackups(updated);
    localStorage.setItem("pasaya_stock_backups", JSON.stringify(updated));
    await deleteBackupOnline(id);
  };

  const handleDownloadJSON = (backup: BackupEntry) => {
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ACCESSORIES_STOCK_BACKUP_${new Date(backup.ts)
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            การเชื่อมต่อ Google Sheets & สำรองข้อมูล
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจสอบสถานะการซิงค์ข้อมูล Google Sheets และจัดการ Snapshot ย้อนหลัง
          </p>
        </div>

        <button
          onClick={onSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "กำลังซิงค์..." : "ซิงค์ข้อมูลชีทใหม่ทันที"}</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Google Sheets Connections Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sheet 1: Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>ชีท 1: รายการเบิกจ่าย (Disbursements)</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {transactions.length.toLocaleString()} รายการ
            </span>
          </div>

          <p className="text-xs text-slate-500">
            บันทึกประวัติการรับเข้า-จ่ายออก ข้อมูลผู้เบิก ไลน์การผลิต และค่าใช้จ่าย
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-600 break-all">
            https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=0
          </div>

          <div className="pt-2 flex justify-end">
            <a
              href="https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=0&single=true&output=csv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด CSV ชีทนี้</span>
            </a>
          </div>
        </div>

        {/* Sheet 2: Stock Master */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Package className="w-4 h-4 text-amber-600" />
              <span>ชีท 2: รายการสต็อก (Master Stock)</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
              {items.length.toLocaleString()} SKU
            </span>
          </div>

          <p className="text-xs text-slate-500">
            ฐานข้อมูลหลักสินค้า บาร์โค้ด ยอดคงเหลือ Min Stock ราคา และ Supplier
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-600 break-all">
            https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=380033643
          </div>

          <div className="pt-2 flex justify-end">
            <a
              href="https://docs.google.com/spreadsheets/d/e/2PACX-1vS9Fm4Y7_BJZcpoolwOFQD6u0Exz4DdbKuFeV5oSjEsL9Pe_P560uyN0bSw522woUtA-JCbsCHJQ5eU/pub?gid=380033643&single=true&output=csv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด CSV ชีทนี้</span>
            </a>
          </div>
        </div>
      </div>

      {/* Snapshot Manager */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              จุดสำรองข้อมูลในเครื่อง (Snapshots & Backups)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              สร้างจุดบันทึกสำรองเพื่อกู้คืนข้อมูลหรือดาวน์โหลดเป็นไฟล์ JSON
            </p>
          </div>

          <button
            onClick={handleCreateBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
          >
            <span>+ สร้างจุดสำรองข้อมูลใหม่</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            ยังไม่มีจุดสำรองข้อมูลที่บันทึกไว้
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">
                    {new Date(b.ts).toLocaleString("th-TH")}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    สต็อก: {b.itemsCount.toLocaleString()} รายการ | ธุรกรรม:{" "}
                    {b.txCount.toLocaleString()} รายการ
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadJSON(b)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="ดาวน์โหลด JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRestoreBackup(b)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold transition"
                    title="กู้คืนข้อมูลจากจุดนี้"
                  >
                    <RotateCcw className="w-3 h-3 inline mr-1" />
                    กู้คืน
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(b.id)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                    title="ลบ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
