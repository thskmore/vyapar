"use strict";
require("dotenv").config();
const express = require("express");
const { createDatabase } = require("./sqlite-compat");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const TZ = process.env.TZ_NAME || "Asia/Kolkata";
let db;

async function initDb() {
  db = await createDatabase(process.env.DB_PATH || path.join(__dirname, "data.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
  create table if not exists pumps(
    id integer primary key autoincrement,
    name text not null,
    code text unique,
    owner_id integer,
    created_at integer not null
  );
  create table if not exists users(
    id integer primary key, pump_id integer not null default 1, name text not null, mobile text not null,
    hash text, role text not null check(role in ('owner','manager','worker')),
    active integer not null default 1, lang text not null default 'en', uid text);
  create table if not exists sessions(token text primary key, user_id integer not null, exp integer not null);
  create table if not exists state(id integer primary key check(id = 1), ver integer not null, json text not null);
  create table if not exists credit_sales(
    id integer primary key, pump_id integer not null default 1, cust_id text not null, d text not null, n text not null,
    a real not null, veh text, worker_id integer not null, created integer not null,
    status text not null default 'ok', fuel text, litres real);
  create table if not exists sections(pump_id integer not null default 1, name text not null, ver integer not null, json text not null, primary key(pump_id, name));
  create table if not exists audit(id integer primary key, pump_id integer not null default 1, t integer not null, user_id integer, user_name text, action text not null, detail text);
  create table if not exists duties(
    id integer primary key, pump_id integer not null default 1, worker_id integer not null, d text not null, shift text not null,
    status text not null default 'open', cash real not null default 0, upi real not null default 0,
    card real not null default 0, note text, started integer not null, submitted integer,
    closed_by integer, closed_at integer, pay_json text, stock_done integer not null default 0, assigned_by integer);
  create table if not exists duty_lines(
    id integer primary key, duty_id integer not null, nozzle_id text not null,
    opening real, closing real, testing real not null default 0, rate real);
  create table if not exists duty_items(
    id integer primary key, duty_id integer not null, item_id text not null, name text not null, qty real not null, price real not null);
  create table if not exists duty_expenses(
    id integer primary key, duty_id integer not null, cat text not null, note text, amount real not null);
  create table if not exists days(
    pump_id integer not null default 1, d text not null, status text not null, closed_by integer, closed_at integer, approved_by integer, approved_at integer, primary key(pump_id, d));
  create table if not exists dips(
    id integer primary key, pump_id integer not null default 1, tank_id text not null, litres real not null, dip real,
    note text, user_id integer not null, t integer not null, dens_obs real, temp real, d15 real);
  create table if not exists pay_rates(pump_id integer not null default 1, worker_id integer not null, shift text not null, rate real not null, primary key(pump_id, worker_id, shift));
  create table if not exists pay_items(
    id integer primary key, pump_id integer not null default 1, worker_id integer not null, month text not null,
    kind text not null check(kind in ('advance','bonus','waive','paid')),
    amount real not null, note text, d text not null, created integer not null);
  create table if not exists density_register(
    id integer primary key,
    pump_id integer not null default 1,
    tank_id text not null,
    d text not null,
    t integer not null,
    m_obs real,
    m_temp real,
    m_d15 real,
    comp1 real,
    comp2 real,
    comp3 real,
    comp4 real,
    mix_dens real,
    chalan_dens real,
    dens_diff real,
    pre_dip real,
    pre_stock real,
    post_dens real,
    receipt_kl real,
    chalan_no text,
    user_id integer,
    by_name text);
  create table if not exists bank_deposits(
    id integer primary key autoincrement,
    pump_id integer not null default 1,
    d text not null,
    amount real not null,
    bank_name text,
    slip_no text,
    deposited_by text,
    note text,
    created_at integer not null,
    user_id integer
  );
  create table if not exists cash_flow_days(
    pump_id integer not null default 1,
    d text not null,
    opening_cash real,
    opening_manual integer not null default 0,
    closing_cash real,
    notes text,
    primary key(pump_id, d)
  );
  create table if not exists meter_readings(
    id integer primary key autoincrement,
    pump_id integer not null default 1,
    d text not null,
    nozzle_id text not null,
    closing real not null,
    testing real not null default 0,
    user_id integer,
    updated_at integer not null,
    unique(pump_id, d, nozzle_id)
  );
  `);

  const addCol = (t, c, def) => {
    try {
      if (!db.prepare(`pragma table_info(${t})`).all().some((x) => x.name === c))
        db.exec(`alter table ${t} add column ${c} ${def}`);
    } catch (e) {}
  };
  addCol("users", "pump_id", "integer not null default 1");
  addCol("users", "lang", "text not null default 'en'");
  addCol("users", "uid", "text");
  addCol("credit_sales", "pump_id", "integer not null default 1");
  addCol("credit_sales", "status", "text not null default 'ok'");
  addCol("credit_sales", "fuel", "text");
  addCol("credit_sales", "litres", "real");
  addCol("audit", "pump_id", "integer not null default 1");
  addCol("duties", "pump_id", "integer not null default 1");
  addCol("duties", "pay_json", "text");
  addCol("duties", "stock_done", "integer not null default 0");
  addCol("duties", "assigned_by", "integer");
  addCol("dips", "pump_id", "integer not null default 1");
  addCol("dips", "dens_obs", "real");
  addCol("dips", "temp", "real");
  addCol("dips", "d15", "real");
  addCol("pay_items", "pump_id", "integer not null default 1");
  addCol("density_register", "pump_id", "integer not null default 1");
  addCol("bank_deposits", "pump_id", "integer not null default 1");
  addCol("cash_flow_days", "pump_id", "integer not null default 1");
  addCol("meter_readings", "pump_id", "integer not null default 1");

  // Migrate composite PK tables in SQLite if they lacked pump_id in PK
  try {
    const sCols = db.prepare("pragma table_info(sections)").all().map((x) => x.name);
    if (!sCols.includes("pump_id")) {
      db.exec(`
        create table sections_new(pump_id integer not null default 1, name text not null, ver integer not null, json text not null, primary key(pump_id, name));
        insert into sections_new(pump_id, name, ver, json) select 1, name, ver, json from sections;
        drop table sections;
        alter table sections_new rename to sections;
      `);
    }
  } catch (e) {}

  try {
    const dCols = db.prepare("pragma table_info(days)").all().map((x) => x.name);
    if (!dCols.includes("pump_id")) {
      db.exec(`
        create table days_new(pump_id integer not null default 1, d text not null, status text not null, closed_by integer, closed_at integer, approved_by integer, approved_at integer, primary key(pump_id, d));
        insert into days_new(pump_id, d, status, closed_by, closed_at, approved_by, approved_at) select 1, d, status, closed_by, closed_at, approved_by, approved_at from days;
        drop table days;
        alter table days_new rename to days;
      `);
    }
  } catch (e) {}

  try {
    const pCols = db.prepare("pragma table_info(pay_rates)").all().map((x) => x.name);
    if (!pCols.includes("pump_id")) {
      db.exec(`
        create table pay_rates_new(pump_id integer not null default 1, worker_id integer not null, shift text not null, rate real not null, primary key(pump_id, worker_id, shift));
        insert into pay_rates_new(pump_id, worker_id, shift, rate) select 1, worker_id, shift, rate from pay_rates;
        drop table pay_rates;
        alter table pay_rates_new rename to pay_rates;
      `);
    }
  } catch (e) {}

  // Ensure default pump exists
  try {
    const pCount = db.prepare("select count(*) n from pumps").get().n;
    if (pCount === 0) {
      db.prepare("insert into pumps(id, name, code, owner_id, created_at) values(1, 'Main Station', 'PUMP-001', 1, ?)").run(now());
    }
  } catch (e) {}

  // Fix any null or 0 pump_id in existing data
  try {
    db.exec(`
      update users set pump_id=1 where pump_id is null or pump_id=0;
      update credit_sales set pump_id=1 where pump_id is null or pump_id=0;
      update audit set pump_id=1 where pump_id is null or pump_id=0;
      update duties set pump_id=1 where pump_id is null or pump_id=0;
      update dips set pump_id=1 where pump_id is null or pump_id=0;
      update pay_items set pump_id=1 where pump_id is null or pump_id=0;
      update density_register set pump_id=1 where pump_id is null or pump_id=0;
    `);
  } catch (e) {}

  migrateOldState();
  if (db.cloudSync) {
    await db.cloudSync.initCloudSync(db);
  }
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((q, s, n) => {
  s.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com data: blob:; connect-src 'self' *; frame-ancestors *",
  });
  n();
});
app.use(express.json({ limit: "5mb" }));
// CSRF guard: every state-changing call must carry a custom header a cross-site form cannot send.
app.use((q, s, n) => {
  if (q.method !== "GET" && q.method !== "HEAD" && q.get("x-app") !== "1") return s.status(403).json({ error: "Forbidden." });
  n();
});
// Every successful change is recorded, with who did it (AUD is defined further down).
app.use((q, s, n) => {
  if (q.method !== "GET") s.on("finish", () => {
    const f = AUD[q.method + " " + (q.route && q.route.path)];
    if (f && s.statusCode < 400 && q.user) audit(q.user, "action", f(q));
  });
  n();
});


const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const hs = (t) => crypto.createHash("sha256").update(t).digest("hex");
const mob = (x) => String(x || "").replace(/\D/g, "").slice(-10);
const pub = (u) => ({
  id: u.id,
  name: u.name,
  mobile: u.mobile,
  role: u.role,
  lang: u.lang || "en",
  pump_id: u.pump_id || 1,
  pump_name: u.pump_name || "Petrol Pump",
  pump_code: u.pump_code || "PUMP-001"
});
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const usersCount = () => db.prepare("select count(*) n from users").get().n;

function cookie(q, k) {
  const m = (q.headers.cookie || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(k + "="));
  return m ? decodeURIComponent(m.slice(k.length + 1)) : null;
}
function getUser(q) {
  let t = cookie(q, "sid");
  if (!t && q.headers.authorization && q.headers.authorization.startsWith("Bearer ")) {
    t = q.headers.authorization.slice(7).trim();
  }
  if (!t) return null;
  const r = db.prepare(`
    select u.id, u.name, u.mobile, u.role, u.lang, u.active, u.pump_id,
           coalesce(p.name, 'Station #' || u.pump_id) as pump_name,
           coalesce(p.code, 'PUMP-' || u.pump_id) as pump_code,
           s.exp
    from sessions s
    join users u on u.id = s.user_id
    left join pumps p on p.id = u.pump_id
    where s.token = ?
  `).get(hs(t));
  if (r && r.active && r.exp >= now()) {
    r.pump_id = r.pump_id || 1;
    return r;
  }
  return null;
}
const need = (...roles) => (q, s, n) => {
  const u = getUser(q);
  if (!u) return s.status(401).json({ error: "Please log in." });
  if (roles.length && !roles.includes(u.role)) return s.status(403).json({ error: "You do not have access to this." });
  q.user = u;
  n();
};
function startSession(q, s, uid) {
  const t = crypto.randomBytes(32).toString("hex");
  db.prepare("insert into sessions values(?,?,?)").run(hs(t), uid, now() + 7 * DAY);
  s.setHeader("Set-Cookie", `sid=${t}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${7 * DAY}`);
  return t;
}
function checkUser(name, m, pw) {
  if (!String(name || "").trim() || String(name).length > 60) return "Enter a name (up to 60 characters).";
  if (m.length !== 10) return "Enter a 10-digit mobile number.";
  if (typeof pw !== "string" || pw.length < 6 || pw.length > 100) return "Password must be at least 6 characters.";
  return null;
}

// Login throttle: 5 wrong tries per IP + mobile locks that pair for 15 minutes.
const fails = new Map();
const blocked = (k) => { const f = fails.get(k); return f && f.n >= 5 && Date.now() - f.t < 15 * 60e3; };
const addFail = (k) => { const f = fails.get(k) || { n: 0, t: 0 }; f.n = Date.now() - f.t > 15 * 60e3 ? 1 : f.n + 1; f.t = Date.now(); fails.set(k, f); };

let adminAuth = null;
function getAdminAuth() {
  if (!adminAuth) {
    try {
      const { initializeApp, getApps } = require("firebase-admin/app");
      const { getAuth } = require("firebase-admin/auth");
      const cfg = require("./firebase-applet-config.json");
      if (!getApps().length) {
        initializeApp({ projectId: cfg.projectId });
      }
      adminAuth = getAuth();
    } catch (e) {
      console.warn("[firebase-admin] initialization error:", e.message);
    }
  }
  return adminAuth;
}

app.get("/api/firebase-config", (q, s) => {
  try {
    const cfg = require("./firebase-applet-config.json");
    s.json({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId,
    });
  } catch (e) {
    s.status(404).json({ error: "Firebase config not found" });
  }
});

function initPumpSections(pumpId, pumpName) {
  const pName = pumpName || "Fuel Station";
  const defaults = {
    c: { c: [] },
    inv: { inv: [] },
    items: {
      items: [
        { id: 1, name: "2T Engine Oil 500ml", unit: "piece", sell: 180, buy: 140, stock: 24, low: 5, cat: "Engine oil", gst: 18, hsn: "2710" },
        { id: 2, name: "4T Plus 1L", unit: "piece", sell: 390, buy: 310, stock: 18, low: 4, cat: "Engine oil", gst: 18, hsn: "2710" },
        { id: 3, name: "Coolant Premix 1L", unit: "piece", sell: 220, buy: 165, stock: 12, low: 3, cat: "Coolant", gst: 18, hsn: "3820" },
      ],
      itemcats: ["Engine oil", "Coolant", "Grease", "Distilled Water", "Shop"]
    },
    sup: { sup: [] },
    bk: { bk: [], ob: { Cash: 0, Bank: 0, UPI: 0 } },
    biz: { biz: { name: pName, addr: "", gst: "" } },
    tanks: {
      tanks: [
        { id: 1, name: "Tank 1 (MS)", fuel: "Petrol (MS)", capacity: 20000, chart: [{ cm: 0, l: 0 }, { cm: 100, l: 9500 }, { cm: 200, l: 20000 }] },
        { id: 2, name: "Tank 2 (HSD)", fuel: "Diesel (HSD)", capacity: 25000, chart: [{ cm: 0, l: 0 }, { cm: 100, l: 12000 }, { cm: 200, l: 25000 }] }
      ],
      deliv: []
    },
    setup: {
      nozzles: [
        { id: 1, name: "MS Nozzle 1", fuel: "Petrol (MS)", tank_id: 1, open: 1000, active: true },
        { id: 2, name: "MS Nozzle 2", fuel: "Petrol (MS)", tank_id: 1, open: 1000, active: true },
        { id: 3, name: "HSD Nozzle 1", fuel: "Diesel (HSD)", tank_id: 2, open: 1000, active: true },
        { id: 4, name: "HSD Nozzle 2", fuel: "Diesel (HSD)", tank_id: 2, open: 1000, active: true }
      ],
      rates: [
        { id: 1, fuel: "Petrol (MS)", rate: 104.5, from: "2020-01-01" },
        { id: 2, fuel: "Diesel (HSD)", rate: 92.5, from: "2020-01-01" }
      ],
      expcats: ["Tea and food", "Repairs", "Electricity", "Transport", "Staff welfare", "Stationery", "Other"],
      paymodes: [
        { key: "cash", name: "Cash", active: true },
        { key: "upi", name: "UPI", active: true },
        { key: "card", name: "Card", active: true }
      ],
      fuelprods: [
        { name: "Petrol (MS)", unit: "L", dmin: 0.72, dmax: 0.775, dtol: 0.003 },
        { name: "Diesel (HSD)", unit: "L", dmin: 0.82, dmax: 0.86, dtol: 0.003 }
      ]
    }
  };

  for (const [secName, secObj] of Object.entries(defaults)) {
    writeSection(pumpId, secName, secObj);
  }
}

app.post("/api/auth/google", async (q, s) => {
  const { idToken } = q.body || {};
  if (!idToken) return s.status(400).json({ error: "Missing ID token." });
  const auth = getAdminAuth();
  if (!auth) return s.status(500).json({ error: "Authentication service unavailable." });

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";
    const name = decoded.name || (email ? email.split("@")[0] : "Google User");

    let u = db.prepare(`
      select u.id, u.name, u.mobile, u.role, u.lang, u.active, u.pump_id,
             coalesce(p.name, 'Station #' || u.pump_id) as pump_name,
             coalesce(p.code, 'PUMP-' || u.pump_id) as pump_code
      from users u
      left join pumps p on p.id = u.pump_id
      where u.uid = ?
    `).get(uid);

    if (!u) {
      // New SaaS customer onboarding via Google: create dedicated pump tenant
      const pName = `${name}'s Station`;
      const pCode = "PUMP-" + Math.floor(1000 + Math.random() * 9000);
      const pumpId = db.prepare("insert into pumps(name, code, created_at) values(?,?,?)").run(pName, pCode, now()).lastInsertRowid;
      const id = db.prepare("insert into users(uid, pump_id, name, mobile, role, active, lang) values(?,?,?,?,?,1,'en')")
        .run(uid, pumpId, name, "", "owner").lastInsertRowid;
      db.prepare("update pumps set owner_id=? where id=?").run(id, pumpId);
      initPumpSections(pumpId, pName);
      u = db.prepare(`
        select u.id, u.name, u.mobile, u.role, u.lang, u.active, u.pump_id,
               coalesce(p.name, 'Station #' || u.pump_id) as pump_name,
               coalesce(p.code, 'PUMP-' || u.pump_id) as pump_code
        from users u
        left join pumps p on p.id = u.pump_id
        where u.id = ?
      `).get(id);
    }

    if (!u.active) return s.status(403).json({ error: "Account deactivated." });

    const token = startSession(q, s, u.id);
    audit(u, "login", "Logged in via Google");
    s.json({ user: pub(u), token });
  } catch (err) {
    console.error("Google Auth verification failed:", err.message);
    s.status(401).json({ error: "Invalid Google token." });
  }
});

