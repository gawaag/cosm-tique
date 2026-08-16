'use strict';

const fs = require('fs');
const path = require('path');

/** Netlify Functions / AWS Lambda (read-only bundle, writable /tmp only). */
const isServerless = !!(
  process.env.AWS_LAMBDA_FUNCTION_NAME
  || process.env.LAMBDA_TASK_ROOT
  || process.env.NETLIFY
);

function findProjectRoot() {
  const candidates = [
    process.env.LAMBDA_TASK_ROOT,
    process.cwd(),
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
    __dirname,
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'views', 'error.ejs'))) return dir;
  }
  return path.join(__dirname, '..');
}

const ROOT = findProjectRoot();
const DATA_DIR = isServerless ? '/tmp/maachabat-data' : path.join(ROOT, 'data');
const UPLOAD_DIR = isServerless ? '/tmp/maachabat-uploads' : path.join(ROOT, 'public', 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BUNDLED_UPLOADS = path.join(ROOT, 'public', 'uploads');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

ensureDirs();

module.exports = {
  isServerless,
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  PUBLIC_DIR,
  BUNDLED_UPLOADS,
  ensureDirs,
};
