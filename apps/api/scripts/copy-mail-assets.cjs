'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'mail', 'assets');
const dest = path.join(__dirname, '..', 'dist', 'mail', 'assets');

if (!fs.existsSync(src)) process.exit(0);

fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
