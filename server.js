"use strict";
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
  create table if not exists users(
    id integer primary key, name text not null, mobile text unique not null,
    hash text not null, role text not null check(role in ('owner','manager','worker')),
    active integer not null default 1);
  create table if not exists sessions(token text primary key, user_id integer not null, exp integer not null);
  create table if not exists state(id integer primary key check(id = 1), ver integer not null, json text not null);
  create table if not exists credit_sales(
    id integer primary key, cust_id text not null, d text not null, n text not null,
    a real not null, veh text, worker_id integer not null, created integer not null,
    status text not null default 'ok');
  create table if not exists sections(name text primary key, ver integer not null, json text not null);
  create table if not exists audit(id integer primary key, t integer not null, user_id integer, user_name text, action text not null, detail text);
  create table if not exists duties(
    id integer primary key, worker_id integer not null, d text not null, shift text not null,
    status text not null default 'open', cash real not null default 0, upi real not null default 0,
    card real not null default 0, note text, started integer not null, submitted integer,
    closed_by integer, closed_at integer);
  create table if not exists duty_lines(
    id integer primary key, duty_id integer not null, nozzle_id text not null,
    opening real, closing real, testing real not null default 0, rate real);
  create table if not exists duty_items(
    id integer primary key, duty_id integer not null, item_id text not null, name text not null, qty real not null, price real not null);
  create table if not exists duty_expenses(
    id integer primary key, duty_id integer not null, cat text not null, note text, amount real not null);
  create table if not exists days(
    d text primary key, status text not null, closed_by integer, closed_at integer, approved_by integer, approved_at integer);
  create table if not exists dips(
    id integer primary key, tank_id text not null, litres real not null, dip real,
    note text, user_id integer not null, t integer not null);
  create table if not exists pay_rates(worker_id integer not null, shift text not null, rate real not null, primary key(worker_id, shift));
  create table if not exists pay_items(
    id integer primary key, worker_id integer not null, month text not null,
    kind text not null check(kind in ('advance','bonus','waive','paid')),
    amount real not null, note text, d text not null, created integer not null);
  create table if not exists density_register(
    id integer primary key,
    d text not null,
    fuel text not null,
    tank_id text,
    m_density real,
    m_temp real,
    m_d15 real,
    comp1 real,
    comp2 real,
    comp3 real,
    comp4 real,
    mix_density real,
    challan_d15 real,
    diff_density real,
    before_dip real,
    before_stock real,
    after_density real,
    receipt_kl real,
    challan_no text,
    note text,
    user_id integer,
    created integer not null);
  create table if not exists meter_register(
    id integer primary key,
    d text not null,
    nozzle_id text not null,
    opening real,
    closing real,
    testing real not null default 0,
    sale real,
    note text,
    user_id integer,
    updated_at integer not null,
    unique(d, nozzle_id));
  create index if not exists idx_meter_reg_d on meter_register(d);
  create index if not exists idx_meter_reg_noz on meter_register(nozzle_id);
  create table if not exists daily_stock_register(
    id integer primary key,
    d text not null,
    fuel text not null,
    tank_id text,
    opening_dip real,
    opening_stock real,
    receipt real not null default 0,
    challan_no text,
    closing_dip real,
    closing_stock real,
    sales_dip real,
    sales_meter real,
    testing real not null default 0,
    book_stock real,
    variation real,
    note text,
    user_id integer,
    updated_at integer not null,
    unique(d, fuel));
  create index if not exists idx_daily_stock_reg_d on daily_stock_register(d);
  create index if not exists idx_daily_stock_reg_fuel on daily_stock_register(fuel);
  `);

  const addCol = (t, c, def) => {
    try {
      if (!db.prepare(`pragma table_info(${t})`).all().some((x) => x.name === c))
        db.exec(`alter table ${t} add column ${c} ${def}`);
    } catch (e) {}
  };
  addCol("credit_sales", "status", "text not null default 'ok'");
  addCol("users", "lang", "text not null default 'en'");
  addCol("duties", "pay_json", "text");
  addCol("duties", "stock_done", "integer not null default 0");
  addCol("duties", "assigned_by", "integer");
  addCol("credit_sales", "fuel", "text");
  addCol("credit_sales", "litres", "real");
  addCol("dips", "dens_obs", "real");
  addCol("dips", "temp", "real");
  addCol("dips", "d15", "real");
  migrateOldState();
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
const pub = (u) => ({ id: u.id, name: u.name, mobile: u.mobile, role: u.role, lang: u.lang || "en" });
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
  const r = db.prepare("select u.id,u.name,u.mobile,u.role,u.lang,u.active,s.exp from sessions s join users u on u.id=s.user_id where s.token=?").get(hs(t));
  return r && r.active && r.exp >= now() ? r : null;
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

app.get("/api/me", (q, s) => {
  const u = getUser(q);
  s.json({ user: u ? pub(u) : null, setup: usersCount() === 0, biz: bizDate() });
});
app.post("/api/setup", (q, s) => {
  if (usersCount() > 0) return s.status(403).json({ error: "Setup is already done." });
  const { name, mobile, password } = q.body || {};
  const e = checkUser(name, mob(mobile), password);
  if (e) return s.status(400).json({ error: e });
  const id = db.prepare("insert into users(name,mobile,hash,role) values(?,?,?,'owner')").run(String(name).trim(), mob(mobile), bcrypt.hashSync(password, 10)).lastInsertRowid;
  const token = startSession(q, s, id);
  s.json({ user: { id, name: String(name).trim(), mobile: mob(mobile), role: "owner" }, token });
});
app.post("/api/login", (q, s) => {
  const m = mob(q.body && q.body.mobile), p = String((q.body && q.body.password) || ""), k = q.ip + "|" + m;
  if (blocked(k)) return s.status(429).json({ error: "Too many wrong attempts. Try again in 15 minutes." });
  const u = db.prepare("select * from users where mobile=?").get(m);
  if (!u || !u.active || !bcrypt.compareSync(p, u.hash)) { addFail(k); return s.status(401).json({ error: "Wrong mobile number or password." }); }
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

// ---- Team (owner only)
app.get("/api/users", need("owner", "manager"), (q, s) =>
  s.json(db.prepare(q.user.role === "owner" ? "select id,name,mobile,role,active from users order by id" : "select id,name,mobile,role,active from users where role='worker' order by id").all()));
app.post("/api/users", need("owner", "manager"), (q, s) => {
  const { name, mobile, password, role } = q.body || {};
  const m = mob(mobile);
  if (!["manager", "worker"].includes(role)) return s.status(400).json({ error: "Choose manager or worker." });
  if (q.user.role === "manager" && role !== "worker") return s.status(403).json({ error: "Managers can add workers only." });
  const e = checkUser(name, m, password);
  if (e) return s.status(400).json({ error: e });
  if (db.prepare("select 1 from users where mobile=?").get(m)) return s.status(409).json({ error: "This mobile number is already registered." });
  db.prepare("insert into users(name,mobile,hash,role) values(?,?,?,?)").run(String(name).trim(), m, bcrypt.hashSync(password, 10), role);
  s.json({ ok: true });
});
app.patch("/api/users/:id", need("owner", "manager"), (q, s) => {
  const id = +q.params.id, u = db.prepare("select * from users where id=?").get(id);
  if (!u) return s.status(404).json({ error: "User not found." });
  if (q.user.role === "manager" && u.role !== "worker") return s.status(403).json({ error: "Managers can change workers only." });
  const { active, password, name } = q.body || {};
  if (active !== undefined) {
    if (u.id === q.user.id) return s.status(400).json({ error: "You cannot deactivate your own account." });
    db.prepare("update users set active=? where id=?").run(active ? 1 : 0, id);
    if (!active) db.prepare("delete from sessions where user_id=?").run(id);
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6 || password.length > 100) return s.status(400).json({ error: "Password must be at least 6 characters." });
    db.prepare("update users set hash=? where id=?").run(bcrypt.hashSync(password, 10), id);
    db.prepare("delete from sessions where user_id=?").run(id);
  }
  if (name !== undefined && String(name).trim()) db.prepare("update users set name=? where id=?").run(String(name).trim().slice(0, 60), id);
  s.json({ ok: true });
});

// ---- Shared business data (owner and manager)
// ---- Shared business data, split into sections so edits rarely clash

const SECTIONS = { c: ["c"], inv: ["inv"], items: ["items", "itemcats"], sup: ["sup"], bk: ["bk", "ob"], biz: ["biz"], tanks: ["tanks", "deliv"], setup: ["nozzles", "rates", "expcats", "paymodes", "fuelprods"] };
const ARRAY_KEYS = new Set(["c", "inv", "items", "sup", "bk", "tanks", "deliv", "nozzles", "rates", "expcats", "paymodes", "fuelprods", "itemcats"]);
const LABEL = { c: "Customers", inv: "Invoices", items: "Stock items", sup: "Suppliers", bk: "Book entries", ob: "Opening balances", biz: "Business details", tanks: "Tanks", deliv: "Fuel deliveries", nozzles: "Nozzles", rates: "Fuel rates", expcats: "Expense categories", paymodes: "Payment modes", fuelprods: "Fuel products", itemcats: "Product categories" };
function audit(u, action, detail) {
  try { db.prepare("insert into audit(t,user_id,user_name,action,detail) values(?,?,?,?,?)").run(now(), u ? u.id : null, u ? u.name : "", action, String(detail || "").slice(0, 600)); } catch (e) { /* never block the request */ }
}
function readSections() {
  const state = {}, vers = {};
  db.prepare("select * from sections").all().forEach((r) => { vers[r.name] = r.ver; Object.assign(state, JSON.parse(r.json)); });
  return { state, vers };
}
const stateNow = () => readSections().state;
function writeSection(name, obj) {
  const r = db.prepare("select ver from sections where name=?").get(name), ver = (r ? r.ver : 0) + 1;
  db.prepare("insert into sections(name,ver,json) values(?,?,?) on conflict(name) do update set ver=excluded.ver, json=excluded.json").run(name, ver, JSON.stringify(obj));
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
      db.prepare("insert into sections values(?,?,?)").run(n, 1, JSON.stringify(o));
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
  const { state, vers } = readSections();
  s.json(Object.keys(vers).length ? { vers, state } : { vers: {}, state: null });
});
app.put("/api/state", need("owner", "manager"), (q, s) => {
  const { vers, changes } = q.body || {};
  const names = changes && typeof changes === "object" ? Object.keys(changes) : [];
  const bad = () => s.status(400).json({ error: "Invalid data." });
  if (!names.length || names.some((n) => !SECTIONS[n])) return bad();
  for (const n of names) for (const k of SECTIONS[n]) {
    const v = changes[n] && changes[n][k];
    if (ARRAY_KEYS.has(k) ? !Array.isArray(v) : v === null || typeof v !== "object" || Array.isArray(v)) return bad();
  }
  const res = db.transaction(() => {
    const conflicts = names.filter((n) => { const r = db.prepare("select ver from sections where name=?").get(n); return +((vers || {})[n] || 0) !== (r ? r.ver : 0); });
    if (conflicts.length) return { conflicts };
    const out = {};
    names.forEach((n) => {
      const prev = db.prepare("select json from sections where name=?").get(n), before = prev ? JSON.parse(prev.json) : {}, obj = {};
      SECTIONS[n].forEach((k) => (obj[k] = changes[n][k]));
      out[n] = writeSection(n, obj);
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
  const lim = Math.min(500, +q.query.limit || 200), t = String(q.query.q || "").trim(), like = `%${t}%`;
  s.json(t
    ? db.prepare("select * from audit where action like ? or detail like ? or user_name like ? order by id desc limit ?").all(like, like, like, lim)
    : db.prepare("select * from audit order by id desc limit ?").all(lim));
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
  "POST /api/density-register": (q) => `Recorded density register for ${q.body.d} (${q.body.fuel})`,
  "POST /api/meter-register": (q) => `Recorded daily meter readings for ${q.body.d}`,
  "DELETE /api/meter-register/:d": (q) => `Deleted daily meter readings for ${q.params.d}`,
  "POST /api/meter-register/sync-from-duties": (q) => `Synced daily meter readings from duties for ${q.body.d}`,
  "POST /api/stock-register": (q) => `Updated daily stock register for ${q.body.d} (${q.body.fuel})`,
  "POST /api/stock-register/quick-morning-dip": (q) => `Recorded morning dip for ${q.body.d} (${q.body.fuel})`,
  "POST /api/stock-register/sync": (q) => `Synced daily stock register for ${q.body.month} (${q.body.fuel})`,
  "DELETE /api/stock-register/:id": (q) => `Deleted stock register entry #${q.params.id}`,
};
// ---- Credit customers and worker credit sales
function customers() {
  const st = stateNow();
  const sums = {};
  db.prepare("select cust_id, sum(a) t from credit_sales where status='ok' group by cust_id").all().forEach((x) => (sums[x.cust_id] = x.t));
  return (st.c || []).map((c) => {
    const due = (c.e || []).reduce((a, x) => a + (x.t === "sale" ? x.a : -x.a), 0) + (sums[String(c.id)] || 0);
    return { id: c.id, name: c.name, active: c.active !== false, veh: c.veh || [], available: Math.round(((c.limit || 0) - due) * 100) / 100 };
  });
}
app.get("/api/fuels", need(), (q, s) => { const st = stateNow(); s.json([...new Set((st.nozzles || []).filter((n) => n.active !== false).map((n) => n.fuel))].map((name) => ({ name, unit: unitOf(st, name) }))); });
app.get("/api/customers", need(), (q, s) => s.json(customers().filter((c) => c.active)));
app.post("/api/credit-sales", need(), (q, s) => {
  const { cust_id, n, a, veh, force, fuel, litres } = q.body || {};
  const c = customers().find((x) => String(x.id) === String(cust_id));
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
  const id = db.prepare("insert into credit_sales(cust_id,d,n,a,veh,worker_id,created,status,fuel,litres) values(?,?,?,?,?,?,?,?,?,?)")
    .run(String(c.id), bizDate(), item, amt, String(veh || "").trim().toUpperCase().slice(0, 20), q.user.id, now(), status, fu || null, lt).lastInsertRowid;
  s.json({ id, pending: status === "pending", available: Math.round((status === "ok" ? c.available - amt : c.available) * 100) / 100 });
});
app.get("/api/credit-sales", need("owner", "manager"), (q, s) =>
  s.json(db.prepare("select cs.id,cs.cust_id,cs.d,cs.n,cs.a,cs.veh,cs.fuel,cs.litres,cs.status,u.name worker from credit_sales cs join users u on u.id=cs.worker_id where cs.status<>'rejected' order by cs.id").all()));
