const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(
  /const updated = \[backup, \.\.\.current\.filter\(\(b\) => b\.id !== backup\.id\)\];/,
  'const updated = [backup, ...((await current) || []).filter((b: any) => b.id !== backup.id)];'
);
server = server.replace(
  /const updated = current\.filter\(\(b\) => b\.id !== id\);/,
  'const updated = ((await current) || []).filter((b: any) => b.id !== id);'
);
fs.writeFileSync('server.ts', server);

let forecast = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');
if (!forecast.includes('import { onSnapshot } from "firebase/firestore";')) {
  forecast = forecast.replace(
    'import React, { useState, useMemo, useEffect } from "react";',
    'import React, { useState, useMemo, useEffect } from "react";\nimport { onSnapshot } from "firebase/firestore";\nimport { orderStatusCol } from "../lib/firebase";'
  );
  fs.writeFileSync('src/components/ForecastPlanningView.tsx', forecast);
}
