"use strict";
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

function normalizeParam(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function normalizeParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0].map(normalizeParam);
  }
  return args.map(normalizeParam);
}

class CompatDatabase {
  constructor(SQL, filePath, buffer) {
    this.SQL = SQL;
    this.filePath = filePath;
    this.sqlDb = buffer ? new SQL.Database(buffer) : new SQL.Database();
    this.inTransaction = 0;
    this.spCounter = 0;
    this.saveTimeout = null;
  }

  saveImmediate() {
    if (!this.filePath) return;
    try {
      const data = this.sqlDb.export();
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, Buffer.from(data));
    } catch (err) {
      console.error("[sqlite-compat] Failed to save database to disk:", err.message);
    }
  }

  save() {
    if (this.inTransaction > 0) return;
    this.saveImmediate();
    if (this.cloudSync) {
      this.cloudSync.scheduleSync(this);
    }
  }

  pragma(str) {
    try {
      return this.sqlDb.exec("pragma " + str);
    } catch (e) {
      // Ignore pragmas that are not supported in in-memory SQLite (like journal_mode = WAL)
      return [];
    }
  }

  exec(sql) {
    const res = this.sqlDb.exec(sql);
    this.save();
    return res;
  }

  prepare(sql) {
    const self = this;
    const trimmed = sql.trim();

    return {
      all(...args) {
        const params = normalizeParams(args);
        let stmt;
        try {
          stmt = self.sqlDb.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          if (stmt) stmt.free();
        }
      },

      get(...args) {
        const params = normalizeParams(args);
        let stmt;
        try {
          stmt = self.sqlDb.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          if (stmt) stmt.free();
        }
      },

      run(...args) {
        const params = normalizeParams(args);
        let stmt;
        try {
          stmt = self.sqlDb.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
        } finally {
          if (stmt) stmt.free();
        }

        let lastInsertRowid = 0;
        let changes = 0;
        try {
          const idRes = self.sqlDb.exec("select last_insert_rowid() as id");
          if (idRes.length && idRes[0].values.length) {
            lastInsertRowid = idRes[0].values[0][0];
          }
          const chRes = self.sqlDb.exec("select changes() as c");
          if (chRes.length && chRes[0].values.length) {
            changes = chRes[0].values[0][0];
          }
        } catch (e) {}

        self.save();
        return { changes, lastInsertRowid };
      }
    };
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self.inTransaction++;
      const sp = "sp_" + (++self.spCounter);
      self.sqlDb.run("SAVEPOINT " + sp);
      try {
        const res = fn(...args);
        self.sqlDb.run("RELEASE " + sp);
        self.inTransaction--;
        if (self.inTransaction === 0) {
          self.save();
        }
        return res;
      } catch (err) {
        try {
          self.sqlDb.run("ROLLBACK TO " + sp);
          self.sqlDb.run("RELEASE " + sp);
        } catch (e) {}
        self.inTransaction--;
        throw err;
      }
    };
  }

  async backup(destPath) {
    const data = this.sqlDb.export();
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, Buffer.from(data));
  }

  restoreFromFile(sourcePath, tables) {
    if (!fs.existsSync(sourcePath)) throw new Error("File not found: " + sourcePath);
    const buf = fs.readFileSync(sourcePath);
    const bkDb = new this.SQL.Database(buf);
    
    // Copy tables from bkDb into this.sqlDb
    this.inTransaction++;
    const sp = "sp_" + (++this.spCounter);
    this.sqlDb.run("SAVEPOINT " + sp);
    try {
      for (const t of tables) {
        const masterRes = bkDb.exec("select 1 from sqlite_master where type='table' and name='" + t + "'");
        this.sqlDb.run("delete from " + t);
        if (!masterRes.length) continue;
        
        const dumpRes = bkDb.exec("select * from " + t);
        if (!dumpRes.length) continue;
        
        const { columns, values } = dumpRes[0];
        const placeholders = columns.map(() => "?").join(",");
        const insertSql = `insert into ${t}(${columns.join(",")}) values(${placeholders})`;
        for (const row of values) {
          this.prepare(insertSql).run(row);
        }
      }
      this.sqlDb.run("delete from sessions");
      this.sqlDb.run("RELEASE " + sp);
      this.inTransaction--;
      this.save();
    } catch (err) {
      this.sqlDb.run("ROLLBACK TO " + sp);
      this.sqlDb.run("RELEASE " + sp);
      this.inTransaction--;
      throw err;
    } finally {
      bkDb.close();
    }
  }
}

async function createDatabase(filePath) {
  const SQL = await initSqlJs();
  let buffer = null;
  if (filePath && fs.existsSync(filePath)) {
    try {
      buffer = fs.readFileSync(filePath);
    } catch (e) {
      console.warn("[sqlite-compat] Could not read existing DB, creating new:", e.message);
    }
  }
  const db = new CompatDatabase(SQL, filePath, buffer);
  try {
    const cloudSync = require("./src/db/cloudsql-sync");
    db.cloudSync = cloudSync;
  } catch (e) {
    console.warn("[sqlite-compat] Cloud SQL sync disabled:", e.message);
  }
  return db;
}

module.exports = {
  createDatabase,
};