app.get("/api/my-credit-sales", need(), (q, s) => {
  const names = {};
  customers().forEach((c) => (names[String(c.id)] = c.name));
  const rows = db.prepare("select id,cust_id,d,n,a,veh,fuel,litres,status from credit_sales where worker_id=? order by id desc limit 50").all(q.user.id);
  s.json(rows.map((r) => ({ ...r, cname: names[r.cust_id] || "Customer" })));
});
const decide = (to) => (q, s) => {
  const r = db.prepare("update credit_sales set status=? where id=? and status='pending'").run(to, +q.params.id);
  if (!r.changes) return s.status(404).json({ error: "This sale is no longer waiting for approval." });
  s.json({ ok: true });
};
app.post("/api/credit-sales/:id/approve", need("owner", "manager"), decide("ok"));
app.post("/api/credit-sales/:id/reject", need("owner", "manager"), decide("rejected"));
app.delete("/api/credit-sales/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from credit_sales where id=?").run(+q.params.id);
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
function nozzleMap(st = stateNow()) {
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
const unitOf = (st, fuel) => { const p = (st.fuelprods || []).find((x) => x.name === fuel); return (p && p.unit) || "L"; };
function lastClose(nid) {
  return db.prepare("select dl.closing c from duty_lines dl join duties d on d.id=dl.duty_id where dl.nozzle_id=? and d.status in ('submitted','closed') and dl.closing is not null order by d.submitted desc, dl.id desc limit 1").get(String(nid)) || {};
}
const dayStatus = (d) => (db.prepare("select status from days where d=?").get(d) || { status: "open" }).status;
function detail(d) {
  const st = stateNow(), nm = nozzleMap(st);
  const lines = db.prepare("select * from duty_lines where duty_id=? order by id").all(d.id).map((l) => {
    const lt = l.closing == null ? 0 : r2(l.closing - l.opening - l.testing), n = nm[l.nozzle_id] || {};
    return { ...l, nozzle: n.name || "Nozzle", fuel: n.fuel || "", unit: unitOf(st, n.fuel), litres: lt, amount: r2(lt * (l.rate || 0)) };
  });
  const items = db.prepare("select * from duty_items where duty_id=? order by id").all(d.id).map((i) => ({ ...i, amount: r2(i.qty * i.price) }));
  const expenses = db.prepare("select * from duty_expenses where duty_id=? order by id").all(d.id);
  const sales = r2(lines.reduce((a, l) => a + l.amount, 0)), litres = r2(lines.filter((l) => l.unit === "L").reduce((a, l) => a + l.litres, 0));
  const lube = r2(items.reduce((a, i) => a + i.amount, 0)), exp = r2(expenses.reduce((a, e) => a + e.amount, 0));
  const credit = r2(db.prepare("select coalesce(sum(a),0) t from credit_sales where worker_id=? and status='ok' and created>=? and created<=?").get(d.worker_id, d.started, d.submitted || now()).t);
  const pay = d.pay_json ? JSON.parse(d.pay_json) : { cash: d.cash, upi: d.upi, card: d.card };
  const collected = r2(Object.values(pay).reduce((a, x) => a + (+x || 0), 0));
  const expected = r2(sales + lube - credit - exp);
  const w = db.prepare("select name from users where id=?").get(d.worker_id);
  return {
    id: d.id, d: d.d, shift: d.shift, status: d.status, worker_id: d.worker_id, worker: w ? w.name : "", pay,
    cash: +pay.cash || 0, upi: +pay.upi || 0, card: +pay.card || 0, note: d.note || "",
    lines, items, expenses, litres, sales, lube, exp, credit, expected, collected, diff: r2(collected - expected),
  };
}
// Updates a duty's nozzle readings, shop items, expenses and collections.
// Workers change closing/testing only; managers (full) can also change opening and rate.
function saveDuty(id, b, strict, full) {
  const st = stateNow(), nm = nozzleMap(st), cur = db.prepare("select * from duty_lines where duty_id=? order by id").all(id);
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
    db.prepare("update duties set pay_json=?, cash=?, upi=?, card=?, note=? where id=?").run(JSON.stringify(pay), pay.cash || 0, pay.upi || 0, pay.card || 0, String(b.note || "").slice(0, 200), id);
  })();
  return null;
}
// Lube and shop stock moves when a duty is closed (and comes back if the owner reopens it).
function adjustStock(duty, sign) {
  const items = db.prepare("select * from duty_items where duty_id=?").all(duty.id), r = db.prepare("select json from sections where name='items'").get();
  if (!items.length || !r) return;
  const o = JSON.parse(r.json);
  items.forEach((x) => { const it = (o.items || []).find((i) => String(i.id) === x.item_id); if (it) it.stock = Math.max(0, r2(+it.stock + sign * x.qty)); });
  writeSection("items", o);
  audit(null, "stock", `${sign < 0 ? "Deducted" : "Restored"} lube and shop stock for duty #${duty.id}`);
}
const openDuty = (uid) => db.prepare("select * from duties where worker_id=? and status='open' order by id desc limit 1").get(uid);
const mine = (q, s, n) => {
  const d = db.prepare("select * from duties where id=? and worker_id=? and status='open'").get(+q.params.id, q.user.id);
  if (!d) return s.status(404).json({ error: "This duty is not open." });
  q.duty = d; n();
};
const fillInfo = (st) => ({
  modes: activeModes(st).map((m) => ({ key: m.key, name: m.name })),
  cats: st.expcats && st.expcats.length ? st.expcats : ["Tea and food", "Repairs", "Electricity", "Transport", "Other"],
  items: (st.items || []).map((i) => ({ id: i.id, name: i.name, unit: i.unit, sell: i.sell, stock: i.stock })),
});
app.get("/api/duty/current", need(), (q, s) => {
  const d = openDuty(q.user.id), st = stateNow();
  const recent = db.prepare("select * from duties where worker_id=? and status<>'open' order by id desc limit 8").all(q.user.id).map(detail);
  s.json({ duty: d ? detail(d) : null, ...fillInfo(st), recent });
});
app.get("/api/my-duties/:id", need(), (q, s) => {
  const d = db.prepare("select * from duties where id=? and worker_id=? and status<>'open'").get(+q.params.id, q.user.id);
  if (!d) return s.status(404).json({ error: "Duty not found." });
  s.json({ duty: detail(d), modes: allModes(stateNow()).map((m) => ({ key: m.key, name: m.name })) });
});
app.put("/api/duty/:id", need(), mine, (q, s) => {
  const e = saveDuty(q.duty.id, q.body || {}, false, false);
  if (e) return s.status(400).json({ error: e });
  s.json({ ok: true });
});
app.post("/api/duty/:id/submit", need(), mine, (q, s) => {
  const e = saveDuty(q.duty.id, q.body || {}, true, false);
  if (e) return s.status(400).json({ error: e });
  db.prepare("update duties set status='submitted', submitted=? where id=?").run(now(), q.duty.id);
  s.json({ ok: true });
});

