'use strict';

/** express-session store using the project's sqlite adapter (better-sqlite3 or sql.js). */
module.exports = function sqlSessionStore(session) {
  const Store = session.Store;

  class SqlSessionStore extends Store {
    constructor(options = {}) {
      super(options);
      this.client = options.client;
      this.expired = options.expired || {};
      this.client.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expired INTEGER NOT NULL
        )
      `);
      if (this.expired.clear) {
        const interval = this.expired.intervalMs || 15 * 60 * 1000;
        this._timer = setInterval(() => {
          try {
            this.client.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
          } catch (_) { /* ignore */ }
        }, interval);
        if (typeof this._timer.unref === 'function') this._timer.unref();
      }
    }

    get(sid, cb) {
      try {
        const row = this.client
          .prepare('SELECT sess FROM sessions WHERE sid = ? AND expired >= ?')
          .get(sid, Date.now());
        if (!row) return cb(null, null);
        cb(null, JSON.parse(row.sess));
      } catch (err) {
        cb(err);
      }
    }

    set(sid, sess, cb) {
      try {
        const maxAge = sess && sess.cookie && sess.cookie.maxAge;
        const expires = sess && sess.cookie && sess.cookie.expires;
        const expired = expires
          ? new Date(expires).getTime()
          : Date.now() + (Number(maxAge) || 86400000);
        this.client.prepare(`
          INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
        `).run(sid, JSON.stringify(sess), expired);
        cb(null);
      } catch (err) {
        cb(err);
      }
    }

    destroy(sid, cb) {
      try {
        this.client.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        cb(null);
      } catch (err) {
        cb(err);
      }
    }

    touch(sid, sess, cb) {
      this.set(sid, sess, cb);
    }
  }

  return SqlSessionStore;
};
