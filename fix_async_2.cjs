const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.delete\("\/api\/backups\/:id", rateLimiter\(30\), \(req, res\) => \{/,
  'app.delete("/api/backups/:id", rateLimiter(30), async (req, res) => {'
);
code = code.replace(
  /saveStoredBackups\(updated\);/,
  'await saveStoredBackups(updated);'
);

fs.writeFileSync('server.ts', code);
