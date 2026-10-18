import { pgTable, serial, text, integer, doublePrecision, bigint, primaryKey } from "drizzle-orm/pg-core";

export const pumps = pgTable("pumps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
  ownerId: integer("owner_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").unique(),
  pumpId: integer("pump_id").notNull().default(1),
  name: text("name").notNull(),
  mobile: text("mobile"),
  hash: text("hash"),
  role: text("role").notNull().default("worker"),
  active: integer("active").notNull().default(1),
  lang: text("lang").notNull().default("en"),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  exp: bigint("exp", { mode: "number" }).notNull(),
});

export const state = pgTable("state", {
  id: integer("id").primaryKey(),
  ver: integer("ver").notNull(),
  json: text("json").notNull(),
});

export const sections = pgTable("sections", {
  pumpId: integer("pump_id").notNull().default(1),
  name: text("name").notNull(),
  ver: integer("ver").notNull(),
  json: text("json").notNull(),
}, (t) => [
  primaryKey({ columns: [t.pumpId, t.name] })
]);

export const creditSales = pgTable("credit_sales", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  custId: text("cust_id").notNull(),
  d: text("d").notNull(),
  n: text("n").notNull(),
  a: doublePrecision("a").notNull(),
  veh: text("veh"),
  workerId: integer("worker_id").notNull(),
  created: bigint("created", { mode: "number" }).notNull(),
  status: text("status").notNull().default("ok"),
  fuel: text("fuel"),
  litres: doublePrecision("litres"),
  dutyId: integer("duty_id"),
});

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  t: bigint("t", { mode: "number" }).notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  detail: text("detail"),
});

export const duties = pgTable("duties", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  workerId: integer("worker_id").notNull(),
  d: text("d").notNull(),
  shift: text("shift").notNull(),
  status: text("status").notNull().default("open"),
  cash: doublePrecision("cash").notNull().default(0),
  upi: doublePrecision("upi").notNull().default(0),
  card: doublePrecision("card").notNull().default(0),
  note: text("note"),
  started: bigint("started", { mode: "number" }).notNull(),
  submitted: bigint("submitted", { mode: "number" }),
  closedBy: integer("closed_by"),
  closedAt: bigint("closed_at", { mode: "number" }),
  payJson: text("pay_json"),
  stockDone: integer("stock_done").notNull().default(0),
  assignedBy: integer("assigned_by"),
});

export const dutyLines = pgTable("duty_lines", {
  id: serial("id").primaryKey(),
  dutyId: integer("duty_id").notNull(),
  nozzleId: text("nozzle_id").notNull(),
  opening: doublePrecision("opening"),
  closing: doublePrecision("closing"),
  testing: doublePrecision("testing").notNull().default(0),
  rate: doublePrecision("rate"),
});

export const dutyItems = pgTable("duty_items", {
  id: serial("id").primaryKey(),
  dutyId: integer("duty_id").notNull(),
  itemId: text("item_id").notNull(),
  name: text("name").notNull(),
  qty: doublePrecision("qty").notNull(),
  price: doublePrecision("price").notNull(),
});

export const dutyExpenses = pgTable("duty_expenses", {
  id: serial("id").primaryKey(),
  dutyId: integer("duty_id").notNull(),
  cat: text("cat").notNull(),
  note: text("note"),
  amount: doublePrecision("amount").notNull(),
});

export const days = pgTable("days", {
  pumpId: integer("pump_id").notNull().default(1),
  d: text("d").notNull(),
  status: text("status").notNull(),
  closedBy: integer("closed_by"),
  closedAt: bigint("closed_at", { mode: "number" }),
  approvedBy: integer("approved_by"),
  approvedAt: bigint("approved_at", { mode: "number" }),
}, (t) => [
  primaryKey({ columns: [t.pumpId, t.d] })
]);

export const dips = pgTable("dips", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  tankId: text("tank_id").notNull(),
  litres: doublePrecision("litres").notNull(),
  dip: doublePrecision("dip"),
  note: text("note"),
  userId: integer("user_id").notNull(),
  t: bigint("t", { mode: "number" }).notNull(),
  densObs: doublePrecision("dens_obs"),
  temp: doublePrecision("temp"),
  d15: doublePrecision("d15"),
});

export const payRates = pgTable("pay_rates", {
  pumpId: integer("pump_id").notNull().default(1),
  workerId: integer("worker_id").notNull(),
  shift: text("shift").notNull(),
  rate: doublePrecision("rate").notNull(),
}, (t) => [
  primaryKey({ columns: [t.pumpId, t.workerId, t.shift] })
]);

export const payItems = pgTable("pay_items", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  workerId: integer("worker_id").notNull(),
  month: text("month").notNull(),
  kind: text("kind").notNull(),
  amount: doublePrecision("amount").notNull(),
  note: text("note"),
  d: text("d").notNull(),
  created: bigint("created", { mode: "number" }).notNull(),
});

export const densityRegister = pgTable("density_register", {
  id: serial("id").primaryKey(),
  pumpId: integer("pump_id").notNull().default(1),
  tankId: text("tank_id").notNull(),
  d: text("d").notNull(),
  t: bigint("t", { mode: "number" }).notNull(),
  mObs: doublePrecision("m_obs"),
  mTemp: doublePrecision("m_temp"),
  mD15: doublePrecision("m_d15"),
  comp1: doublePrecision("comp1"),
  comp2: doublePrecision("comp2"),
  comp3: doublePrecision("comp3"),
  comp4: doublePrecision("comp4"),
  mixDens: doublePrecision("mix_dens"),
  chalanDens: doublePrecision("chalan_dens"),
  densDiff: doublePrecision("dens_diff"),
  preDip: doublePrecision("pre_dip"),
  preStock: doublePrecision("pre_stock"),
  postDens: doublePrecision("post_dens"),
  receiptKl: doublePrecision("receipt_kl"),
  chalanNo: text("chalan_no"),
  userId: integer("user_id"),
  byName: text("by_name"),
});
