const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastPlanningView.tsx', 'utf8');

// 1. Remove state and functions
code = code.replace(
  /const \[currentLotNumber, setCurrentLotNumber\] = useState\(""\);[\s\S]*?setConfirmModal\(null\);\n  };\n/,
  ''
);

fs.writeFileSync('src/components/ForecastPlanningView.tsx', code);
console.log('Removed states and functions');
