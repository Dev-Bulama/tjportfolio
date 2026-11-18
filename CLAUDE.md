# CLAUDE.md — working notes for this repo

Portfolio + admin CMS for Tijani "TJ" Bulama. Brief: `portfolio-build-prompt.md`. Architecture and
decisions: `PLAN.md` (read §2 "Decisions" before changing caching, CSP, images or auth).

## Stack
Express 5 + EJS (server-rendered), TypeScript strict, Tailwind v4 (CLI), esbuild client bundles,
Drizzle ORM + mysql2 (MySQL 8), custom auth (argon2id, DB sessions, TOTP), Zod everywhere,
Tiptap core, sharp, Nodemailer + EJS email templates, Chart.js, SortableJS, PDFKit, satori, Vitest, Playwright.

## Commands
- `npm run dev` — tsx watch + Tailwind watch + esbuild watch (needs MySQL; `docker compose up -d`)
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` — run all four after every change set
- `npm run db:generate` — create a migration after editing `src/db/schema/*`
- `npm run db:migrate` / `npm run db:seed` — local DB setup (also run automatically: migrations on boot, seed from /setup)
- `npm run e2e` — Playwright smoke tests (`--trace off` unless debugging)

## Conventions
- `src/client/*` is browser code (bundled by esbuild); it must never import from `src/db`, `src/lib/auth` or `src/server`.
- Every mutation: Zod-parse input → `requirePerm(action, resource)` → write → `audit()` → `bust(tags)`.
  The router-level admin guard is not enough on its own; each handler checks permissions.
- Content modules are declared in `src/resources/registry.ts`; add fields there, not in ad-hoc forms.
- Public data loaders live in `src/server/public.ts`, are wrapped in `cached()` (`src/lib/cache.ts`)
  and must filter: published (or scheduled+due), not deleted, not sample.
- Hide unknown seed values: anything containing `[[…]]` goes through `pub()` / `isPlaceholder()` before rendering.
- `npm run build` never touches the DB.
- Escape everything in EJS (`<%= %>`); `<%- %>` only for sanitized HTML, icons and includes.
- Admin links: use `A(path)` in views / `adminUrl()` in code — the admin path is configurable via `ADMIN_PATH`.
- Colors only via tokens (`text-ink`, `bg-surface`, `border-line`, `text-gold`…); gold never for body text on ivory.
- No TODOs, no lorem ipsum, no fabricated testimonials/certifications.

## Hosting constraints (Hostinger hPanel Node "Web App")
- App sleeps when idle → no in-process timers; scheduled work runs via `GET /api/cron?secret=…&task=all`.
- MySQL only, host usually `localhost`; pool ≤ 5 connections.
- App dir is replaced on redeploy → uploads live in `UPLOAD_DIR` (outside the app) or S3/R2.
- No SSH assumed → migrations run on boot (`src/db/migrate.ts` called from `src/server.ts`, guarded by `GET_LOCK`).
- Keep deps lean. Entry point `dist/server.js`; `PORT` comes from the host.
