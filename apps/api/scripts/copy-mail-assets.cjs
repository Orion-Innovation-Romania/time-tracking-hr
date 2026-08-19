'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'mail', 'assets');
const dest = path.join(__dirname, '..', 'dist', 'mail', 'assets');

if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
}

const openapiSrc = path.join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml');
const openapiDestDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(openapiSrc)) {
  fs.mkdirSync(openapiDestDir, { recursive: true });
  fs.copyFileSync(openapiSrc, path.join(openapiDestDir, 'openapi.yaml'));
}
