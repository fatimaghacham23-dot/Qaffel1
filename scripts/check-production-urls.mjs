import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/app", "src/components", "src/lib"];
const allowed = new Set(["src/lib/urls.ts", "src/lib/env-public.ts", "src/lib/env-server.ts", "src/app/api/readiness/route.ts"]);
const prohibited = [/https?:\/\/(?:localhost|127\.0\.0\.1)/, /NEXT_PUBLIC_APP_URL/, /window\.location\.origin/, /location\.origin/];
const explicitRedirects = new Map([["/settings", "/settings/profile"], ["/settings/integrations", "/settings"]]);

function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return files(child);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [child.replaceAll("\\", "/")] : [];
  });
}

function routePath(file) {
  const relative = file.replace(/^src\/app/, "").replace(/\/page\.tsx$/, "");
  if (!relative || /\[.+?\]/.test(relative)) return relative ? null : "/";
  return relative;
}

const appFiles = files("src/app");
const routes = new Set(appFiles.filter((file) => file.endsWith("/page.tsx")).map(routePath).filter(Boolean));
const violations = [];
const internalDestinations = new Set();
const hrefPattern = /\bhref\s*(?:=|:)\s*(?:\{\s*)?["'](\/[^"']*)/g;

for (const root of roots) {
  for (const file of files(root)) {
    if (allowed.has(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const source = readFileSync(file, "utf8");
    for (const pattern of prohibited) if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
    for (const match of source.matchAll(hrefPattern)) {
      const destination = match[1].split(/[?#]/)[0];
      if (destination) internalDestinations.add(destination);
    }
  }
}

for (const destination of internalDestinations) {
  if (!routes.has(destination) && !explicitRedirects.has(destination)) violations.push(`unknown internal destination: ${destination}`);
}

for (const [source, target] of explicitRedirects) {
  const file = `src/app${source}/page.tsx`;
  if (!routes.has(source) || !readFileSync(file, "utf8").includes(`redirect("${target}")`)) {
    violations.push(`redirect route missing or incorrect: ${source} -> ${target}`);
  }
}

if (violations.length) {
  console.error("Production URL guard failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("Production URL guard passed.");
