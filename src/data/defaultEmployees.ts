import type { Employee } from "../types";

export const INITIAL_EMPLOYEES: Employee[] = [
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
    },
  },
];

