const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.delete\("\/api\/backups\/:id", rateLimiter\(30\), \(req, res\) => \{/,
  'app.delete("/api/backups/:id", rateLimiter(30), async (req, res) => {'
);
code = code.replace(
  /app\.delete\("\/api\/backups\/:id", rateLimiter\(20\), \(req, res\) => \{/,
  'app.delete("/api/backups/:id", rateLimiter(20), async (req, res) => {'
);
fs.writeFileSync('server.ts', code);
