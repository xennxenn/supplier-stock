const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /import \* as admin from 'firebase-admin';\nadmin\.initializeApp\(\{ projectId: "gen-lang-client-0654376496" \}\);\nconst db = admin\.firestore\(\);\n/,
  `import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const adminApp = initializeApp({ projectId: "gen-lang-client-0654376496" });
const db = getFirestore(adminApp);
`
);

fs.writeFileSync('server.ts', code);
