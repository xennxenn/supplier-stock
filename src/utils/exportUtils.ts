import * as XLSX from "xlsx";

/**
 * Clean string for safe CSV/Excel cells
 */
export function sanitizeCell(value: any): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  return String(value);
}

/**
 * Export data array to Excel (.xlsx)
 */
export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  try {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => String(r[i] ?? "").length)
      );
      return { wch: Math.min(50, Math.max(10, maxLen + 2)) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const cleanFileName = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    // Fallback to CSV if xlsx fails
    exportToCSV(filename, headers, rows);
  }
}

/**
 * Export data array to CSV (.csv) with UTF-8 BOM
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const formattedRows = rows.map((row) =>
    row
      .map((val) => {
        if (val === null || val === undefined) return '""';
        if (typeof val === "number") return val;
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );

  const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
  const csvContent = "\uFEFF" + [headerLine, ...formattedRows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function getMonthFromPart(part: string): number {
  const parsed = parseInt(part, 10);
  if (!isNaN(parsed)) return parsed - 1; // 0-indexed month
  // Attempt to parse Thai month abbreviation
  const idx = THAI_MONTHS.findIndex((m) => part.includes(m));
  if (idx !== -1) return idx;
  return NaN;
}

/**
 * Robust date parser supporting Thai Buddhist calendar, ISO, DD/MM/YYYY, Thai month names, and Excel serial numbers
 */
export function parseFlexibleDate(dateStr?: string, fallbackYear?: number, fallbackMonth?: number): number {
  if (!dateStr || dateStr.trim() === "") {
    if (fallbackYear && fallbackMonth) {
      const y = fallbackYear > 2500 ? fallbackYear - 543 : fallbackYear;
      return new Date(y, fallbackMonth - 1, 1).getTime();
    }
    return 0;
  }

  const str = dateStr.trim();

  // Excel serial number (e.g., "45424" or 45424)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.getTime();
  }

  // DD/MM/YYYY or D/M/YYYY or DD/MM/YY or DD/MM/YYYY HH:mm:ss
  if (str.includes("/")) {
    const [datePart, timePart] = str.split(" ");
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = getMonthFromPart(parts[1]);
      let y = parseInt(parts[2], 10);

      // Handle 2-digit years
      if (y < 100) {
        // If year is 50-99, it's likely Thai year 2550-2599
        y += y >= 50 ? 2500 : 2000;
      }
      // Handle Thai Buddhist year (e.g., 2567 -> 2024)
      if (y > 2500) {
        y -= 543;
      }

      let hour = 0, min = 0, sec = 0;
      if (timePart) {
        const timeParts = timePart.split(":");
        if (timeParts.length >= 2) {
          hour = parseInt(timeParts[0], 10) || 0;
          min = parseInt(timeParts[1], 10) || 0;
          sec = parseInt(timeParts[2] || "0", 10) || 0;
        }
      }

      const dateObj = new Date(y, m, d, hour, min, sec);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.getTime();
      }
    }
  }

  // YYYY-MM-DD or DD-MM-YYYY or DD-MMM-YYYY (e.g. 2-ก.ย.-2026)
  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        let y = parseInt(parts[0], 10);
        if (y > 2500) y -= 543;
        const m = getMonthFromPart(parts[1]);
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) return dateObj.getTime();
      } else {
        // DD-MM-YYYY or DD-MMM-YYYY
        const d = parseInt(parts[0], 10);
        const m = getMonthFromPart(parts[1]);
        let y = parseInt(parts[2], 10);
        
        if (y < 100) {
          y += y >= 50 ? 2500 : 2000;
        }
        if (y > 2500) y -= 543;
        
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) return dateObj.getTime();
      }
    }
  }

  // Standard JS parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  // Fallback to year/month if provided
  if (fallbackYear && fallbackMonth) {
    const y = fallbackYear > 2500 ? fallbackYear - 543 : fallbackYear;
    return new Date(y, fallbackMonth - 1, 1).getTime();
  }

  return 0;
}
