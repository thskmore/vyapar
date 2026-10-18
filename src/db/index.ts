import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (process.env.SQL_HOST && process.env.SQL_USER) {
      try {
        global._postgresPool = new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 10,
          connectionTimeoutMillis: 15000,
        });

        global._postgresPool.on("error", (err) => {
          console.error("Unexpected error on idle SQL pool client:", err);
        });
      } catch (err) {
        console.warn("[AI Studio] Database pool initialization failed:", err);
      }
    }
  }
  return global._postgresPool;
};

export const pool = createPool();

let dbInstance: any;
try {
  if (pool) {
    dbInstance = drizzle(pool, { schema });
  } else {
    throw new Error("Pool unavailable or credentials missing");
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  dbInstance = new Proxy(
    {},
    {
      get: (_, prop) =>
        prop === "query" ? new Proxy({}, { get: () => noOp }) : async () => [],
    }
  );
}

export const db = dbInstance;
