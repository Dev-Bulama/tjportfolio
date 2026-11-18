# Tijani Bulama — Portfolio & Admin CMS

Editorial personal site and full content-management system for Tijani “TJ” Bulama: senior full-stack
engineer, AI automation specialist and corporate technology trainer.

**Stack:** Express 5 · TypeScript (strict) · EJS server rendering · Tailwind CSS v4 · MySQL 8 + Drizzle ORM ·
custom auth (argon2id, DB sessions, TOTP 2FA) · sharp · Nodemailer · Tiptap · Chart.js · Vitest · Playwright.
Built to run on Hostinger's Node.js Web Apps (shared/cloud hosting) — see [DEPLOY.md](DEPLOY.md).

## Local setup (5 commands)

Requires Node 20–24 and Docker (or any MySQL 8 server).

```bash
npm install
```

```bash
cp .env.example .env   # then set SESSION_SECRET, SETUP_TOKEN, DATABASE_* (docker defaults: tjportfolio / tj / tjdevpass) and UPLOAD_DIR
```

```bash
docker compose up -d
```

```bash
npm run dev
```

```bash
open "http://localhost:3000/setup?token=YOUR_SETUP_TOKEN"   # create the Owner, enrol 2FA, load starter content
```

Migrations run automatically when the server starts. To seed without the wizard: `npm run db:migrate && npm run db:seed`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server (tsx watch) + Tailwind watch + esbuild watch |
| `npm run build` | CSS, browser bundles and server → `public/assets`, `dist/` (no database needed) |
| `npm start` | Runs `dist/server.js` on `$PORT` |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Unit + integration tests (integration tests need MySQL; they're skipped if it's unreachable) |
| `npm run e2e` | Playwright smoke + axe accessibility suite (starts its own server on port 3100) |
| `npm run db:generate` | New migration after editing `src/db/schema/*` |
| `npm run db:migrate` · `npm run db:seed` | Apply migrations · idempotent seed |
| `scripts/make-zip.sh` | Clean ZIP for Hostinger's upload route |

Integration tests use `tjportfolio_test` (override with `TEST_DATABASE_NAME`); `docker compose -f docker-compose.test.yml up -d`
provides a throwaway MySQL on port 3307. E2E uses `tjportfolio_e2e`.

## Project layout

```
src/
  server.ts, app.ts          entry + Express app factory (security headers, sessions, CSRF, routers)
  config/env.ts              Zod-validated environment (clear error listing anything missing)
  db/                        Drizzle schema, migrator (GET_LOCK), seed content
  resources/                 content-module registry + generic CRUD engine + page-builder blocks
  routes/site|admin|api      public pages & forms · admin panel · health, collect, cron, media
  server/                    data loaders (cached), auth, uploads, analytics, backups, CV PDF, tickets
  lib/                       auth, storage drivers, mail, rate limit, cache, sanitize, validation, utils
  client/                    browser TypeScript bundled by esbuild (site.js ≈ 8 KB, admin.js + lazy chunks)
  styles/app.css             design tokens, light/dark themes, components
views/                       EJS templates (site, admin, blocks, emails)
drizzle/                     SQL migrations (committed)
tests/ e2e/                  Vitest unit/integration · Playwright E2E
```

Architecture notes and design decisions: [PLAN.md](PLAN.md). Conventions for contributors: [CLAUDE.md](CLAUDE.md).
How to run the site day to day: [ADMIN-GUIDE.md](ADMIN-GUIDE.md).

## Quality gates

- `npm run lint`, `npm run typecheck`, `npm test` (53 tests), `npm run e2e` (20 tests incl. axe on 10 pages + dark mode) all pass.
- Lighthouse (mobile, simulated slow 4G) on Home, Work, a case study, Contact, a training and a service page:
  Performance 99–100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.5–2.0 s; CLS 0.
- `npm audit --omit=dev`: no high or critical issues (one moderate advisory in a library bundled by `satori`,
  which only renders our own OG images and never unzips untrusted input).
