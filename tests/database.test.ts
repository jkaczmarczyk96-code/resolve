import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

const alice = randomUUID();
const bob = randomUUID();
const problemA = randomUUID();
const problemA2 = randomUUID();
const problemB = randomUUID();
const stepA = randomUUID();
const stepA2 = randomUUID();
const stepB = randomUUID();
const stepB2 = randomUUID();
let db: PGlite;

async function asUser(user: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec("set role authenticated");
}

// Values remain parameterized. Table/column identifiers below are test-owned constants.
async function insert(table: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  return db.query(`insert into public.${table} (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(values));
}

beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users (id) values ($1), ($2)", [alice, bob]);
  await asUser(alice);
  await db.query("update public.profiles set display_name = 'Alice' where id = $1", [alice]);
  await insert("problems", { id: problemA, user_id: alice, title: "A", original_input: "A goal" });
  await insert("problems", { id: problemA2, user_id: alice, title: "A2", original_input: "A second goal" });
  await insert("plan_steps", { id: stepA, problem_id: problemA, title: "First", sequence: 0 });
  await insert("plan_steps", { id: stepA2, problem_id: problemA, title: "Second", sequence: 1 });
  await asUser(bob);
  await db.query("update public.profiles set display_name = 'Bob' where id = $1", [bob]);
  await insert("problems", { id: problemB, user_id: bob, title: "B", original_input: "B goal" });
  await insert("plan_steps", { id: stepB, problem_id: problemB, title: "First", sequence: 0 });
  await insert("plan_steps", { id: stepB2, problem_id: problemB, title: "Second", sequence: 1 });
});
afterAll(async () => { await db?.close(); });

describe("database grants and RLS", () => {
  it("enables RLS and the expected policies on every public table", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean; count: number }>(`
      select c.relname, c.relrowsecurity, count(p.oid)::int as count
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      left join pg_policy p on p.polrelid = c.oid
      where n.nspname = 'public' and c.relkind = 'r'
      group by c.relname, c.relrowsecurity
    `);
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.count, row.relname).toBe(["web_runs", "human_requests"].includes(row.relname) ? 1 : 4);
    }
  });

  it("isolates profiles and prevents profile identity reassignment", async () => {
    await asUser(alice);
    expect((await db.query("select id from public.profiles")).rows).toEqual([{ id: alice }]);
    await expect(insert("profiles", { id: bob })).rejects.toThrow(/row-level security/);
    expect((await db.query("update public.profiles set display_name = 'stolen' where id = $1 returning id", [bob])).rows).toHaveLength(0);
    await expect(db.query("update public.profiles set id = $1 where id = $2", [bob, alice])).rejects.toThrow(/row-level security/);
    expect((await db.query("delete from public.profiles where id = $1 returning id", [bob])).rows).toHaveLength(0);
    expect((await db.query("update public.profiles set display_name = 'Alice updated' where id = $1 returning id", [alice])).rows).toHaveLength(1);
    expect((await db.query("delete from public.profiles where id = $1 returning id", [alice])).rows).toHaveLength(1);
    await insert("profiles", { id: alice });
  });

  it("isolates problems for SELECT/INSERT/UPDATE/DELETE and forbids ownership transfer", async () => {
    await asUser(alice);
    expect((await db.query("select id from public.problems where id = $1", [problemB])).rows).toHaveLength(0);
    await expect(insert("problems", { user_id: bob, title: "Forged", original_input: "Input" })).rejects.toThrow(/row-level security/);
    expect((await db.query("update public.problems set title = 'Stolen' where id = $1 returning id", [problemB])).rows).toHaveLength(0);
    expect((await db.query("delete from public.problems where id = $1 returning id", [problemB])).rows).toHaveLength(0);
    await expect(db.query("update public.problems set user_id = $1 where id = $2", [bob, problemA])).rejects.toThrow(/row-level security/);
    const own = randomUUID();
    await insert("problems", { id: own, user_id: alice, title: "Own", original_input: "Input" });
    expect((await db.query("update public.problems set title = 'Updated' where id = $1 returning id", [own])).rows).toHaveLength(1);
    expect((await db.query("delete from public.problems where id = $1 returning id", [own])).rows).toHaveLength(1);
  });

  const childFixtures = [
    { table: "constraints", values: { type: "budget", description: "Budget" } },
    { table: "unknowns", values: { description: "Location?" } },
    { table: "plan_steps", values: { title: "Research", sequence: 20 } },
    { table: "research_items", values: { title: "Source", claim: "Claim", source_url: "https://example.com", source_name: "Example" } },
    { table: "options", values: { title: "Option", description: "Description" } },
    { table: "decisions", values: { title: "Decision", decision: "Choose", reasoning: "Public summary" } },
    { table: "tasks", values: { title: "Task" } },
    { table: "risks", values: { title: "Risk", description: "Description" } },
    { table: "agent_runs", values: { agent_type: "intake" } },
  ];

  it.each(childFixtures)("enforces all ownership operations on $table", async ({ table, values }) => {
    const foreignId = randomUUID();
    const ownId = randomUUID();
    await asUser(bob);
    await insert(table, { ...values, id: foreignId, problem_id: problemB });
    await asUser(alice);
    expect((await db.query(`select id from public.${table} where id = $1`, [foreignId])).rows).toHaveLength(0);
    await expect(insert(table, { ...values, problem_id: problemB })).rejects.toThrow(/row-level security/);
    expect((await db.query(`update public.${table} set problem_id = $1 where id = $2 returning id`, [problemA, foreignId])).rows).toHaveLength(0);
    expect((await db.query(`delete from public.${table} where id = $1 returning id`, [foreignId])).rows).toHaveLength(0);
    await insert(table, { ...values, id: ownId, problem_id: problemA });
    expect((await db.query(`select id from public.${table} where id = $1`, [ownId])).rows).toHaveLength(1);
    await expect(db.query(`update public.${table} set problem_id = $1 where id = $2`, [problemB, ownId])).rejects.toThrow(/row-level security/);
    expect((await db.query(`update public.${table} set problem_id = $1 where id = $2 returning id`, [problemA, ownId])).rows).toHaveLength(1);
    expect((await db.query(`delete from public.${table} where id = $1 returning id`, [ownId])).rows).toHaveLength(1);
  });

  it("protects the dependency relation for all four operations", async () => {
    await asUser(bob);
    await insert("plan_step_dependencies", { problem_id: problemB, plan_step_id: stepB2, depends_on_id: stepB });
    await asUser(alice);
    expect((await db.query("select * from public.plan_step_dependencies where problem_id = $1", [problemB])).rows).toHaveLength(0);
    await expect(insert("plan_step_dependencies", { problem_id: problemB, plan_step_id: stepB2, depends_on_id: stepB })).rejects.toThrow(/row-level security/);
    expect((await db.query("update public.plan_step_dependencies set depends_on_id = $1 where problem_id = $2 returning *", [stepB, problemB])).rows).toHaveLength(0);
    expect((await db.query("delete from public.plan_step_dependencies where problem_id = $1 returning *", [problemB])).rows).toHaveLength(0);
    await insert("plan_step_dependencies", { problem_id: problemA, plan_step_id: stepA2, depends_on_id: stepA });
    expect((await db.query("select * from public.plan_step_dependencies")).rows).toHaveLength(1);
    await expect(db.query("update public.plan_step_dependencies set problem_id = $1, plan_step_id = $2, depends_on_id = $3 where problem_id = $4", [problemB, stepB2, stepB, problemA])).rejects.toThrow(/row-level security/);
    expect((await db.query("update public.plan_step_dependencies set depends_on_id = $1 where problem_id = $2 returning *", [stepA, problemA])).rows).toHaveLength(1);
    expect((await db.query("delete from public.plan_step_dependencies where problem_id = $1 returning *", [problemA])).rows).toHaveLength(1);
  });

  it("denies anonymous CRUD and access with a missing user identity", async () => {
    await db.exec("reset role");
    const { rows: tables } = await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
    await db.exec("set role anon");
    for (const { tablename } of tables) {
      await expect(db.query(`select ${tablename === "web_runs" ? "id" : "*"} from public.${tablename}`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`insert into public.${tablename} default values`)).rejects.toThrow(/permission denied/);
      const column = ["plan_step_dependencies", "human_requests"].includes(tablename) ? "problem_id" : "id";
      await expect(db.query(`update public.${tablename} set ${column} = ${column}`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`delete from public.${tablename}`)).rejects.toThrow(/permission denied/);
    }
    await asUser("");
    for (const { tablename } of tables) expect((await db.query(`select ${tablename === "web_runs" ? "id" : "*"} from public.${tablename}`)).rows).toHaveLength(0);
    await expect(insert("problems", { user_id: alice, title: "No identity", original_input: "Input" })).rejects.toThrow(/row-level security/);
  });
});

describe("database integrity", () => {
  it("rejects cross-problem research/dependency links and self dependencies", async () => {
    await asUser(alice);
    const source = { title: "Source", claim: "Claim", source_name: "Example", source_url: "https://example.com" };
    await expect(insert("research_items", { ...source, problem_id: problemA, plan_step_id: stepB })).rejects.toThrow(/foreign key/);
    await expect(insert("research_items", { ...source, problem_id: problemA2, plan_step_id: stepA })).rejects.toThrow(/foreign key/);
    await expect(insert("plan_step_dependencies", { problem_id: problemA, plan_step_id: stepA, depends_on_id: stepB })).rejects.toThrow(/foreign key/);
    await expect(insert("plan_step_dependencies", { problem_id: problemA, plan_step_id: stepA, depends_on_id: stepA })).rejects.toThrow(/check constraint/);
  });

  it("enforces progress, status, currency, probability, and safe source constraints", async () => {
    await asUser(alice);
    await expect(insert("problems", { user_id: alice, title: "Invalid", original_input: "Input", progress: 101 })).rejects.toThrow(/check constraint/);
    await expect(db.query("update public.problems set status = 'solved' where id = $1", [problemA])).rejects.toThrow(/check constraint/);
    await expect(insert("options", { problem_id: problemA, title: "Cost", description: "Cost", estimated_cost: 100 })).rejects.toThrow(/check constraint/);
    await expect(insert("risks", { problem_id: problemA, title: "Risk", description: "Risk", probability: 2 })).rejects.toThrow(/check constraint/);
    await expect(insert("research_items", { problem_id: problemA, title: "Unsafe", claim: "Claim", source_name: "Unsafe", source_url: "javascript:alert(1)" })).rejects.toThrow(/check constraint/);
  });

  it("maintains timestamps and preserves research when a step is deleted", async () => {
    await asUser(alice);
    const own = randomUUID();
    const step = randomUUID();
    await insert("problems", { id: own, user_id: alice, title: "Temporary", original_input: "Input", updated_at: "2000-01-01T00:00:00Z" });
    const { rows } = await db.query<{ updated_at: string }>("update public.problems set title = 'Updated' where id = $1 returning updated_at", [own]);
    expect(new Date(rows[0].updated_at).getUTCFullYear()).toBeGreaterThan(2000);
    await insert("plan_steps", { id: step, problem_id: own, title: "Step", sequence: 0 });
    await insert("research_items", { problem_id: own, plan_step_id: step, title: "Source", claim: "Claim", source_name: "Example", source_url: "https://example.com" });
    await db.query("delete from public.plan_steps where id = $1", [step]);
    expect((await db.query("select plan_step_id from public.research_items where problem_id = $1", [own])).rows).toEqual([{ plan_step_id: null }]);
    await db.query("delete from public.problems where id = $1", [own]);
    expect((await db.query("select id from public.research_items where problem_id = $1", [own])).rows).toHaveLength(0);
  });

  it("cascades account deletion to all owned problem data", async () => {
    await db.exec("reset role");
    await db.query("delete from auth.users where id = $1", [bob]);
    expect((await db.query("select id from public.profiles where id = $1", [bob])).rows).toHaveLength(0);
    expect((await db.query("select id from public.problems where user_id = $1", [bob])).rows).toHaveLength(0);
    const { rows: tables } = await db.query<{ table_name: string }>("select table_name from information_schema.columns where table_schema = 'public' and column_name = 'problem_id'");
    for (const { table_name } of tables) expect((await db.query(`select ${table_name === "web_runs" ? "id" : "*"} from public.${table_name} where problem_id = $1`, [problemB])).rows).toHaveLength(0);
  });
});
