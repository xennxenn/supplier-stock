const fs = require('fs');
let forecast = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');
forecast = forecast.replace(
  'import React, { useState, useMemo, useEffect } from "react";\nimport { onSnapshot } from "firebase/firestore";\nimport { orderStatusCol } from "../lib/firebase";\nimport { OrderStatus } from "../types";',
  'import React, { useState, useMemo } from "react";'
);
fs.writeFileSync('src/components/ForecastPlanningView.tsx', forecast);
