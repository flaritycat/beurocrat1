import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

async function run() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.resolve(process.cwd(), "../database/migrations");
    const entries = await fs.readdir(migrationsDir);
    const files = entries.filter((entry) => entry.endsWith(".sql")).sort();

    for (const fileName of files) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [fileName],
      );

      if (alreadyApplied.rowCount) {
        continue;
      }

      const fullPath = path.join(migrationsDir, fileName);
      const sql = await fs.readFile(fullPath, "utf8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [fileName]);
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
