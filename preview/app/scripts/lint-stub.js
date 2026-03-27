const fs = require('node:fs');
const path = require('node:path');

const stub = [
  'eslint/prettier não estão instalados localmente neste projeto.',
  'Execute `npm i -D eslint prettier` e depois ajuste este script para rodar as ferramentas reais.'
].join('\n');

console.log(stub);

const marker = path.join(process.cwd(), '.lint-last-run');
fs.writeFileSync(marker, new Date().toISOString());
