'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const file = path.join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml');
const spec = yaml.load(fs.readFileSync(file, 'utf8'));
if (!spec || spec.openapi !== '3.0.3' || !spec.paths) {
  throw new Error('Invalid OpenAPI document');
}

const ops = [];
const ids = new Map();
for (const [p, item] of Object.entries(spec.paths)) {
  for (const [m, op] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
    ops.push(`${m.toUpperCase()} ${p}`);
    if (!op.operationId) throw new Error(`Missing operationId: ${m} ${p}`);
    if (ids.has(op.operationId)) {
      throw new Error(`Duplicate operationId ${op.operationId}`);
    }
    ids.set(op.operationId, `${m} ${p}`);
  }
}

console.log(`OK ${spec.info.title} ${spec.openapi}`);
console.log(`${Object.keys(spec.paths).length} paths, ${ops.length} operations`);
