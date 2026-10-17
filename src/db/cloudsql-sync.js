"use strict";
const { Pool } = require("pg");

const TABLES = [
  { name: "pumps", pk: ["id"], hasSeq: true },
  { name: "users", pk: ["id"], hasSeq: true },
  { name: "sessions", pk: ["token"] },
  { name: "state", pk: ["id"] },
  { name: "sections", pk: ["pump_id", "name"] },
  { name: "days", pk: ["pump_id", "d"] },
  { name: "credit_sales", pk: ["id"], hasSeq: true },
  { name: "audit", pk: ["id"], hasSeq: true },
  { name: "duties", pk: ["id"], hasSeq: true },
  { name: "duty_lines", pk: ["id"], hasSeq: true },
  { name: "duty_items", pk: ["id"], hasSeq: true },
  { name: "duty_expenses", pk: ["id"], hasSeq: true },
  { name: "dips", pk: ["id"], hasSeq: true },
  { name: "pay_rates", pk: ["pump_id", "worker_id", "shift"] },
  { name: "pay_items", pk: ["id"], hasSeq: true },
  { name: "density_register", pk: ["id"], hasSeq: true },
];

let pool = null;
let syncTimer = null;
let isSyncing = false;
let pendingSync = false;

function getPool() {
  if (!pool && process.env.SQL_HOST && process.env.SQL_USER) {
    pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });
    pool.on("error", (err) => {
      console.error("[cloudsql] Pool client error:", err.message);
    });
  }
  return pool;
}

async function initCloudSync(compatDb) {
  const p = getPool();
  if (!p) {
    console.log("[cloudsql] Cloud SQL not configured, using local storage");
    return;
  }

  try {
    const client = await p.connect();
    try {
      // Check if Cloud SQL already contains data
      const checkRes = await client.query("SELECT (SELECT count(*) FROM users) as u_cnt, (SELECT count(*) FROM state) as s_cnt");
      const hasCloudData = (+checkRes.rows[0].u_cnt > 0) || (+checkRes.rows[0].s_cnt > 0);

      if (hasCloudData) {
        console.log("[cloudsql] Found existing data in Cloud SQL. Hydrating local cache...");
        compatDb.inTransaction++;
        try {
          for (const t of TABLES) {
            const res = await client.query(`SELECT * FROM "${t.name}"`);
            compatDb.sqlDb.run(`DELETE FROM ${t.name}`);
            if (res.rows.length > 0) {
              for (const row of res.rows) {
                const cols = Object.keys(row);
                const placeholders = cols.map(() => "?").join(",");
                const vals = cols.map(c => row[c]);
                compatDb.prepare(`INSERT INTO ${t.name} (${cols.join(",")}) VALUES (${placeholders})`).run(...vals);
              }
            }
          }
          compatDb.saveImmediate();
        } finally {
          compatDb.inTransaction--;
        }
        console.log("[cloudsql] Hydration complete from Cloud SQL.");
      } else {
        // Cloud SQL is empty, push local data to Cloud SQL
        console.log("[cloudsql] Cloud SQL is fresh. Pushing initial local data to Cloud SQL...");
        await pushDataToCloudSql(compatDb, client);
        console.log("[cloudsql] Initial data push to Cloud SQL complete.");
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[cloudsql] Initialization error:", err.message);
  }
}

async function pushDataToCloudSql(compatDb, client) {
  await client.query("BEGIN");
  try {
    for (const t of TABLES) {
      let rows = [];
      try {
        rows = compatDb.prepare(`SELECT * FROM ${t.name}`).all();
      } catch (e) {
        continue;
      }

      await client.query(`DELETE FROM "${t.name}"`);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const cols = Object.keys(row);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
          const vals = cols.map(c => row[c]);
          await client.query(`INSERT INTO "${t.name}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${placeholders})`, vals);
        }
      }

      if (t.hasSeq) {
        try {
          await client.query(`SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), COALESCE((SELECT MAX(id) FROM "${t.name}"), 1))`);
        } catch (seqErr) {}
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

function scheduleSync(compatDb) {
  if (!getPool()) return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    if (isSyncing) {
      pendingSync = true;
      return;
    }
    isSyncing = true;
    try {
      const client = await pool.connect();
      try {
        await pushDataToCloudSql(compatDb, client);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("[cloudsql] Sync error:", err.message);
    } finally {
      isSyncing = false;
      if (pendingSync) {
        pendingSync = false;
        scheduleSync(compatDb);
      }
    }
  }, 100);
}

module.exports = {
  getPool,
  initCloudSync,
  scheduleSync,
};
