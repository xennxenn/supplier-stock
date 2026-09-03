const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code += `
export interface OrderStatus {
  barcode: string;
  isOrdered: boolean;
  lotNumber: string;
  updatedAt: string;
}
`;
fs.writeFileSync('src/types.ts', code);
