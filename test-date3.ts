import { parseFlexibleDate } from "./src/utils/exportUtils";
console.log("29-ส.ค.-2026", parseFlexibleDate("29-ส.ค.-2026"));
console.log(new Date(parseFlexibleDate("29-ส.ค.-2026")).toISOString());
console.log("25-ต.ค.-2024", parseFlexibleDate("25-ต.ค.-2024"));
console.log(new Date(parseFlexibleDate("25-ต.ค.-2024")).toISOString());
