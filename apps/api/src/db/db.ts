import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createD1Database(database: D1Database): Database {
  return drizzle(database, { schema });
}

export type Schema = typeof schema;
export type Database = DrizzleD1Database<Schema>;