app.get("/api/me", (q, s) => {
  const u = getUser(q);
  s.json({ user: u ? pub(u) : null, setup: usersCount() === 0, biz: bizDate() });
});

// SaaS registration: creates an isolated pump station tenant and owner account
app.post(["/api/signup", "/api/register", "/api/setup"], (q, s) => {
  const { name, mobile, password, pump_name, pump_code } = q.body || {};
  const m = mob(mobile);
  const e = checkUser(name, m, password);
  if (e) return s.status(400).json({ error: e });

  const pName = String(pump_name || "").trim().slice(0, 80) || `${String(name).trim()}'s Station`;
  let pCode = String(pump_code || "").trim().toUpperCase().slice(0, 20);
  if (!pCode) {
    pCode = "PUMP-" + Math.floor(100 + Math.random() * 900);
  }
  if (db.prepare("select 1 from pumps where code=?").get(pCode)) {
    pCode = "PUMP-" + Math.floor(1000 + Math.random() * 9000);
  }

  // If mobile already registered as owner, suggest login
  const existing = db.prepare("select * from users where mobile=? and role='owner'").get(m);
  if (existing) {
    return s.status(409).json({ error: "An owner account with this mobile number already exists. Please log in." });
  }

  const pumpId = db.prepare("insert into pumps(name, code, created_at) values(?,?,?)").run(pName, pCode, now()).lastInsertRowid;
  const userId = db.prepare("insert into users(pump_id, name, mobile, hash, role, active, lang) values(?,?,?,?,?,1,'en')")
    .run(pumpId, String(name).trim(), m, bcrypt.hashSync(password, 10), "owner").lastInsertRowid;
  db.prepare("update pumps set owner_id=? where id=?").run(userId, pumpId);

  initPumpSections(pumpId, pName);

  const token = startSession(q, s, userId);
  const u = db.prepare(`
    select u.id, u.name, u.mobile, u.role, u.lang, u.active, u.pump_id,
           p.name as pump_name, p.code as pump_code
    from users u left join pumps p on p.id=u.pump_id where u.id=?
  `).get(userId);
  audit(u, "signup", `Registered new pump station: ${pName} (${pCode})`);
  s.json({ user: pub(u), token });
});

app.post("/api/login", (q, s) => {
  const m = mob(q.body && q.body.mobile), p = String((q.body && q.body.password) || ""), k = q.ip + "|" + m;
  if (blocked(k)) return s.status(429).json({ error: "Too many wrong attempts. Try again in 15 minutes." });
  const u = db.prepare(`
    select u.*, coalesce(p.name, 'Station #' || u.pump_id) as pump_name, coalesce(p.code, 'PUMP-' || u.pump_id) as pump_code
    from users u
    left join pumps p on p.id=u.pump_id
    where u.mobile=?
  `).get(m);
  if (!u || !u.active || !bcrypt.compareSync(p, u.hash)) {
    addFail(k);
    return s.status(401).json({ error: "Wrong mobile number or password." });
  }
  fails.delete(k);
  const token = startSession(q, s, u.id);
  audit(u, "login", "Logged in");
  s.json({ user: pub(u), token });
});

app.post("/api/logout", (q, s) => {
  let t = cookie(q, "sid");
  if (!t && q.headers.authorization && q.headers.authorization.startsWith("Bearer ")) {
    t = q.headers.authorization.slice(7).trim();
  }
  if (t) db.prepare("delete from sessions where token=?").run(hs(t));
  s.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0");
  s.json({ ok: true });
});

app.post("/api/lang", need(), (q, s) => {
  const lang = q.body && q.body.lang;
  if (!["en", "mr", "hi"].includes(lang)) return s.status(400).json({ error: "Unknown language." });
  db.prepare("update users set lang=? where id=?").run(lang, q.user.id);
  s.json({ ok: true });
});

app.post("/api/password", need(), (q, s) => {
  const { old, password } = q.body || {};
  const u = db.prepare("select * from users where id=?").get(q.user.id);
  if (!bcrypt.compareSync(String(old || ""), u.hash)) return s.status(400).json({ error: "Current password is wrong." });
  if (typeof password !== "string" || password.length < 6 || password.length > 100) return s.status(400).json({ error: "New password must be at least 6 characters." });
  db.prepare("update users set hash=? where id=?").run(bcrypt.hashSync(password, 10), u.id);
  const keep = hs(cookie(q, "sid"));
  db.prepare("delete from sessions where user_id=? and token<>?").run(u.id, keep);
  s.json({ ok: true });
});

// Multi-pump SaaS management endpoints
app.get("/api/pumps", need("owner"), (q, s) => {
  const rows = db.prepare("select id, name, code, created_at from pumps where owner_id=? or id=? order by id").all(q.user.id, q.user.pump_id);
  s.json(rows);
});

app.post("/api/pumps", need("owner"), (q, s) => {
  const { name, code } = q.body || {};
  const pName = String(name || "").trim().slice(0, 80);
  if (!pName) return s.status(400).json({ error: "Enter pump station name." });
  let pCode = String(code || "").trim().toUpperCase().slice(0, 20);
  if (!pCode) {
    pCode = "PUMP-" + Math.floor(1000 + Math.random() * 9000);
  }
  if (db.prepare("select 1 from pumps where code=?").get(pCode)) {
    return s.status(409).json({ error: "Pump code is already in use. Choose another code." });
  }
  const pumpId = db.prepare("insert into pumps(name, code, owner_id, created_at) values(?,?,?,?)").run(pName, pCode, q.user.id, now()).lastInsertRowid;
  initPumpSections(pumpId, pName);
  s.json({ pump: { id: pumpId, name: pName, code: pCode }, id: pumpId, name: pName, code: pCode });
});

app.post("/api/pumps/switch", need("owner"), (q, s) => {
  const pumpId = +q.body.pump_id;
  const p = db.prepare("select * from pumps where id=?").get(pumpId);
  if (!p) return s.status(404).json({ error: "Pump station not found." });
  if (p.owner_id !== q.user.id && p.id !== q.user.pump_id) {
    return s.status(403).json({ error: "Access denied to this pump station." });
  }
  db.prepare("update users set pump_id=? where id=?").run(p.id, q.user.id);
  const u = db.prepare(`
    select u.id, u.name, u.mobile, u.role, u.lang, u.active, u.pump_id,
           p.name as pump_name, p.code as pump_code
    from users u left join pumps p on p.id=u.pump_id where u.id=?
  `).get(q.user.id);
  audit(u, "switch pump", `Switched active station to: ${p.name} (${p.code})`);
  s.json({ user: pub(u) });
});

app.get("/api/pump", need("owner", "manager"), (q, s) => {
  const p = db.prepare("select * from pumps where id=?").get(q.user.pump_id);
  s.json(p || { id: q.user.pump_id, name: q.user.pump_name, code: q.user.pump_code });
});

app.patch("/api/pump", need("owner"), (q, s) => {
  const { name, code } = q.body || {};
  const pid = q.user.pump_id;
  if (name) {
    db.prepare("update pumps set name=? where id=?").run(String(name).trim().slice(0, 80), pid);
  }
  if (code) {
    const cd = String(code).trim().toUpperCase().slice(0, 20);
    const ex = db.prepare("select id from pumps where code=? and id<>?").get(cd, pid);
    if (ex) return s.status(409).json({ error: "Pump code is already in use." });
    db.prepare("update pumps set code=? where id=?").run(cd, pid);
  }
  const p = db.prepare("select * from pumps where id=?").get(pid);
  s.json(p);
});

// ---- Team (strictly isolated to q.user.pump_id)
app.get("/api/users", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  s.json(db.prepare(
    q.user.role === "owner"
      ? "select id,name,mobile,role,active,pump_id from users where pump_id=? order by id"
      : "select id,name,mobile,role,active,pump_id from users where pump_id=? and role='worker' order by id"
  ).all(pid));
});

app.post("/api/users", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { name, mobile, password, role } = q.body || {};
  const m = mob(mobile);
  if (!["manager", "worker"].includes(role)) return s.status(400).json({ error: "Choose manager or worker." });
  if (q.user.role === "manager" && role !== "worker") return s.status(403).json({ error: "Managers can add workers only." });
  const e = checkUser(name, m, password);
  if (e) return s.status(400).json({ error: e });
  if (db.prepare("select 1 from users where pump_id=? and mobile=?").get(pid, m)) {
    return s.status(409).json({ error: "This mobile number is already registered at this pump station." });
  }
  const info = db.prepare("insert into users(pump_id,name,mobile,hash,role) values(?,?,?,?,?)")
    .run(pid, String(name).trim(), m, bcrypt.hashSync(password, 10), role);
  s.json({ ok: true, id: info.lastInsertRowid, user: { id: info.lastInsertRowid, name: String(name).trim(), mobile: m, role } });
});

app.patch("/api/users/:id", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const id = +q.params.id, u = db.prepare("select * from users where id=? and pump_id=?").get(id, pid);
  if (!u) return s.status(404).json({ error: "User not found in this pump station team." });
  if (q.user.role === "manager" && u.role !== "worker") return s.status(403).json({ error: "Managers can change workers only." });
  const { active, password, name } = q.body || {};
  if (active !== undefined) {
    if (u.id === q.user.id) return s.status(400).json({ error: "You cannot deactivate your own account." });
    db.prepare("update users set active=? where id=? and pump_id=?").run(active ? 1 : 0, id, pid);
    if (!active) db.prepare("delete from sessions where user_id=?").run(id);
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6 || password.length > 100) return s.status(400).json({ error: "Password must be at least 6 characters." });
    db.prepare("update users set hash=? where id=? and pump_id=?").run(bcrypt.hashSync(password, 10), id, pid);
    db.prepare("delete from sessions where user_id=?").run(id);
  }
  if (name !== undefined && String(name).trim()) db.prepare("update users set name=? where id=? and pump_id=?").run(String(name).trim().slice(0, 60), id, pid);
  s.json({ ok: true });
});

// ---- Shared business data (owner and manager)
// ---- Shared business data, split into sections so edits rarely clash

const SECTIONS = { c: ["c"], inv: ["inv"], items: ["items", "itemcats"], sup: ["sup"], bk: ["bk", "ob"], biz: ["biz"], tanks: ["tanks", "deliv"], setup: ["nozzles", "rates", "expcats", "paymodes", "fuelprods"] };
const ARRAY_KEYS = new Set(["c", "inv", "items", "sup", "bk", "tanks", "deliv", "nozzles", "rates", "expcats", "paymodes", "fuelprods", "itemcats"]);
const LABEL = { c: "Customers", inv: "Invoices", items: "Stock items", sup: "Suppliers", bk: "Book entries", ob: "Opening balances", biz: "Business details", tanks: "Tanks", deliv: "Fuel deliveries", nozzles: "Nozzles", rates: "Fuel rates", expcats: "Expense categories", paymodes: "Payment modes", fuelprods: "Fuel products", itemcats: "Product categories" };
function audit(u, action, detail) {
  try {
    const pid = u && u.pump_id ? u.pump_id : 1;
    db.prepare("insert into audit(pump_id,t,user_id,user_name,action,detail) values(?,?,?,?,?,?)")
      .run(pid, now(), u ? u.id : null, u ? u.name : "", action, String(detail || "").slice(0, 600));
  } catch (e) { /* never block the request */ }
}
function readSections(pumpId = 1) {
  const state = {}, vers = {};
  db.prepare("select name, ver, json from sections where pump_id=?").all(pumpId).forEach((r) => {
    vers[r.name] = r.ver;
    try { Object.assign(state, JSON.parse(r.json)); } catch (e) {}
  });
  return { state, vers };
}
const stateNow = (pumpId = 1) => readSections(pumpId).state;
function writeSection(pumpId, name, obj) {
  const r = db.prepare("select ver from sections where pump_id=? and name=?").get(pumpId, name);
  const ver = (r ? r.ver : 0) + 1;
  db.prepare(`
    insert into sections(pump_id,name,ver,json) values(?,?,?,?)
    on conflict(pump_id,name) do update set ver=excluded.ver, json=excluded.json
  `).run(pumpId, name, ver, JSON.stringify(obj));
  return ver;
}
// One-time move from the old single-record layout
function migrateOldState() {
  if (db.prepare("select 1 from sections limit 1").get()) return;
  const old = db.prepare("select json from state where id=1").get();
  if (!old) return;
  const st = JSON.parse(old.json);
  db.transaction(() => {
    for (const [n, keys] of Object.entries(SECTIONS)) {
      const o = {};
      keys.forEach((k) => { if (st[k] !== undefined) o[k] = st[k]; });
      db.prepare("insert into sections(pump_id,name,ver,json) values(1,?,?,?)").run(n, 1, JSON.stringify(o));
    }
  })();
}
const hasId = (x) => x && typeof x === "object" && x.id !== undefined;
function diffSummary(before, after) {
  const out = [];
  for (const k of Object.keys(after)) {
    const b = after[k], a = before[k] === undefined && Array.isArray(b) ? [] : before[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const lab = LABEL[k] || k;
    if (Array.isArray(a) && Array.isArray(b) && a.every(hasId) && b.every(hasId)) {
      const am = new Map(a.map((x) => [String(x.id), x])), bm = new Map(b.map((x) => [String(x.id), x]));
      const nm = (x) => String(x.name || x.no || x.d || x.id).slice(0, 30);
      const added = b.filter((x) => !am.has(String(x.id))).map(nm), removed = a.filter((x) => !bm.has(String(x.id))).map(nm);
      const changed = b.filter((x) => am.has(String(x.id)) && JSON.stringify(am.get(String(x.id))) !== JSON.stringify(x)).map((x) => {
        const o = am.get(String(x.id));
        return nm(x) + (Array.isArray(x.e) && Array.isArray(o.e) && x.e.length !== o.e.length ? ` (entries ${o.e.length} to ${x.e.length})` : "");
      });
      const cut = (l) => l.slice(0, 4).join(", ") + (l.length > 4 ? ` +${l.length - 4} more` : "");
      if (added.length) out.push(`${lab} added: ${cut(added)}`);
      if (removed.length) out.push(`${lab} removed: ${cut(removed)}`);
      if (changed.length) out.push(`${lab} changed: ${cut(changed)}`);
      if (!added.length && !removed.length && !changed.length) out.push(`${lab} reordered`);
    } else out.push(`${lab} changed`);
  }
  return out.join("; ");
}
app.get("/api/state", need("owner", "manager"), (q, s) => {
  const { state, vers } = readSections(q.user.pump_id);
  s.json(Object.keys(vers).length ? { vers, state } : { vers: {}, state: null });
});
app.put("/api/state", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { vers, changes } = q.body || {};
  const names = changes && typeof changes === "object" ? Object.keys(changes) : [];
  const bad = () => s.status(400).json({ error: "Invalid data." });
  if (!names.length || names.some((n) => !SECTIONS[n])) return bad();
  for (const n of names) for (const k of SECTIONS[n]) {
    const v = changes[n] && changes[n][k];
    if (ARRAY_KEYS.has(k) ? !Array.isArray(v) : v === null || typeof v !== "object" || Array.isArray(v)) return bad();
  }
  const res = db.transaction(() => {
    const conflicts = names.filter((n) => {
      const r = db.prepare("select ver from sections where pump_id=? and name=?").get(pid, n);
      return +((vers || {})[n] || 0) !== (r ? r.ver : 0);
    });
    if (conflicts.length) return { conflicts };
    const out = {};
    names.forEach((n) => {
      const prev = db.prepare("select json from sections where pump_id=? and name=?").get(pid, n);
      const before = prev ? JSON.parse(prev.json) : {};
      const obj = {};
      SECTIONS[n].forEach((k) => (obj[k] = changes[n][k]));
      out[n] = writeSection(pid, n, obj);
      const d = diffSummary(before, obj);
      if (d) audit(q.user, "data", d);
    });
    return { vers: out };
  })();
  if (res.conflicts) return s.status(409).json({ error: "Data was changed by someone else.", conflicts: res.conflicts });
  s.json(res);
});

