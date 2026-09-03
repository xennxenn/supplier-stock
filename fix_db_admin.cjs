const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace imports
code = code.replace(
  'import { initializeApp } from "firebase-admin/app";\nimport { getFirestore } from "firebase-admin/firestore";\nconst adminApp = initializeApp({ projectId: "gen-lang-client-0654376496" });\nconst db = getFirestore(adminApp, "ai-studio-supplieraccessor-a00a7d4e-7cb1-4ba9-aa1f-4df7ed9106f0");',
  `import { initializeApp } from "firebase/app";\nimport { getFirestore, collection, getDocs, doc, setDoc, writeBatch, query, orderBy, limit } from "firebase/firestore";\n\nconst firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));\nconst appFirebase = initializeApp(firebaseConfig);\nconst db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);`
);

// getStoredEmployees
code = code.replace(
  /const snap = await db\.collection\("employees"\)\.get\(\);/g,
  'const snap = await getDocs(collection(db, "employees"));'
);

// getStoredCustomTransactions
code = code.replace(
  /const snap = await db\.collection\("customTransactions"\)\.orderBy\("timestamp", "desc"\)\.limit\(5000\)\.get\(\);/g,
  'const q = query(collection(db, "customTransactions"), orderBy("timestamp", "desc"), limit(5000));\n    const snap = await getDocs(q);'
);

// saveStoredCustomTransaction
code = code.replace(
  /await db\.collection\("customTransactions"\)\.doc\(tx\.id\)\.set\(tx\);/g,
  'await setDoc(doc(db, "customTransactions", tx.id), tx);'
);

// getStoredBackups
code = code.replace(
  /const snap = await db\.collection\("backups"\)\.orderBy\("timestamp", "desc"\)\.get\(\);/g,
  'const q = query(collection(db, "backups"), orderBy("timestamp", "desc"));\n    const snap = await getDocs(q);'
);

// saveStoredBackups
code = code.replace(/const batch = db\.batch\(\);/g, 'const batch = writeBatch(db);');
code = code.replace(/const snap = await db\.collection\("backups"\)\.get\(\);/g, 'const snap = await getDocs(collection(db, "backups"));');
code = code.replace(/batch\.set\(db\.collection\("backups"\)\.doc\(b\.id\), b\);/g, 'batch.set(doc(db, "backups", b.id), b);');

// getStoredOrderStatus
code = code.replace(
  /const snap = await db\.collection\("orderStatuses"\)\.get\(\);/g,
  'const snap = await getDocs(collection(db, "orderStatuses"));'
);

// updateOrderStatus
code = code.replace(
  /await db\.collection\("orderStatuses"\)\.doc\(barcode\)\.set\(/g,
  'await setDoc(doc(db, "orderStatuses", barcode), '
);

// updateOrderStatuses (also handles batch)
code = code.replace(/batch\.set\(db\.collection\("orderStatuses"\)\.doc\(s\.barcode\), s\);/g, 'batch.set(doc(db, "orderStatuses", s.barcode), s);');

fs.writeFileSync('server.ts', code);