// ---- Manager: assign nozzles, review, close
app.get("/api/assign-info", need("owner", "manager"), (q, s) => {
  const st = stateNow(), d = bizDate();
  const busy = {};
  db.prepare("select dl.nozzle_id n, u.name w from duty_lines dl join duties du on du.id=dl.duty_id join users u on u.id=du.worker_id where du.status in ('open','submitted')").all().forEach((x) => (busy[x.n] = x.w));
  const workers = db.prepare("select id,name from users where role='worker' and active=1 order by name").all();
  const nozzles = (st.nozzles || []).filter((n) => n.active !== false).map((n) => {
    const lc = lastClose(n.id);
    return { id: n.id, name: n.name, fuel: n.fuel, busy_by: busy[String(n.id)] || null, rate: rateFor(st, n.fuel, d), opening: lc.c ?? (n.open ?? null) };
  });
  const open = db.prepare("select * from duties where status='open' order by id").all().map(detail);
  s.json({ date: d, day: dayStatus(d), workers, nozzles, open });
});
app.post("/api/duties/assign", need("owner", "manager"), (q, s) => {
  const { worker_id, shift, nozzle_ids } = q.body || {}, st = stateNow(), d = bizDate();
  const w = db.prepare("select * from users where id=? and active=1 and role='worker'").get(+worker_id);
  if (!w) return s.status(400).json({ error: "Choose a worker." });
  if (!SHIFTS.includes(shift)) return s.status(400).json({ error: "Choose a shift." });
  const ids = Array.isArray(nozzle_ids) ? [...new Set(nozzle_ids.map(String))] : [];
  if (!ids.length || ids.length > 30) return s.status(400).json({ error: "Choose at least one nozzle." });
  if (dayStatus(d) !== "open") return s.status(409).json({ error: "Today's business day is already closed. Ask the owner to reopen it." });
  if (openDuty(w.id)) return s.status(409).json({ error: `${w.name} already has a duty in progress.` });
  const nm = nozzleMap(st), lines = [];
  for (const id of ids) {
    const n = nm[id];
    if (!n || n.active === false) return s.status(400).json({ error: "One of the nozzles is not available." });
    const b = db.prepare("select u.name w from duty_lines dl join duties du on du.id=dl.duty_id join users u on u.id=du.worker_id where dl.nozzle_id=? and du.status in ('open','submitted') limit 1").get(id);
    if (b) return s.status(409).json({ error: `${n.name} is with ${b.w}. It is free once that duty is closed.` });
    const rate = rateFor(st, n.fuel, d);
    if (rate == null) return s.status(400).json({ error: `Set the ${n.fuel} rate in Pump setup first.` });
    const lc = lastClose(id), opening = lc.c ?? (n.open ?? null);
    if (opening == null) return s.status(400).json({ error: `Set the opening reading for ${n.name} in Pump setup first.` });
    lines.push({ id, opening, rate });
  }
  const dutyId = db.transaction(() => {
    const did = db.prepare("insert into duties(worker_id,d,shift,started,assigned_by) values(?,?,?,?,?)").run(w.id, d, shift, now(), q.user.id).lastInsertRowid;
    lines.forEach((l) => db.prepare("insert into duty_lines(duty_id,nozzle_id,opening,rate) values(?,?,?,?)").run(did, l.id, l.opening, l.rate));
    return did;
  })();
  s.json({ id: dutyId });
});
app.delete("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const r = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and status='open'").get(+q.params.id);
    if (!d) return 0;
    db.prepare("delete from duty_lines where duty_id=?").run(d.id);
    db.prepare("delete from duty_items where duty_id=?").run(d.id);
    db.prepare("delete from duty_expenses where duty_id=?").run(d.id);
    db.prepare("delete from duties where id=?").run(d.id);
    return 1;
  })();
  if (!r) return s.status(404).json({ error: "Only a duty that has not been submitted can be cancelled." });
  s.json({ ok: true });
});
app.get("/api/duties", need("owner", "manager"), (q, s) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.query.d || "") ? q.query.d : bizDate();
  s.json({
    day: db.prepare("select * from duties where d=? and status<>'open' order by id").all(d).map(detail),
    pending: db.prepare("select * from duties where status='submitted' order by id").all().map(detail),
    open: db.prepare("select * from duties where status='open' order by id").all().map(detail),
    day_status: dayStatus(d),
  });
});
app.get("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const d = db.prepare("select * from duties where id=? and status<>'open'").get(+q.params.id);
  if (!d) return s.status(404).json({ error: "Duty not found." });
  s.json(detail(d));
});
app.put("/api/duties/:id", need("owner", "manager"), (q, s) => {
  const d = db.prepare("select * from duties where id=? and status='submitted'").get(+q.params.id);
  if (!d) return s.status(404).json({ error: "Only duties waiting to be closed can be changed." });
  const before = detail(d), e = saveDuty(d.id, q.body || {}, true, true);
  if (e) return s.status(400).json({ error: e });
  const after = detail(db.prepare("select * from duties where id=?").get(d.id)), bits = [];
  [["fuel sales", "sales"], ["lube sales", "lube"], ["expenses", "exp"], ["collected", "collected"]].forEach(([l, k]) => { if (before[k] !== after[k]) bits.push(`${l} ${money(before[k])} to ${money(after[k])}`); });
  if (JSON.stringify(before.lines.map((l) => [l.opening, l.closing, l.testing, l.rate])) !== JSON.stringify(after.lines.map((l) => [l.opening, l.closing, l.testing, l.rate]))) bits.push("nozzle readings changed");
  audit(q.user, "duty corrected", `Duty #${d.id} (${before.worker}, ${before.shift}): ${bits.length ? bits.join(", ") : "saved with no figure changes"}`);
  s.json({ ok: true });
});
app.post("/api/duties/:id/close", need("owner", "manager"), (q, s) => {
  const out = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and status='submitted'").get(+q.params.id);
    if (!d) return { code: 404, error: "This duty is not waiting to be closed." };
    if (dayStatus(d.d) !== "open") return { code: 409, error: "This business day is already closed." };
    db.prepare("update duties set status='closed', closed_by=?, closed_at=?, stock_done=1 where id=?").run(q.user.id, now(), d.id);
    if (!d.stock_done) adjustStock(d, -1);
    return { ok: true };
  })();
  if (out.error) return s.status(out.code).json({ error: out.error });
  s.json({ ok: true });
});
app.post("/api/duties/:id/reopen", need("owner"), (q, s) => {
  const out = db.transaction(() => {
    const d = db.prepare("select * from duties where id=? and status='closed'").get(+q.params.id);
    if (!d) return { code: 404, error: "This duty is not closed." };
    if (dayStatus(d.d) !== "open") return { code: 409, error: "Reopen the business day first." };
    db.prepare("update duties set status='submitted', stock_done=0 where id=?").run(d.id);
    if (d.stock_done) adjustStock(d, +1);
    return { ok: true };
  })();
  if (out.error) return s.status(out.code).json({ error: out.error });
  s.json({ ok: true });
});

// ---- Business day: manager closes, owner approves
const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
app.post("/api/days/:d/close", need("owner", "manager"), (q, s) => {
  const d = q.params.d;
  if (!validDay(d)) return s.status(400).json({ error: "Invalid date." });
  if (dayStatus(d) !== "open") return s.status(409).json({ error: "This day is already closed." });
  const c = db.prepare("select sum(status='closed') done, sum(status<>'closed') wait from duties where d=?").get(d);
  if (!c.done) return s.status(400).json({ error: "There are no closed duties on this date." });
  if (c.wait) return s.status(400).json({ error: "Some duties on this date are still open or waiting to be closed." });
  db.prepare("insert into days(d,status,closed_by,closed_at) values(?,?,?,?) on conflict(d) do update set status='closed', closed_by=excluded.closed_by, closed_at=excluded.closed_at, approved_by=null, approved_at=null").run(d, "closed", q.user.id, now());
  s.json({ ok: true });
});
app.post("/api/days/:d/approve", need("owner"), (q, s) => {
  const r = db.prepare("update days set status='approved', approved_by=?, approved_at=? where d=? and status='closed'").run(q.user.id, now(), q.params.d);
  if (!r.changes) return s.status(409).json({ error: "Only a day closed by the manager can be approved." });
  s.json({ ok: true });
});
app.post("/api/days/:d/reopen", need("owner"), (q, s) => {
  db.prepare("update days set status='open', approved_by=null, approved_at=null where d=?").run(q.params.d);
  s.json({ ok: true });
});
// Day reports use closed duties only.
app.get("/api/day-report", need("owner", "manager"), (q, s) => {
  const d = validDay(q.query.d) ? q.query.d : bizDate(), st = stateNow();
  const duties = db.prepare("select * from duties where d=? and status='closed' order by id").all(d).map(detail);
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
  const dd = db.prepare("select * from days where d=?").get(d) || { status: "open" };
  s.json({ d, day: dd, modes: allModes(st).map((m) => ({ key: m.key, name: m.name })), duties, summary: { ...T, total: r2(T.sales + T.lube), fuel, shop, exps, pay } });
});

