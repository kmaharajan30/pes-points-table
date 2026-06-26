/**
 * A synchronous SQLite wrapper using sql.js that mimics the better-sqlite3 API.
 * sql.js is a pure JavaScript SQLite implementation (compiled from C via Emscripten)
 * so it requires NO native compilation, Python, or Visual Studio Build Tools.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class DatabaseWrapper {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._ready = false;
    this._saveTimer = null;
  }

  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this._ready = true;
    this.db.run('PRAGMA foreign_keys = ON');
  }

  _save() {
    // Debounce saves — write at most once per 100ms to avoid excessive I/O
    // but also do an immediate write to ensure persistence
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  pragma(str) {
    if (str === 'journal_mode = WAL') return;
    if (str === 'foreign_keys = ON') {
      this.db.run('PRAGMA foreign_keys = ON');
    }
  }

  exec(sql) {
    // sql.js db.run() only executes the FIRST statement in multi-statement SQL.
    // We must use db.exec() which handles multiple statements properly.
    this.db.exec(sql);
    this._save();
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.db.run(sql, params);
        self._save();
        return { changes: self.db.getRowsModified() };
      },
      get(...params) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  transaction(fn) {
    const self = this;
    return function(...args) {
      self.db.run('BEGIN TRANSACTION');
      try {
        fn(...args);
        self.db.run('COMMIT');
        self._save();
      } catch (e) {
        self.db.run('ROLLBACK');
        throw e;
      }
    };
  }
}

module.exports = DatabaseWrapper;