// ---- Audit log (owner)
app.get("/api/audit", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const lim = Math.min(500, +q.query.limit || 200), t = String(q.query.q || "").trim(), like = `%${t}%`;
  s.json(t
    ? db.prepare("select * from audit where pump_id=? and (action like ? or detail like ? or user_name like ?) order by id desc limit ?").all(pid, like, like, like, lim)
    : db.prepare("select * from audit where pump_id=? order by id desc limit ?").all(pid, lim));
});
const money = (n) => "\u20b9" + Math.round(+n || 0);
const AUD = {
  "POST /api/users": (q) => `Added ${q.body.role} ${q.body.name}`,
  "PATCH /api/users/:id": (q) => `Changed user #${q.params.id}` + (q.body.active !== undefined ? (q.body.active ? " (activated)" : " (deactivated)") : "") + (q.body.password !== undefined ? " (password reset)" : ""),
  "POST /api/password": () => "Changed own password",
  "POST /api/credit-sales": (q) => `Credit sale ${money(q.body.a)} for customer #${q.body.cust_id}`,
  "POST /api/credit-sales/:id/approve": (q) => `Approved over-limit credit sale #${q.params.id}`,
  "POST /api/credit-sales/:id/reject": (q) => `Rejected credit sale #${q.params.id}`,
  "DELETE /api/credit-sales/:id": (q) => `Deleted credit sale #${q.params.id}`,
  "POST /api/duty/:id/submit": (q) => `Submitted duty #${q.params.id}`,
  "POST /api/duties/assign": (q) => `Assigned a ${q.body.shift} duty to worker #${q.body.worker_id}`,
  "DELETE /api/duties/:id": (q) => `Cancelled duty #${q.params.id}`,
  "POST /api/duties/:id/close": (q) => `Closed duty #${q.params.id}`,
  "POST /api/duties/:id/reopen": (q) => `Reopened duty #${q.params.id}`,
  "POST /api/days/:d/close": (q) => `Closed business day ${q.params.d}`,
  "POST /api/days/:d/approve": (q) => `Approved business day ${q.params.d}`,
  "POST /api/days/:d/reopen": (q) => `Reopened business day ${q.params.d}`,
  "PUT /api/payroll/rates": (q) => `Changed pay rates for worker #${q.body.worker_id}`,
  "POST /api/payroll/items": (q) => `Pay entry (${q.body.kind}) ${money(q.body.amount)} for worker #${q.body.worker_id}`,
  "DELETE /api/payroll/items/:id": (q) => `Deleted pay entry #${q.params.id}`,
  "POST /api/dips": (q) => `Tank dip reading for tank #${q.body.tank_id}` + (q.body.d15 || q.body.dens_obs ? " with density" : ""),
  "DELETE /api/dips/:id": (q) => `Deleted dip reading #${q.params.id}`,
};
// ---- Credit customers and worker credit sales
function customers(pumpId = 1) {
  const st = stateNow(pumpId);
  const sums = {};
  db.prepare("select cust_id, sum(a) t from credit_sales where pump_id=? and status='ok' group by cust_id").all(pumpId).forEach((x) => (sums[x.cust_id] = x.t));
  return (st.c || []).map((c) => {
    const due = (c.e || []).reduce((a, x) => a + (x.t === "sale" ? x.a : -x.a), 0) + (sums[String(c.id)] || 0);
    return { id: c.id, name: c.name, active: c.active !== false, veh: c.veh || [], available: Math.round(((c.limit || 0) - due) * 100) / 100 };
  });
}
app.get("/api/fuels", need(), (q, s) => { const st = stateNow(q.user.pump_id); s.json([...new Set((st.nozzles || []).filter((n) => n.active !== false).map((n) => n.fuel))].map((name) => ({ name, unit: unitOf(st, name) }))); });
app.get("/api/customers", need(), (q, s) => s.json(customers(q.user.pump_id).filter((c) => c.active)));
app.post("/api/credit-sales", need(), (q, s) => {
  const pid = q.user.pump_id;
  const { cust_id, n, a, veh, force, fuel, litres } = q.body || {};
  const c = customers(pid).find((x) => String(x.id) === String(cust_id));
  const fu = String(fuel || "").trim().slice(0, 30), lt = fu && litres !== "" && litres != null ? Math.round(+litres * 100) / 100 : null;
  const amt = Math.round(+a * 100) / 100, item = String(n || "").trim() || (fu && lt > 0 ? `${fu} ${lt} L` : "");
  if (!c) return s.status(400).json({ error: "Choose a customer from the list." });
  if (!c.active) return s.status(400).json({ error: "This customer is inactive." });
  if (fu && !(lt > 0 && lt <= 5000)) return s.status(400).json({ error: "Enter the litres." });
  if (!item || item.length > 100) return s.status(400).json({ error: "Enter the fuel or item and quantity." });
  if (!(amt > 0 && amt <= 1e7)) return s.status(400).json({ error: "Enter an amount above zero." });
  const over = amt > c.available, worker = q.user.role === "worker";
  // Workers cannot exceed a customer's limit: the sale waits for a manager or owner to approve it.
  if (over && !worker && !force) return s.status(409).json({ error: "over_limit", available: c.available });
  const status = over && worker ? "pending" : "ok";
  const id = db.prepare("insert into credit_sales(pump_id,cust_id,d,n,a,veh,worker_id,created,status,fuel,litres) values(?,?,?,?,?,?,?,?,?,?,?)")
    .run(pid, String(c.id), bizDate(), item, amt, String(veh || "").trim().toUpperCase().slice(0, 20), q.user.id, now(), status, fu || null, lt).lastInsertRowid;
  s.json({ id, pending: status === "pending", available: Math.round((status === "ok" ? c.available - amt : c.available) * 100) / 100 });
});
app.get("/api/credit-sales", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  s.json(db.prepare("select cs.id,cs.cust_id,cs.d,cs.n,cs.a,cs.veh,cs.fuel,cs.litres,cs.status,u.name worker from credit_sales cs join users u on u.id=cs.worker_id where cs.pump_id=? and cs.status<>'rejected' order by cs.id").all(pid));
});
app.get("/api/my-credit-sales", need(), (q, s) => {
  const pid = q.user.pump_id;
  const names = {};
  customers(pid).forEach((c) => (names[String(c.id)] = c.name));
  const rows = db.prepare("select id,cust_id,d,n,a,veh,fuel,litres,status from credit_sales where pump_id=? and worker_id=? order by id desc limit 50").all(pid, q.user.id);
  s.json(rows.map((r) => ({ ...r, cname: names[r.cust_id] || "Customer" })));
});
const decide = (to) => (q, s) => {
  const r = db.prepare("update credit_sales set status=? where id=? and pump_id=? and status='pending'").run(to, +q.params.id, q.user.pump_id);
  if (!r.changes) return s.status(404).json({ error: "This sale is no longer waiting for approval." });
  s.json({ ok: true });
};
app.post("/api/credit-sales/:id/approve", need("owner", "manager"), decide("ok"));
app.post("/api/credit-sales/:id/reject", need("owner", "manager"), decide("rejected"));
app.delete("/api/credit-sales/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from credit_sales where id=? and pump_id=?").run(+q.params.id, q.user.pump_id);
  s.json({ ok: true });
});

// ---- Duties and nozzle readings
const addCol = (t, c, def) => { try { if (!db.prepare(`pragma table_info(${t})`).all().some((x) => x.name === c)) db.exec(`alter table ${t} add column ${c} ${def}`); } catch (e) {} };


const r2 = (x) => Math.round(x * 100) / 100;
const num = (x) => { if (x === "" || x === null || x === undefined) return NaN; const n = +x; return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : NaN; };
// The business day starts at 6 AM: a night shift that runs past midnight belongs to the previous day.
const bizDate = () => new Date(Date.now() - 6 * 3600e3).toLocaleDateString("en-CA", { timeZone: TZ });
const DEFMODES = [{ key: "cash", name: "Cash", active: true }, { key: "upi", name: "UPI", active: true }, { key: "card", name: "Card", active: true }];
const allModes = (st) => (st.paymodes && st.paymodes.length ? st.paymodes : DEFMODES);
const activeModes = (st) => allModes(st).filter((m) => m.active !== false || m.key === "cash");
function nozzleMap(st = stateNow(1)) {
  const m = {};
  (st.nozzles || []).forEach((n) => (m[String(n.id)] = n));
  return m;
}
function rateFor(st, fuel, date) {
  let best = null;
  (st.rates || []).forEach((r) => {
    if (r.fuel === fuel && r.from <= date && (!best || r.from > best.from || (r.from === best.from && r.id > best.id))) best = r;
  });
  return best ? +best.rate : null;
}
function fuelRateFor(st, fuel, date) {
  const direct = rateFor(st, fuel, date);
  if (direct != null) return direct;
  let latest = null;
  (st.rates || []).forEach((r) => {
    if (r.fuel === fuel && (!latest || r.from > latest.from || (r.from === latest.from && r.id > latest.id))) latest = r;
  });
  return latest ? +latest.rate : null;
}
const unitOf = (st, fuel) => { const p = (st.fuelprods || []).find((x) => x.name === fuel); return (p && p.unit) || "L"; };
function lastClose(nid, pumpId = 1) {
  return db.prepare("select dl.closing c from duty_lines dl join duties d on d.id=dl.duty_id where d.pump_id=? and dl.nozzle_id=? and d.status in ('submitted','closed') and dl.closing is not null order by d.submitted desc, dl.id desc limit 1").get(pumpId, String(nid)) || {};
}
const dayStatus = (d, pumpId = 1) => (db.prepare("select status from days where pump_id=? and d=?").get(pumpId, d) || { status: "open" }).status;
function detail(d, pumpId) {
  const pid = pumpId || d.pump_id || 1;
  const st = stateNow(pid), nm = nozzleMap(st);
  const lines = db.prepare("select * from duty_lines where duty_id=? order by id").all(d.id).map((l) => {
    const lt = l.closing == null ? 0 : r2(l.closing - l.opening - l.testing), n = nm[l.nozzle_id] || {};
    return { ...l, nozzle: n.name || "Nozzle", fuel: n.fuel || "", unit: unitOf(st, n.fuel), litres: lt, amount: r2(lt * (l.rate || 0)) };
  });
  const items = db.prepare("select * from duty_items where duty_id=? order by id").all(d.id).map((i) => ({ ...i, amount: r2(i.qty * i.price) }));
  const expenses = db.prepare("select * from duty_expenses where duty_id=? order by id").all(d.id);
  const sales = r2(lines.reduce((a, l) => a + l.amount, 0)), litres = r2(lines.filter((l) => l.unit === "L").reduce((a, l) => a + l.litres, 0));
  const lube = r2(items.reduce((a, i) => a + i.amount, 0)), exp = r2(expenses.reduce((a, e) => a + e.amount, 0));
  const credit = r2(db.prepare("select coalesce(sum(a),0) t from credit_sales where pump_id=? and worker_id=? and status='ok' and created>=? and created<=?").get(pid, d.worker_id, d.started, d.submitted || now()).t);
  const pay = d.pay_json ? JSON.parse(d.pay_json) : { cash: d.cash, upi: d.upi, card: d.card };
  const collected = r2(Object.values(pay).reduce((a, x) => a + (+x || 0), 0));
  const expected = r2(sales + lube - credit - exp);
  const w = db.prepare("select name from users where id=? and pump_id=?").get(d.worker_id, pid);
  return {
    id: d.id, d: d.d, shift: d.shift, status: d.status, worker_id: d.worker_id, worker: w ? w.name : "", pay,
    cash: +pay.cash || 0, upi: +pay.upi || 0, card: +pay.card || 0, note: d.note || "",
    lines, items, expenses, litres, sales, lube, exp, credit, expected, collected, diff: r2(collected - expected),
    pump_id: pid
  };
}
// Updates a duty's nozzle readings, shop items, expenses and collections.
// Workers change closing/testing only; managers (full) can also change opening and rate.
function saveDuty(id, b, strict, full, pumpId = 1) {
  const st = stateNow(pumpId), nm = nozzleMap(st), cur = db.prepare("select * from duty_lines where duty_id=? order by id").all(id);
  const src = Array.isArray(b.lines) ? b.lines : [], ups = [];
  const rd = (v) => (v === "" || v === null || v === undefined ? null : num(v));
  for (const row of cur) {
    const l = src.find((x) => String(x.nozzle_id) === row.nozzle_id) || {}, nn = (nm[row.nozzle_id] || {}).name || "Nozzle";
    const o = { id: row.id, opening: row.opening, rate: row.rate, closing: row.closing, testing: row.testing };
    if (l.closing !== undefined) o.closing = rd(l.closing);
    if (l.testing !== undefined) o.testing = rd(l.testing) ?? 0;
    if (full && l.opening !== undefined) o.opening = rd(l.opening);
    if (full && l.rate !== undefined) o.rate = rd(l.rate);
    if ([o.closing, o.testing, o.opening, o.rate].some((x) => Number.isNaN(x))) return `Check the numbers for ${nn}.`;
    if (strict) {
      if (o.opening == null) return `Enter the opening reading for ${nn}.`;
      if (o.closing == null) return `Enter the closing reading for ${nn}.`;
      if (o.rate == null || o.rate <= 0) return `The rate for ${nn} is missing. Ask the owner to set it in Pump setup.`;
      if (o.closing < o.opening) return `Closing is less than opening for ${nn}.`;
      if (o.testing > o.closing - o.opening) return `Testing litres are more than the fuel dispensed on ${nn}.`;
    }
    ups.push(o);
  }
  const items = [], need = {}, stItems = st.items || [], iSrc = Array.isArray(b.items) ? b.items : [];
  if (iSrc.length > 50) return "Too many shop items.";
  for (const x of iSrc) {
    if (x.item_id === "" || x.item_id == null) continue;
    const it = stItems.find((i) => String(i.id) === String(x.item_id));
    if (!it) return "Choose each lube or shop item from the stock list.";
    const q = num(x.qty);
    if (Number.isNaN(q) || q <= 0) { if (strict) return `Enter a quantity for ${it.name}.`; continue; }
    items.push({ item_id: String(it.id), name: it.name, qty: q, price: +it.sell });
    need[it.id] = (need[it.id] || 0) + q;
  }
  if (strict) for (const k in need) { const it = stItems.find((i) => String(i.id) === k); if (need[k] > +it.stock) return `Only ${it.stock} ${it.unit} of ${it.name} in stock.`; }
  const exps = [], eSrc = Array.isArray(b.expenses) ? b.expenses : [];
  if (eSrc.length > 50) return "Too many expense lines.";
  for (const x of eSrc) {
    const blank = (x.amount === "" || x.amount == null) && !String(x.note || "").trim();
    if (blank) continue;
    const a = num(x.amount);
    if (Number.isNaN(a) || a <= 0) { if (strict) return "Enter an amount above zero for every expense."; continue; }
    exps.push({ cat: String(x.cat || "Other").slice(0, 40), note: String(x.note || "").slice(0, 60), amount: r2(a) });
  }
  const pay = {};
  for (const m of activeModes(st)) {
    let raw = b.pay && b.pay[m.key] !== undefined ? b.pay[m.key] : b[m.key];
    const n = num(raw === undefined || raw === null || raw === "" ? 0 : raw);
    if (Number.isNaN(n)) return `Check the ${m.name} amount.`;
    pay[m.key] = n;
  }
  db.transaction(() => {
    const u = db.prepare("update duty_lines set opening=?, closing=?, testing=?, rate=? where id=?");
    ups.forEach((o) => u.run(o.opening, o.closing, o.testing, o.rate, o.id));
    db.prepare("delete from duty_items where duty_id=?").run(id);
    items.forEach((x) => db.prepare("insert into duty_items(duty_id,item_id,name,qty,price) values(?,?,?,?,?)").run(id, x.item_id, x.name, x.qty, x.price));
    db.prepare("delete from duty_expenses where duty_id=?").run(id);
    exps.forEach((x) => db.prepare("insert into duty_expenses(duty_id,cat,note,amount) values(?,?,?,?)").run(id, x.cat, x.note, x.amount));
    db.prepare("update duties set pay_json=?, cash=?, upi=?, card=?, note=? where id=? and pump_id=?").run(JSON.stringify(pay), pay.cash || 0, pay.upi || 0, pay.card || 0, String(b.note || "").slice(0, 200), id, pumpId);
  })();
  return null;
}
// Lube and shop stock moves when a duty is closed (and comes back if the owner reopens it).
function adjustStock(duty, sign, pumpId) {
  const pid = pumpId || duty.pump_id || 1;
  const items = db.prepare("select * from duty_items where duty_id=?").all(duty.id), r = db.prepare("select json from sections where pump_id=? and name='items'").get(pid);
  if (!items.length || !r) return;
  const o = JSON.parse(r.json);
  items.forEach((x) => { const it = (o.items || []).find((i) => String(i.id) === x.item_id); if (it) it.stock = Math.max(0, r2(+it.stock + sign * x.qty)); });
  writeSection(pid, "items", o);
  audit({ pump_id: pid }, "stock", `${sign < 0 ? "Deducted" : "Restored"} lube and shop stock for duty #${duty.id}`);
}
const openDuty = (uid, pumpId = 1) => db.prepare("select * from duties where pump_id=? and worker_id=? and status='open' order by id desc limit 1").get(pumpId, uid);
const mine = (q, s, n) => {
  const d = db.prepare("select * from duties where id=? and pump_id=? and worker_id=? and status='open'").get(+q.params.id, q.user.pump_id, q.user.id);
  if (!d) return s.status(404).json({ error: "This duty is not open." });
  q.duty = d; n();
};
const fillInfo = (st) => ({
  modes: activeModes(st).map((m) => ({ key: m.key, name: m.name })),
  cats: st.expcats && st.expcats.length ? st.expcats : ["Tea and food", "Repairs", "Electricity", "Transport", "Other"],
  items: (st.items || []).map((i) => ({ id: i.id, name: i.name, unit: i.unit, sell: i.sell, stock: i.stock })),
});
app.get("/api/duty/current", need(), (q, s) => {
  const pid = q.user.pump_id;
  const d = openDuty(q.user.id, pid), st = stateNow(pid);
  const recent = db.prepare("select * from duties where pump_id=? and worker_id=? and status<>'open' order by id desc limit 8").all(pid, q.user.id).map((x) => detail(x, pid));
  s.json({ duty: d ? detail(d, pid) : null, ...fillInfo(st), recent });
});
app.get("/api/my-duties/:id", need(), (q, s) => {
  const pid = q.user.pump_id;
  const d = db.prepare("select * from duties where id=? and pump_id=? and worker_id=? and status<>'open'").get(+q.params.id, pid, q.user.id);
  if (!d) return s.status(404).json({ error: "Duty not found." });
  s.json({ duty: detail(d, pid), modes: allModes(stateNow(pid)).map((m) => ({ key: m.key, name: m.name })) });
});
app.put("/api/duty/:id", need(), mine, (q, s) => {
  const e = saveDuty(q.duty.id, q.body || {}, false, false, q.user.pump_id);
  if (e) return s.status(400).json({ error: e });
  s.json({ ok: true });
});
app.post("/api/duty/:id/submit", need(), mine, (q, s) => {
  const pid = q.user.pump_id;
  const e = saveDuty(q.duty.id, q.body || {}, true, false, pid);
  if (e) return s.status(400).json({ error: e });
  db.prepare("update duties set status='submitted', submitted=? where id=? and pump_id=?").run(now(), q.duty.id, pid);
  s.json({ ok: true });
});

