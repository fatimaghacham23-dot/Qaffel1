import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = join(root, "supabase", "migrations");
const manifestPath = join(root, "MIGRATIONS.md");
const initial = "0001_initial_schema.sql";
const timestamped = /^(\d{14})_[a-z0-9_]+\.sql$/;

const migrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));
const documented = new Set(
  [...readFileSync(manifestPath, "utf8").matchAll(/`((?:0001|\d{14})_[a-z0-9_]+\.sql)`/g)]
    .map((match) => match[1])
);
const errors = [];
const versions = new Map();

if (migrations[0] !== initial) {
  errors.push(`First migration must be ${initial}.`);
}

for (const migration of migrations) {
  if (migration === initial) continue;
  const match = timestamped.exec(migration);
  if (!match) {
    errors.push(`Invalid migration filename: ${migration}`);
    continue;
  }
  if (versions.has(match[1])) {
    errors.push(`Duplicate migration version ${match[1]}: ${versions.get(match[1])}, ${migration}`);
  }
  versions.set(match[1], migration);
}

for (const migration of migrations) {
  if (!documented.has(migration)) errors.push(`Undocumented migration: ${migration}`);
}
for (const migration of documented) {
  if (!migrations.includes(migration)) errors.push(`Manifest references a missing migration: ${migration}`);
}

if (errors.length) {
  for (const error of errors) console.error(`[migrations] ${error}`);
  process.exit(1);
}

console.log(`[migrations] PASS: ${migrations.length} ordered migrations match MIGRATIONS.md`);
