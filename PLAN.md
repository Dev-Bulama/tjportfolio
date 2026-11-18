# PLAN — Tijani "TJ" Bulama · Portfolio & Admin CMS

Source of truth: `portfolio-build-prompt.md` (the build brief), with one owner-directed change:
**the app is built on Express.js instead of Next.js.** This file records the architecture, the
decisions taken where the brief left room or where the Express switch requires a substitute, and the
phase checklist.

## 1. Architecture

```
Browser ──► Express 5 (single Node process, Node 22, `node dist/server.js`)
              helmet (CSP with per-request nonce, HSTS, …) → compression → cookie-parser
              → session loader (DB sessions) → CSRF (synchronizer token) → maintenance-mode gate
              → routes:
                 site/*      public pages, EJS server-rendered (SEO), data via tagged in-memory cache
                 /${ADMIN_PATH}/*  admin (EJS + small client bundles), every handler re-checks can()
                 /setup      first-run wizard
                 /api/*      collect, media, cron, health, og, cv, upload
          ──► src/server/*   queries (cached) + services (zod + can() + audit + cache bust)
          ──► src/db         Drizzle ORM → mysql2 pool (≤5 conns)
          ──► src/lib/storage  local (UPLOAD_DIR outside app) | s3 (R2 etc.)
          ──► jobs table     email retry, analytics roll-up — drained by /api/cron
Assets: Tailwind v4 CLI → public/assets/app.css; esbuild → public/assets/{site,admin}.js
```

### Generic resource engine
`src/resources/registry.ts` declares every content module once (table, fields, list columns,
features: status, featured, ordering, slug, SEO, trash, sample flag, public URL, cache tags).
From it we derive the Zod schema, the admin list (server-side search/filter/sort/paginate, bulk
actions, drag reorder), the editor form (rich text, media picker, gallery, repeaters, block builder,
SEO, status/schedule, autosave, unsaved-changes guard, per-record audit trail) and the CRUD handlers
(create / edit / duplicate / preview / trash / restore / destroy / reorder / bulk).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| D0 | **Express 5 + EJS** replaces Next.js (owner request). Templates are server-rendered for SEO; interactivity via small TypeScript bundles built with esbuild. | Owner instruction. |
| D1 | Brief libs that are React-only get framework-agnostic equivalents: Tiptap core (editor), Chart.js (charts, replaces Recharts), server-side tables (replaces TanStack Table), SortableJS (drag & drop), PDFKit (generated CV, replaces @react-pdf), EJS email templates (replace React Email), satori + sharp (OG images, replaces next/og), CSS transitions + a tiny rAF tween instead of Motion (keeps the public JS bundle small for Lighthouse), `lucide-static` SVG icons, hand-built accessible UI primitives (dialogs, menus, tabs) styled like shadcn/ui. | No React runtime. |
| D2 | Public data is cached in-process by tag (`src/lib/cache.ts`, TTL 300 s) and invalidated instantly on admin mutations. | ISR-equivalent on a single long-lived process. |
| D3 | IDs `bigint unsigned auto_increment`. Tokens (sessions, review links, resets) = random 32 bytes, stored as SHA-256. | Consistent, index-friendly. |
| D4 | Upload pipeline: magic-byte sniff → sharp auto-orient + strip metadata (EXIF/GPS) → cleaned original + WebP variants 320/640/960/1280/1920 + blur placeholder; `<picture>`/`srcset` helper uses them. If sharp fails, store original and warn. | Shared-hosting CPU; graceful fallback. |
| D5 | Country from proxy headers only; `geoip-lite` not bundled. | ~100 MB data. |
| D6 | Fonts self-hosted from `@fontsource-variable/*`, preloaded, `font-display: swap` with metric-matched fallbacks. | No third-party requests, minimal CLS. |
| D7 | HTML sanitizing: `sanitize-html` (no jsdom) on save and at render. | Same guarantee as DOMPurify without a jsdom cold start. |
| D8 | Testimonials public only when `approved AND consent AND NOT is_sample`; sample certifications never public; any `[[…]]` placeholder value is never rendered publicly (`pub()` helper). | Brief §0.4/§11. |
| D9 | CSRF: synchronizer token tied to the session (or a signed anonymous cookie for public forms), checked on every non-GET request except `/api/collect` and `/api/cron`. | Brief §4.11. |
| D10 | Scheduled posts are treated as published once `published_at <= NOW()` by every query; cron also flips status. | Nothing depends on cron alone. |

## 3. Route map
Public: `/`, `/about`, `/services`, `/services/:slug`, `/work`, `/work/:slug`, `/training`,
`/training/:slug`, `/courses`, `/certifications`, `/certifications/:slug`, `/gallery`,
`/gallery/:slug`, `/testimonials`, `/review/:token`, `/insights`, `/insights/:slug`, `/resume`,
`/contact`, `/maintenance-request`, `/status/:ticket`, `/privacy`, `/terms`, custom pages `/*`,
`/newsletter/confirm`, `/newsletter/unsubscribe`, `/setup`, 404/500.
SEO: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/rss.xml`, `/og/:kind/:slug.png`.
Admin (`/${ADMIN_PATH}`): login, 2fa, forgot/reset, dashboard, content/:resource (list, new, :id,
trash), media, inbox, tickets, registrations, subscribers, review requests, menus, settings,
analytics, users, account (password, 2FA, sessions), audit, backups, system.
API: `/api/health`, `/api/collect`, `/api/cron`, `/media/*`, `/cv/:id`, `/cv/generated.pdf`.

## 4. Phase checklist
- [x] **0. Plan** — PLAN.md, CLAUDE.md
- [x] **1. Foundation** — Express + TS strict, Tailwind v4, design tokens, fonts, env (zod), Drizzle/mysql2, docker-compose, ESLint/Prettier, client build
- [x] **2. Data layer** — schema, migrations, boot migrator with GET_LOCK, idempotent seed
- [x] **3. Auth & admin shell** — setup wizard, login, TOTP + recovery, reset, sessions, roles, lockout, audit, admin layout, ⌘K palette
- [x] **4. Content modules** — resource engine + all modules, settings, review requests, CV files
- [x] **5. Media & storage** — drivers, upload pipeline, library, usages, health card
- [x] **6. Public site** — all routes, homepage builder, page blocks, menus, SEO/OG/JSON-LD/sitemap/RSS
- [x] **7. Forms & comms** — contact, tickets, status, newsletter, registrations, reviews, inbox, emails, jobs
- [x] **8. Analytics & hardening** — beacon, collect, roll-ups, dashboard, CSP, cron, export/import
- [ ] **9. Polish & QA** — responsive/dark/motion, empty states, Lighthouse, axe, tests
- [ ] **10. Docs** — README, DEPLOY, ADMIN-GUIDE, .env.example, scripts/make-zip.sh
