const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.post\("\/api\/backups", rateLimiter\(30\), \(req, res\) => \{/g,
  'app.post("/api/backups", rateLimiter(30), async (req, res) => {'
);
code = code.replace(
  /app\.post\("\/api\/backups", rateLimiter\(20\), \(req, res\) => \{/g,
  'app.post("/api/backups", rateLimiter(20), async (req, res) => {'
);

code = code.replace(
  /app\.delete\("\/api\/backups\/:id", rateLimiter\(20\), \(req, res\) => \{/g,
  'app.delete("/api/backups/:id", rateLimiter(20), async (req, res) => {'
);

fs.writeFileSync('server.ts', code);
