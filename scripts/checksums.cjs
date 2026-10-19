const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const files = process.argv.slice(2);
if (!files.length) throw new Error('Pass the package ZIP paths.');
const lines = files.map(file => `${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`);
fs.writeFileSync(path.join(path.dirname(files[0]), 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