// Money from closed business days: collections by mode, fuel and shop sales, expenses (for the Book and Reports)
app.get("/api/duty-money", need("owner", "manager"), (q, s) => {
  const f = validDay(q.query.from) ? q.query.from : "0000-01-01", t = validDay(q.query.to) ? q.query.to : "9999-12-31";
  const days = db.prepare("select d from days where status in ('closed','approved') and d>=? and d<=? order by d").all(f, t);
  s.json(days.map(({ d }) => {
    const ds = db.prepare("select * from duties where d=? and status='closed' order by id").all(d).map(detail);
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
  const f = validDay(q.query.from) ? q.query.from : "0000-01-01", t = validDay(q.query.to) ? q.query.to : "9999-12-31";
  s.json(db.prepare("select * from duties where status='closed' and d>=? and d<=? order by d,id").all(f, t).map(detail)
    .map((x) => ({ id: x.id, d: x.d, shift: x.shift, worker_id: x.worker_id, worker: x.worker, sales: r2(x.sales + x.lube), diff: x.diff })));
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
function tankChecks() {
  const st = stateNow(), tanks = st.tanks || [], dv = st.deliv || [], tankOf = {};
  (st.nozzles || []).forEach((n) => (tankOf[String(n.id)] = String(n.tank_id || "")));
  const sales = db.prepare("select d.submitted t, dl.nozzle_id n, dl.closing-dl.opening-dl.testing lt from duty_lines dl join duties d on d.id=dl.duty_id where d.status in ('submitted','closed')").all();
  const dips = db.prepare("select di.*, u.name by_name from dips di join users u on u.id=di.user_id order by di.t, di.id").all();
  const sold = (tid, a, b) => r2(sales.filter((x) => tankOf[x.n] === tid && x.t > a && x.t <= b).reduce((s, x) => s + x.lt, 0));
  const recv = (tid, a, b) => r2(dv.reduce((s, d) => s + (Math.floor(d.ts / 1000) > a && Math.floor(d.ts / 1000) <= b ? (d.lines || []).filter((l) => String(l.tank_id) === tid).reduce((q, l) => q + (+l.litres || 0), 0) : 0), 0));
  return tanks.map((tk) => {
    const tid = String(tk.id), ds = dips.filter((x) => x.tank_id === tid), checks = [];
    for (let i = 1; i < ds.length; i++) {
      const p = ds[i - 1], c = ds[i], so = sold(tid, p.t, c.t), re = recv(tid, p.t, c.t), exp = r2(p.litres + re - so);
      checks.push({ id: c.id, from: p.t, to: c.t, opening: p.litres, received: re, sold: so, expected: exp, actual: c.litres, variance: r2(c.litres - exp), by: c.by_name });
    }
    const last = ds[ds.length - 1] || null;
    const book = last ? r2(last.litres + recv(tid, last.t, now()) - sold(tid, last.t, now())) : null;
    return { id: tk.id, name: tk.name, fuel: tk.fuel, capacity: tk.capacity || 0, last: last ? { id: last.id, litres: last.litres, t: last.t, by: last.by_name } : null, book, checks: checks.slice(-8).reverse() };
  });
}
app.get("/api/tanks", need(), (q, s) => {
  const st = stateNow(), names = {};
  (st.tanks || []).forEach((t) => (names[String(t.id)] = t.name));
  const mine = db.prepare("select id,tank_id,litres,dip,dens_obs,temp,d15,note,t from dips where user_id=? order by id desc limit 10").all(q.user.id).map((d) => ({ ...d, tank: names[d.tank_id] || "Tank" }));
  s.json({ tanks: (st.tanks || []).map((t) => ({ id: t.id, name: t.name, fuel: t.fuel, capacity: t.capacity || 0 })), mine });
});
app.post("/api/dips", need(), (q, s) => {
  const b = q.body || {}, tank = (stateNow().tanks || []).find((t) => String(t.id) === String(b.tank_id));
  if (!tank) return s.status(400).json({ error: "Choose a tank." });
  let litres = num(b.litres);
  const dip = b.dip === "" || b.dip == null ? null : num(b.dip);
  if (Number.isNaN(litres)) {
    if (dip === null || Number.isNaN(dip)) return s.status(400).json({ error: "Enter the litres or the dip reading." });
    const r = fromChart(tank.chart, dip);
    if (r.err) return s.status(400).json({ error: r.err });
    litres = r.l;
  }
  if (tank.capacity && litres > tank.capacity * 1.02) return s.status(400).json({ error: `That is more than the tank capacity (${tank.capacity} L). Check the reading.` });
  const opt = (x, lo, hi) => {
    if (x === "" || x == null) return null;
    const n = +x;
    if (!Number.isFinite(n)) return NaN;
    if ((n >= lo && n <= hi) || (n >= lo * 1000 && n <= hi * 1000)) return n;
    return NaN;
  };
  const dobs = opt(b.dens_obs, 0.5, 1.2), d15 = opt(b.d15, 0.5, 1.2), tmp = opt(b.temp, -10, 90);
  if ([dobs, d15].some(Number.isNaN)) return s.status(400).json({ error: "Density should be a number such as 732.0 or 0.745." });
  if (Number.isNaN(tmp)) return s.status(400).json({ error: "Check the temperature." });
  const id = db.prepare("insert into dips(tank_id,litres,dip,dens_obs,temp,d15,note,user_id,t) values(?,?,?,?,?,?,?,?,?)").run(String(tank.id), r2(litres), dip, dobs, tmp, d15, String(b.note || "").slice(0, 200), q.user.id, now()).lastInsertRowid;
  try {
    const dIso = today();
    const ex = db.prepare("select id from density_register where d=? and fuel=?").get(dIso, tank.fuel);
    if (!ex && (dobs != null || d15 != null)) {
      db.prepare("insert into density_register(d, fuel, tank_id, m_density, m_temp, m_d15, user_id, created) values(?,?,?,?,?,?,?,?)").run(dIso, tank.fuel, String(tank.id), dobs, tmp, d15, q.user.id, now());
    }
  } catch (e) {}
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
  const st = stateNow(), tanks = {}, rows = [], nn = (x) => (x === "" || x == null || !Number.isFinite(+x) ? null : +x);
  (st.tanks || []).forEach((t) => (tanks[String(t.id)] = t));
  (st.deliv || []).forEach((d) => (d.lines || []).forEach((l) => {
    const dn = l.dens, t = tanks[String(l.tank_id)];
    if (!dn || !t) return;
    const o = { src: "Delivery", t: Math.floor((d.ts || 0) / 1000), d: d.d, tank: t.name, fuel: t.fuel, inv: nn(dn.inv), obs: nn(dn.obs), temp: nn(dn.temp), d15: nn(dn.d15), by: "" };
    if (o.inv == null && o.obs == null && o.d15 == null) return;
    o.flags = densFlags(densCfg(st, t.fuel), o); rows.push(o);
  }));
  db.prepare("select di.*, u.name by_name from dips di join users u on u.id=di.user_id where di.dens_obs is not null or di.d15 is not null order by di.t desc limit 200").all().forEach((x) => {
    const t = tanks[x.tank_id]; if (!t) return;
    const o = { src: "Dip", t: x.t, d: new Date(x.t * 1000).toLocaleDateString("en-CA", { timeZone: TZ }), tank: t.name, fuel: t.fuel, inv: null, obs: x.dens_obs, temp: x.temp, d15: x.d15, by: x.by_name };
    o.flags = densFlags(densCfg(st, t.fuel), o); rows.push(o);
  });
  rows.sort((a, b) => b.t - a.t);
  s.json(rows.slice(0, 80));
});
app.get("/api/stock-check", need("owner", "manager"), (q, s) => s.json(tankChecks()));
app.delete("/api/dips/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from dips where id=?").run(+q.params.id);
  s.json({ ok: true });
});

// ---- Density Register (Indian OMC standard register for Petrol, Diesel, Power Petrol)
app.get("/api/density-register", need(), (q, s) => {
  const m = q.query.month || today().slice(0, 7);
  const fuel = q.query.fuel || "";
  let query = "select r.*, u.name as recorder from density_register r left join users u on u.id=r.user_id where substr(r.d,1,7)=?";
  const params = [m];
  if (fuel) {
    query += " and r.fuel=?";
    params.push(fuel);
  }
  query += " order by r.d asc, r.id asc";
  const rows = db.prepare(query).all(...params);
  s.json(rows);
});

app.post("/api/density-register", need("owner", "manager"), (q, s) => {
  const b = q.body || {};
  if (!b.d || !/^\d{4}-\d{2}-\d{2}$/.test(b.d)) return s.status(400).json({ error: "Enter a valid date." });
  if (!b.fuel) return s.status(400).json({ error: "Select a fuel product." });
  
  const numOrNull = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);
  const comp1 = numOrNull(b.comp1);
  const comp2 = numOrNull(b.comp2);
  const comp3 = numOrNull(b.comp3);
  const comp4 = numOrNull(b.comp4);
  
  let mix = numOrNull(b.mix_density);
  if (mix === null) {
    const comps = [comp1, comp2, comp3, comp4].filter((x) => x !== null);
    if (comps.length > 0) {
      mix = r2(comps.reduce((a, c) => a + c, 0) / comps.length);
    }
  }
  
  const chalan = numOrNull(b.challan_d15);
  let diff = numOrNull(b.diff_density);
  if (diff === null && mix !== null && chalan !== null) {
    diff = r2(Math.abs(mix - chalan));
  }
  
  const id = db.prepare(`
    insert into density_register(
      d, fuel, tank_id, m_density, m_temp, m_d15,
      comp1, comp2, comp3, comp4, mix_density, challan_d15, diff_density,
      before_dip, before_stock, after_density, receipt_kl, challan_no,
      note, user_id, created
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.d, b.fuel, b.tank_id ? String(b.tank_id) : null,
    numOrNull(b.m_density), numOrNull(b.m_temp), numOrNull(b.m_d15),
    comp1, comp2, comp3, comp4, mix, chalan, diff,
    numOrNull(b.before_dip), numOrNull(b.before_stock), numOrNull(b.after_density),
    numOrNull(b.receipt_kl), b.challan_no ? String(b.challan_no).trim() : null,
    b.note ? String(b.note).trim() : null, q.user.id, now()
  ).lastInsertRowid;
  
  s.json({ ok: true, id });
});

app.put("/api/density-register/:id", need("owner", "manager"), (q, s) => {
  const b = q.body || {};
  const id = +q.params.id;
  if (!db.prepare("select 1 from density_register where id=?").get(id)) {
    return s.status(404).json({ error: "Entry not found." });
  }
  if (!b.d || !/^\d{4}-\d{2}-\d{2}$/.test(b.d)) return s.status(400).json({ error: "Enter a valid date." });
  if (!b.fuel) return s.status(400).json({ error: "Select a fuel product." });
  
  const numOrNull = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);
  const comp1 = numOrNull(b.comp1);
  const comp2 = numOrNull(b.comp2);
  const comp3 = numOrNull(b.comp3);
  const comp4 = numOrNull(b.comp4);
  
  let mix = numOrNull(b.mix_density);
  if (mix === null) {
    const comps = [comp1, comp2, comp3, comp4].filter((x) => x !== null);
    if (comps.length > 0) mix = r2(comps.reduce((a, c) => a + c, 0) / comps.length);
  }
  
  const chalan = numOrNull(b.challan_d15);
  let diff = numOrNull(b.diff_density);
  if (diff === null && mix !== null && chalan !== null) {
    diff = r2(Math.abs(mix - chalan));
  }
  
  db.prepare(`
    update density_register set
      d=?, fuel=?, tank_id=?, m_density=?, m_temp=?, m_d15=?,
      comp1=?, comp2=?, comp3=?, comp4=?, mix_density=?, challan_d15=?, diff_density=?,
      before_dip=?, before_stock=?, after_density=?, receipt_kl=?, challan_no=?,
      note=?
    where id=?
  `).run(
    b.d, b.fuel, b.tank_id ? String(b.tank_id) : null,
    numOrNull(b.m_density), numOrNull(b.m_temp), numOrNull(b.m_d15),
    comp1, comp2, comp3, comp4, mix, chalan, diff,
    numOrNull(b.before_dip), numOrNull(b.before_stock), numOrNull(b.after_density),
    numOrNull(b.receipt_kl), b.challan_no ? String(b.challan_no).trim() : null,
    b.note ? String(b.note).trim() : null, id
  );
  
  s.json({ ok: true });
});

app.delete("/api/density-register/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from density_register where id=?").run(+q.params.id);
  s.json({ ok: true });
});

// ---- Daily Meter Register (Opening meter taken from night shift closing)
function getActiveNozzles(st = stateNow()) {
  let nozzles = (st.nozzles || []).filter((n) => n.active !== false);
  if (nozzles.length === 0 && Array.isArray(st.tanks) && st.tanks.length > 0) {
    nozzles = st.tanks.map((t, i) => ({
      id: "noz_" + t.id,
      name: "Pump " + (i + 1),
      fuel: t.fuel,
      tank_id: String(t.id),
      active: true,
      open: 1000.0,
    }));
  }
  return nozzles;
}

app.get("/api/meter-register", need(), (q, s) => {
  const m = q.query.month || today().slice(0, 7);
  const st = stateNow();
  const nozzles = getActiveNozzles(st);
  
  const entries = db.prepare(`
    select r.*, u.name as recorder
    from meter_register r
    left join users u on u.id=r.user_id
    where substr(r.d,1,7)=?
    order by r.d asc, r.nozzle_id asc
  `).all(m);
  
  // Also collect duty info for this month if any, to provide duty sync hints
  const dutiesSummary = db.prepare(`
    select du.d, dl.nozzle_id, min(dl.opening) min_open, max(dl.closing) max_close, sum(dl.testing) sum_test
    from duty_lines dl
    join duties du on du.id=dl.duty_id
    where substr(du.d,1,7)=? and du.status in ('submitted','closed')
    group by du.d, dl.nozzle_id
  `).all(m);
  
  s.json({ month: m, nozzles, entries, dutiesSummary });
});

app.get("/api/meter-register/openings", need(), (q, s) => {
  const d = q.query.d || today();
  const st = stateNow();
  const nozzles = getActiveNozzles(st);
  
  const openings = {};
  for (const n of nozzles) {
    const nid = String(n.id);
    // 1. Look for previous closing in meter_register prior to d (closing of night shift / end of previous day)
    const prev = db.prepare("select closing, d from meter_register where nozzle_id=? and d < ? and closing is not null order by d desc limit 1").get(nid, d);
    if (prev && prev.closing != null) {
      openings[nid] = { opening: prev.closing, source: "previous_closing", fromDate: prev.d };
      continue;
    }
    // 2. Look for closing in duty_lines prior to d (night shift closing of yesterday)
    const prevDuty = db.prepare("select dl.closing, du.d from duty_lines dl join duties du on du.id=dl.duty_id where dl.nozzle_id=? and du.d < ? and dl.closing is not null order by du.d desc, du.submitted desc, dl.id desc limit 1").get(nid, d);
    if (prevDuty && prevDuty.closing != null) {
      openings[nid] = { opening: prevDuty.closing, source: "duty_night_closing", fromDate: prevDuty.d };
      continue;
    }
    // 3. Initial nozzle opening reading
    openings[nid] = { opening: n.open ?? 0, source: "initial_setup" };
  }
  s.json({ d, openings });
});

app.post("/api/meter-register", need("owner", "manager"), (q, s) => {
  const b = q.body || {};
  if (!b.d || !/^\d{4}-\d{2}-\d{2}$/.test(b.d)) return s.status(400).json({ error: "Enter a valid date." });
  const readings = Array.isArray(b.readings) ? b.readings : [];
  if (readings.length === 0) return s.status(400).json({ error: "No meter readings provided." });
  
  const numOrNull = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);
  
  db.transaction(() => {
    for (const r of readings) {
      const nid = String(r.nozzle_id);
      const op = numOrNull(r.opening);
      const cl = numOrNull(r.closing);
      const test = numOrNull(r.testing) || 0;
      let sale = null;
      if (cl != null && op != null) {
        sale = r2(Math.max(0, cl - op - test));
      }
      db.prepare(`
        insert into meter_register(d, nozzle_id, opening, closing, testing, sale, note, user_id, updated_at)
        values(?,?,?,?,?,?,?,?,?)
        on conflict(d, nozzle_id) do update set
          opening=excluded.opening,
          closing=excluded.closing,
          testing=excluded.testing,
          sale=excluded.sale,
          note=excluded.note,
          user_id=excluded.user_id,
          updated_at=excluded.updated_at
      `).run(b.d, nid, op, cl, test, sale, r.note ? String(r.note).slice(0, 200) : null, q.user.id, now());
    }
  })();
  
  s.json({ ok: true });
});

app.delete("/api/meter-register/:d", need("owner", "manager"), (q, s) => {
  const d = q.params.d;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Invalid date." });
  db.prepare("delete from meter_register where d=?").run(d);
  s.json({ ok: true });
});

app.post("/api/meter-register/sync-from-duties", need("owner", "manager"), (q, s) => {
  const d = (q.body && q.body.d) || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Invalid date." });
  
  // Find duty readings for date d
  const lines = db.prepare(`
    select dl.nozzle_id, min(dl.opening) as first_open, max(dl.closing) as last_close, sum(dl.testing) as tot_test
    from duty_lines dl
    join duties du on du.id=dl.duty_id
    where du.d=? and du.status in ('submitted','closed') and dl.closing is not null
    group by dl.nozzle_id
  `).all(d);
  
  if (lines.length === 0) return s.status(404).json({ error: "No submitted or closed duties found on " + d });
  
  db.transaction(() => {
    for (const l of lines) {
      const nid = String(l.nozzle_id);
      const op = l.first_open;
      const cl = l.last_close;
      const test = l.tot_test || 0;
      const sale = r2(Math.max(0, cl - op - test));
      db.prepare(`
        insert into meter_register(d, nozzle_id, opening, closing, testing, sale, note, user_id, updated_at)
        values(?,?,?,?,?,?,?,?,?)
        on conflict(d, nozzle_id) do update set
          opening=excluded.opening,
          closing=excluded.closing,
          testing=excluded.testing,
          sale=excluded.sale,
          note='Synced from duties',
          user_id=excluded.user_id,
          updated_at=excluded.updated_at
      `).run(d, nid, op, cl, test, sale, q.user.id, now());
    }
  })();
  
  s.json({ ok: true, synced: lines.length });
});

// Seed exact May 2025 Google Sheet sample dataset
app.post("/api/meter-register/seed-sample", need("owner", "manager"), (q, s) => {
  const st = stateNow();
  let nozzles = st.nozzles || [];
  
  // Define the standard pumps from the user's sheet if setup is empty or nozzles are missing
  const samplePumps = [
    { id: "p1_hsd", name: "Pump 1", fuel: "Diesel (HSD)", open: 536771.16 },
    { id: "p2_ms", name: "Pump 2", fuel: "Petrol (MS)", open: 1651598.67 },
    { id: "p3_ms", name: "Pump 3", fuel: "Petrol (MS)", open: 1250393.36 },
    { id: "p4_hsd", name: "Pump 4", fuel: "Diesel (HSD)", open: 46772.17 },
    { id: "p5_hsd", name: "Pump 5", fuel: "Diesel (HSD)", open: 10037.96 },
    { id: "p6_hsd", name: "Pump 6", fuel: "Diesel (HSD)", open: 3861961.10 },
    { id: "p7_power", name: "Pump 7", fuel: "Power petrol", open: 1566757.84 },
  ];
  
  if (!nozzles || nozzles.length === 0) {
    const tanks = st.tanks || [];
    const tHSD = (tanks.find((t) => /diesel|hsd/i.test(t.fuel)) || {}).id || "";
    const tMS = (tanks.find((t) => /petrol|ms/i.test(t.fuel) && !/power/i.test(t.fuel)) || {}).id || "";
    const tPWR = (tanks.find((t) => /power/i.test(t.fuel)) || {}).id || "";
    
    nozzles = samplePumps.map((sp) => ({
      id: sp.id,
      name: sp.name,
      fuel: sp.fuel,
      tank_id: /power/i.test(sp.fuel) ? tPWR : /diesel|hsd/i.test(sp.fuel) ? tHSD : tMS,
      active: true,
      open: sp.open,
    }));
    
    // Save to setup section
    const curSetup = db.prepare("select json from sections where name='setup'").get();
    const setupObj = curSetup ? JSON.parse(curSetup.json) : {};
    setupObj.nozzles = nozzles;
    if (!setupObj.rates || setupObj.rates.length === 0) {
      setupObj.rates = [
        { id: 1, fuel: "Petrol (MS)", rate: 104.25, from: "2025-01-01" },
        { id: 2, fuel: "Diesel (HSD)", rate: 92.15, from: "2025-01-01" },
        { id: 3, fuel: "Power petrol", rate: 109.80, from: "2025-01-01" },
      ];
    }
    writeSection("setup", setupObj);
  }
  
  // Exact daily data points for May 2025 from Google Sheet screenshot:
  const p2_readings = [
    1653043.67, 1654262.05, 1655660.12, 1656897.15, 1658510.84, 1659810.84, 1660649.69,
    1662296.52, 1663365.72, 1663442.80, 1664571.88, 1665654.14, 1666771.43, 1667958.22,
    1669333.45, 1670788.54, 1671839.73, 1672865.98, 1673791.09, 1674814.31, 1676051.61,
    1677150.38, 1678403.95, 1679652.72, 1680767.58, 1682008.85, 1683238.00, 1684327.70,
    1685726.44, 1687170.37, 1688196.35
  ];
  
  const p4_readings = [
    47957.17, 49032.19, 50783.30, 52088.94, 53570.38, 55286.11, 56225.79,
    57720.41, 58708.45, 59783.35, 60719.509, 61821.26, 62871.43, 64584.50,
    66004.05, 67912.21, 68956.70, 69919.17, 71289.08, 72866.57, 74311.12,
    75031.55, 75868.22, 76704.73, 77590.52, 79009.07, 79789.09, 80879.92,
    81839.39, 83177.17, 85057.84
  ];

  // Specific sheet sales totals
  const ms_sales = [
    1445, 1218, 1298, 1337, 1551, 1363, 839, 1647, 1069, 77, 1129, 1082, 1117, 1187,
    1375, 1455, 1051, 1026, 925, 1023, 1237, 1099, 720, 837, 1249, 1241, 1229, 1090,
    1399, 1444, 1026
  ];
  
  const hsd_sales = [
    1185, 1075, 1752, 1306, 1481, 1716, 940, 1495, 988, 1075, 936, 1102, 1050, 1713,
    1420, 1908, 1044, 962, 1370, 1577, 1445, 720, 837, 837, 886, 1419, 780, 1091,
    959, 1338, 1881
  ];

  db.transaction(() => {
    let p2_prev = 1651598.67;
    let p4_prev = 46772.17;
    
    for (let day = 1; day <= 31; day++) {
      const dStr = (day < 10 ? "0" : "") + day;
      const date = "2025-05-" + dStr;
      
      const p2_close = p2_readings[day - 1];
      const p2_sale = ms_sales[day - 1];
      const p2_open = p2_prev;
      p2_prev = p2_close;
      
      const p4_close = p4_readings[day - 1];
      const p4_sale = hsd_sales[day - 1];
      const p4_open = p4_prev;
      p4_prev = p4_close;
      
      const p5_close = day === 1 ? 10037.96 : 10038.73;
      const p5_open = 10037.96;
      
      const dayReadings = [
        { nid: "p1_hsd", op: 536771.16, cl: 536771.16, sale: 0 },
        { nid: "p2_ms", op: p2_open, cl: p2_close, sale: p2_sale },
        { nid: "p3_ms", op: 1250393.36, cl: 1250393.36, sale: 0 },
        { nid: "p4_hsd", op: p4_open, cl: p4_close, sale: p4_sale },
        { nid: "p5_hsd", op: p5_open, cl: p5_close, sale: day === 1 ? 0 : (day === 2 ? 0.77 : 0) },
        { nid: "p6_hsd", op: 3861961.10, cl: 3861961.10, sale: 0 },
        { nid: "p7_power", op: 1566757.84, cl: 1566757.84, sale: 0 },
      ];
      
      for (const dr of dayReadings) {
        db.prepare(`
          insert into meter_register(d, nozzle_id, opening, closing, testing, sale, note, user_id, updated_at)
          values(?,?,?,?,?,?,?,?,?)
          on conflict(d, nozzle_id) do update set
            opening=excluded.opening,
            closing=excluded.closing,
            testing=excluded.testing,
            sale=excluded.sale,
            updated_at=excluded.updated_at
        `).run(date, dr.nid, dr.op, dr.cl, 0, dr.sale, "DailySale 2025 Google Sheet", q.user.id, now());
      }
    }
  })();
  
  s.json({ ok: true, count: 31 });
});

// ---- Daily Stock Register (Form 13 / OMC Stock Register per product)
function calcDipToLitres(chart, dip) {
  if (dip == null || isNaN(dip)) return null;
  const d = Number(dip);
  if (!chart || !Array.isArray(chart) || chart.length === 0) return null;
  if (d <= chart[0].cm) return chart[0].l;
  if (d >= chart[chart.length - 1].cm) return chart[chart.length - 1].l;
  for (let i = 0; i < chart.length - 1; i++) {
    const c1 = chart[i].cm, c2 = chart[i + 1].cm;
    const l1 = chart[i].l, l2 = chart[i + 1].l;
    if (d >= c1 && d <= c2) {
      if (c2 === c1) return l1;
      const frac = (d - c1) / (c2 - c1);
      return Math.round((l1 + frac * (l2 - l1)) * 10) / 10;
    }
  }
  return null;
}

app.get("/api/stock-register", need(), (q, s) => {
  const m = q.query.month || today().slice(0, 7);
  const st = stateNow();
  const tanks = st.tanks || [];
  const fuels = [...new Set(tanks.map((t) => t.fuel))];
  if (fuels.length === 0) fuels.push("Petrol (MS)", "Diesel (HSD)", "Power petrol");
  const fuel = q.query.fuel || fuels[0];
  
  const tank = tanks.find((t) => t.fuel === fuel) || tanks[0] || null;
  const tankIdStr = tank ? String(tank.id) : null;
  
  // 1. Existing registered records for this month & fuel
  const entries = db.prepare(`
    select * from daily_stock_register
    where substr(d, 1, 7)=? and fuel=?
    order by d asc
  `).all(m, fuel);

  // 2. Deliveries linked for this month & fuel from st.deliv
  const linkedDeliveries = {};
  (st.deliv || []).forEach((dl) => {
    if (!dl.d || dl.d.slice(0, 7) !== m) return;
    let totLitres = 0;
    const matchingLines = [];
    (dl.lines || []).forEach((line) => {
      const lineTank = tanks.find((t) => String(t.id) === String(line.tank_id));
      if (lineTank && lineTank.fuel === fuel) {
        totLitres += Number(line.litres) || 0;
        matchingLines.push(line);
      }
    });
    if (totLitres > 0) {
      linkedDeliveries[dl.d] = {
        litres: totLitres,
        billno: dl.billno || "",
        sup: dl.sup,
        lines: matchingLines,
      };
    }
  });

  // 3. Meter register sales for this month & fuel
  const nozzles = getActiveNozzles(st).filter((n) => n.fuel === fuel);
  const nozzleIds = nozzles.map((n) => String(n.id));
  const linkedMeterSales = {};
  if (nozzleIds.length > 0) {
    const placeholders = nozzleIds.map(() => "?").join(",");
    const rows = db.prepare(`
      select d, sum(sale) as meter_sale, sum(testing) as meter_testing
      from meter_register
      where substr(d, 1, 7)=? and nozzle_id in (${placeholders})
      group by d
    `).all(m, ...nozzleIds);
    rows.forEach((r) => {
      linkedMeterSales[r.d] = {
        sale: r.meter_sale != null ? r2(r.meter_sale) : null,
        testing: r.meter_testing != null ? r2(r.meter_testing) : 0,
      };
    });
  }

  // 4. Closed duties sales fallback if meter register has no entries
  const linkedDutySales = {};
  if (nozzleIds.length > 0) {
    const placeholders = nozzleIds.map(() => "?").join(",");
    const dutyRows = db.prepare(`
      select du.d,
             sum(max(0, coalesce(dl.closing,0) - coalesce(dl.opening,0) - coalesce(dl.testing,0))) as duty_sale,
             sum(coalesce(dl.testing, 0)) as duty_testing
      from duty_lines dl
      join duties du on du.id=dl.duty_id
      where substr(du.d, 1, 7)=? and du.status in ('submitted','closed') and dl.nozzle_id in (${placeholders}) and dl.closing is not null
      group by du.d
    `).all(m, ...nozzleIds);
    dutyRows.forEach((r) => {
      linkedDutySales[r.d] = {
        sale: r.duty_sale != null ? r2(r.duty_sale) : null,
        testing: r.duty_testing != null ? r2(r.duty_testing) : 0,
      };
    });
  }

  // 5. Morning dips recorded in dips table
  const linkedDips = {};
  if (tankIdStr) {
    const dipRows = db.prepare(`
      select id, litres, dip, note, t, date(t, 'unixepoch', 'localtime') as day_str
      from dips
      where tank_id=? and substr(date(t, 'unixepoch', 'localtime'), 1, 7)=?
      order by t asc
    `).all(tankIdStr, m);
    dipRows.forEach((dp) => {
      if (!linkedDips[dp.day_str]) {
        linkedDips[dp.day_str] = dp;
      }
    });
  }

  s.json({
    month: m,
    fuel,
    fuels,
    tank,
    entries,
    linked: {
      deliveries: linkedDeliveries,
      meterSales: linkedMeterSales,
      dutySales: linkedDutySales,
      dips: linkedDips,
    },
  });
});

app.get("/api/stock-register/hints", need(), (q, s) => {
  const d = q.query.d || today();
  const fuel = q.query.fuel || "Petrol (MS)";
  const st = stateNow();
  const tanks = st.tanks || [];
  const tank = tanks.find((t) => t.fuel === fuel) || tanks[0] || null;
  const tankIdStr = tank ? String(tank.id) : null;

  // 1. Check previous day closing stock/dip
  const prevDate = new Date(new Date(d + "T12:00:00").getTime() - 86400e3).toISOString().slice(0, 10);
  const prevEntry = db.prepare("select closing_dip, closing_stock from daily_stock_register where d=? and fuel=?").get(prevDate, fuel);
  
  let suggestedOpeningDip = null;
  let suggestedOpeningStock = null;
  let openingSource = "none";

  if (prevEntry && prevEntry.closing_stock != null) {
    suggestedOpeningDip = prevEntry.closing_dip;
    suggestedOpeningStock = prevEntry.closing_stock;
    openingSource = "previous_closing";
  } else if (tankIdStr) {
    // Check morning dip in dips table
    const dipRow = db.prepare("select dip, litres from dips where tank_id=? and date(t, 'unixepoch', 'localtime')=? order by t asc limit 1").get(tankIdStr, d);
    if (dipRow) {
      suggestedOpeningDip = dipRow.dip;
      suggestedOpeningStock = dipRow.litres;
      openingSource = "dips_table";
    }
  }

  // 2. Check deliveries for date d
  let suggestedReceipt = 0;
  let suggestedChallan = "";
  (st.deliv || []).forEach((dl) => {
    if (dl.d === d) {
      (dl.lines || []).forEach((line) => {
        const lineTank = tanks.find((t) => String(t.id) === String(line.tank_id));
        if (lineTank && lineTank.fuel === fuel) {
          suggestedReceipt += Number(line.litres) || 0;
          if (dl.billno) suggestedChallan = dl.billno;
        }
      });
    }
  });

  // 3. Check meter sales for date d
  const nozzles = getActiveNozzles(st).filter((n) => n.fuel === fuel);
  const nozzleIds = nozzles.map((n) => String(n.id));
  let suggestedMeterSales = null;
  let suggestedTesting = 0;

  if (nozzleIds.length > 0) {
    const placeholders = nozzleIds.map(() => "?").join(",");
    const mr = db.prepare(`select sum(sale) as sale, sum(testing) as testing from meter_register where d=? and nozzle_id in (${placeholders})`).get(d, ...nozzleIds);
    if (mr && mr.sale != null) {
      suggestedMeterSales = r2(mr.sale);
      suggestedTesting = r2(mr.testing || 0);
    } else {
      // Fallback to duty_lines
      const dr = db.prepare(`
        select sum(max(0, coalesce(dl.closing,0) - coalesce(dl.opening,0) - coalesce(dl.testing,0))) as sale,
               sum(coalesce(dl.testing, 0)) as testing
        from duty_lines dl
        join duties du on du.id=dl.duty_id
        where du.d=? and du.status in ('submitted','closed') and dl.nozzle_id in (${placeholders}) and dl.closing is not null
      `).get(d, ...nozzleIds);
      if (dr && dr.sale != null) {
        suggestedMeterSales = r2(dr.sale);
        suggestedTesting = r2(dr.testing || 0);
      }
    }
  }

  s.json({
    d,
    fuel,
    tank,
    suggestedOpeningDip,
    suggestedOpeningStock,
    openingSource,
    suggestedReceipt,
    suggestedChallan,
    suggestedMeterSales,
    suggestedTesting,
  });
});

app.post("/api/stock-register", need("owner", "manager"), (q, s) => {
  const b = q.body || {};
  if (!b.d || !/^\d{4}-\d{2}-\d{2}$/.test(b.d)) return s.status(400).json({ error: "Enter a valid date." });
  if (!b.fuel) return s.status(400).json({ error: "Select a fuel product." });

  const numOrNull = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);
  const opDip = numOrNull(b.opening_dip);
  const opStock = numOrNull(b.opening_stock);
  const receipt = numOrNull(b.receipt) || 0;
  const challan = b.challan_no ? String(b.challan_no).trim().slice(0, 100) : null;
  const clDip = numOrNull(b.closing_dip);
  const clStock = numOrNull(b.closing_stock);
  const sm = numOrNull(b.sales_meter);
  const test = numOrNull(b.testing) || 0;
  
  let salesDip = numOrNull(b.sales_dip);
  let bookStock = numOrNull(b.book_stock);
  let variation = numOrNull(b.variation);

  const totStock = opStock != null ? r2(opStock + receipt) : null;

  if (salesDip == null && totStock != null && clStock != null) {
    salesDip = r2(totStock - clStock);
  }
  if (bookStock == null && totStock != null && sm != null) {
    bookStock = r2(totStock - sm);
  }
  if (variation == null && sm != null && salesDip != null) {
    variation = r2(sm - salesDip);
  } else if (variation == null && clStock != null && bookStock != null) {
    variation = r2(clStock - bookStock);
  }

  db.transaction(() => {
    db.prepare(`
      insert into daily_stock_register(
        d, fuel, tank_id, opening_dip, opening_stock, receipt, challan_no,
        closing_dip, closing_stock, sales_dip, sales_meter, testing,
        book_stock, variation, note, user_id, updated_at
      ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      on conflict(d, fuel) do update set
        tank_id=excluded.tank_id,
        opening_dip=excluded.opening_dip,
        opening_stock=excluded.opening_stock,
        receipt=excluded.receipt,
        challan_no=excluded.challan_no,
        closing_dip=excluded.closing_dip,
        closing_stock=excluded.closing_stock,
        sales_dip=excluded.sales_dip,
        sales_meter=excluded.sales_meter,
        testing=excluded.testing,
        book_stock=excluded.book_stock,
        variation=excluded.variation,
        note=excluded.note,
        user_id=excluded.user_id,
        updated_at=excluded.updated_at
    `).run(
      b.d, b.fuel, b.tank_id ? String(b.tank_id) : null,
      opDip, opStock, receipt, challan,
      clDip, clStock, salesDip, sm, test,
      bookStock, variation, b.note ? String(b.note).trim().slice(0, 300) : null,
      q.user.id, now()
    );

    // If closing stock was set, check if next day exists and update its opening stock if missing
    if (clStock != null) {
      const nextD = new Date(new Date(b.d + "T12:00:00").getTime() + 86400e3).toISOString().slice(0, 10);
      const nextRow = db.prepare("select id, opening_stock from daily_stock_register where d=? and fuel=?").get(nextD, b.fuel);
      if (nextRow && nextRow.opening_stock == null) {
        db.prepare("update daily_stock_register set opening_dip=?, opening_stock=?, updated_at=? where id=?")
          .run(clDip, clStock, now(), nextRow.id);
      }
    }

    // If opening stock was set, check if previous day exists and update its closing stock if missing
    if (opStock != null) {
      const prevD = new Date(new Date(b.d + "T12:00:00").getTime() - 86400e3).toISOString().slice(0, 10);
      const prevRow = db.prepare("select * from daily_stock_register where d=? and fuel=?").get(prevD, b.fuel);
      if (prevRow && prevRow.closing_stock == null) {
        let pSalesDip = prevRow.sales_dip;
        let pVar = prevRow.variation;
        const pTot = prevRow.opening_stock != null ? prevRow.opening_stock + (prevRow.receipt || 0) : null;
        if (pTot != null) {
          pSalesDip = r2(pTot - opStock);
          if (prevRow.sales_meter != null) {
            pVar = r2(prevRow.sales_meter - pSalesDip);
          }
        }
        db.prepare("update daily_stock_register set closing_dip=?, closing_stock=?, sales_dip=?, variation=?, updated_at=? where id=?")
          .run(opDip, opStock, pSalesDip, pVar, now(), prevRow.id);
      }
    }
  })();

  s.json({ ok: true });
});

// Quick morning dip route - links opening stock of today and closing stock of yesterday
app.post("/api/stock-register/quick-morning-dip", need("owner", "manager", "worker"), (q, s) => {
  const b = q.body || {};
  const d = b.d || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s.status(400).json({ error: "Enter a valid date." });
  const fuel = b.fuel || "Petrol (MS)";

  const st = stateNow();
  const tanks = st.tanks || [];
  const tank = tanks.find((t) => t.fuel === fuel) || tanks[0] || null;
  const tankId = tank ? String(tank.id) : null;

  let dip = b.dip != null && b.dip !== "" ? +b.dip : null;
  let litres = b.litres != null && b.litres !== "" ? +b.litres : null;

  if (litres == null && dip != null && tank && tank.chart && tank.chart.length > 0) {
    litres = calcDipToLitres(tank.chart, dip);
  }
  if (litres == null && dip == null) {
    return s.status(400).json({ error: "Enter the dip reading or litres." });
  }

  db.transaction(() => {
    // 1. Insert/update today's row in daily_stock_register
    const existingToday = db.prepare("select * from daily_stock_register where d=? and fuel=?").get(d, fuel);
    if (existingToday) {
      db.prepare(`
        update daily_stock_register set
          opening_dip=?, opening_stock=?, updated_at=?
        where id=?
      `).run(dip, litres, now(), existingToday.id);
    } else {
      db.prepare(`
        insert into daily_stock_register(d, fuel, tank_id, opening_dip, opening_stock, user_id, updated_at)
        values(?,?,?,?,?,?,?)
      `).run(d, fuel, tankId, dip, litres, q.user.id, now());
    }

    // 2. Also update yesterday's closing dip & closing stock
    const prevDate = new Date(new Date(d + "T12:00:00").getTime() - 86400e3).toISOString().slice(0, 10);
    const prevRow = db.prepare("select * from daily_stock_register where d=? and fuel=?").get(prevDate, fuel);
    if (prevRow) {
      let pSalesDip = prevRow.sales_dip;
      let pVar = prevRow.variation;
      const pTot = prevRow.opening_stock != null ? prevRow.opening_stock + (prevRow.receipt || 0) : null;
      if (pTot != null && litres != null) {
        pSalesDip = r2(pTot - litres);
        if (prevRow.sales_meter != null) {
          pVar = r2(prevRow.sales_meter - pSalesDip);
        }
      }
      db.prepare(`
        update daily_stock_register set
          closing_dip=?, closing_stock=?, sales_dip=?, variation=?, updated_at=?
        where id=?
      `).run(dip, litres, pSalesDip, pVar, now(), prevRow.id);
    }

    // 3. Log to standard dips table as well
    if (tankId && litres != null) {
      db.prepare(`
        insert into dips(tank_id, litres, dip, note, user_id, t)
        values(?,?,?,?,?,?)
      `).run(tankId, litres, dip, b.note ? String(b.note).slice(0, 200) : "Morning dip reading", q.user.id, now());
    }
  })();

  s.json({ ok: true, d, fuel, dip, litres });
});

// Sync app data into stock register: inward deliveries and pump meter sales
app.post("/api/stock-register/sync", need("owner", "manager"), (q, s) => {
  const m = (q.body && q.body.month) || today().slice(0, 7);
  const fuel = (q.body && q.body.fuel) || "Petrol (MS)";
  const st = stateNow();
  const tanks = st.tanks || [];
  const tank = tanks.find((t) => t.fuel === fuel) || tanks[0] || null;
  const tankId = tank ? String(tank.id) : null;

  const ym = m.split("-"), yr = parseInt(ym[0]), mo = parseInt(ym[1]);
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // Find deliveries for this month & fuel
  const delivMap = {};
  (st.deliv || []).forEach((dl) => {
    if (!dl.d || dl.d.slice(0, 7) !== m) return;
    let totLitres = 0;
    (dl.lines || []).forEach((line) => {
      const lineTank = tanks.find((t) => String(t.id) === String(line.tank_id));
      if (lineTank && lineTank.fuel === fuel) {
        totLitres += Number(line.litres) || 0;
      }
    });
    if (totLitres > 0) {
      delivMap[dl.d] = { litres: totLitres, billno: dl.billno || "" };
    }
  });

  // Find meter sales for this month & fuel
  const nozzles = getActiveNozzles(st).filter((n) => n.fuel === fuel);
  const nozzleIds = nozzles.map((n) => String(n.id));
  const meterMap = {};

  if (nozzleIds.length > 0) {
    const placeholders = nozzleIds.map(() => "?").join(",");
    const rows = db.prepare(`
      select d, sum(sale) as meter_sale, sum(testing) as meter_testing
      from meter_register
      where substr(d, 1, 7)=? and nozzle_id in (${placeholders})
      group by d
    `).all(m, ...nozzleIds);
    rows.forEach((r) => {
      meterMap[r.d] = { sale: r.meter_sale != null ? r2(r.meter_sale) : null, testing: r.meter_testing || 0 };
    });

    // Fallback duty lines for days missing in meter_register
    const dutyRows = db.prepare(`
      select du.d,
             sum(max(0, coalesce(dl.closing,0) - coalesce(dl.opening,0) - coalesce(dl.testing,0))) as duty_sale,
             sum(coalesce(dl.testing, 0)) as duty_testing
      from duty_lines dl
      join duties du on du.id=dl.duty_id
      where substr(du.d, 1, 7)=? and du.status in ('submitted','closed') and dl.nozzle_id in (${placeholders}) and dl.closing is not null
      group by du.d
    `).all(m, ...nozzleIds);
    dutyRows.forEach((r) => {
      if (!meterMap[r.d] || meterMap[r.d].sale == null) {
        meterMap[r.d] = { sale: r.duty_sale != null ? r2(r.duty_sale) : null, testing: r.duty_testing || 0 };
      }
    });
  }

  let syncedCount = 0;
  db.transaction(() => {
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = (day < 10 ? "0" : "") + day;
      const date = m + "-" + dStr;
      const dv = delivMap[date];
      const ms = meterMap[date];

      if (!dv && !ms) continue;

      const existing = db.prepare("select * from daily_stock_register where d=? and fuel=?").get(date, fuel);
      const receipt = dv ? dv.litres : (existing ? existing.receipt : 0);
      const challan = dv ? dv.billno : (existing ? existing.challan_no : null);
      const salesMeter = ms && ms.sale != null ? ms.sale : (existing ? existing.sales_meter : null);
      const testing = ms && ms.testing != null ? ms.testing : (existing ? existing.testing : 0);

      const opStock = existing ? existing.opening_stock : null;
      const clStock = existing ? existing.closing_stock : null;
      const totStock = opStock != null ? r2(opStock + receipt) : null;
      let salesDip = existing ? existing.sales_dip : null;
      let bookStock = existing ? existing.book_stock : null;
      let variation = existing ? existing.variation : null;

      if (totStock != null && clStock != null) {
        salesDip = r2(totStock - clStock);
      }
      if (totStock != null && salesMeter != null) {
        bookStock = r2(totStock - salesMeter);
      }
      if (salesMeter != null && salesDip != null) {
        variation = r2(salesMeter - salesDip);
      }

      if (existing) {
        db.prepare(`
          update daily_stock_register set
            receipt=?, challan_no=?, sales_meter=?, testing=?,
            sales_dip=?, book_stock=?, variation=?, updated_at=?
          where id=?
        `).run(receipt, challan, salesMeter, testing, salesDip, bookStock, variation, now(), existing.id);
      } else {
        db.prepare(`
          insert into daily_stock_register(d, fuel, tank_id, receipt, challan_no, sales_meter, testing, sales_dip, book_stock, variation, user_id, updated_at)
          values(?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(date, fuel, tankId, receipt, challan, salesMeter, testing, salesDip, bookStock, variation, q.user.id, now());
      }
      syncedCount++;
    }
  })();

  s.json({ ok: true, synced: syncedCount });
});

// Seed sample dataset matching user's MS 0126 (January 2026 Motor Spirit / Petrol pump stock register)
app.post("/api/stock-register/seed-sample", need("owner", "manager"), (q, s) => {
  const st = stateNow();
  const tanks = st.tanks || [];
  const tMS = (tanks.find((t) => /petrol|ms/i.test(t.fuel) && !/power/i.test(t.fuel)) || {}).id || "";
  const tHSD = (tanks.find((t) => /diesel|hsd/i.test(t.fuel)) || {}).id || "";
  const tPWR = (tanks.find((t) => /power/i.test(t.fuel)) || {}).id || "";

  // 31 days data for MS Petrol (January 2026)
  const msSample = [
    { d: "2026-01-01", op_dip: 142.0, op_stock: 8420, rec: 0, ch: null, cl_dip: 121.5, cl_stock: 6975, m_sale: 1440, test: 5, var: -5 },
    { d: "2026-01-02", op_dip: 121.5, op_stock: 6975, rec: 0, ch: null, cl_dip: 104.2, cl_stock: 5750, m_sale: 1218, test: 5, var: -7 },
    { d: "2026-01-03", op_dip: 104.2, op_stock: 5750, rec: 5000, ch: "CH-9041", cl_dip: 163.8, cl_stock: 9455, m_sale: 1298, test: 5, var: 3 },
    { d: "2026-01-04", op_dip: 163.8, op_stock: 9455, rec: 0, ch: null, cl_dip: 145.6, cl_stock: 8120, m_sale: 1337, test: 5, var: 2 },
    { d: "2026-01-05", op_dip: 145.6, op_stock: 8120, rec: 0, ch: null, cl_dip: 124.8, cl_stock: 6565, m_sale: 1551, test: 5, var: -4 },
    { d: "2026-01-06", op_dip: 124.8, op_stock: 6565, rec: 0, ch: null, cl_dip: 106.5, cl_stock: 5200, m_sale: 1363, test: 5, var: -2 },
    { d: "2026-01-07", op_dip: 106.5, op_stock: 5200, rec: 0, ch: null, cl_dip: 95.2, cl_stock: 4360, m_sale: 839, test: 5, var: -1 },
    { d: "2026-01-08", op_dip: 95.2, op_stock: 4360, rec: 5000, ch: "CH-9188", cl_dip: 154.2, cl_stock: 7710, m_sale: 1647, test: 5, var: -3 },
    { d: "2026-01-09", op_dip: 154.2, op_stock: 7710, rec: 0, ch: null, cl_dip: 139.8, cl_stock: 6640, m_sale: 1069, test: 5, var: -1 },
    { d: "2026-01-10", op_dip: 139.8, op_stock: 6640, rec: 0, ch: null, cl_dip: 124.5, cl_stock: 5490, m_sale: 1145, test: 5, var: -5 },
    { d: "2026-01-11", op_dip: 124.5, op_stock: 5490, rec: 0, ch: null, cl_dip: 109.4, cl_stock: 4360, m_sale: 1129, test: 5, var: -1 },
    { d: "2026-01-12", op_dip: 109.4, op_stock: 4360, rec: 0, ch: null, cl_dip: 94.8, cl_stock: 3275, m_sale: 1082, test: 5, var: -3 },
    { d: "2026-01-13", op_dip: 94.8, op_stock: 3275, rec: 6000, ch: "CH-9345", cl_dip: 168.2, cl_stock: 8155, m_sale: 1117, test: 5, var: -3 },
    { d: "2026-01-14", op_dip: 168.2, op_stock: 8155, rec: 0, ch: null, cl_dip: 152.4, cl_stock: 6965, m_sale: 1187, test: 5, var: -3 },
    { d: "2026-01-15", op_dip: 152.4, op_stock: 6965, rec: 0, ch: null, cl_dip: 134.1, cl_stock: 5588, m_sale: 1375, test: 5, var: -2 },
    { d: "2026-01-16", op_dip: 134.1, op_stock: 5588, rec: 0, ch: null, cl_dip: 114.6, cl_stock: 4130, m_sale: 1455, test: 5, var: -3 },
    { d: "2026-01-17", op_dip: 114.6, op_stock: 4130, rec: 0, ch: null, cl_dip: 100.8, cl_stock: 3075, m_sale: 1051, test: 5, var: -4 },
    { d: "2026-01-18", op_dip: 100.8, op_stock: 3075, rec: 5000, ch: "CH-9512", cl_dip: 158.4, cl_stock: 7048, m_sale: 1026, test: 5, var: -1 },
    { d: "2026-01-19", op_dip: 158.4, op_stock: 7048, rec: 0, ch: null, cl_dip: 145.8, cl_stock: 6125, m_sale: 925, test: 5, var: 2 },
    { d: "2026-01-20", op_dip: 145.8, op_stock: 6125, rec: 0, ch: null, cl_dip: 132.1, cl_stock: 5100, m_sale: 1023, test: 5, var: -2 },
    { d: "2026-01-21", op_dip: 132.1, op_stock: 5100, rec: 0, ch: null, cl_dip: 115.5, cl_stock: 3860, m_sale: 1237, test: 5, var: -3 },
    { d: "2026-01-22", op_dip: 115.5, op_stock: 3860, rec: 0, ch: null, cl_dip: 101.0, cl_stock: 2760, m_sale: 1099, test: 5, var: -1 },
    { d: "2026-01-23", op_dip: 101.0, op_stock: 2760, rec: 5000, ch: "CH-9670", cl_dip: 156.2, cl_stock: 6580, m_sale: 1178, test: 5, var: -2 },
    { d: "2026-01-24", op_dip: 156.2, op_stock: 6580, rec: 0, ch: null, cl_dip: 140.0, cl_stock: 5360, m_sale: 1218, test: 5, var: -2 },
    { d: "2026-01-25", op_dip: 140.0, op_stock: 5360, rec: 0, ch: null, cl_dip: 123.5, cl_stock: 4108, m_sale: 1249, test: 5, var: -3 },
    { d: "2026-01-26", op_dip: 123.5, op_stock: 4108, rec: 0, ch: null, cl_dip: 107.0, cl_stock: 2865, m_sale: 1241, test: 5, var: -2 },
    { d: "2026-01-27", op_dip: 107.0, op_stock: 2865, rec: 5000, ch: "CH-9799", cl_dip: 157.0, cl_stock: 6634, m_sale: 1229, test: 5, var: -2 },
    { d: "2026-01-28", op_dip: 157.0, op_stock: 6634, rec: 0, ch: null, cl_dip: 142.2, cl_stock: 5542, m_sale: 1090, test: 5, var: -2 },
    { d: "2026-01-29", op_dip: 142.2, op_stock: 5542, rec: 0, ch: null, cl_dip: 123.6, cl_stock: 4140, m_sale: 1399, test: 5, var: -3 },
    { d: "2026-01-30", op_dip: 123.6, op_stock: 4140, rec: 0, ch: null, cl_dip: 104.5, cl_stock: 2692, m_sale: 1444, test: 5, var: -4 },
    { d: "2026-01-31", op_dip: 104.5, op_stock: 2692, rec: 5000, ch: "CH-9920", cl_dip: 158.0, cl_stock: 6664, m_sale: 1026, test: 5, var: -2 }
  ];

  db.transaction(() => {
    // 1. Seed MS Petrol
    for (const r of msSample) {
      const totStock = r.op_stock + r.rec;
      const salesDip = totStock - r.cl_stock;
      const bookStock = totStock - r.m_sale;
      const variation = r.m_sale - salesDip;
      db.prepare(`
        insert into daily_stock_register(
          d, fuel, tank_id, opening_dip, opening_stock, receipt, challan_no,
          closing_dip, closing_stock, sales_dip, sales_meter, testing,
          book_stock, variation, note, user_id, updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        on conflict(d, fuel) do update set
          tank_id=excluded.tank_id,
          opening_dip=excluded.opening_dip,
          opening_stock=excluded.opening_stock,
          receipt=excluded.receipt,
          challan_no=excluded.challan_no,
          closing_dip=excluded.closing_dip,
          closing_stock=excluded.closing_stock,
          sales_dip=excluded.sales_dip,
          sales_meter=excluded.sales_meter,
          testing=excluded.testing,
          book_stock=excluded.book_stock,
          variation=excluded.variation,
          note=excluded.note,
          updated_at=excluded.updated_at
      `).run(
        r.d, "Petrol (MS)", tMS ? String(tMS) : null,
        r.op_dip, r.op_stock, r.rec, r.ch,
        r.cl_dip, r.cl_stock, salesDip, r.m_sale, r.test,
        bookStock, variation, r.rec > 0 ? "TT Decanted " + r.ch : null,
        q.user.id, now()
      );
    }

    // 2. Also seed HSD Diesel with realistic sample
    let hsdStock = 12650;
    const hsdSales = [1185, 1075, 1752, 1306, 1481, 1716, 940, 1495, 988, 1075, 936, 1102, 1050, 1713, 1420, 1908, 1044, 962, 1370, 1577, 1445, 1120, 1180, 1210, 1280, 1419, 1180, 1091, 1250, 1338, 1450];
    for (let day = 1; day <= 31; day++) {
      const dStr = (day < 10 ? "0" : "") + day;
      const date = "2026-01-" + dStr;
      const rec = (day === 5 || day === 12 || day === 20 || day === 27) ? 8000 : 0;
      const ch = rec > 0 ? "CH-HSD-" + (8000 + day) : null;
      const mSale = hsdSales[day - 1];
      const opStock = hsdStock;
      const totStock = opStock + rec;
      const dailyVar = day % 4 === 0 ? -1 : (day % 3 === 0 ? -3 : -2);
      const salesDip = mSale - dailyVar;
      const clStock = totStock - salesDip;
      const bookStock = totStock - mSale;
      const opDip = Math.round((opStock / 22000 * 200) * 10) / 10;
      const clDip = Math.round((clStock / 22000 * 200) * 10) / 10;
      hsdStock = clStock;

      db.prepare(`
        insert into daily_stock_register(
          d, fuel, tank_id, opening_dip, opening_stock, receipt, challan_no,
          closing_dip, closing_stock, sales_dip, sales_meter, testing,
          book_stock, variation, note, user_id, updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        on conflict(d, fuel) do update set
          tank_id=excluded.tank_id,
          opening_dip=excluded.opening_dip,
          opening_stock=excluded.opening_stock,
          receipt=excluded.receipt,
          challan_no=excluded.challan_no,
          closing_dip=excluded.closing_dip,
          closing_stock=excluded.closing_stock,
          sales_dip=excluded.sales_dip,
          sales_meter=excluded.sales_meter,
          testing=excluded.testing,
          book_stock=excluded.book_stock,
          variation=excluded.variation,
          note=excluded.note,
          updated_at=excluded.updated_at
      `).run(
        date, "Diesel (HSD)", tHSD ? String(tHSD) : null,
        opDip, opStock, rec, ch,
        clDip, clStock, salesDip, mSale, 5,
        bookStock, dailyVar, rec > 0 ? "TT Decanted " + ch : null,
        q.user.id, now()
      );
    }

    // 3. Also seed Power Petrol
    let pwrStock = 4100;
    for (let day = 1; day <= 31; day++) {
      const dStr = (day < 10 ? "0" : "") + day;
      const date = "2026-01-" + dStr;
      const rec = day === 15 ? 3000 : 0;
      const ch = rec > 0 ? "CH-PWR-101" : null;
      const mSale = 180 + (day % 7) * 20;
      const opStock = pwrStock;
      const totStock = opStock + rec;
      const dailyVar = day % 5 === 0 ? 0 : -1;
      const salesDip = mSale - dailyVar;
      const clStock = totStock - salesDip;
      const bookStock = totStock - mSale;
      const opDip = Math.round((opStock / 9000 * 160) * 10) / 10;
      const clDip = Math.round((clStock / 9000 * 160) * 10) / 10;
      pwrStock = clStock;

      db.prepare(`
        insert into daily_stock_register(
          d, fuel, tank_id, opening_dip, opening_stock, receipt, challan_no,
          closing_dip, closing_stock, sales_dip, sales_meter, testing,
          book_stock, variation, note, user_id, updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        on conflict(d, fuel) do update set
          tank_id=excluded.tank_id,
          opening_dip=excluded.opening_dip,
          opening_stock=excluded.opening_stock,
          receipt=excluded.receipt,
          challan_no=excluded.challan_no,
          closing_dip=excluded.closing_dip,
          closing_stock=excluded.closing_stock,
          sales_dip=excluded.sales_dip,
          sales_meter=excluded.sales_meter,
          testing=excluded.testing,
          book_stock=excluded.book_stock,
          variation=excluded.variation,
          note=excluded.note,
          updated_at=excluded.updated_at
      `).run(
        date, "Power petrol", tPWR ? String(tPWR) : null,
        opDip, opStock, rec, ch,
        clDip, clStock, salesDip, mSale, 5,
        bookStock, dailyVar, rec > 0 ? "TT Decanted " + ch : null,
        q.user.id, now()
      );
    }
  })();

  s.json({ ok: true, count: 93, month: "2026-01" });
});

app.delete("/api/stock-register/:id", need("owner", "manager"), (q, s) => {
  db.prepare("delete from daily_stock_register where id=?").run(+q.params.id);
  s.json({ ok: true });
});

app.delete("/api/stock-register/date/:d/:fuel", need("owner", "manager"), (q, s) => {
  db.prepare("delete from daily_stock_register where d=? and fuel=?").run(q.params.d, q.params.fuel);
  s.json({ ok: true });
});

// ---- Worker pay (owner manages; each worker can see their own)

const SHIFTS = ["Morning", "Evening", "Night"];
const monthOf = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(m || "") ? m : today().slice(0, 7));
function payFor(u, month) {
  const rates = {};
  db.prepare("select shift,rate from pay_rates where worker_id=?").all(u.id).forEach((r) => (rates[r.shift] = r.rate));
  const ds = db.prepare("select * from duties where worker_id=? and status='closed' and substr(d,1,7)=?").all(u.id, month).map(detail);
  const pending = db.prepare("select count(*) n from duties where worker_id=? and status in ('open','submitted') and substr(d,1,7)=?").get(u.id, month).n;
  const count = { Morning: 0, Evening: 0, Night: 0 };
  let earn = 0, short = 0, missing = false;
  ds.forEach((d) => {
    count[d.shift] = (count[d.shift] || 0) + 1;
    if (rates[d.shift] == null) missing = true;
    earn += rates[d.shift] || 0;
    if (d.diff <= -1) short += -d.diff;
  });
  const items = db.prepare("select id,kind,amount,note,d from pay_items where worker_id=? and month=? order by id").all(u.id, month);
  const sum = (k) => r2(items.filter((x) => x.kind === k).reduce((a, x) => a + x.amount, 0));
  const advance = sum("advance"), bonus = sum("bonus"), waived = sum("waive"), paid = sum("paid");
  earn = r2(earn); short = r2(short);
  const net = r2(earn + bonus - advance - Math.max(0, short - waived));
  return { id: u.id, name: u.name, role: u.role, rates, count, duties: ds.length, pending, missing_rate: missing, earn, short, advance, bonus, waived, paid, net, balance: r2(net - paid), items };
}
app.get("/api/payroll", need("owner"), (q, s) => {
  const m = monthOf(q.query.month);
  const us = db.prepare("select id,name,role from users where role='worker' or id in (select worker_id from duties where substr(d,1,7)=?) order by name").all(m);
  s.json({ month: m, workers: us.map((u) => payFor(u, m)) });
});
app.put("/api/payroll/rates", need("owner"), (q, s) => {
  const { worker_id, rates } = q.body || {};
  if (!db.prepare("select 1 from users where id=?").get(+worker_id)) return s.status(404).json({ error: "Worker not found." });
  const vals = {};
  for (const sh of SHIFTS) {
    const x = rates && rates[sh];
    if (x === "" || x == null) continue;
    const n = num(x);
    if (Number.isNaN(n)) return s.status(400).json({ error: `Check the ${sh} rate.` });
    vals[sh] = n;
  }
  db.transaction(() => {
    db.prepare("delete from pay_rates where worker_id=?").run(+worker_id);
    Object.keys(vals).forEach((sh) => db.prepare("insert into pay_rates values(?,?,?)").run(+worker_id, sh, vals[sh]));
  })();
  s.json({ ok: true });
});
app.post("/api/payroll/items", need("owner"), (q, s) => {
  const { worker_id, month, kind, amount, note } = q.body || {};
  if (!db.prepare("select 1 from users where id=?").get(+worker_id)) return s.status(404).json({ error: "Worker not found." });
  if (!["advance", "bonus", "waive", "paid"].includes(kind)) return s.status(400).json({ error: "Invalid entry type." });
  const a = num(amount);
  if (Number.isNaN(a) || a <= 0 || a > 1e7) return s.status(400).json({ error: "Enter an amount above zero." });
  db.prepare("insert into pay_items(worker_id,month,kind,amount,note,d,created) values(?,?,?,?,?,?,?)").run(+worker_id, monthOf(month), kind, r2(a), String(note || "").slice(0, 100), today(), now());
  s.json({ ok: true });
});
app.delete("/api/payroll/items/:id", need("owner"), (q, s) => {
  db.prepare("delete from pay_items where id=?").run(+q.params.id);
  s.json({ ok: true });
});
app.get("/api/my-pay", need(), (q, s) => {
  const m = monthOf(q.query.month);
  s.json({ month: m, worker: payFor(q.user, m) });
});

