import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = join(root, "supabase", "migrations");
const migrationDocPath = join(root, "MIGRATIONS.md");
const packagePath = join(root, "package.json");
const envExamplePath = join(root, ".env.example");
const releaseDir = join(root, ".release");
const releaseManifestPath = join(releaseDir, "release-manifest.json");

const requiredProductionVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SOLO",
  "STRIPE_PRICE_BUSINESS",
  "STRIPE_PRICE_TEAM",
  "STRIPE_PRICE_ENTERPRISE"
];

const serverOnlyNamePattern = /(SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)/i;
const timestampedMigrationPattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const initialMigrationName = "0001_initial_schema.sql";

function fail(message) {
  failures.push(message);
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function listMigrations() {
  return readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
}

function documentedMigrations() {
  const text = readFileSync(migrationDocPath, "utf8");
  return new Set(
    [...text.matchAll(/`((?:0001|\d{14})_[a-z0-9_]+\.sql)`/g)].map((match) => match[1])
  );
}

function validateMigrationManifest(migrations) {
  const versions = new Map();
  const documented = documentedMigrations();

  if (migrations[0] !== initialMigrationName) {
    fail(`First migration must be ${initialMigrationName}; found ${migrations[0] || "none"}.`);
  }

  for (const name of migrations) {
    if (name === initialMigrationName) continue;
    const match = timestampedMigrationPattern.exec(name);
    if (!match) {
      fail(`Migration filename is not a 14-digit timestamp plus snake_case name: ${name}`);
      continue;
    }
    const version = match[1];
    const previous = versions.get(version);
    if (previous) fail(`Duplicate migration version ${version}: ${previous}, ${name}`);
    versions.set(version, name);
  }

  for (const name of migrations) {
    if (!documented.has(name)) fail(`MIGRATIONS.md does not document ${name}`);
  }
  for (const name of documented) {
    if (!migrations.includes(name)) fail(`MIGRATIONS.md references missing migration ${name}`);
  }
}

function validateEnvironment() {
  for (const name of requiredProductionVariables) {
    if (!process.env[name]?.trim()) fail(`Required production variable is absent: ${name}`);
  }

  const example = readFileSync(envExamplePath, "utf8");
  const documentedNames = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
  for (const name of documentedNames) {
    if (name.startsWith("NEXT_PUBLIC_") && serverOnlyNamePattern.test(name)) {
      fail(`Server-only secret-like variable must not be public: ${name}`);
    }
  }
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("NEXT_PUBLIC_") && serverOnlyNamePattern.test(name)) {
      fail(`Server-only secret-like environment variable must not be public: ${name}`);
    }
  }
}

function validateGit() {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) fail("Git working tree is dirty. Commit or remove all release inputs before release.");
}

function runCheck(label, npmArgs) {
  process.stdout.write(`\n[release-check] ${label}\n`);
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(executable, npmArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function writeManifest(migrations) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const manifest = {
    application: pkg.name,
    version: pkg.version,
    commitSha: git(["rev-parse", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    buildTimeUtc: new Date().toISOString(),
    nodeVersion: process.version,
    migrationCount: migrations.length,
    migrations
  };
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(releaseManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`\n[release-check] release manifest: ${releaseManifestPath}\n`);
}

if (!existsSync(migrationDir) || !existsSync(migrationDocPath) || !existsSync(packagePath)) {
  console.error("[release-check] repository layout is incomplete.");
  process.exit(1);
}

const failures = [];
const migrations = listMigrations();

validateGit();
validateEnvironment();
validateMigrationManifest(migrations);

if (failures.length) {
  console.error("\n[release-check] preflight failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

try {
  runCheck("typecheck", ["run", "typecheck"]);
  runCheck("lint", ["run", "lint"]);
  runCheck("tests", ["test"]);
  runCheck("production build", ["run", "build"]);
  writeManifest(migrations);
  console.log("\n[release-check] PASS");
} catch (error) {
  console.error(`\n[release-check] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
