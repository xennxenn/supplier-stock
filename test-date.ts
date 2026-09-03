import { parseFlexibleDate } from "./src/utils/exportUtils";
console.log(parseFlexibleDate("2-ก.ย.-2026", 2026, 9));
console.log(new Date(parseFlexibleDate("2-ก.ย.-2026", 2026, 9)).toISOString());
console.log(parseFlexibleDate("29-ส.ค.-2026", 2026, 8));
console.log(parseFlexibleDate("25-ต.ค.-2024", 2024, 10));
console.log(parseFlexibleDate("2-ก.ย.-2024", 2024, 9));