// ---- Manager: assign nozzles, review, close
app.get("/api/assign-info", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id, st = stateNow(pid), d = bizDate();
  const busy = {};
  db.prepare("select dl.nozzle_id n, u.name w from duty_lines dl join duties du on du.id=dl.duty_id join users u on u.id=du.worker_id where du.pump_id=? and du.status in ('open','submitted')").all(pid).forEach((x) => (busy[x.n] = x.w));
  const workers = db.prepare("select id,name from users where pump_id=? and role='worker' and active=1 order by name").all(pid);
  const nozzles = (st.nozzles || []).filter((n) => n.active !== false).map((n) => {
    const lc = lastClose(n.id, pid);
    return { id: n.id, name: n.name, fuel: n.fuel, busy_by: busy[String(n.id)] || null, rate: rateFor(st, n.fuel, d), opening: lc.c ?? (n.open ?? null) };
  });
  const open = db.prepare("select * from duties where pump_id=? and status='open' order by id").all(pid).map((x) => detail(x, pid));
  s.json({ date: d, day: dayStatus(d, pid), workers, nozzles, open });
});
app.post("/api/duties/assign", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { worker_id, shift, nozzle_ids } = q.body || {}, st = stateNow(pid), d = bizDate();
  const w = db.prepare("select * from users where id=? and pump_id=? and active=1 and role='worker'").get(+worker_id, pid);
  if (!w) return s.status(400).json({ error: "Choose a worker." });
  if (!SHIFTS.includes(shift)) return s.status(400).json({ error: "Choose a shift." });
  const ids = Array.isArray(nozzle_ids) ? [...new Set(nozzle_ids.map(String))] : [];
  if (!ids.length || ids.length > 30) return s.status(400).json({ error: "Choose at least one nozzle." });
  if (dayStatus(d, pid) !== "open") return s.status(409).json({ error: "Today's business day is already closed. Ask the owner to reopen it." });
  if (openDuty(w.id, pid)) return s.status(409).json({ error: `${w.name} already has a duty in progress.` });
  const nm = nozzleMap(st), lines = [];
  for (const id of ids) {
    const n = nm[id];
    if (!n || n.active === false) return s.status(400).json({ error: "One of the nozzles is not available." });
    const b = db.prepare("select u.name w from duty_lines dl join duties du on du.id=dl.duty_id join users u on u.id=du.worker_id where du.pump_id=? and dl.nozzle_id=? and du.status in ('open','submitted') limit 1").get(pid, id);
    if (b) return s.status(409).json({ error: `${n.name} is with ${b.w}. It is free once that duty is closed.` });
    const rate = rateFor(st, n.fuel, d);
    if (rate == null) return s.status(400).json({ error: `Set the ${n.fuel} rate in Pump setup first.` });
    const lc = lastClose(id, pid), opening = lc.c ?? (n.open ?? null);
    if (opening == null) return s.status(400).json({ error: `Set the opening reading for ${n.name} in Pump setup first.` });
    lines.push({ id, opening, rate });
  }
  const dutyId = db.transaction(() => {
    const did = db.prepare("insert into duties(pump_id,worker_id,d,shift,started,assigned_by) values(?,?,?,?,?,?)").run(pid, w.id, d, shift, now(), q.user.id).lastInsertRowid;
    lines.forEach((l) => db.prepare("insert into duty_lines(duty_id,nozzle_id,opening,rate) values(?,?,?,?)").run(did, l.id, l.opening, l.rate));
    return did;
  })();
  s.json({ id: dutyId });
});
app.delete("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const r = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and pump_id=? and status='open'").get(+q.params.id, pid);
    if (!d) return 0;
    db.prepare("delete from duty_lines where duty_id=?").run(d.id);
    db.prepare("delete from duty_items where duty_id=?").run(d.id);
    db.prepare("delete from duty_expenses where duty_id=?").run(d.id);
    db.prepare("delete from duties where id=? and pump_id=?").run(d.id, pid);
    return 1;
  })();
  if (!r) return s.status(404).json({ error: "Only a duty that has not been submitted can be cancelled." });
  s.json({ ok: true });
});
app.get("/api/duties", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.query.d || "") ? q.query.d : bizDate();
  s.json({
    day: db.prepare("select * from duties where pump_id=? and d=? and status<>'open' order by id").all(pid, d).map((x) => detail(x, pid)),
    pending: db.prepare("select * from duties where pump_id=? and status='submitted' order by id").all(pid).map((x) => detail(x, pid)),
    open: db.prepare("select * from duties where pump_id=? and status='open' order by id").all(pid).map((x) => detail(x, pid)),
    day_status: dayStatus(d, pid),
  });
});
app.get("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = db.prepare("select * from duties where id=? and pump_id=? and status<>'open'").get(+q.params.id, pid);
  if (!d) return s.status(404).json({ error: "Duty not found." });
  s.json(detail(d, pid));
});
app.put("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = db.prepare("select * from duties where id=? and pump_id=? and status='submitted'").get(+q.params.id, pid);
  if (!d) return s.status(404).json({ error: "Only duties waiting to be closed can be changed." });
  const before = detail(d, pid), e = saveDuty(d.id, q.body || {}, true, true, pid);
  if (e) return s.status(400).json({ error: e });
  const after = detail(db.prepare("select * from duties where id=? and pump_id=?").get(d.id, pid), pid), bits = [];
  [["fuel sales", "sales"], ["lube sales", "lube"], ["expenses", "exp"], ["collected", "collected"]].forEach(([l, k]) => { if (before[k] !== after[k]) bits.push(`${l} ${money(before[k])} to ${money(after[k])}`); });
  if (JSON.stringify(before.lines.map((l) => [l.opening, l.closing, l.testing, l.rate])) !== JSON.stringify(after.lines.map((l) => [l.opening, l.closing, l.testing, l.rate]))) bits.push("nozzle readings changed");
  audit(q.user, "duty corrected", `Duty #${d.id} (${before.worker}, ${before.shift}): ${bits.length ? bits.join(", ") : "saved with no figure changes"}`);
  s.json({ ok: true });
});
app.post("/api/duties/:id/close", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const out = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and pump_id=? and status='submitted'").get(+q.params.id, pid);
    if (!d) return { code: 404, error: "This duty is not waiting to be closed." };
    if (dayStatus(d.d, pid) !== "open") return { code: 409, error: "This business day is already closed." };
    db.prepare("update duties set status='closed', closed_by=?, closed_at=?, stock_done=1 where id=? and pump_id=?").run(q.user.id, now(), d.id, pid);
    if (!d.stock_done) adjustStock(d, -1, pid);
    return { ok: true };
  })();
  if (out.error) return s.status(out.code).json({ error: out.error });
  s.json({ ok: true });
});
app.post("/api/duties/:id/reopen", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const out = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and pump_id=? and status='closed'").get(+q.params.id, pid);
    if (!d) return { code: 404, error: "This duty is not closed." };
    if (dayStatus(d.d, pid) !== "open") return { code: 409, error: "Reopen the business day first." };
    db.prepare("update duties set status='submitted', stock_done=0 where id=? and pump_id=?").run(d.id, pid);
    if (d.stock_done) adjustStock(d, +1, pid);
    return { ok: true };
  })();
  if (out.error) return s.status(out.code).json({ error: out.error });
  s.json({ ok: true });
});

// ---- Business day: manager closes, owner approves
const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
app.post("/api/days/:d/close", need("owner", "manager"), (q, s) => {
  try {
    const pid = q.user.pump_id;
    const d = q.params.d;
    if (!validDay(d)) return s.status(400).json({ error: "Invalid date." });
    if (dayStatus(d, pid) !== "open") return s.status(409).json({ error: "This day is already closed." });
    const c = db.prepare("select sum(status='closed') done, sum(status<>'closed') wait from duties where pump_id=? and d=?").get(pid, d);
    if (c && c.wait > 0) return s.status(400).json({ error: "Some duties on this date are still open or waiting to be closed. Please review and close them first." });

    // 1. Mark day as closed in days table
    db.prepare("insert into days(pump_id,d,status,closed_by,closed_at) values(?,?,?,?,?) on conflict(pump_id,d) do update set status='closed', closed_by=excluded.closed_by, closed_at=excluded.closed_at, approved_by=null, approved_at=null").run(pid, d, "closed", q.user.id, now());

    // 2. Automate closing meter readings update for all nozzles from closed duties of this day
    const dutyLines = db.prepare(`
      select dl.nozzle_id, dl.opening, dl.closing, dl.testing, d.id duty_id,
             coalesce(d.closed_at, d.submitted, d.started) t
      from duty_lines dl
      join duties d on d.id=dl.duty_id
      where d.pump_id=? and d.d=? and d.status='closed'
      order by coalesce(d.closed_at, d.submitted, d.started) asc, d.id asc
    `).all(pid, d);

    const dutyNozzleMap = {};
    dutyLines.forEach((row) => {
      const nid = String(row.nozzle_id);
      if (!dutyNozzleMap[nid]) {
        dutyNozzleMap[nid] = { nozzle_id: nid, closing: null, testing: 0 };
      }
      if (row.closing != null && !isNaN(+row.closing)) {
        dutyNozzleMap[nid].closing = +row.closing; // latest duty in chronological sequence sets closing
      }
      if (row.testing != null && !isNaN(+row.testing)) {
        dutyNozzleMap[nid].testing = r2(dutyNozzleMap[nid].testing + (+row.testing));
      }
    });

    const st = stateNow(pid);
    const activeNozzles = (st.nozzles || []).filter((n) => n.active !== false);
    const finalNozzleMap = {};
    const nowTs = now();

    activeNozzles.forEach((noz) => {
      const nid = String(noz.id);
      let closingVal = null;
      let testingVal = 0;

      if (dutyNozzleMap[nid] && dutyNozzleMap[nid].closing != null) {
        closingVal = dutyNozzleMap[nid].closing;
        testingVal = dutyNozzleMap[nid].testing;
      } else {
        // Check existing meter reading entered for this date
        const existing = db.prepare("select closing, testing from meter_readings where pump_id=? and nozzle_id=? and d=?").get(pid, nid, d);
        if (existing && existing.closing != null && !isNaN(+existing.closing)) {
          closingVal = +existing.closing;
          testingVal = r2(+existing.testing || 0);
        } else {
          // Carry forward previous closing meter
          const priorMr = db.prepare("select closing from meter_readings where pump_id=? and nozzle_id=? and d < ? order by d desc, id desc limit 1").get(pid, nid, d);
          if (priorMr && priorMr.closing != null && !isNaN(+priorMr.closing)) {
            closingVal = +priorMr.closing;
          } else {
            const priorDuty = db.prepare(`
              select dl.closing from duty_lines dl
              join duties d on d.id=dl.duty_id
              where d.pump_id=? and dl.nozzle_id=? and d.d < ? and dl.closing is not null
              order by d.d desc, d.id desc limit 1
            `).get(pid, nid, d);
            if (priorDuty && priorDuty.closing != null && !isNaN(+priorDuty.closing)) {
              closingVal = +priorDuty.closing;
            } else if (noz.open != null && !isNaN(+noz.open)) {
              closingVal = +noz.open;
            }
          }
          testingVal = 0;
        }
      }

      if (closingVal != null) {
        finalNozzleMap[nid] = { nozzle_id: nid, closing: closingVal, testing: testingVal };
      }
    });

    const insMeter = db.prepare(`
      insert into meter_readings(pump_id, d, nozzle_id, closing, testing, user_id, updated_at)
      values(?, ?, ?, ?, ?, ?, ?)
      on conflict(pump_id, d, nozzle_id) do update set
        closing=excluded.closing,
        testing=excluded.testing,
        user_id=excluded.user_id,
        updated_at=excluded.updated_at
    `);

    Object.values(finalNozzleMap).forEach((nm) => {
      insMeter.run(pid, d, nm.nozzle_id, nm.closing, nm.testing, q.user.id, nowTs);
    });

    // 3. Sync nozzle opening meters in pump state for future shifts
    let stateModified = false;
    (st.nozzles || []).forEach((noz) => {
      const nm = finalNozzleMap[String(noz.id)];
      if (nm && nm.closing != null) {
        noz.open = nm.closing;
        stateModified = true;
      }
    });
    if (stateModified) {
      const setupObj = {};
      (SECTIONS.setup || []).forEach((k) => {
        if (st[k] !== undefined) setupObj[k] = st[k];
      });
      writeSection(pid, "setup", setupObj);
    }

    audit(q.user, "close_day", `Closed business day ${d}: automated closing meters and tank sales updated`);
    s.json({ ok: true, automated_nozzles: Object.keys(finalNozzleMap).length });
  } catch (err) {
    console.error("Close day error:", err);
    s.status(500).json({ error: err.message, stack: err.stack });
  }
});
app.post("/api/days/:d/approve", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const r = db.prepare("update days set status='approved', approved_by=?, approved_at=? where pump_id=? and d=? and status='closed'").run(q.user.id, now(), pid, q.params.d);
  if (!r.changes) return s.status(409).json({ error: "Only a day closed by the manager can be approved." });
  s.json({ ok: true });
});
app.post("/api/days/:d/reopen", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  db.prepare("update days set status='open', approved_by=null, approved_at=null where pump_id=? and d=?").run(pid, q.params.d);
  s.json({ ok: true });
});
// Day reports use closed duties only.
app.get("/api/day-report", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = validDay(q.query.d) ? q.query.d : bizDate(), st = stateNow(pid);
  const duties = db.prepare("select * from duties where pump_id=? and d=? and status='closed' order by id").all(pid, d).map((x) => detail(x, pid));
  const fuel = {}, shop = {}, exps = {}, pay = {};
  const T = { sales: 0, lube: 0, credit: 0, exp: 0, expected: 0, collected: 0, diff: 0, litres: 0 };
  duties.forEach((x) => {
    ["sales", "lube", "credit", "exp", "expected", "collected", "diff", "litres"].forEach((k) => (T[k] += x[k]));
    x.lines.forEach((l) => { const f = fuel[l.fuel || "Other"] || (fuel[l.fuel || "Other"] = { litres: 0, amount: 0 }); f.litres += l.litres; f.amount += l.amount; });
    x.items.forEach((i) => { const f = shop[i.name] || (shop[i.name] = { qty: 0, amount: 0 }); f.qty += i.qty; f.amount += i.amount; });
    x.expenses.forEach((e) => (exps[e.cat] = (exps[e.cat] || 0) + e.amount));
    Object.keys(x.pay).forEach((k) => (pay[k] = (pay[k] || 0) + (+x.pay[k] || 0)));
  });
  Object.keys(T).forEach((k) => (T[k] = r2(T[k])));
  const dd = db.prepare("select * from days where pump_id=? and d=?").get(pid, d) || { status: "open" };
  s.json({ d, day: dd, modes: allModes(st).map((m) => ({ key: m.key, name: m.name })), duties, summary: { ...T, total: r2(T.sales + T.lube), fuel, shop, exps, pay } });
});

