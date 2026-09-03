import { parseFlexibleDate } from "./src/utils/exportUtils";
console.log("29-ส.ค.-2026", parseFlexibleDate("29-ส.ค.-2026", 2026, 8));
console.log("1-ก.ย.-2026", parseFlexibleDate("1-ก.ย.-2026", 2026, 9));
console.log("2-ก.ย.-2026", parseFlexibleDate("2-ก.ย.-2026", 2026, 9));
console.log("2-ก.ย.-2024", parseFlexibleDate("2-ก.ย.-2024", 2024, 9));
console.log("25-ต.ค.-2024", parseFlexibleDate("25-ต.ค.-2024", 2024, 10));
