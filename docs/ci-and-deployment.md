# CI and production deployment controls

## Pull-request and branch CI

`.github/workflows/ci.yml` runs three independent gates:

- application: clean install, dependency audit, migration manifest, typecheck, all unit tests, lint, and production build;
- database rehearsal: local Supabase start, full reset, local migration history, and database lint;
- secret scan: full-history Gitleaks scan.

CI uses placeholder local/test identifiers only. They are not production credentials and must never be accepted as deployment configuration.

## Production release gate

`.github/workflows/production-release.yml` is manual and targets the protected `production` GitHub environment. It:

1. checks out an exact reviewed full commit SHA;
2. verifies the checkout is exact and clean;
3. performs a clean dependency install and vulnerability audit;
4. runs the repository release check;
5. packages `.next` and the release manifest as a retained artifact.

It intentionally does not deploy to a hosting provider. The repository does not contain verified provider/project metadata, a rollback owner, or protected provider credentials. Adding a guessed Vercel or other deployment command would create an unsafe release path.

To enable actual production deployment, record and review:

- hosting provider and immutable project identifier;
- domain ownership and DNS/TLS responsibility;
- protected environment approval rules;
- deployment token scope and rotation owner;
- application and database order;
- previous-version rollback command;
- health/readiness verification;
- post-deployment smoke and authenticated acceptance owners.

Then add a provider-specific deployment job that consumes only the validated artifact and remains behind the protected `production` environment approval.

## Branch protection recommendation

Require all three CI jobs, at least one independent review, resolved conversations, and a linear up-to-date branch before merge. Restrict workflow and environment changes to designated maintainers. Require manual production environment approval from someone other than the author.
