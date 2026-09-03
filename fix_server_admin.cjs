const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /import \* as admin from 'firebase-admin';[\s\S]*?const db = getFirestore\(adminApp\);\ndb\.settings\(\{ databaseId: "ai-studio-supplieraccessor-a00a7d4e-7cb1-4ba9-aa1f-4df7ed9106f0" \}\);/,
  `import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const adminApp = initializeApp({ projectId: "gen-lang-client-0654376496" });
const db = getFirestore(adminApp, "ai-studio-supplieraccessor-a00a7d4e-7cb1-4ba9-aa1f-4df7ed9106f0");`
);

fs.writeFileSync('server.ts', code);
