import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/app", "src/components", "src/lib"];
const allowed = new Set(["src/lib/urls.ts", "src/lib/env-public.ts", "src/lib/env-server.ts", "src/app/api/readiness/route.ts"]);
const prohibited = [/https?:\/\/(?:localhost|127\.0\.0\.1)/, /NEXT_PUBLIC_APP_URL/, /window\.location\.origin/, /location\.origin/];
function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap((entry) => { const child = join(path, entry.name); if (entry.isDirectory()) return files(child); return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [child.replaceAll("\\", "/")] : []; }); }
const violations = [];
for (const root of roots) for (const file of files(root)) { if (allowed.has(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue; const source = readFileSync(file, "utf8"); for (const pattern of prohibited) if (pattern.test(source)) violations.push(`${file}: ${pattern}`); }
if (violations.length) { console.error("Production URL guard failed:\n" + violations.join("\n")); process.exit(1); }
console.log("Production URL guard passed.");