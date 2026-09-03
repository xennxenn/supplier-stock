const fs = require('fs');

let forecast = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');
if (!forecast.includes('import { onSnapshot } from "firebase/firestore";')) {
  forecast = forecast.replace(
    'import React, { useState, useMemo, useEffect } from "react";',
    'import React, { useState, useMemo, useEffect } from "react";\nimport { onSnapshot } from "firebase/firestore";\nimport { orderStatusCol } from "../lib/firebase";'
  );
  fs.writeFileSync('src/components/ForecastPlanningView.tsx', forecast);
}
