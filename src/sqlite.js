'use strict';

const fs = require('fs');
const path = require('path');
const { isServerless } = require('./runtime-paths');

let sqlJsModule = null;
let sqlJsReady = null;

function findWasmPath() {
  const file = 'sql-wasm.wasm';
  const fromResolve = [];
  try {
    const entry = require.resolve('sql.js');
    fromResolve.push(path.join(path.dirname(entry), 'sql-wasm.wasm'));
    fromResolve.push(path.join(path.dirname(entry), 'dist', file));
  } catch (_) { /* not installed yet */ }

  const candidates = [
    ...fromResolve,
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, 'node_modules', 'sql.js', 'dist', file)
      : null,
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, file)
      : null,
    path.join(__dirname, file),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function ensureReady() {
  if (!isServerless) return Promise.resolve();
  if (sqlJsModule) return Promise.resolve();
  if (sqlJsReady) return sqlJsReady;

  sqlJsReady = (async () => {
    const initSqlJs = require('sql.js');
    const wasmPath = findWasmPath();
    if (!wasmPath || !fs.existsSync(wasmPath)) {
      throw new Error(`[sqlite] sql-wasm.wasm introuvable (cherché: ${wasmPath})`);
    }
    const wasmBinary = new Uint8Array(fs.readFileSync(wasmPath));
    sqlJsModule = await initSqlJs({ wasmBinary });
  })();

  return sqlJsReady;
}

function isPlainObject(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && !Buffer.isBuffer(value)
    && !(value instanceof Date)
  );
}

function normalizeSql(sql) {
  return String(sql).replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, ':$1');
}

function applyBind(stmt, sql, args) {
  if (!args.length) return;
  if (args.length === 1 && isPlainObject(args[0])) {
    const obj = args[0];
    const names = [...sql.matchAll(/[:@$]([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
    const bind = {};
    for (const name of new Set(names)) {
      const raw = Object.prototype.hasOwnProperty.call(obj, name)
        ? obj[name]
        : (obj[`@${name}`] ?? obj[`:${name}`] ?? obj[`$${name}`]);
      bind[`:${name}`] = raw === undefined ? null : raw;
    }
    stmt.bind(bind);
    return;
  }
  stmt.bind(args.map((v) => (v === undefined ? null : v)));
}

function lastInsertRowid(native) {
  const result = native.exec('SELECT last_insert_rowid() AS id');
  if (!result.length || !result[0].values.length) return 0;
  return Number(result[0].values[0][0] || 0);
}

class SqlJsStatement {
  constructor(adapter, sql) {
    this._adapter = adapter;
    this._sql = normalizeSql(sql);
  }

  get(...args) {
    const stmt = this._adapter._native.prepare(this._sql);
    try {
      applyBind(stmt, this._sql, args);
      if (!stmt.step()) return undefined;
      return stmt.getAsObject();
    } finally {
      stmt.free();
    }
  }

  all(...args) {
    const stmt = this._adapter._native.prepare(this._sql);
    try {
      applyBind(stmt, this._sql, args);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...args) {
    const stmt = this._adapter._native.prepare(this._sql);
    try {
      applyBind(stmt, this._sql, args);
      stmt.step();
      const changes = this._adapter._native.getRowsModified();
      const rowid = lastInsertRowid(this._adapter._native);
      if (!this._adapter._txDepth) this._adapter._save();
      return { changes, lastInsertRowid: rowid };
    } finally {
      stmt.free();
    }
  }
}

class SqlJsDatabase {
  constructor(filename) {
    if (!sqlJsModule) {
      throw new Error('[sqlite] sql.js n’est pas initialisé. Appelez ensureReady() avant openSqlite().');
    }
    this._filename = filename;
    this._txDepth = 0;
    const buf = filename && fs.existsSync(filename) ? fs.readFileSync(filename) : null;
    this._native = buf && buf.length
      ? new sqlJsModule.Database(buf)
      : new sqlJsModule.Database();
  }

  _save() {
    if (!this._filename) return;
    fs.mkdirSync(path.dirname(this._filename), { recursive: true });
    const data = this._native.export();
    fs.writeFileSync(this._filename, Buffer.from(data));
  }

  prepare(sql) {
    return new SqlJsStatement(this, sql);
  }

  exec(sql) {
    this._native.exec(sql);
    if (!this._txDepth) this._save();
    return this;
  }

  pragma(source) {
    const sql = String(source || '').trim();
    if (/wal_checkpoint/i.test(sql)) {
      this._save();
      return [{ wal_checkpoint: 'ok' }];
    }
    if (/^journal_mode\b/i.test(sql)) {
      return [{ journal_mode: 'memory' }];
    }
    try {
      this._native.exec(`PRAGMA ${sql}`);
      if (/=/.test(sql)) return [];
      return this.prepare(`PRAGMA ${sql}`).all();
    } catch (_) {
      return [];
    }
  }

  transaction(fn) {
    return (...args) => {
      this._txDepth += 1;
      this._native.exec('BEGIN');
      try {
        const result = fn(...args);
        this._native.exec('COMMIT');
        this._txDepth -= 1;
        this._save();
        return result;
      } catch (err) {
        try { this._native.exec('ROLLBACK'); } catch (_) { /* ignore */ }
        this._txDepth -= 1;
        throw err;
      }
    };
  }
}

function openSqlite(filename) {
  if (isServerless) return new SqlJsDatabase(filename);
  const BetterSqlite3 = require('better-sqlite3');
  return new BetterSqlite3(filename);
}

module.exports = { openSqlite, ensureReady, isServerless };