// ---- Daily summary text (for the owner's WhatsApp)
const R0 = (n) => "\u20b9" + Math.round(n).toLocaleString("en-IN");
const L1 = (n) => (Math.round(n * 10) / 10).toLocaleString("en-IN") + " L";
app.get("/api/daily-summary", need("owner", "manager"), (q, s) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.query.d || "") ? q.query.d : bizDate();
  const st = stateNow(), biz = st.biz || {};
  const ds = db.prepare("select * from duties where d=? and status in ('submitted','closed') order by id").all(d).map(detail);
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
  db.prepare("select cust_id, sum(a) t from credit_sales where status='ok' group by cust_id").all().forEach((x) => (sums[x.cust_id] = x.t));
  let owed = 0, owing = 0;
  (st.c || []).forEach((c) => {
    const due = (c.e || []).reduce((a, x) => a + (x.t === "sale" ? x.a : -x.a), 0) + (sums[String(c.id)] || 0);
    if (due > 0) { owed += due; owing++; }
  });
  const cs = db.prepare("select count(*) n, coalesce(sum(a),0) t from credit_sales where d=? and status='ok'").get(d);
  const ledgerToday = (st.c || []).reduce((a, c) => a + (c.e || []).filter((x) => x.t === "sale" && x.d === d).reduce((b, x) => b + x.a, 0), 0);
  out.push("", "*Credit*", `Credit sales today: ${R0(cs.t + ledgerToday)}`, `Total outstanding: ${R0(owed)} from ${owing} customer${owing === 1 ? "" : "s"}`);
  const pend = db.prepare("select count(*) n from credit_sales where status='pending'").get().n;
  if (pend) out.push(`${pend} credit sale${pend === 1 ? "" : "s"} waiting for approval`);
  // stock
  const tanks = tankChecks();
  out.push("", "*Tank stock*");
  if (!tanks.length) out.push("No tanks set up.");
  tanks.forEach((t) => out.push(t.book == null ? `${t.name} - ${t.fuel}: no dip yet` : `${t.name} - ${t.fuel}: about ${L1(t.book)}${t.capacity ? ` (${Math.round((t.book / t.capacity) * 100)}% full)` : ""}`));
  const low = (st.items || []).filter((i) => +i.stock <= +i.low);
  if (low.length) { out.push("", "*Low stock*"); low.forEach((i) => out.push(`${i.name}: ${i.stock} ${i.unit} left`)); }
  const owner = db.prepare("select mobile from users where role='owner' order by id limit 1").get();
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
const RESTORE_TABLES = ["users", "sections", "state", "audit", "credit_sales", "duties", "duty_lines", "duty_items", "duty_expenses", "days", "dips", "pay_rates", "pay_items", "density_register", "meter_register", "daily_stock_register"];
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
