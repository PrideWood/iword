import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let sqlClient: ReturnType<typeof postgres> | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置；当前只能使用只读示例预览。");
  }

  sqlClient = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  database = drizzle(sqlClient, { schema });
  return database;
}

export async function closeDatabase() {
  if (sqlClient) await sqlClient.end({ timeout: 5 });
  sqlClient = undefined;
  database = undefined;
}
