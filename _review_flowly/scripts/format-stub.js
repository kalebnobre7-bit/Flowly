const fs = require('node:fs');
const path = require('node:path');

console.log('format: stub executado (sem prettier instalado).');
const marker = path.join(process.cwd(), '.format-last-run');
fs.writeFileSync(marker, new Date().toISOString());