// Money from closed business days: collections by mode, fuel and shop sales, expenses (for the Book and Reports)
app.get("/api/duty-money", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const f = validDay(q.query.from) ? q.query.from : "0000-01-01", t = validDay(q.query.to) ? q.query.to : "9999-12-31";
  const days = db.prepare("select d from days where pump_id=? and status in ('closed','approved') and d>=? and d<=? order by d").all(pid, f, t);
  s.json(days.map(({ d }) => {
    const ds = db.prepare("select * from duties where pump_id=? and d=? and status='closed' order by id").all(pid, d).map((x) => detail(x, pid));
    const pay = {}, fuel = {}, lube = {}, exp = [];
    let fuelTotal = 0, lubeTotal = 0, credit = 0;
    ds.forEach((x) => {
      Object.keys(x.pay).forEach((k) => (pay[k] = r2((pay[k] || 0) + (+x.pay[k] || 0))));
      x.lines.forEach((l) => { const k = l.fuel || "Other", o = fuel[k] || (fuel[k] = { litres: 0, amount: 0 }); o.litres = r2(o.litres + l.litres); o.amount = r2(o.amount + l.amount); });
      x.items.forEach((i) => { const o = lube[i.item_id] || (lube[i.item_id] = { item_id: i.item_id, name: i.name, qty: 0, amount: 0 }); o.qty = r2(o.qty + i.qty); o.amount = r2(o.amount + i.amount); });
      x.expenses.forEach((e) => exp.push({ cat: e.cat, note: e.note, amount: e.amount, worker: x.worker }));
      fuelTotal += x.sales; lubeTotal += x.lube; credit += x.credit;
    });
    return { d, pay, fuel, lube: Object.values(lube), exp, fuelTotal: r2(fuelTotal), lubeTotal: r2(lubeTotal), credit: r2(credit), duties: ds.length };
  }));
});

// Closed duties with their sales and cash difference, for the shortage report
app.get("/api/shortage-data", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const f = validDay(q.query.from) ? q.query.from : "0000-01-01", t = validDay(q.query.to) ? q.query.to : "9999-12-31";
  s.json(db.prepare("select * from duties where pump_id=? and status='closed' and d>=? and d<=? order by d,id").all(pid, f, t).map((x) => detail(x, pid))
    .map((x) => ({ id: x.id, d: x.d, shift: x.shift, worker_id: x.worker_id, worker: x.worker, sales: r2(x.sales + x.lube), diff: x.diff })));
});

