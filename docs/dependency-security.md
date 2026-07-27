# Dependency security policy and current exception

## Blocking production gate

`npm run security:audit` runs:

```text
npm audit --omit=dev --audit-level=high
```

It must return zero before release packaging. The current patched production graph returns zero known vulnerabilities. Direct security updates include Next.js 16.2.11 and PostCSS 8.5.23; patched transitive overrides are pinned for Babel, JS-YAML, PostCSS, and Sharp.

## Full development-tool report

`npm run security:audit:all` audits production and development dependencies. CI always runs it and publishes the failure, but it is temporarily non-blocking because the remaining advisory is confined to the lint toolchain:

- `brace-expansion` through `minimatch@3` bundled by the current `eslint-config-next` plugins;
- the fixed `brace-expansion@5` API is incompatible with `minimatch@3`;
- globally forcing that major caused lint to crash;
- ESLint 10 removed the vulnerable branch in part of the graph but is incompatible with the React plugin bundled by `eslint-config-next@16.2.11`.

Mitigations:

- development dependencies are omitted from production installation/artifacts;
- CI lint configuration and glob inputs are repository-controlled;
- untrusted users cannot provide lint glob expressions;
- production dependency audit remains blocking;
- the full report remains visible on every CI run.

Removal condition:

Upgrade when Next's ESLint plugin stack supports a non-vulnerable minimatch/brace-expansion chain (or provides an ESLint 10-compatible plugin set), then restore the full audit as blocking. Do not force an incompatible override merely to hide the finding.
