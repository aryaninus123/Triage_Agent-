import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";
import { seedCustomers } from "./customer-store";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return instance;
}

export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), "data", "triage.db");
  instance = new Database(resolvedPath);
  initSchema(instance);
  seedCustomers(instance);
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
