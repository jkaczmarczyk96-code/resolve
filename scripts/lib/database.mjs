import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

/** PostgreSQL test harness only; never import into the application runtime. */
export async function createTestDatabase() {
  const db = new PGlite();
  try {
    // Supabase-owned objects are simulated here; Auth/PostgREST are not running.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    const migrations = new URL("../../supabase/migrations/", import.meta.url);
    const filenames = (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort();
    for (const filename of filenames) {
      const sql = await readFile(new URL(filename, migrations), "utf8");
      await db.transaction(async (tx) => { await tx.exec(sql); });
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
