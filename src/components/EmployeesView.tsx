import React, { useState } from "react";
import {
  Users,
  Shield,
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Lock,
  User,
  AlertCircle,
} from "lucide-react";
import type { Employee, PermissionKey } from "../types";

interface EmployeesViewProps {
  employees: Employee[];
  currentUser: Employee;
  availableLines?: string[];
  availableSuppliers?: string[];
  onSaveEmployees: (emps: Employee[]) => void;
}

const ALL_PERMS: Array<{ key: PermissionKey; label: string }> = [
  { key: "view", label: "ดูรายการสต็อก & แดชบอร์ด" },
  { key: "receive", label: "บันทึกรับเข้าสินค้า" },
  { key: "issue", label: "บันทึกเบิกจ่ายสินค้า" },
  { key: "addItem", label: "เพิ่ม/แก้ไขรายการสินค้า" },
  { key: "importExport", label: "นำเข้า / ส่งออก CSV" },
  { key: "reports", label: "ดูรายงาน & สถิติ" },
  { key: "employees", label: "จัดการพนักงาน & สิทธิ์" },
  { key: "backup", label: "สำรองข้อมูล & ซิงค์ชีท" },
];

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  currentUser,
  availableLines = [],
  availableSuppliers = [],
  onSaveEmployees,
}) => {
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "",
    username: "",
    password: "",
    pin: "1234",
    role: "staff",
    department: "แพ็ค",
    employeeCode: "",
    allowedLines: [],
    allowedSuppliers: [],
    perms: {
      view: true,
      receive: true,
      issue: true,
      addItem: false,
      importExport: false,
      reports: false,
      employees: false,
      backup: false,
    },
  });

  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string>("");

  const handleEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      ...emp,
      username: emp.username || emp.employeeCode || emp.id.replace("emp_", ""),
      password: emp.password || emp.pin || "password",
      allowedLines: emp.allowedLines || [],
      allowedSuppliers: emp.allowedSuppliers || [],
    });
    setIsCreating(false);
    setDeleteError("");
  };

  const handleNew = () => {
    setIsCreating(true);
    setEditingEmp(null);
    setFormData({
      id: `emp_${Date.now()}`,
      name: "",
      username: "",
      password: "",
      pin: "1234",
      role: "staff",
      department: "แพ็ค",
      employeeCode: "",
      allowedLines: [],
      allowedSuppliers: [],
      perms: {
        view: true,
        receive: true,
        issue: true,
        addItem: false,
        importExport: false,
        reports: false,
        employees: false,
        backup: false,
      },
    });
    setDeleteError("");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    const cleanUsername = (formData.username || formData.employeeCode || formData.name || "").trim().toLowerCase();
    const cleanPassword = (formData.password || formData.pin || "password").trim();

    if (isCreating) {
      const newEmp: Employee = {
        id: `emp_${Date.now()}`,
        name: formData.name.trim(),
        username: cleanUsername || `user_${Date.now().toString().slice(-4)}`,
        password: cleanPassword,
        pin: cleanPassword.slice(0, 6) || "1234",
        role: formData.role || "staff",
        department: formData.department || "คลังสินค้า",
        employeeCode: (formData.employeeCode || "").trim(),
        allowedLines: formData.allowedLines || [],
        allowedSuppliers: formData.allowedSuppliers || [],
        perms: formData.perms || {
          view: true,
          receive: true,
          issue: true,
          addItem: false,
          importExport: false,
          reports: false,
          employees: false,
          backup: false,
        },
      };
      onSaveEmployees([...employees, newEmp]);
      setIsCreating(false);
    } else if (editingEmp) {
      const updated = employees.map((emp) =>
        emp.id === editingEmp.id
          ? ({
              ...emp,
              ...formData,
              name: (formData.name || emp.name).trim(),
              username: cleanUsername,
              password: cleanPassword,
              pin: cleanPassword.slice(0, 6) || emp.pin,
              allowedLines: formData.allowedLines || [],
              allowedSuppliers: formData.allowedSuppliers || [],
            } as Employee)
          : emp
      );
      onSaveEmployees(updated);
      setEditingEmp(null);
    }
  };

  const confirmDelete = () => {
    if (!empToDelete) return;
    if (employees.length <= 1) {
      setDeleteError("ไม่สามารถลบผู้ใช้งานคนสุดท้ายของระบบได้");
      return;
    }

    // Check if trying to delete the only admin
    const remainingAdmins = employees.filter(
      (e) => e.id !== empToDelete.id && e.role === "admin"
    );
    if (empToDelete.role === "admin" && remainingAdmins.length === 0) {
      setDeleteError("ต้องมีผู้ดูแลระบบ (Admin) อย่างน้อย 1 ท่านในระบบเสมอ");
      return;
    }

    const updated = employees.filter((e) => e.id !== empToDelete.id);
    onSaveEmployees(updated);
    setEmpToDelete(null);
    setDeleteError("");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            จัดการรายชื่อพนักงาน & สิทธิ์การเข้าใช้งาน
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            กำหนด Username, Password และสิทธิ์การใช้งานในแต่ละโมดูลของระบบ
          </p>
        </div>

        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* Editor Modal */}
      {(isCreating || editingEmp) && (
        <div className="bg-white p-6 rounded-2xl border-2 border-amber-400 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              {isCreating ? "เพิ่มพนักงานใหม่" : "แก้ไขข้อมูลพนักงาน & สิทธิ์"}
            </h3>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingEmp(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="เช่น somchai หรือ admin"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  รหัสผ่าน (Password) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                      pin: e.target.value,
                    })
                  }
                  placeholder="เช่น pass1234"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  รหัสพนักงาน
                </label>
                <input
                  type="text"
                  value={formData.employeeCode || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeCode: e.target.value })
                  }
                  placeholder="เช่น 510220"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  แผนก / ไลน์
                </label>
                <input
                  type="text"
                  value={formData.department || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="เช่น แพ็ค / คลังวัตถุดิบ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  บทบาท (Role)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-slate-900"
                >
                  <option value="admin">ผู้ดูแลระบบ (Admin - ทุกสิทธิ์)</option>
                  <option value="manager">หัวหน้างาน (Manager)</option>
                  <option value="staff">พนักงานทั่วไป (Staff)</option>
                </select>
              </div>
            </div>

            {/* Line & Supplier Access Control (Locking per user) */}
            <div className="pt-3 border-t border-slate-100 space-y-4">
              {/* Allowed Lines */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-800 text-xs">
                    🔒 สิทธิ์การเข้าถึงไลน์การผลิต (Allowed Production Lines):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedLines: [] })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        !formData.allowedLines || formData.allowedLines.length === 0
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      ทุกไลน์ (ไม่จำกัด)
                    </button>
                    {availableLines.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            allowedLines: [...availableLines],
                          })
                        }
                        className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                      >
                        เลือกทั้งหมด ({availableLines.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] text-slate-500">
                    {!formData.allowedLines || formData.allowedLines.length === 0
                      ? "💡 ผู้ใช้นี้สามารถดูและจัดการข้อมูลของ ทุกไลน์การผลิต"
                      : `🔒 จำกัดให้เข้าถึงเฉพาะ ${formData.allowedLines.length} ไลน์ที่เลือกด้านล่าง:`}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {availableLines.map((line) => {
                      const isSelected =
                        formData.allowedLines &&
                        formData.allowedLines.includes(line);

                      return (
                        <button
                          key={line}
                          type="button"
                          onClick={() => {
                            const cur = formData.allowedLines || [];
                            if (isSelected) {
                              setFormData({
                                ...formData,
                                allowedLines: cur.filter((l) => l !== line),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                allowedLines: [...cur, line],
                              });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-slate-950" : "bg-slate-300"}`} />
                          <span>{line}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Allowed Suppliers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-800 text-xs">
                    🔒 สิทธิ์การเข้าถึง Supplier (Allowed Suppliers):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedSuppliers: [] })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        !formData.allowedSuppliers || formData.allowedSuppliers.length === 0
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      ทุก Supplier (ไม่จำกัด)
                    </button>
                    {availableSuppliers.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            allowedSuppliers: [...availableSuppliers],
                          })
                        }
                        className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                      >
                        เลือกทั้งหมด ({availableSuppliers.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] text-slate-500">
                    {!formData.allowedSuppliers || formData.allowedSuppliers.length === 0
                      ? "💡 ผู้ใช้นี้สามารถดูและจัดการข้อมูลของ ทุก Supplier"
                      : `🔒 จำกัดให้เข้าถึงเฉพาะ ${formData.allowedSuppliers.length} Supplier ที่เลือกด้านล่าง:`}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {availableSuppliers.map((sup) => {
                      const isSelected =
                        formData.allowedSuppliers &&
                        formData.allowedSuppliers.includes(sup);

                      return (
                        <button
                          key={sup}
                          type="button"
                          onClick={() => {
                            const cur = formData.allowedSuppliers || [];
                            if (isSelected) {
                              setFormData({
                                ...formData,
                                allowedSuppliers: cur.filter((s) => s !== sup),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                allowedSuppliers: [...cur, sup],
                              });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-slate-950" : "bg-slate-300"}`} />
                          <span>{sup}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-bold text-slate-800 text-xs mb-2">
                กำหนดสิทธิ์การใช้งานรายโมดูล:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {ALL_PERMS.map((p) => {
                  const isChecked =
                    formData.role === "admin" ||
                    formData.perms?.[p.key] === true;

                  return (
                    <label
                      key={p.key}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? "bg-amber-50 border-amber-200 text-amber-900 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={formData.role === "admin"}
                        onChange={(e) => {
                          const curPerms = formData.perms || ({} as any);
                          setFormData({
                            ...formData,
                            perms: {
                              ...curPerms,
                              [p.key]: e.target.checked,
                            },
                          });
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingEmp(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-sm"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">ชื่อ-นามสกุล</th>
              <th className="p-3">Username</th>
              <th className="p-3">รหัสพนักงาน</th>
              <th className="p-3">บทบาท (Role)</th>
              <th className="p-3">สิทธิ์ไลน์การผลิต</th>
              <th className="p-3">สิทธิ์ Supplier</th>
              <th className="p-3">สิทธิ์โมดูล</th>
              <th className="p-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    {emp.name[0] || "U"}
                  </div>
                  <div>
                    <div>{emp.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {emp.department || "คลังสินค้า"}
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono font-semibold text-slate-800">
                  {emp.username || emp.employeeCode || emp.id.replace("emp_", "")}
                </td>
                <td className="p-3 font-mono text-slate-600">
                  {emp.employeeCode || "-"}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      emp.role === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : emp.role === "manager"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {emp.role === "admin"
                      ? "Admin"
                      : emp.role === "manager"
                      ? "Manager"
                      : "Staff"}
                  </span>
                </td>
                <td className="p-3">
                  {emp.role === "admin" || !emp.allowedLines || emp.allowedLines.length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                      ทุกไลน์
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-200">
                        {emp.allowedLines.length} ไลน์
                      </span>
                      {emp.allowedLines.slice(0, 2).map((l) => (
                        <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                          {l}
                        </span>
                      ))}
                      {emp.allowedLines.length > 2 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{emp.allowedLines.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {emp.role === "admin" || !emp.allowedSuppliers || emp.allowedSuppliers.length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                      ทุก Supplier
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-900 font-bold border border-indigo-200">
                        {emp.allowedSuppliers.length} Supplier
                      </span>
                      {emp.allowedSuppliers.slice(0, 2).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                          {s}
                        </span>
                      ))}
                      {emp.allowedSuppliers.length > 2 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{emp.allowedSuppliers.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {emp.role === "admin" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-bold border border-purple-200">
                        ทุกสิทธิ์ (Full Access)
                      </span>
                    ) : (
                      ALL_PERMS.filter((p) => emp.perms?.[p.key]).map((p) => (
                        <span
                          key={p.key}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                        >
                          {p.label.slice(0, 12)}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {emp.id !== currentUser.id && (
                      <button
                        onClick={() => {
                          setDeleteError("");
                          setEmpToDelete(emp);
                        }}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                        title={`ลบ ${emp.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal (In-UI, safe from iframe popups) */}
      {empToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                ยืนยันการลบรายชื่อผู้ใช้งาน
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                คุณต้องการลบ <strong>{empToDelete.name}</strong>{" "}
                <span className="font-mono text-slate-500">
                  (@{empToDelete.username || empToDelete.employeeCode || empToDelete.id})
                </span>{" "}
                ออกจากระบบหรือไม่?
              </p>
              <p className="text-[11px] text-rose-600">
                ⚠️ เมื่อลบแล้ว ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบหรือเข้าถึงข้อมูลได้อีก
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEmpToDelete(null);
                  setDeleteError("");
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