// ---- Daily 6:00 AM Cash Flow: Opening Cash + Morning Shift - Bank Deposit + Evening Shift + Night Shift = Closing Balance
function prevDay(d) {
  const dt = new Date(d + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
function nextDay(d) {
  const dt = new Date(d + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function computeDayCashFlow(pid, d, visited = new Set()) {
  if (!validDay(d)) d = bizDate();
  if (visited.has(d)) return { closing_cash: 0 };
  visited.add(d);

  const ds = db.prepare("select * from duties where pump_id=? and d=? and status in ('submitted','closed') order by id").all(pid, d).map((x) => detail(x, pid));

  const shifts = {
    Morning: { cash: 0, litres: 0, sales: 0, lube: 0, credit: 0, exp: 0, duties: [] },
    Evening: { cash: 0, litres: 0, sales: 0, lube: 0, credit: 0, exp: 0, duties: [] },
    Night: { cash: 0, litres: 0, sales: 0, lube: 0, credit: 0, exp: 0, duties: [] },
    Other: { cash: 0, litres: 0, sales: 0, lube: 0, credit: 0, exp: 0, duties: [] }
  };

  ds.forEach((x) => {
    const k = ["Morning", "Evening", "Night"].includes(x.shift) ? x.shift : "Other";
    shifts[k].cash = r2(shifts[k].cash + (+x.cash || 0));
    shifts[k].litres = r2(shifts[k].litres + (+x.litres || 0));
    shifts[k].sales = r2(shifts[k].sales + (+x.sales || 0));
    shifts[k].lube = r2(shifts[k].lube + (+x.lube || 0));
    shifts[k].credit = r2(shifts[k].credit + (+x.credit || 0));
    shifts[k].exp = r2(shifts[k].exp + (+x.exp || 0));
    shifts[k].duties.push({
      id: x.id,
      worker_id: x.worker_id,
      worker: x.worker,
      shift: x.shift,
      cash: x.cash,
      upi: x.upi,
      card: x.card,
      sales: x.sales,
      litres: x.litres,
      credit: x.credit,
      diff: x.diff,
      status: x.status
    });
  });

  const dbDeps = db.prepare("select * from bank_deposits where pump_id=? and d=? order by created_at desc, id desc").all(pid, d);
  const st = stateNow(pid);
  const bkDeps = (st.bk || []).filter((b) => b.d === d && b.t === "xfer" && b.acct === "Cash" && (b.to === "Bank" || b.dep));
  const seenDeps = new Set(dbDeps.map((x) => String(x.id)));
  const allDeposits = [...dbDeps];
  bkDeps.forEach((b) => {
    if (!seenDeps.has(String(b.id)) && !seenDeps.has(String(b.dep_id))) {
      allDeposits.push({
        id: b.id,
        pump_id: pid,
        d: b.d,
        amount: +b.a || 0,
        bank_name: b.bank || "Bank Account",
        slip_no: b.slip || "",
        deposited_by: b.by || "",
        note: b.n || "",
        created_at: b.id || now(),
        from_bk: true
      });
    }
  });

  const total_bank_deposit = r2(allDeposits.reduce((acc, dep) => acc + (+dep.amount || 0), 0));

  let other_in = 0, other_out = 0;
  (st.bk || []).forEach((b) => {
    if (b.d === d && b.acct === "Cash") {
      if (b.t === "in") other_in = r2(other_in + (+b.a || 0));
      else if (b.t === "out") other_out = r2(other_out + (+b.a || 0));
    }
  });

  // Opening Cash: manual override or auto-chain from previous day's closing balance
  const row = db.prepare("select opening_cash, opening_manual, notes from cash_flow_days where pump_id=? and d=?").get(pid, d);
  let opening_cash = 0;
  let opening_is_manual = false;

  if (row && row.opening_manual) {
    opening_cash = r2(row.opening_cash || 0);
    opening_is_manual = true;
  } else {
    // Look for previous business day
    const priorDay = db.prepare(`
      select d from (
        select d from duties where pump_id=? and d < ?
        union
        select d from bank_deposits where pump_id=? and d < ?
        union
        select d from cash_flow_days where pump_id=? and d < ?
      ) order by d desc limit 1
    `).get(pid, d, pid, d, pid, d);

    if (priorDay && !visited.has(priorDay.d)) {
      const priorCf = computeDayCashFlow(pid, priorDay.d, new Set(visited));
      opening_cash = r2(priorCf.closing_cash || 0);
    } else {
      opening_cash = r2((st.ob && st.ob.Cash) || 0);
    }
  }

  const morning_cash = r2(shifts.Morning.cash);
  const evening_cash = r2(shifts.Evening.cash);
  const night_cash = r2(shifts.Night.cash);
  const other_shift_cash = r2(shifts.Other.cash);
  const total_shift_cash = r2(morning_cash + evening_cash + night_cash + other_shift_cash);

  const subtotal_after_morning = r2(opening_cash + morning_cash);
  const subtotal_after_deposit = r2(subtotal_after_morning - total_bank_deposit);
  const closing_cash = r2(
    opening_cash + morning_cash - total_bank_deposit + evening_cash + night_cash + other_shift_cash + other_in - other_out
  );
  const next_day_opening = closing_cash;

  try {
    db.prepare(`
      insert into cash_flow_days(pump_id, d, opening_cash, opening_manual, closing_cash, notes)
      values(?, ?, ?, ?, ?, ?)
      on conflict(pump_id, d) do update set
        opening_cash = case when cash_flow_days.opening_manual = 1 then cash_flow_days.opening_cash else excluded.opening_cash end,
        closing_cash = excluded.closing_cash
    `).run(pid, d, opening_cash, opening_is_manual ? 1 : 0, closing_cash, row ? row.notes : "");
  } catch (e) {}

  return {
    d,
    prev_d: prevDay(d),
    next_d: nextDay(d),
    day_status: dayStatus(d, pid),
    opening_cash,
    opening_is_manual,
    morning_cash,
    bank_deposit: total_bank_deposit,
    evening_cash,
    night_cash,
    other_shift_cash,
    total_shift_cash,
    subtotal_after_morning,
    subtotal_after_deposit,
    other_in,
    other_out,
    closing_cash,
    next_day_opening,
    shifts,
    bank_deposits: allDeposits
  };
}

// Cash flow API routes
app.get(["/api/cashflow/day", "/api/cashflow/day/:d"], need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = validDay(q.params.d || q.query.d) ? (q.params.d || q.query.d) : bizDate();
  s.json(computeDayCashFlow(pid, d));
});

app.post("/api/cashflow/deposit", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { d, amount, bank_name, slip_no, deposited_by, note } = q.body || {};
  const day = validDay(d) ? d : bizDate();
  const amt = num(amount);
  if (!amt || amt <= 0) return s.status(400).json({ error: "Enter a deposit amount above ₹0." });

  const depId = db.prepare(`
    insert into bank_deposits(pump_id, d, amount, bank_name, slip_no, deposited_by, note, created_at, user_id)
    values(?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pid, day, amt, String(bank_name || "Bank").trim(), String(slip_no || "").trim(), String(deposited_by || q.user.name).trim(), String(note || "").trim(), now(), q.user.id).lastInsertRowid;

  // Sync with S.bk for Book compatibility
  try {
    const st = stateNow(pid);
    const bkList = Array.isArray(st.bk) ? [...st.bk] : [];
    bkList.push({
      id: Date.now(),
      dep_id: depId,
      d: day,
      t: "xfer",
      acct: "Cash",
      to: "Bank",
      bank: String(bank_name || "Bank").trim(),
      a: amt,
      dep: 1,
      slip: String(slip_no || "").trim(),
      by: String(deposited_by || q.user.name).trim()
    });
    const curSec = db.prepare("select ver, json from sections where pump_id=? and name='bk'").get(pid);
    const curObj = curSec ? JSON.parse(curSec.json) : { bk: [], ob: { Cash: 0, Bank: 0, UPI: 0 } };
    curObj.bk = bkList;
    db.prepare("insert into sections(pump_id, name, ver, json) values(?, 'bk', ?, ?) on conflict(pump_id, name) do update set ver=excluded.ver, json=excluded.json")
      .run(pid, "bk", (curSec ? curSec.ver : 0) + 1, JSON.stringify(curObj));
  } catch (e) {}

  audit(q.user, "bank deposit", `Recorded bank deposit of ₹${amt} on ${day} (Slip: ${slip_no || "none"})`);
  s.json({ ok: true, id: depId, flow: computeDayCashFlow(pid, day) });
});

app.delete("/api/cashflow/deposit/:id", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const depId = +q.params.id;
  const dep = db.prepare("select * from bank_deposits where id=? and pump_id=?").get(depId, pid);
  if (!dep) {
    try {
      const curSec = db.prepare("select ver, json from sections where pump_id=? and name='bk'").get(pid);
      if (curSec) {
        const curObj = JSON.parse(curSec.json);
        curObj.bk = (curObj.bk || []).filter((b) => b.id !== depId && b.dep_id !== depId);
        db.prepare("update sections set ver=ver+1, json=? where pump_id=? and name='bk'").run(JSON.stringify(curObj), pid);
      }
    } catch (e) {}
    return s.json({ ok: true });
  }

  db.prepare("delete from bank_deposits where id=? and pump_id=?").run(depId, pid);
  try {
    const curSec = db.prepare("select ver, json from sections where pump_id=? and name='bk'").get(pid);
    if (curSec) {
      const curObj = JSON.parse(curSec.json);
      curObj.bk = (curObj.bk || []).filter((b) => b.dep_id !== depId && b.id !== depId);
      db.prepare("update sections set ver=ver+1, json=? where pump_id=? and name='bk'").run(JSON.stringify(curObj), pid);
    }
  } catch (e) {}

  audit(q.user, "delete bank deposit", `Deleted bank deposit of ₹${dep.amount} from ${dep.d}`);
  s.json({ ok: true, flow: computeDayCashFlow(pid, dep.d) });
});

app.post("/api/cashflow/opening", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { d, opening_cash, note } = q.body || {};
  const day = validDay(d) ? d : bizDate();
  const amt = num(opening_cash);
  if (isNaN(amt) || amt < 0) return s.status(400).json({ error: "Enter a valid opening cash amount (₹0 or greater)." });

  db.prepare(`
    insert into cash_flow_days(pump_id, d, opening_cash, opening_manual, notes)
    values(?, ?, ?, 1, ?)
    on conflict(pump_id, d) do update set opening_cash=excluded.opening_cash, opening_manual=1, notes=excluded.notes
  `).run(pid, day, amt, String(note || "").trim());

  audit(q.user, "set opening cash", `Set 6 AM opening cash to ₹${amt} on ${day}`);
  s.json({ ok: true, flow: computeDayCashFlow(pid, day) });
});

app.post("/api/cashflow/reset-opening", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const { d } = q.body || {};
  const day = validDay(d) ? d : bizDate();

  db.prepare(`
    update cash_flow_days set opening_manual=0 where pump_id=? and d=?
  `).run(pid, day);

  audit(q.user, "reset opening cash", `Reset 6 AM opening cash to auto-carry from previous day on ${day}`);
  s.json({ ok: true, flow: computeDayCashFlow(pid, day) });
});

app.get("/api/cashflow/register", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const today = bizDate();
  const f = validDay(q.query.from) ? q.query.from : prevDay(prevDay(prevDay(prevDay(prevDay(prevDay(prevDay(today)))))));
  const t = validDay(q.query.to) ? q.query.to : today;

  const rows = [];
  let cur = f;
  let count = 0;
  while (cur <= t && count < 60) {
    rows.push(computeDayCashFlow(pid, cur));
    cur = nextDay(cur);
    count++;
  }
  s.json({ from: f, to: t, days: rows });
});

// ---- Fuel tanks: dip readings and stock check

function fromChart(chart, dip) {
  const c = (chart || []).map((x) => ({ cm: +x.cm, l: +x.l })).filter((x) => Number.isFinite(x.cm) && Number.isFinite(x.l)).sort((a, b) => a.cm - b.cm);
  if (c.length < 2) return { err: "This tank has no dip chart yet. Enter litres directly, or ask the manager to add the chart." };
  if (dip < c[0].cm || dip > c[c.length - 1].cm) return { err: "This dip is outside the tank's chart range. Check the reading." };
  for (let i = 1; i < c.length; i++) {
    if (dip <= c[i].cm) { const a = c[i - 1], b = c[i]; return { l: r2(b.cm === a.cm ? b.l : a.l + ((dip - a.cm) / (b.cm - a.cm)) * (b.l - a.l)) }; }
  }
  return { l: c[c.length - 1].l };
}
function tankChecks(pumpId = 1) {
  const st = stateNow(pumpId), tanks = st.tanks || [], dv = st.deliv || [], tankOf = {};
  (st.nozzles || []).forEach((n) => {
    let tid = String(n.tank_id || "");
    if (!tid) {
      const matchTk = tanks.find((t) => t.fuel === n.fuel);
      if (matchTk) tid = String(matchTk.id);
    }
    tankOf[String(n.id)] = tid;
  });

  const dutyLines = db.prepare(`
    select d.d, coalesce(d.closed_at, d.submitted, d.started) t, dl.nozzle_id n,
           (case when dl.closing is not null and dl.opening is not null and dl.closing >= dl.opening then dl.closing - dl.opening else 0 end) gross,
           coalesce(dl.testing, 0) testing
    from duty_lines dl
    join duties d on d.id=dl.duty_id
    where d.pump_id=? and d.status in ('submitted','closed')
  `).all(pumpId);

  const meterRows = db.prepare("select * from meter_readings where pump_id=? order by d asc, id asc").all(pumpId);
  const dips = db.prepare("select di.*, u.name by_name from dips di join users u on u.id=di.user_id where di.pump_id=? order by di.t asc, di.id asc").all(pumpId);
  const closedDays = new Set(
    db.prepare("select d from days where pump_id=? and status in ('closed', 'approved')").all(pumpId).map((x) => x.d)
  );

  const dutyByDateNoz = {};
  dutyLines.forEach((s) => {
    if (!s.d || !s.n) return;
    const k = s.d + "_" + String(s.n);
    if (!dutyByDateNoz[k]) {
      dutyByDateNoz[k] = { gross: 0, testing: 0, net: 0, t: s.t };
    }
    dutyByDateNoz[k].gross = r2(dutyByDateNoz[k].gross + s.gross);
    dutyByDateNoz[k].testing = r2(dutyByDateNoz[k].testing + s.testing);
    dutyByDateNoz[k].net = r2(dutyByDateNoz[k].net + (s.gross - s.testing));
    if (s.t > (dutyByDateNoz[k].t || 0)) dutyByDateNoz[k].t = s.t;
  });

  const meterByDateNoz = {};
  meterRows.forEach((mr) => {
    if (!mr.d || !mr.nozzle_id) return;
    meterByDateNoz[mr.d + "_" + String(mr.nozzle_id)] = mr;
  });

  function getPriorClosing(nid, beforeDate) {
    const priorMr = db.prepare(`
      select closing from meter_readings
      where pump_id=? and nozzle_id=? and d < ?
      order by d desc, id desc limit 1
    `).get(pumpId, nid, beforeDate);
    if (priorMr && priorMr.closing != null && !isNaN(+priorMr.closing)) {
      return +priorMr.closing;
    }
    const priorDuty = db.prepare(`
      select dl.closing from duty_lines dl
      join duties d on d.id=dl.duty_id
      where d.pump_id=? and dl.nozzle_id=? and d.d < ? and dl.closing is not null
      order by d.d desc, d.id desc limit 1
    `).get(pumpId, nid, beforeDate);
    if (priorDuty && priorDuty.closing != null && !isNaN(+priorDuty.closing)) {
      return +priorDuty.closing;
    }
    const noz = (st.nozzles || []).find((n) => String(n.id) === nid);
    if (noz && noz.open != null && !isNaN(+noz.open)) {
      return +noz.open;
    }
    return null;
  }

  return tanks.map((tk) => {
    const tid = String(tk.id);
    const ds = dips.filter((x) => String(x.tank_id) === tid);

    // Map dips by date
    const dipsByDate = {};
    ds.forEach((di) => {
      const dDate = new Date(di.t * 1000 - 6 * 3600e3).toLocaleDateString("en-CA", { timeZone: TZ });
      dipsByDate[dDate] = di;
    });

    // Map deliveries by date for this tank
    const delivByDate = {};
    dv.forEach((dlv) => {
      const dLitres = (dlv.lines || [])
        .filter((l) => String(l.tank_id) === tid)
        .reduce((sum, l) => sum + (+l.litres || 0), 0);
      if (dLitres > 0) {
        delivByDate[dlv.d] = r2((delivByDate[dlv.d] || 0) + dLitres);
      }
    });

    // Find all nozzles attached to this tank
    const myNozzles = (st.nozzles || []).filter((n) => tankOf[String(n.id)] === tid);

    // Collect all dates that have activity for this tank's nozzles
    const activeDatesForTank = new Set();
    dutyLines.forEach((s) => {
      if (tankOf[String(s.n)] === tid && s.d) activeDatesForTank.add(s.d);
    });
    meterRows.forEach((mr) => {
      if (tankOf[String(mr.nozzle_id)] === tid && mr.d) activeDatesForTank.add(mr.d);
    });
    closedDays.forEach((cd) => activeDatesForTank.add(cd));

    // Calculate Sales by Date across ALL nozzles of this tank
    const salesByDate = {};
    activeDatesForTank.forEach((dStr) => {
      let gTot = 0, tTot = 0, nTot = 0, maxT = 0;
      myNozzles.forEach((noz) => {
        const nid = String(noz.id);
        const dk = dStr + "_" + nid;
        if (dutyByDateNoz[dk]) {
          const dsRow = dutyByDateNoz[dk];
          gTot = r2(gTot + dsRow.gross);
          tTot = r2(tTot + dsRow.testing);
          nTot = r2(nTot + dsRow.net);
          if (dsRow.t > maxT) maxT = dsRow.t;
        } else if (meterByDateNoz[dk]) {
          const mr = meterByDateNoz[dk];
          const prev = getPriorClosing(nid, dStr);
          if (mr.closing != null && prev != null && mr.closing >= prev) {
            const g = r2(mr.closing - prev);
            const tst = r2(mr.testing || 0);
            const n = r2(g - tst);
            gTot = r2(gTot + g);
            tTot = r2(tTot + tst);
            nTot = r2(nTot + n);
            if (mr.updated_at > maxT) maxT = mr.updated_at;
          }
        }
      });
      if (gTot > 0 || tTot > 0 || nTot > 0 || closedDays.has(dStr)) {
        salesByDate[dStr] = {
          gross: gTot,
          testing: tTot,
          net: nTot,
          t: maxT || Math.floor(new Date(dStr + "T23:59:59+05:30").getTime() / 1000)
        };
      }
    });

    const allDatesSet = new Set([
      ...Object.keys(dipsByDate),
      ...Object.keys(delivByDate),
      ...Object.keys(salesByDate),
      ...Array.from(closedDays)
    ]);

    const sortedDates = Array.from(allDatesSet).sort();
    const checks = [];
    let runningBookStock = ds.length > 0 ? ds[0].litres : 0;
    let cumSales = 0, cumVar = 0, currentMonth = null;

    for (let i = 0; i < sortedDates.length; i++) {
      const dDate = sortedDates[i];
      const nextDate = sortedDates[i + 1] || null;

      const dip = dipsByDate[dDate] || null;
      const nextDip = nextDate ? (dipsByDate[nextDate] || null) : null;

      let opening = dip ? dip.litres : runningBookStock;
      const opening_dip = dip ? dip.dip : null;

      const received = delivByDate[dDate] || 0;
      const totStock = r2(opening + received);

      const sm = salesByDate[dDate] || { gross: 0, testing: 0, net: 0 };
      const meter_sales = sm.gross;
      const pump_test = sm.testing;
      const net_meter_sales = sm.net;

      const monthKey = dDate.slice(0, 7);
      if (currentMonth !== monthKey) {
        currentMonth = monthKey;
        cumSales = 0;
        cumVar = 0;
      }
      cumSales = r2(cumSales + net_meter_sales);

      const actual = nextDip ? nextDip.litres : null;
      const closing_dip = nextDip ? nextDip.dip : null;
      const sales_by_dip = actual != null ? r2(totStock - actual) : null;
      const diff = sales_by_dip != null ? r2(net_meter_sales - sales_by_dip) : null;
      if (diff != null) {
        cumVar = r2(cumVar + diff);
      }

      const expected = r2(totStock - net_meter_sales);
      const variance = actual != null ? r2(actual - expected) : null;

      runningBookStock = actual != null ? actual : expected;
      const fRate = fuelRateFor(st, tk.fuel, dDate) ?? fuelRateFor(st, tk.fuel, bizDate());

      checks.push({
        id: dip ? dip.id : -1000 - i,
        d: dDate,
        from: dip ? dip.t : Math.floor(new Date(dDate + "T06:00:00+05:30").getTime() / 1000),
        to: nextDip ? nextDip.t : null,
        rate: fRate,
        opening,
        opening_dip,
        received,
        total_stock: totStock,
        meter_sales,
        pump_test,
        net_meter_sales,
        cumulative_sales: cumSales,
        sold: net_meter_sales,
        actual,
        closing_dip,
        sales_by_dip,
        diff,
        cumulative_variation: diff != null ? cumVar : null,
        expected,
        variance,
        note: dip ? (dip.note || "") : "",
        by: dip ? dip.by_name : (closedDays.has(dDate) ? "Day Closed (Auto)" : "Meter Duty"),
        is_latest: i === sortedDates.length - 1
      });
    }

    const lastDip = ds[ds.length - 1] || null;
    const book = r2(runningBookStock);

    return {
      id: tk.id,
      name: tk.name,
      fuel: tk.fuel,
      rate: fuelRateFor(st, tk.fuel, bizDate()),
      capacity: tk.capacity || 0,
      last: lastDip ? { id: lastDip.id, litres: lastDip.litres, dip: lastDip.dip, t: lastDip.t, by: lastDip.by_name } : null,
      book,
      checks: checks.slice(-365).reverse()
    };
  });
}
app.get("/api/tanks", need(), (q, s) => {
  const pid = q.user.pump_id;
  const st = stateNow(pid), names = {};
  (st.tanks || []).forEach((t) => (names[String(t.id)] = t.name));
  const mine = db.prepare("select id,tank_id,litres,dip,dens_obs,temp,d15,note,t from dips where pump_id=? and user_id=? order by id desc limit 10").all(pid, q.user.id).map((d) => ({ ...d, tank: names[d.tank_id] || "Tank" }));
  s.json({ tanks: (st.tanks || []).map((t) => ({ id: t.id, name: t.name, fuel: t.fuel, capacity: t.capacity || 0, chart: t.chart || [] })), mine });
});
app.post("/api/dips", need(), (q, s) => {
  const pid = q.user.pump_id;
  const b = q.body || {};
  const st = stateNow(pid);
  const allTanks = st.tanks || [];

  // Batch insertion for all tanks at once
  if (Array.isArray(b.readings)) {
    if (!b.readings.length) return s.status(400).json({ error: "No tank readings provided." });

    let ts = now();
    if (b.date) {
      let timeStr = b.time || "08:00:00";
      if (timeStr.length === 5) timeStr += ":00";
      const parsed = Math.floor(new Date(`${b.date}T${timeStr}+05:30`).getTime() / 1000);
      if (!isNaN(parsed) && parsed > 0) ts = parsed;
    }
    const note = String(b.note || "").slice(0, 200);

    const inserted = [];
    try {
      const tx = db.transaction(() => {
        for (const item of b.readings) {
          const tank = allTanks.find((t) => String(t.id) === String(item.tank_id));
          if (!tank) continue;

          let litres = num(item.litres);
          const dip = item.dip === "" || item.dip == null ? null : num(item.dip);

          if (Number.isNaN(litres)) {
            if (dip === null || Number.isNaN(dip)) continue;
            const r = fromChart(tank.chart, dip);
            if (r.err) throw new Error(r.err + ` for ${tank.name}`);
            litres = r.l;
          }

          if (tank.capacity && litres > tank.capacity * 1.05) {
            throw new Error(`${tank.name}: Litres (${litres} L) exceed tank capacity (${tank.capacity} L).`);
          }

          const id = db.prepare(
            "insert into dips(pump_id,tank_id,litres,dip,dens_obs,temp,d15,note,user_id,t) values(?,?,?,?,?,?,?,?,?,?)"
          ).run(pid, String(tank.id), r2(litres), dip, null, null, null, note, q.user.id, ts).lastInsertRowid;

          inserted.push({ id, tank_id: tank.id, litres: r2(litres) });
        }
      });
      tx();
    } catch (err) {
      return s.status(400).json({ error: err.message || "Could not save dip readings." });
    }

    if (!inserted.length) return s.status(400).json({ error: "Please enter a dip reading or litres for at least one tank." });

    audit(pid, q.user, "add_dips_batch", `Recorded dips for ${inserted.length} tanks`);
    return s.json({ ok: true, count: inserted.length, dips: inserted });
  }

  // Single tank backward compatibility
  const tank = allTanks.find((t) => String(t.id) === String(b.tank_id));
  if (!tank) return s.status(400).json({ error: "Choose a tank." });
  let litres = num(b.litres);
  const dip = b.dip === "" || b.dip == null ? null : num(b.dip);
  if (Number.isNaN(litres)) {
    if (dip === null || Number.isNaN(dip)) return s.status(400).json({ error: "Enter the litres or the dip reading." });
    const r = fromChart(tank.chart, dip);
    if (r.err) return s.status(400).json({ error: r.err });
    litres = r.l;
  }
  if (tank.capacity && litres > tank.capacity * 1.05) return s.status(400).json({ error: `That is more than the tank capacity (${tank.capacity} L). Check the reading.` });

  let ts = now();
  if (b.date) {
    let timeStr = b.time || "08:00:00";
    if (timeStr.length === 5) timeStr += ":00";
    const parsed = Math.floor(new Date(`${b.date}T${timeStr}+05:30`).getTime() / 1000);
    if (!isNaN(parsed) && parsed > 0) ts = parsed;
  }

  const id = db.prepare("insert into dips(pump_id,tank_id,litres,dip,dens_obs,temp,d15,note,user_id,t) values(?,?,?,?,?,?,?,?,?,?)").run(pid, String(tank.id), r2(litres), dip, null, null, null, String(b.note || "").slice(0, 200), q.user.id, ts).lastInsertRowid;
  s.json({ id, litres: r2(litres) });
});
// ---- Density checks (deliveries and dips) with flags
const DENS_DEF = { "Petrol (MS)": { min: 0.72, max: 0.775 }, "Diesel (HSD)": { min: 0.82, max: 0.86 }, "Power petrol": { min: 0.72, max: 0.775 }, "Power diesel": { min: 0.82, max: 0.86 } };
function densCfg(st, fuel) {
  const p = (st.fuelprods || []).find((x) => x.name === fuel), d = DENS_DEF[fuel] || {}, pick = (x, def) => (x === undefined || x === null || x === "" ? def : +x);
  return { min: pick(p && p.dmin, d.min), max: pick(p && p.dmax, d.max), tol: pick(p && p.dtol, 0.003), unit: (p && p.unit) || "L" };
}
function densFlags(cfg, r) {
  const v = r.d15 ?? r.obs, f = [];
  if (v == null || cfg.unit !== "L") return f;
  if ((cfg.min != null && v < cfg.min) || (cfg.max != null && v > cfg.max)) f.push(`Outside the allowed range (${cfg.min} to ${cfg.max})`);
  if (r.inv != null && Math.abs(v - r.inv) > cfg.tol + 1e-9) f.push(`Differs from the invoice density by ${(Math.abs(v - r.inv)).toFixed(4)} (limit ${cfg.tol})`);
  return f;
}
app.get("/api/density", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const st = stateNow(pid), tanks = {}, rows = [], nn = (x) => (x === "" || x == null || !Number.isFinite(+x) ? null : +x);
  (st.tanks || []).forEach((t) => (tanks[String(t.id)] = t));
  (st.deliv || []).forEach((d) => (d.lines || []).forEach((l) => {
    const dn = l.dens, t = tanks[String(l.tank_id)];
    if (!dn || !t) return;
    const o = { src: "Delivery", t: Math.floor((d.ts || 0) / 1000), d: d.d, tank: t.name, fuel: t.fuel, inv: nn(dn.inv), obs: nn(dn.obs), temp: nn(dn.temp), d15: nn(dn.d15), by: "" };
    if (o.inv == null && o.obs == null && o.d15 == null) return;
    o.flags = densFlags(densCfg(st, t.fuel), o); rows.push(o);
  }));
  db.prepare("select di.*, u.name by_name from dips di join users u on u.id=di.user_id where di.pump_id=? and (di.dens_obs is not null or di.d15 is not null) order by di.t desc limit 200").all(pid).forEach((x) => {
    const t = tanks[x.tank_id]; if (!t) return;
    const o = { src: "Dip", t: x.t, d: new Date(x.t * 1000).toLocaleDateString("en-CA", { timeZone: TZ }), tank: t.name, fuel: t.fuel, inv: null, obs: x.dens_obs, temp: x.temp, d15: x.d15, by: x.by_name };
    o.flags = densFlags(densCfg(st, t.fuel), o); rows.push(o);
  });
  rows.sort((a, b) => b.t - a.t);
  s.json(rows.slice(0, 80));
});
app.get("/api/stock-check", need("owner", "manager"), (q, s) => s.json(tankChecks(q.user.pump_id)));
app.delete("/api/dips/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from dips where id=? and pump_id=?").run(+q.params.id, q.user.pump_id);
  s.json({ ok: true });
});
app.put("/api/dips/:id/note", need("owner", "manager"), (q, s) => {
  const note = String((q.body && q.body.note) || "").trim().slice(0, 200);
  db.prepare("update dips set note=? where id=? and pump_id=?").run(note, +q.params.id, q.user.pump_id);
  s.json({ ok: true, note });
});

// Statutory Daily Density Register (matches official Indian Oil / Petroleum Daily Density Register format)
app.get("/api/density-register", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const st = stateNow(pid), tanks = {}, tankList = st.tanks || [];
  tankList.forEach((t) => (tanks[String(t.id)] = t));

  const dbRows = db.prepare("select * from density_register where pump_id=? order by d desc, id desc limit 400").all(pid);
  const keyMap = {};
  dbRows.forEach((r) => {
    const t = tanks[String(r.tank_id)];
    r.tank_name = t ? t.name : "Tank";
    r.fuel = t ? t.fuel : "";
    keyMap[`${r.tank_id}_${r.d}`] = r;
  });

  // Synthesize from dips
  db.prepare("select di.*, u.name by_name from dips di join users u on u.id=di.user_id where di.pump_id=? and (di.dens_obs is not null or di.d15 is not null) order by di.t desc limit 150").all(pid).forEach((x) => {
    const t = tanks[String(x.tank_id)];
    if (!t) return;
    const dStr = new Date(x.t * 1000).toLocaleDateString("en-CA", { timeZone: TZ });
    const k = `${x.tank_id}_${dStr}`;
    if (!keyMap[k]) {
      const syn = {
        id: -x.id,
        synthetic: true,
        tank_id: String(x.tank_id),
        tank_name: t.name,
        fuel: t.fuel,
        d: dStr,
        t: x.t,
        m_obs: x.dens_obs != null ? (x.dens_obs < 2 ? r2(x.dens_obs * 1000) : x.dens_obs) : null,
        m_temp: x.temp,
        m_d15: x.d15 != null ? (x.d15 < 2 ? r2(x.d15 * 1000) : x.d15) : null,
        comp1: null, comp2: null, comp3: null, comp4: null,
        mix_dens: null, chalan_dens: null, dens_diff: null,
        pre_dip: x.dip, pre_stock: x.litres,
        post_dens: null, receipt_kl: null, chalan_no: "",
        by_name: x.by_name
      };
      keyMap[k] = syn;
      dbRows.push(syn);
    }
  });

  // Synthesize from fuel deliveries
  (st.deliv || []).forEach((dlv) => {
    (dlv.lines || []).forEach((l) => {
      const t = tanks[String(l.tank_id)];
      if (!t) return;
      const k = `${l.tank_id}_${dlv.d}`;
      const dn = l.dens || {};
      const inv = dn.inv != null ? (dn.inv < 2 ? r2(dn.inv * 1000) : dn.inv) : null;
      const obs = dn.obs != null ? (dn.obs < 2 ? r2(dn.obs * 1000) : dn.obs) : null;
      const d15 = dn.d15 != null ? (dn.d15 < 2 ? r2(dn.d15 * 1000) : dn.d15) : null;
      const recKl = l.litres ? r2(l.litres / 1000) : null;

      if (keyMap[k]) {
        const row = keyMap[k];
        if (row.chalan_dens == null) row.chalan_dens = inv;
        if (row.mix_dens == null) row.mix_dens = obs || d15;
        if (row.post_dens == null) row.post_dens = d15 || obs;
        if (row.receipt_kl == null) row.receipt_kl = recKl;
        if (!row.chalan_no) row.chalan_no = dlv.billno || "";
        if (row.mix_dens != null && row.chalan_dens != null && row.dens_diff == null) {
          row.dens_diff = r2(Math.abs(row.mix_dens - row.chalan_dens));
        }
      } else {
        const syn = {
          id: -(dlv.id || Date.now()),
          synthetic: true,
          tank_id: String(l.tank_id),
          tank_name: t.name,
          fuel: t.fuel,
          d: dlv.d,
          t: Math.floor((dlv.ts || Date.now()) / 1000),
          m_obs: null, m_temp: dn.temp || null, m_d15: null,
          comp1: obs || d15, comp2: null, comp3: null, comp4: null,
          mix_dens: obs || d15,
          chalan_dens: inv,
          dens_diff: (obs || d15) != null && inv != null ? r2(Math.abs((obs || d15) - inv)) : null,
          pre_dip: null, pre_stock: null,
          post_dens: d15 || obs,
          receipt_kl: recKl,
          chalan_no: dlv.billno || "",
          by_name: ""
        };
        keyMap[k] = syn;
        dbRows.push(syn);
      }
    });
  });

  dbRows.sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : (b.id || 0) - (a.id || 0)));
  s.json({ tanks: tankList, rows: dbRows });
});

app.post("/api/density-register", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const b = q.body || {};

  // Batch insertion for multi-tank morning density
  if (Array.isArray(b.readings)) {
    if (!b.readings.length) return s.status(400).json({ error: "No tank density readings provided." });
    const d = String(b.d || b.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Please enter a valid date (YYYY-MM-DD)." });

    const num = (x) => (x === "" || x === undefined || x === null || Number.isNaN(+x) ? null : +x);
    const normDens = (v) => {
      if (v == null) return null;
      return v < 2 ? r2(v * 1000) : r2(v);
    };

    const t = Math.floor(new Date(d + "T08:00:00").getTime() / 1000);
    const processed = [];

    try {
      const tx = db.transaction(() => {
        for (const item of b.readings) {
          const tid = String(item.tank_id || "").trim();
          if (!tid) continue;

          const m_obs = normDens(num(item.m_obs));
          const m_temp = num(item.m_temp);
          let m_d15 = normDens(num(item.m_d15));

          if (m_d15 == null && m_obs != null && m_temp != null) {
            m_d15 = r2(m_obs + (m_temp - 15) * 0.89);
          }

          if (m_obs == null && m_d15 == null) continue;

          const existing = db.prepare("select * from density_register where pump_id=? and tank_id=? and d=? order by id desc limit 1").get(pid, tid, d);
          if (existing) {
            const final_m_obs = m_obs !== null ? m_obs : existing.m_obs;
            const final_m_temp = m_temp !== null ? m_temp : existing.m_temp;
            const final_m_d15 = m_d15 !== null ? m_d15 : existing.m_d15;
            db.prepare(`
              update density_register set
                m_obs = ?,
                m_temp = ?,
                m_d15 = ?,
                user_id = ?,
                by_name = ?
              where id = ? and pump_id = ?
            `).run(final_m_obs, final_m_temp, final_m_d15, q.user.id, q.user.name, existing.id, pid);
            processed.push({ id: existing.id, tank_id: tid, updated: true });
          } else {
            const ins = db.prepare(`
              insert into density_register(pump_id, tank_id, d, t, m_obs, m_temp, m_d15, user_id, by_name)
              values(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(pid, tid, d, t, m_obs, m_temp, m_d15, q.user.id, q.user.name);
            processed.push({ id: ins.lastInsertRowid, tank_id: tid, created: true });
          }
        }
      });
      tx();
    } catch (err) {
      return s.status(400).json({ error: err.message || "Could not save morning density readings." });
    }

    if (!processed.length) return s.status(400).json({ error: "Please enter observed density for at least one tank." });

    audit(q.user, "add_morning_densities_batch", `Recorded morning densities for ${processed.length} tanks on ${d}`);
    return s.json({ ok: true, count: processed.length, entries: processed });
  }

  const tid = String(b.tank_id || "").trim();
  if (!tid) return s.status(400).json({ error: "Please select a tank." });
  const d = String(b.d || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Please enter a valid date (YYYY-MM-DD)." });

  const num = (x) => (x === "" || x === undefined || x === null || Number.isNaN(+x) ? null : +x);
  const normDens = (v) => {
    if (v == null) return null;
    return v < 2 ? r2(v * 1000) : r2(v);
  };

  const m_obs = normDens(num(b.m_obs));
  const m_temp = num(b.m_temp);
  let m_d15 = normDens(num(b.m_d15));

  if (m_d15 == null && m_obs != null && m_temp != null) {
    m_d15 = r2(m_obs + (m_temp - 15) * 0.89);
  }

  const comp1 = normDens(num(b.comp1));
  const comp2 = normDens(num(b.comp2));
  const comp3 = normDens(num(b.comp3));
  const comp4 = normDens(num(b.comp4));

  const comps = [comp1, comp2, comp3, comp4].filter((x) => x != null);
  let mix_dens = normDens(num(b.mix_dens));
  if (mix_dens == null && comps.length > 0) {
    mix_dens = r2(comps.reduce((a, c) => a + c, 0) / comps.length);
  }

  const chalan_dens = normDens(num(b.chalan_dens));
  let dens_diff = num(b.dens_diff);
  if (dens_diff == null && mix_dens != null && chalan_dens != null) {
    dens_diff = r2(Math.abs(mix_dens - chalan_dens));
  }

  const pre_dip = num(b.pre_dip);
  const pre_stock = num(b.pre_stock);
  const post_dens = normDens(num(b.post_dens));
  const receipt_kl = num(b.receipt_kl);
  const chalan_no = String(b.chalan_no || "").trim().slice(0, 50);

  const t = Math.floor(new Date(d + "T10:00:00").getTime() / 1000);

  // Check if an existing record exists for this tank on this date
  let existing = null;
  if (b.id) {
    existing = db.prepare("select * from density_register where id=? and pump_id=?").get(+b.id, pid);
  } else {
    existing = db.prepare("select * from density_register where pump_id=? and tank_id=? and d=? order by id desc limit 1").get(pid, tid, d);
  }

  if (existing) {
    const final_m_obs = m_obs !== null ? m_obs : existing.m_obs;
    const final_m_temp = m_temp !== null ? m_temp : existing.m_temp;
    const final_m_d15 = m_d15 !== null ? m_d15 : existing.m_d15;
    const final_comp1 = comp1 !== null ? comp1 : existing.comp1;
    const final_comp2 = comp2 !== null ? comp2 : existing.comp2;
    const final_comp3 = comp3 !== null ? comp3 : existing.comp3;
    const final_comp4 = comp4 !== null ? comp4 : existing.comp4;
    const final_mix_dens = mix_dens !== null ? mix_dens : existing.mix_dens;
    const final_chalan_dens = chalan_dens !== null ? chalan_dens : existing.chalan_dens;
    const final_dens_diff = dens_diff !== null ? dens_diff : existing.dens_diff;
    const final_pre_dip = pre_dip !== null ? pre_dip : existing.pre_dip;
    const final_pre_stock = pre_stock !== null ? pre_stock : existing.pre_stock;
    const final_post_dens = post_dens !== null ? post_dens : existing.post_dens;
    const final_receipt_kl = receipt_kl !== null ? receipt_kl : existing.receipt_kl;
    const final_chalan_no = chalan_no ? chalan_no : existing.chalan_no;

    db.prepare(`
      update density_register set
        m_obs=?, m_temp=?, m_d15=?,
        comp1=?, comp2=?, comp3=?, comp4=?,
        mix_dens=?, chalan_dens=?, dens_diff=?,
        pre_dip=?, pre_stock=?, post_dens=?,
        receipt_kl=?, chalan_no=?, user_id=?, by_name=?
      where id=? and pump_id=?
    `).run(
      final_m_obs, final_m_temp, final_m_d15,
      final_comp1, final_comp2, final_comp3, final_comp4,
      final_mix_dens, final_chalan_dens, final_dens_diff,
      final_pre_dip, final_pre_stock, final_post_dens,
      final_receipt_kl, final_chalan_no, q.user.id, q.user.name,
      existing.id, pid
    );
    return s.json({ ok: true, id: existing.id, updated: true });
  }

  const stmt = db.prepare(`
    insert into density_register(pump_id, tank_id, d, t, m_obs, m_temp, m_d15, comp1, comp2, comp3, comp4, mix_dens, chalan_dens, dens_diff, pre_dip, pre_stock, post_dens, receipt_kl, chalan_no, user_id, by_name)
    values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(pid, tid, d, t, m_obs, m_temp, m_d15, comp1, comp2, comp3, comp4, mix_dens, chalan_dens, dens_diff, pre_dip, pre_stock, post_dens, receipt_kl, chalan_no, q.user.id, q.user.name);

  s.json({ ok: true, id: info.lastInsertRowid });
});

app.delete("/api/density-register/:id", need("owner", "manager"), (q, s) => {
  const id = +q.params.id;
  if (id > 0) {
    db.prepare("delete from density_register where id=? and pump_id=?").run(id, q.user.pump_id);
  }
  s.json({ ok: true });
});

// ---- Daily Meter Register API (Statutory Pump Meter Sheet)
app.get("/api/meters", need(), (q, s) => {
  const pid = q.user.pump_id || 1;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.query.month || "") ? q.query.month : null;
  const st = stateNow(pid);
  const nozzles = st.nozzles || [];

  let rows;
  if (month) {
    rows = db.prepare("select * from meter_readings where pump_id=? and d like ? order by d asc, id asc").all(pid, month + "%");
  } else {
    rows = db.prepare("select * from meter_readings where pump_id=? order by d asc, id asc").all(pid);
  }

  // Pre-calculate the latest closing reading immediately prior to the requested month (or today) for each nozzle
  const firstDate = month ? month + "-01" : today();
  const priorClosings = {};
  for (const n of nozzles) {
    const nid = String(n.id);
    const prior = db.prepare(`
      select closing from meter_readings
      where pump_id=? and nozzle_id=? and d < ?
      order by d desc, id desc limit 1
    `).get(pid, nid, firstDate);

    if (prior && prior.closing != null) {
      priorClosings[nid] = prior.closing;
    } else {
      const dutyPrior = db.prepare(`
        select dl.closing from duty_lines dl
        join duties d on d.id=dl.duty_id
        where d.pump_id=? and dl.nozzle_id=? and d.d < ? and dl.closing is not null
        order by d.d desc, d.id desc limit 1
      `).get(pid, nid, firstDate);
      if (dutyPrior && dutyPrior.closing != null) {
        priorClosings[nid] = dutyPrior.closing;
      } else if (n.open != null && !isNaN(+n.open)) {
        priorClosings[nid] = +n.open;
      }
    }
  }

  s.json({ rows, prior: priorClosings });
});

app.get("/api/meters/prev", need(), (q, s) => {
  const pid = q.user.pump_id || 1;
  const targetDate = String(q.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return s.status(400).json({ error: "Valid date required." });

  const st = stateNow(pid);
  const nozzles = st.nozzles || [];
  const res = {};

  for (const n of nozzles) {
    const nid = String(n.id);
    // 1. Check existing reading for this exact date first (if editing)
    const current = db.prepare(`
      select closing, testing from meter_readings
      where pump_id=? and nozzle_id=? and d=?
    `).get(pid, nid, targetDate);

    // 2. Check latest reading strictly before targetDate
    const prior = db.prepare(`
      select closing, d from meter_readings
      where pump_id=? and nozzle_id=? and d < ?
      order by d desc, id desc limit 1
    `).get(pid, nid, targetDate);

    let prevClose = null;
    let prevDate = null;
    let source = "none";

    if (prior && prior.closing != null) {
      prevClose = prior.closing;
      prevDate = prior.d;
      source = "meter_register";
    } else {
      // Check duty_lines
      const dutyPrior = db.prepare(`
        select dl.closing, d.d from duty_lines dl
        join duties d on d.id=dl.duty_id
        where d.pump_id=? and dl.nozzle_id=? and d.d < ? and dl.closing is not null
        order by d.d desc, d.id desc limit 1
      `).get(pid, nid, targetDate);
      if (dutyPrior && dutyPrior.closing != null) {
        prevClose = dutyPrior.closing;
        prevDate = dutyPrior.d;
        source = "shift_duty";
      } else if (n.open != null && !isNaN(+n.open)) {
        prevClose = +n.open;
        source = "initial_setup";
      }
    }

    res[nid] = {
      prev_closing: prevClose,
      prev_date: prevDate,
      source: source,
      current_closing: current ? current.closing : null,
      current_testing: current ? current.testing : 0
    };
  }
  s.json(res);
});

app.post("/api/meters", need("owner", "manager", "worker"), (q, s) => {
  const pid = q.user.pump_id || 1;
  const b = q.body || {};
  const d = String(b.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Valid date YYYY-MM-DD is required." });
  const readings = Array.isArray(b.readings) ? b.readings : [];
  if (!readings.length) return s.status(400).json({ error: "No meter readings provided." });

  const nowTs = Math.floor(Date.now() / 1000);
  const ins = db.prepare(`
    insert into meter_readings(pump_id, d, nozzle_id, closing, testing, user_id, updated_at)
    values(?, ?, ?, ?, ?, ?, ?)
    on conflict(pump_id, d, nozzle_id) do update set
      closing=excluded.closing,
      testing=excluded.testing,
      user_id=excluded.user_id,
      updated_at=excluded.updated_at
  `);

  let count = 0;
  const tx = db.transaction(() => {
    for (const r of readings) {
      const nid = String(r.nozzle_id || "");
      if (!nid) continue;
      const closing = parseFloat(r.closing);
      const testing = parseFloat(r.testing) || 0;
      if (isNaN(closing) || closing < 0) continue;
      ins.run(pid, d, nid, closing, testing, q.user.id, nowTs);
      count++;
    }
  });
  tx();

  audit(pid, q.user, "save_meter_readings", `Date: ${d}, ${count} nozzles`);
  s.json({ ok: true, count, date: d });
});

app.delete("/api/meters/:date", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id || 1;
  const d = String(q.params.date || "").trim();
  if (!d) return s.status(400).json({ error: "Date required" });
  db.prepare("delete from meter_readings where pump_id=? and d=?").run(pid, d);
  audit(pid, q.user, "delete_meter_readings", `Date: ${d}`);
  s.json({ ok: true, date: d });
});

// ---- Worker pay (owner manages; each worker can see their own)
const SHIFTS = ["Morning", "Evening", "Night"];
const monthOf = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(m || "") ? m : today().slice(0, 7));
function payFor(u, month, pumpId = 1) {
  const pid = pumpId || u.pump_id || 1;
  const rates = {};
  db.prepare("select shift,rate from pay_rates where pump_id=? and worker_id=?").all(pid, u.id).forEach((r) => (rates[r.shift] = r.rate));
  const ds = db.prepare("select * from duties where pump_id=? and worker_id=? and status='closed' and substr(d,1,7)=?").all(pid, u.id, month).map((x) => detail(x, pid));
  const pending = db.prepare("select count(*) n from duties where pump_id=? and worker_id=? and status in ('open','submitted') and substr(d,1,7)=?").get(pid, u.id, month).n;
  const count = { Morning: 0, Evening: 0, Night: 0 };
  let earn = 0, short = 0, missing = false;
  ds.forEach((d) => {
    count[d.shift] = (count[d.shift] || 0) + 1;
    if (rates[d.shift] == null) missing = true;
    earn += rates[d.shift] || 0;
    if (d.diff <= -1) short += -d.diff;
  });
  const items = db.prepare("select id,kind,amount,note,d from pay_items where pump_id=? and worker_id=? and month=? order by id").all(pid, u.id, month);
  const sum = (k) => r2(items.filter((x) => x.kind === k).reduce((a, x) => a + x.amount, 0));
  const advance = sum("advance"), bonus = sum("bonus"), waived = sum("waive"), paid = sum("paid");
  earn = r2(earn); short = r2(short);
  const net = r2(earn + bonus - advance - Math.max(0, short - waived));
  return { id: u.id, name: u.name, role: u.role, rates, count, duties: ds.length, pending, missing_rate: missing, earn, short, advance, bonus, waived, paid, net, balance: r2(net - paid), items };
}
app.get("/api/payroll", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const m = monthOf(q.query.month);
  const us = db.prepare("select id,name,role from users where pump_id=? and (role='worker' or id in (select worker_id from duties where pump_id=? and substr(d,1,7)=?)) order by name").all(pid, pid, m);
  s.json({ month: m, workers: us.map((u) => payFor(u, m, pid)) });
});
app.put("/api/payroll/rates", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const { worker_id, rates } = q.body || {};
  if (!db.prepare("select 1 from users where id=? and pump_id=?").get(+worker_id, pid)) return s.status(404).json({ error: "Worker not found." });
  const vals = {};
  for (const sh of SHIFTS) {
    const x = rates && rates[sh];
    if (x === "" || x == null) continue;
    const n = num(x);
    if (Number.isNaN(n)) return s.status(400).json({ error: `Check the ${sh} rate.` });
    vals[sh] = n;
  }
  db.transaction(() => {
    db.prepare("delete from pay_rates where pump_id=? and worker_id=?").run(pid, +worker_id);
    Object.keys(vals).forEach((sh) => db.prepare("insert into pay_rates(pump_id,worker_id,shift,rate) values(?,?,?,?)").run(pid, +worker_id, sh, vals[sh]));
  })();
  s.json({ ok: true });
});
app.post("/api/payroll/items", need("owner"), (q, s) => {
  const pid = q.user.pump_id;
  const { worker_id, month, kind, amount, note } = q.body || {};
  if (!db.prepare("select 1 from users where id=? and pump_id=?").get(+worker_id, pid)) return s.status(404).json({ error: "Worker not found." });
  if (!["advance", "bonus", "waive", "paid"].includes(kind)) return s.status(400).json({ error: "Invalid entry type." });
  const a = num(amount);
  if (Number.isNaN(a) || a <= 0 || a > 1e7) return s.status(400).json({ error: "Enter an amount above zero." });
  db.prepare("insert into pay_items(pump_id,worker_id,month,kind,amount,note,d,created) values(?,?,?,?,?,?,?,?)").run(pid, +worker_id, monthOf(month), kind, r2(a), String(note || "").slice(0, 100), today(), now());
  s.json({ ok: true });
});
app.delete("/api/payroll/items/:id", need("owner"), (q, s) => {
  db.prepare("delete from pay_items where id=? and pump_id=?").run(+q.params.id, q.user.pump_id);
  s.json({ ok: true });
});
app.get("/api/my-pay", need(), (q, s) => {
  const m = monthOf(q.query.month);
  s.json({ month: m, worker: payFor(q.user, m, q.user.pump_id) });
});

// ---- Daily summary text (for the owner's WhatsApp)
const R0 = (n) => "\u20b9" + Math.round(n).toLocaleString("en-IN");
const L1 = (n) => (Math.round(n * 10) / 10).toLocaleString("en-IN") + " L";
app.get("/api/daily-summary", need("owner", "manager"), (q, s) => {
  const pid = q.user.pump_id;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.query.d || "") ? q.query.d : bizDate();
  const st = stateNow(pid), biz = st.biz || {};
  const ds = db.prepare("select * from duties where pump_id=? and d=? and status in ('submitted','closed') order by id").all(pid, d).map((x) => detail(x, pid));
  const waiting = ds.filter((x) => x.status === "submitted").length;
  const fuel = {};
  let lit = 0, amt = 0, cash = 0, upi = 0, card = 0, diff = 0;
  ds.forEach((x) => {
    cash += x.cash; upi += x.upi; card += x.card; diff += x.diff;
    x.lines.forEach((l) => { const f = fuel[l.fuel || "Other"] || (fuel[l.fuel || "Other"] = { l: 0, a: 0, u: l.unit }); f.l += l.litres; f.a += l.amount; if (l.unit === "L") lit += l.litres; amt += l.amount; });
  });
  const when = new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const out = [`*Daily summary: ${when}*`];
  if (biz.name) out.push(biz.name);
  out.push("", "*Fuel sold*");
  if (!ds.length) out.push("No duties submitted for this date.");
  else {
    Object.keys(fuel).forEach((k) => out.push(`${k}: ${fuel[k].u === "L" ? L1(fuel[k].l) : (Math.round(fuel[k].l * 10) / 10).toLocaleString("en-IN") + " " + fuel[k].u} = ${R0(fuel[k].a)}`));
    out.push(`Total: ${lit ? L1(lit) + " of liquid fuel, " : ""}${R0(amt)} fuel sales`);
    const lb = ds.reduce((a, x) => a + x.lube, 0);
    if (lb > 0) out.push(`Lube and shop sales: ${R0(lb)}`);
    const pt = {}, mn = {};
    ds.forEach((x) => Object.keys(x.pay).forEach((k) => (pt[k] = (pt[k] || 0) + (+x.pay[k] || 0))));
    allModes(st).forEach((m) => (mn[m.key] = m.name));
    out.push("", "*Collections*", Object.keys(pt).map((k) => `${mn[k] || k} ${R0(pt[k])}`).join(" | "), `Total collected: ${R0(ds.reduce((a, x) => a + x.collected, 0))}`);
    const shorts = ds.filter((x) => x.diff <= -1).map((x) => `${x.worker} (${x.shift}): short ${R0(-x.diff)}`);
    const excess = ds.filter((x) => x.diff >= 1).map((x) => `${x.worker} (${x.shift}): excess ${R0(x.diff)}`);
    if (!shorts.length && !excess.length) out.push("All duties tally.");
    shorts.concat(excess).forEach((x) => out.push(x));
    out.push(`Net difference: ${Math.abs(diff) < 1 ? "none" : (diff < 0 ? "short " : "excess ") + R0(Math.abs(diff))}`);
    out.push(`${ds.length} dut${ds.length === 1 ? "y" : "ies"}${waiting ? `, ${waiting} not yet closed` : ""}`);
  }
  // credit
  const sums = {};
  db.prepare("select cust_id, sum(a) t from credit_sales where pump_id=? and status='ok' group by cust_id").all(pid).forEach((x) => (sums[x.cust_id] = x.t));
  let owed = 0, owing = 0;
  (st.c || []).forEach((c) => {
    const due = (c.e || []).reduce((a, x) => a + (x.t === "sale" ? x.a : -x.a), 0) + (sums[String(c.id)] || 0);
    if (due > 0) { owed += due; owing++; }
  });
  const cs = db.prepare("select count(*) n, coalesce(sum(a),0) t from credit_sales where pump_id=? and d=? and status='ok'").get(pid, d);
  const ledgerToday = (st.c || []).reduce((a, c) => a + (c.e || []).filter((x) => x.t === "sale" && x.d === d).reduce((b, x) => b + x.a, 0), 0);
  out.push("", "*Credit*", `Credit sales today: ${R0(cs.t + ledgerToday)}`, `Total outstanding: ${R0(owed)} from ${owing} customer${owing === 1 ? "" : "s"}`);
  const pend = db.prepare("select count(*) n from credit_sales where pump_id=? and status='pending'").get(pid).n;
  if (pend) out.push(`${pend} credit sale${pend === 1 ? "" : "s"} waiting for approval`);
  // stock
  const tanks = tankChecks(pid);
  out.push("", "*Tank stock*");
  if (!tanks.length) out.push("No tanks set up.");
  tanks.forEach((t) => out.push(t.book == null ? `${t.name} - ${t.fuel}: no dip yet` : `${t.name} - ${t.fuel}: about ${L1(t.book)}${t.capacity ? ` (${Math.round((t.book / t.capacity) * 100)}% full)` : ""}`));
  const low = (st.items || []).filter((i) => +i.stock <= +i.low);
  if (low.length) { out.push("", "*Low stock*"); low.forEach((i) => out.push(`${i.name}: ${i.stock} ${i.unit} left`)); }
  const owner = db.prepare("select mobile from users where pump_id=? and role='owner' order by id limit 1").get(pid);
  s.json({ text: out.join("\n"), to: owner ? owner.mobile : "" });
});

// ---- Server backups (owner): a nightly copy of the whole database, plus restore
const fs = require("fs");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const BK_NAME = /^[A-Za-z0-9._-]+\.db$/;
async function makeBackup(name) {
  await db.backup(path.join(BACKUP_DIR, name));
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => BK_NAME.test(f)).map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  files.slice(30).forEach((x) => fs.unlinkSync(path.join(BACKUP_DIR, x.f)));
  return name;
}
const stamp = () => new Date().toLocaleString("sv-SE", { timeZone: TZ }).replace(/[: ]/g, "-").slice(0, 16);
function nightlyBackup() {
  const hour = +new Date().toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }), name = `data-${today()}.db`;
  if (hour < 2 || fs.existsSync(path.join(BACKUP_DIR, name))) return;
  makeBackup(name).then(() => audit(null, "backup", `Nightly backup ${name}`)).catch((e) => console.error("Nightly backup failed:", e.message));
}
app.get("/api/backups", need("owner"), (q, s) => {
  s.json(fs.readdirSync(BACKUP_DIR).filter((f) => BK_NAME.test(f)).map((f) => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, size: st.size, t: Math.floor(st.mtimeMs / 1000) }; }).sort((a, b) => b.t - a.t));
});
app.post("/api/backups/run", need("owner"), (q, s) => {
  const name = `data-manual-${stamp()}.db`;
  makeBackup(name).then(() => { audit(q.user, "backup", `Manual backup ${name}`); s.json({ name }); }).catch(() => s.status(500).json({ error: "Backup failed." }));
});
app.get("/api/backups/:name", need("owner"), (q, s) => {
  if (!BK_NAME.test(q.params.name) || !fs.existsSync(path.join(BACKUP_DIR, q.params.name))) return s.status(404).json({ error: "Backup not found." });
  s.download(path.join(BACKUP_DIR, q.params.name));
});
// Restore copies every table from the chosen backup over the live data. A safety copy is taken first.
const RESTORE_TABLES = ["pumps", "users", "sections", "state", "audit", "credit_sales", "duties", "duty_lines", "duty_items", "duty_expenses", "days", "dips", "pay_rates", "pay_items", "density_register", "bank_deposits", "cash_flow_days", "meter_readings"];
app.post("/api/backups/restore", need("owner"), async (q, s) => {
  const name = q.body && q.body.name;
  if (!BK_NAME.test(String(name)) || !fs.existsSync(path.join(BACKUP_DIR, name))) return s.status(404).json({ error: "Backup not found." });
  try {
    await makeBackup(`data-before-restore-${stamp()}.db`);
    if (typeof db.restoreFromFile === "function") {
      db.restoreFromFile(path.join(BACKUP_DIR, name), RESTORE_TABLES);
    } else {
      db.prepare("attach database ? as bk").run(path.join(BACKUP_DIR, name));
      try {
        db.transaction(() => {
          for (const t of RESTORE_TABLES) {
            const there = db.prepare("select 1 from bk.sqlite_master where type='table' and name=?").get(t);
            db.exec(`delete from main.${t}`);
            if (!there) continue;
            const mainCols = db.prepare(`pragma main.table_info(${t})`).all().map((c) => c.name), bkCols = db.prepare(`pragma bk.table_info(${t})`).all().map((c) => c.name);
            const cols = mainCols.filter((c) => bkCols.includes(c)).join(",");
            db.exec(`insert into main.${t}(${cols}) select ${cols} from bk.${t}`);
          }
          db.exec("delete from main.sessions");
        })();
      } finally { db.exec("detach database bk"); }
    }
    audit(q.user, "restore", `Restored data from ${name}`);
    s.json({ ok: true });
  } catch (e) { console.error("Restore failed:", e.message); s.status(500).json({ error: "Restore failed. Your data was not changed." }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/api", (q, s) => s.status(404).json({ error: "Not found." }));
app.use((err, q, s, n) => s.status(err.status || 500).json({ error: err.status === 400 ? "Invalid request." : "Something went wrong." }));

async function start() {
  await initDb();
  setInterval(nightlyBackup, 10 * 60e3).unref();
  setTimeout(nightlyBackup, 5000).unref();
  setInterval(() => db.prepare("delete from sessions where exp<?").run(now()), 3600e3).unref();
  app.listen(PORT, HOST, () => console.log(`Petrol pump server on http://${HOST}:${PORT}`));
}

start().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
