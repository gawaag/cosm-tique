'use strict';

const fs = require('fs');
const path = require('path');
const { isServerless, DATA_DIR, UPLOAD_DIR, ensureDirs } = require('./runtime-paths');

const DB_FILES = ['app.db', 'sessions.db'];

function blobStore(name) {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name, consistency: 'strong' });
}

async function hydrateFromBlobs() {
  if (!isServerless) return;
  ensureDirs();
  try {
    const dbStore = blobStore('shop-sqlite');
    for (const name of DB_FILES) {
      const buf = await dbStore.get(name, { type: 'arrayBuffer' });
      if (buf && buf.byteLength) {
        fs.writeFileSync(path.join(DATA_DIR, name), Buffer.from(buf));
        console.log(`[netlify] restored ${name} (${buf.byteLength} bytes)`);
      }
    }
  } catch (err) {
    console.warn('[netlify] sqlite blob hydrate skipped:', err.message);
  }

  try {
    const uploadStore = blobStore('shop-uploads');
    const listed = await uploadStore.list();
    const blobs = listed && listed.blobs ? listed.blobs : [];
    for (const item of blobs) {
      const key = item.key || item;
      if (!key || String(key).includes('..') || String(key).includes('/') || String(key).includes('\\')) continue;
      const buf = await uploadStore.get(key, { type: 'arrayBuffer' });
      if (buf && buf.byteLength) {
        fs.writeFileSync(path.join(UPLOAD_DIR, key), Buffer.from(buf));
      }
    }
  } catch (err) {
    console.warn('[netlify] uploads blob hydrate skipped:', err.message);
  }
}

async function persistToBlobs() {
  if (!isServerless) return;
  try {
    try {
      const { db } = require('./db');
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) { /* db not open yet */ }

    const dbStore = blobStore('shop-sqlite');
    for (const name of DB_FILES) {
      const file = path.join(DATA_DIR, name);
      if (!fs.existsSync(file)) continue;
      await dbStore.set(name, fs.readFileSync(file));
    }
  } catch (err) {
    console.warn('[netlify] sqlite blob persist skipped:', err.message);
  }

  try {
    const uploadStore = blobStore('shop-uploads');
    const names = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const file = path.join(UPLOAD_DIR, name);
      if (!fs.statSync(file).isFile()) continue;
      await uploadStore.set(name, fs.readFileSync(file));
    }
  } catch (err) {
    console.warn('[netlify] uploads blob persist skipped:', err.message);
  }
}

module.exports = { hydrateFromBlobs, persistToBlobs };
