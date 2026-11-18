# BUILD BRIEF — Tijani "TJ" Bulama · Personal Portfolio & Admin CMS

> **How to use this file:** Put it in an empty folder, open Claude Code there, and say:
> *"Read `portfolio-build-prompt.md` in full and build the project exactly as specified, phase by phase. Plan first, then execute."*

---

## 0. ROLE & OPERATING RULES FOR CLAUDE CODE

You are a principal full-stack engineer and senior product designer. Build a **production-ready, editorial-grade personal portfolio with a full admin CMS** for Tijani "TJ" Bulama. The bar is the visual and editorial quality of Forbes, Stripe Press and top executive personal sites: restrained, confident, typographically rich, fast, and accessible.

Operating rules:

1. **Plan first.** Before writing code, produce `PLAN.md` with the architecture, folder structure, DB schema, route map and phase checklist. Then execute phase by phase (Section 14), ticking items off in `PLAN.md`.
2. **Create a `CLAUDE.md`** at the repo root summarizing stack, conventions, commands and the hosting constraints in Section 12, so future sessions stay consistent.
3. **No placeholders in code.** Every page, form, admin screen and API route must work end to end. No `TODO`, no "coming soon", no lorem ipsum. Seed content comes from Section 11.
4. **Never fabricate credentials or testimonials.** Certifications and client reviews are seeded as **drafts flagged `isSample = true`** and are never shown publicly until the admin edits and publishes them. A visible admin banner reminds the owner to replace samples.
5. After each phase: run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`. Fix all errors before moving on. `git commit` at the end of each phase with a clear message.
6. Prefer boring, well-maintained libraries. Keep dependencies lean — this runs on shared/managed Node hosting (Hostinger hPanel), not a big VPS.
7. TypeScript `strict: true` everywhere. Zod-validate every input, on the server, always.

---

## 1. TECH STACK (fixed — do not substitute)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest stable, App Router) + React + TypeScript** | SSR/ISR for SEO, server actions for admin, one deployable app. Hostinger auto-detects Next.js. |
| Runtime | **Node.js 22 LTS** (must also run on 20) | Supported by Hostinger Web Apps. |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) + `lucide-react` icons | Accessible, themeable, no runtime CSS cost. |
| Motion | **Motion** (`motion/react`) — subtle only | Editorial feel, respects `prefers-reduced-motion`. |
| Database | **MySQL 8** (Hostinger managed MySQL; host is usually `localhost`) | Only DB engine Hostinger shared/managed plans support. |
| ORM | **Drizzle ORM + `mysql2`** with `drizzle-kit` migrations | No native query-engine binary — far more reliable on shared hosting than Prisma. |
| Auth | Custom, minimal and audited: **argon2id** (`@node-rs/argon2`) password hashing, **DB-backed sessions** in httpOnly/secure/SameSite=Lax cookies, **TOTP 2FA** (`otplib`) + recovery codes | Full control, no third-party auth dependency. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | Same schema client and server. |
| Rich text | **Tiptap** editor in admin, stored as JSON + sanitized HTML (`isomorphic-dompurify`) | Blog posts, case studies, custom pages. |
| Images | `sharp` for resize/WebP/AVIF + blur placeholder on upload | Fast pages, small files. |
| Uploads | Pluggable storage driver: **`local`** (default, persistent dir outside the app) and **`s3`** (S3-compatible, e.g. Cloudflare R2) | See Section 12.4 — uploads must survive redeploys. |
| Email | **Nodemailer** via Hostinger SMTP (`smtp.hostinger.com`, port 465, SSL) | Contact/maintenance notifications + auto-replies. |
| Anti-spam | **Cloudflare Turnstile** + honeypot field + DB-backed rate limiting | No Redis needed. |
| Charts | **Recharts** | Admin analytics dashboard. |
| Tables | **TanStack Table** | Sortable/filterable admin lists. |
| PDF | Uploaded CV PDF served as download; optional "generate CV PDF from site data" via `@react-pdf/renderer` | Always-current CV. |
| Testing | **Vitest** (unit/integration) + **Playwright** (smoke e2e) | |
| Lint/format | ESLint (next config) + Prettier | |

---

## 2. BRAND & DESIGN SYSTEM — "mature, editorial, executive"

### 2.1 Palette (deep navy + muted gold + warm ivory; teal used sparingly)

Define as CSS variables in `globals.css` and map into the Tailwind theme. Provide **light and dark** modes; default to the system setting, with a toggle.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#0B1A2B` | `#F3EFE6` | Headings, primary text |
| `--body` | `#33414F` | `#C9CED6` | Body text |
| `--muted` | `#6B7684` | `#8D97A5` | Captions, meta |
| `--bg` | `#F8F6F1` (warm ivory) | `#0A1420` | Page background |
| `--surface` | `#FFFFFF` | `#101D2C` | Cards |
| `--line` | `#E4DFD4` | `#1E2C3D` | Hairlines, borders |
| `--navy` | `#0F2A47` | `#16365A` | Brand primary, header, footer |
| `--gold` | `#B8925A` | `#CFAE74` | Accent: links on hover, rules, key numbers, CTA outline |
| `--teal` | `#1F6F6B` | `#3B9C95` | Tiny highlights only (tags, success) |
| `--danger` | `#9B2C2C` | `#E07A7A` | Errors |

All text/background pairs must meet **WCAG 2.2 AA** contrast. Gold is never used for body text on ivory.

### 2.2 Typography

- **Display/headings:** `Fraunces` (variable serif, optical sizing) — editorial, magazine-grade.
- **Body/UI:** `Inter` (variable).
- **Mono (code, stats labels):** `JetBrains Mono`.
- Load via `next/font` (self-hosted, no layout shift). Fluid type scale with `clamp()`. Body 17–18px, line-height 1.65, max line length ~70ch.

### 2.3 Visual language

- Generous whitespace, 12-column grid, max content width 1200px.
- Thin gold hairline rules and small-caps section kickers (e.g. `— SELECTED WORK`), like a magazine.
- Large portrait of TJ in the hero with a subtle duotone/navy grade option.
- Cards: flat, 1px border, soft shadow only on hover, 12px radius. No gradients-everywhere, no glassmorphism, no neon.
- Micro-interactions: underline-grow links, image zoom 1.03 on hover, staggered fade-up on scroll (disabled under reduced motion).
- Pull-quotes for testimonials in large Fraunces italic with a gold opening mark.
- "As featured / Trusted by" logo strip in grayscale, colorizing on hover.

### 2.4 Quality targets

- Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO (mobile).
- LCP < 2.0s, CLS < 0.05, no layout shift from fonts or images.
- Fully responsive from 320px to 2560px. Test breakpoints: 360, 390, 768, 1024, 1280, 1536.
- Keyboard navigable, visible focus rings (gold), skip-to-content link, semantic landmarks, alt text required on every uploaded image (enforced in admin).

---

## 3. INFORMATION ARCHITECTURE — PUBLIC SITE

Global header: logo/wordmark "Tijani Bulama", nav (About, Work, Training, Certifications, Insights, Contact), "Download CV" button, theme toggle. Sticky, shrinks on scroll, mobile slide-over menu. Navigation is **admin-editable** (Menu Manager).

Global footer: short bio line, social icons, quick links, newsletter signup, "Request maintenance" link, copyright, privacy and terms links.

| Route | Content |
|---|---|
| `/` | **Home**: hero (portrait, name, headline, one-line positioning, 2 CTAs: "Hire me / Book a consultation" + "View work"), live stats bar (years experience, projects delivered, professionals trained, courses authored — all admin-editable numbers), "What I do" service pillars, featured projects, featured trainings, client/partner logo strip, testimonials carousel, certifications strip, latest insights, CTA band. Every homepage section can be reordered, shown or hidden from admin. |
| `/about` | Long-form bio, portrait, career timeline (experience + education + NYSC), values/approach, tech stack grid grouped by category with proficiency, "Organizations I lead" (Skillscore, Mapelead, Ha-shem Academy), speaking/press, downloadable CV. |
| `/services` and `/services/[slug]` | Service pages: Software Engineering, AI Agents & Automation, Corporate Technology Training, Oracle Database Consulting & Training, Lean Six Sigma Training, Curriculum & Courseware Development. Each with deliverables, process, related projects, related reviews, FAQ, CTA. |
| `/work` | Unified portfolio with filter tabs: **All · Web Apps · Mobile Apps · Websites · AI & Automation · Plugins · Oracle DB · Data/Analytics · Lean Six Sigma** (categories are admin-managed). Search, tag filter, sort. Grid ↔ list toggle. |
| `/work/[slug]` | **Case study**: hero image, client, role, year, duration, status (completed / ongoing), tech stack chips, problem → approach → solution → results (rich text), metrics callouts, image gallery with lightbox, embedded video, live link, repo link (optional), App Store / Play Store badges for mobile apps, related reviews for this project, next/previous project. |
| `/training` | Trainings delivered: filter by track (Oracle, Cloud/AWS, VMware, Lean Six Sigma, Software Dev, AI/ML, Data, Cybersecurity, Digital Skills). Cards show client (if allowed), format (on-site/virtual), duration, cohort size, date. |
| `/training/[slug]` | Training detail: overview, curriculum outline (modules), outcomes, photo gallery from the sessions, participant/client reviews, "Request this training for your team" CTA (prefilled inquiry form). |
| `/courses` | Course catalogue (upcoming/open trainings) with dates, price or "on request", seats, "Register interest" form. |
| `/certifications` | Grid grouped by issuer/track. Each card: badge image, name, issuer, issue/expiry date, credential ID, **"Verify" link** to issuer, and a "View certificate" modal (image/PDF viewer). Filter by category. |
| `/certifications/[slug]` | Shareable detail page with the certificate preview and verification info. |
| `/gallery` | Albums (training sessions, events, speaking, team, project launches). Masonry layout, lightbox with captions, keyboard navigation, lazy loading. |
| `/testimonials` | All published reviews, filterable by **service type** (Web App, Mobile App, Website, Oracle DB, Lean Six Sigma, Corporate Training, AI/Automation, Consulting), with star rating, author, role, company, logo, linked project. Aggregate rating per category. |
| `/review/[token]` | **Private review submission page** reached via a one-time link the admin sends to a client. Submitted reviews land in moderation. |
| `/insights` and `/insights/[slug]` | Blog/articles: categories, tags, reading time, table of contents, share buttons, author box, related posts, RSS at `/rss.xml`. |
| `/resume` | Web version of the CV (print-friendly CSS) + "Download PDF" button. Download count is tracked. |
| `/contact` | Contact form (name, email, phone, company, inquiry type, budget range, timeline, message, attachment optional), direct email, WhatsApp click-to-chat, social links, office city (Lagos, Nigeria), optional Calendly/Cal.com embed for booking. |
| `/maintenance-request` | **Maintenance / support request form** for existing clients: client name, company, email, phone, project/system (dropdown of projects + "Other"), issue type (bug, downtime, content update, feature request, security, performance), priority (low/normal/high/critical), description, URL affected, screenshots upload (max 5 images, 5 MB each), preferred contact method. Generates a **ticket number** (e.g. `TJ-MR-2026-0042`), emails the client a confirmation and the admin a notification. |
| `/status/[ticket]` | Client can check their maintenance ticket status with ticket number + email. |
| `/[...slug]` | **Custom pages** created in admin with the block builder (Section 4.9). |
| `/privacy`, `/terms` | Editable legal pages (seeded with a sensible NDPA/GDPR-aware privacy notice for contact forms and analytics). |
| `/404`, `/500` | Branded error pages. |

### SEO & sharing (mandatory)

- Per-page meta title/description/OG image editable in admin, with sensible defaults.
- **Dynamic OG images** via `next/og` (name, title, navy/gold layout) for every project, post, training and certificate.
- JSON-LD: `Person` (with `sameAs` social links), `Organization` for Skillscore, `CreativeWork`/`SoftwareApplication` for projects, `Course` for trainings, `Article` for posts, `Review`/`AggregateRating` for testimonials, `BreadcrumbList`.
- `sitemap.xml` and `robots.txt` generated from DB content. Canonical URLs. Clean slugs.
- Open Graph and Twitter/X cards. Favicon set and web manifest.

---

## 4. ADMIN PANEL (`/admin`) — complete control

Layout: collapsible left sidebar, top bar with global search (⌘K command palette), notifications bell (new messages, tickets, reviews), profile menu, "View site" link. Light/dark. Fully usable on mobile and tablet.

Every content module supports: **list (search, filter, sort, paginate, bulk select) · create · edit · duplicate · preview · draft/published/scheduled status · featured toggle · drag-and-drop ordering · soft delete to Trash with restore · permanent delete (confirm dialog)** · SEO fields · slug auto-generation with manual override · audit trail.

### 4.1 Dashboard
KPI cards (visitors today/7d/30d, page views, CV downloads, new messages, open tickets, pending reviews), traffic chart, top pages, top referrers, recent activity feed, quick actions (New project, New training, Upload to gallery, Write post), and the "replace sample content" checklist until all samples are gone.

### 4.2 Profile & Site Settings
- **Profile:** full name, display name, headline, short bio, long bio (rich text), portrait upload (with crop), secondary photos, location, email, phone, WhatsApp number, availability status ("Available for projects" / "Booked until…") shown as a badge on the site.
- **Social links manager:** add/edit/reorder/hide any platform — LinkedIn, X (Twitter), GitHub, YouTube, Instagram, Facebook, TikTok, WhatsApp, Medium, Dev.to, Calendly/Cal.com, plus custom (label + URL + icon picker). Rendered in header/footer/contact and in JSON-LD `sameAs`.
- **Stats:** editable homepage counters (label, value, suffix, icon).
- **Branding:** logo (light/dark), favicon, accent color override (validated for contrast), font pair choice from 3 curated presets.
- **SEO defaults**, Google Search Console verification meta, optional GA4 ID (off by default).
- **Integrations:** SMTP settings (with "Send test email"), Turnstile keys, Calendly/Cal.com URL, storage driver config (`local`/`s3`) — secrets come from env, UI only shows whether they are configured.
- **Homepage builder:** toggle, reorder and retitle homepage sections.
- **Maintenance mode** toggle for the public site (admins still see it).

### 4.3 Content modules
1. **Projects / Work** — fields: title, slug, category (Web App, Mobile App, Website, AI & Automation, Plugin, Oracle DB, Data/Analytics, Lean Six Sigma, Other — categories are a managed table), client name, client logo, show-client toggle (for NDA work), role, year, start/end date, status (completed/ongoing/concept), summary, rich-text body (problem/approach/solution/results), key metrics (repeatable label + value), tech stack (multi-select from Skills), cover image, gallery (multi-upload, reorder, captions), video URL, live URL, repo URL, App Store URL, Play Store URL, testimonials link, featured flag.
2. **Skills** — name, category (Languages, Frameworks, Databases, Cloud/DevOps, AI/ML, Methodologies, Tools), proficiency (1–5 or %), years, icon/logo, show on homepage toggle.
3. **Experience timeline** — organization, role, location, start/end, current toggle, description, logo.
4. **Education** — institution, qualification, field, years, notes.
5. **Trainings delivered** — title, slug, track, client/organization (with show toggle), format, location, start/end dates, duration (days/hours), participants count, modules (repeatable title + description), outcomes, cover image, **photo gallery from the sessions**, related certifications, featured flag.
6. **Courses (catalogue)** — title, track, description, outline, duration, schedule, price or "on request", currency (NGN/USD), seats, registration open toggle; registrations listed in admin with CSV export.
7. **Certifications** — name, issuer, issuer logo, category, issue date, expiry date (auto "Expired" badge), credential ID, verification URL, certificate file (image or PDF), visibility toggle, display order.
8. **Gallery** — albums (title, slug, description, cover, date, category) → images (caption, alt text required, photographer credit, order). Bulk drag-and-drop upload with progress bars, automatic resizing and WebP.
9. **Testimonials / Reviews** — author name, role, company, company logo, author photo, rating (1–5), service type (managed list — Web App, Mobile App, Website, Oracle DB, Lean Six Sigma, Corporate Training, AI/Automation, Consulting), linked project or training (optional), quote, date, source (direct / LinkedIn / Google / email), consent-to-publish checkbox, status (pending/approved/rejected), featured.
   - **Review request flow:** admin enters a client's name + email + optional project → system emails a branded, single-use, expiring link to `/review/[token]` → submission arrives as *pending* → admin approves/edits/rejects. Track sent/opened/submitted.
10. **Insights (blog)** — title, slug, excerpt, cover, rich text body, categories, tags, author, reading time (auto), scheduled publish date, SEO.
11. **CV / Resume** — upload multiple CV versions (e.g. "Software Engineering CV", "Trainer CV"), set one as primary, toggle public visibility; optional "Generate PDF from site data" button that builds a clean, branded CV from profile + experience + skills + certifications. Download analytics per file.
12. **Services** — title, slug, icon, summary, body, deliverables list, process steps, FAQ (repeatable Q/A), related projects/reviews, CTA text.
13. **Clients & partners logos** — name, logo, URL, show toggle, order.
14. **Speaking & press** — title, event/publication, date, link, image.
15. **FAQs** — global FAQ items with category.

### 4.4 Inbox (contact messages)
Table with status (new, read, replied, archived, spam), inquiry type, date. Detail view with full message, attachment, metadata (page, referrer, country). Reply from admin (sends via SMTP, stored in thread), internal notes, mark as spam, export CSV. Email notification to admin on new message + branded auto-reply to sender.

### 4.5 Maintenance tickets
Kanban **and** table view: New → Acknowledged → In Progress → Awaiting Client → Resolved → Closed. Assign priority, set due date, internal notes, public replies (client is emailed and can see them on `/status/[ticket]`), attachments gallery, SLA indicator (time since opened), filter by project/client/priority.

### 4.6 Course registrations & training requests
List, status, notes, CSV export.

### 4.7 Newsletter subscribers
List, double opt-in status, unsubscribe link handling, CSV export.

### 4.8 Media Library
Central library for every upload: grid/list, search, filter by type/album/unused, edit alt text and caption, replace file (keeps references), see where each file is used, delete with usage warning. Upload limits configurable (default: images 8 MB, PDFs 15 MB). Allowed MIME types validated by **magic bytes**, not extension. Images stripped of EXIF GPS.

### 4.9 Pages & Menu Manager
- **Page builder:** create custom pages from blocks — Hero, Rich Text, Image, Image+Text, Gallery, Stats, Cards (from Projects/Trainings/Certifications/Testimonials with filters), CTA band, FAQ, Embed (YouTube/Calendly/Maps), Contact form, Spacer/Divider. Drag to reorder, per-block settings, preview, draft/publish, SEO.
- **Menu manager:** header and footer menus, nested items, link to page/route/external URL, reorder by drag.

### 4.10 Analytics (first-party, privacy-friendly, cookieless)
- Track via a tiny client beacon → `POST /api/collect` (respect Do-Not-Track; exclude logged-in admins and bots).
- Unique visitors computed from a **daily-rotating salted hash** of IP + user-agent (no raw IP stored, no cookies → no cookie banner required for analytics).
- Store: path, referrer domain, UTM params, device type, browser, OS, country (from `geoip-lite` or proxy header if present), timestamp.
- Events: CV download, certificate view, verify-link click, contact submit, maintenance submit, project view, outbound social click, WhatsApp click, course registration.
- Dashboard: date range picker (today, 7d, 30d, 90d, custom), visitors & page-views line chart, top pages, top projects, referrers, UTM campaigns, countries, devices, event funnel (visit → contact). CSV export.
- Nightly roll-up of raw hits into daily aggregates; raw hits pruned after 90 days (configurable).

### 4.11 Users, roles & security
- Roles: **Owner** (everything), **Admin** (all content + inbox, no user/security settings), **Editor** (content only), **Viewer** (read-only). Permission checks in a single `can(user, action, resource)` helper, enforced on every server action and API route.
- Login with email + password, **mandatory TOTP 2FA for Owner** (optional for others), 10 one-time recovery codes.
- Password reset by email (single-use token, 30-minute expiry). Strong password policy + check against a small common-password list.
- Login rate limiting and lockout after 5 failed attempts (15 min), with email alert to owner.
- Sessions list ("active devices") with revoke; sessions expire after 7 days idle / 30 days absolute.
- CSRF protection on all mutating requests (server actions + double-submit token for route handlers).
- **Audit log:** who did what, when, before/after diff for content changes, IP hash. Filterable.
- Admin URL path configurable via env (`ADMIN_PATH`, default `admin`) to reduce bot noise.

### 4.12 Backup & data tools
- One-click **Export** (JSON of all content + zip of uploads), and **Import** to restore.
- Optional scheduled backup to email or S3 (triggered by cron endpoint, Section 12.6).
- Trash with 30-day auto-purge.

---

## 5. DATA MODEL (Drizzle, MySQL)

Create these tables (snake_case, `id` as `varchar(26)` ULID or `bigint` autoincrement — pick one and be consistent; `created_at`, `updated_at`, `deleted_at` for soft delete on content tables; `utf8mb4_unicode_ci`):

`users`, `sessions`, `password_resets`, `recovery_codes`, `login_attempts`, `audit_logs`,
`settings` (key/value JSON), `social_links`, `stats`, `homepage_sections`,
`categories` (type-scoped: project/training/certification/post/service-type), `tags`, `taggables`,
`projects`, `project_images`, `project_skills`, `project_metrics`,
`skills`, `experiences`, `education`,
`trainings`, `training_modules`, `training_images`,
`courses`, `course_registrations`,
`certifications`,
`albums`, `media` (central library: path, driver, mime, size, width, height, blur_data_url, alt, caption, checksum), `media_usages`,
`testimonials`, `review_requests` (token hash, email, expires_at, used_at),
`posts`,
`services`, `service_faqs`,
`clients`, `press_items`, `faqs`,
`pages`, `page_blocks`, `menus`, `menu_items`,
`messages`, `message_replies`,
`maintenance_tickets`, `ticket_updates`, `ticket_attachments`,
`subscribers`,
`cv_files`,
`analytics_hits`, `analytics_events`, `analytics_daily`,
`rate_limits`, `jobs` (simple DB-backed queue for emails/rollups).

Add indexes on slugs (unique), status + published_at, foreign keys, and analytics timestamp columns. Write the schema in `src/db/schema/*.ts`, generate migrations with `drizzle-kit generate`, commit them.

---

## 6. PROJECT STRUCTURE

```
src/
  app/
    (site)/            # public routes + layout
    (admin)/admin/     # admin routes + layout (path from ADMIN_PATH via rewrite)
    api/               # route handlers: collect, media, cron, health, rss, og
    review/[token]/
    status/[ticket]/
    sitemap.ts  robots.ts  manifest.ts
  components/
    site/  admin/  ui/ (shadcn)  blocks/ (page-builder blocks)
  db/
    schema/  migrations/  index.ts  seed/
  lib/
    auth/  permissions.ts  storage/ (local.ts, s3.ts, index.ts)  mail/ (templates in react-email)
    analytics/  rate-limit.ts  validation/  seo.ts  utils.ts
  server/
    actions/  queries/
  instrumentation.ts   # runs pending migrations on boot (Section 12.5)
tests/  e2e/
```

---

## 7. FORMS — behaviour common to all public forms

Server-side Zod validation, Turnstile verification, honeypot field, rate limit (5 submissions / 10 min / IP-hash), friendly inline errors, success state with next steps, accessible labels and error announcements (`aria-live`), WhatsApp fallback link, and data stored before email is attempted (so nothing is lost if SMTP fails; failed emails retry via the `jobs` table).

Email templates (React Email, navy/gold branded, plain-text fallback): contact auto-reply, admin new-message alert, maintenance ticket confirmation, ticket update, review request, review thank-you, password reset, 2FA enabled, lockout alert, newsletter double opt-in, course registration confirmation.

---

## 8. PERFORMANCE & RELIABILITY

- Public pages use **ISR**; admin mutations call `revalidatePath`/`revalidateTag` for affected pages so changes appear instantly.
- `next/image` with stored width/height + blur placeholders; AVIF/WebP. If `sharp` fails to load at runtime, fall back gracefully (`images.unoptimized`) rather than crashing — log a warning.
- Fonts self-hosted via `next/font`. No render-blocking third-party scripts; Calendly/Maps embeds load on interaction.
- MySQL connection pool size small (≤ 5) — shared hosting has connection limits. Reuse a single pool across hot reloads.
- `/api/health` returns DB connectivity and version (used after deploy).
- Structured logging (`pino`) to stdout.
- Graceful handling of cold starts (the host stops idle apps — Section 12.1).

---

## 9. SECURITY CHECKLIST (must pass before Phase 8 ends)

- Security headers via `next.config` / middleware: CSP (nonce-based for scripts), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors 'none' (except allowed embeds).
- All admin routes protected in middleware **and** re-checked in every server action (never trust middleware alone).
- Uploaded files: magic-byte validation, randomized filenames, stored outside the web root, served through `/api/media/[...path]` with correct `Content-Type`, `Content-Disposition` for PDFs, `X-Content-Type-Options: nosniff`; SVG uploads disabled (or sanitized) by default.
- HTML from rich text sanitized on save and on render.
- No secrets in client bundles; `server-only` imports for server modules.
- `npm audit` clean of high/critical issues.
- Rate limits on login, reset, all public forms, `/api/collect`.

---

## 10. ACCESSIBILITY & UX DETAILS

- Lightbox, carousel, modals and command palette fully keyboard-operable with focus trapping and Escape to close.
- Carousels pause on hover/focus and have visible controls.
- Form fields with real `<label>`s, helper text, and error summaries.
- Print stylesheet for `/resume` and case studies.
- Empty states in admin with clear "Add your first…" actions.
- Toast notifications for every admin action; optimistic UI where safe.
- Unsaved-changes warning in admin editors; autosave drafts every 30s.

---

## 11. SEED CONTENT (realistic, about TJ)

Create `src/db/seed/` with idempotent seed scripts (`npm run db:seed`), also callable from the setup wizard. Use the content below. Where a value is unknown, use a clearly marked editable placeholder in the admin (e.g. `[[add LinkedIn URL]]`) and **do not render placeholder values publicly** — hide any field that still contains `[[…]]`.

### 11.1 Profile
- **Name:** Tijani Bulama ("TJ")
- **Headline:** Senior Full-Stack Engineer · AI Automation Specialist · Corporate Technology Trainer
- **Positioning line (hero):** "I build software that ships and train the teams who run it."
- **Location:** Lagos, Nigeria · works with clients across Africa and remotely worldwide
- **Short bio:** Tijani Bulama is a senior full-stack software engineer with 8+ years of experience building web, mobile and AI-powered products with Laravel, React, Node.js, Python, PostgreSQL/MySQL and AWS. He is the Founder and CEO of Skillscore IT Solutions & Training, a Lagos-based technology training and software development company, and leads corporate training delivery through Mapelead Limited and Ha-shem Academy. His work spans production software, AI agents and automation, and instructor-led programmes in Oracle Database, cloud, virtualization and Lean Six Sigma for corporate and public-sector teams.
- **Long bio (About page):** expand the short bio into 4–5 editorial paragraphs covering: engineering practice; the founding of Skillscore and its mission to close Africa's tech-skills gap; corporate training delivered for organizations including the ECOWAS Community Court of Justice and African American Business School (AABS); his authorship of large, programmatically produced course manuals and question banks; his growing focus on AI agent frameworks and automation; his NYSC service at the Katsina State Directorate of Information and Communication Technology (KATDICT), where he developed a digital impact and legacy agenda and a digital-literacy programme for schools; and his LinkedIn writing for the African tech community. Keep it factual and confident, no exaggeration.
- **Availability:** "Available for select projects & corporate trainings"
- **Email / phone / WhatsApp / domain:** `[[add]]`

### 11.2 Social links (seed with placeholders, all editable)
LinkedIn `[[linkedin.com/in/…]]`, X `[[x.com/…]]`, GitHub `[[github.com/…]]`, YouTube `[[…]]`, Instagram `[[…]]`, Facebook `[[…]]`, TikTok `[[…]]`, WhatsApp `[[wa.me/234…]]`, Calendly/Cal.com `[[…]]`.

### 11.3 Organizations / experience timeline
- Founder & CEO — Skillscore IT Solutions & Training, Lagos (current)
- Lead Trainer & Consultant — Mapelead Limited (training & consulting brand)
- Lead Instructor — Ha-shem Academy, Lagos (corporate training)
- Corporate training delivery under the Covalence brand (earlier)
- NYSC Corps Member — Katsina State Directorate of ICT (KATDICT)
- Senior Full-Stack Software Engineer — freelance & contract (8+ years)
(Dates: `[[add]]`.)

### 11.4 Skills (grouped)
- **Languages:** TypeScript, JavaScript, PHP, Python, SQL, PL/SQL, C#
- **Frameworks:** Laravel, React, Next.js, Node.js/Express, React Native, SvelteKit, ASP.NET Core, WordPress (plugins & themes)
- **Databases:** PostgreSQL, MySQL, Oracle Database 19c (SQL, PL/SQL, DBA, RAC), Prisma/Drizzle
- **Cloud & Infra:** AWS (Solutions Architect scope), VMware vSAN / VMware Cloud Foundation, Linux, Hostinger/hPanel, CI/CD
- **AI & Data:** AI agent frameworks, LLM automation, chatbots, AI video production workflows, dbt analytics engineering, machine learning fundamentals
- **Methodologies:** Lean Six Sigma (Master Black Belt curriculum), Agile delivery, secure coding
- **Training & Content:** curriculum design, instructor-led bootcamps, certification-style question banks, technical writing

### 11.5 Services (6)
Software Engineering (web & mobile) · AI Agents & Automation · Corporate Technology Training · Oracle Database Training & Consulting · Lean Six Sigma Training · Curriculum & Courseware Development. Write a strong summary, deliverables list, 4-step process and 3 FAQs for each.

### 11.6 Trainings delivered (seed as published; dates/participant counts `[[add]]`)
1. Oracle Database 19c Bootcamp — SQL, PL/SQL, DBA I–III (5 days, corporate IT staff, Ha-shem Academy)
2. Oracle Database RAC Administration 19c (4 days, hands-on VirtualBox RAC lab: DNS + 2 nodes)
3. Oracle Database Administration I (1Z0-082) — 5 days, incl. advanced automation edition
4. AWS Certified Solutions Architect – Associate (SAA-C03) — 5 days
5. VMware vSAN 7 — 5-day instructor-led
6. VMware Cloud Foundation 9.x — 5 days, banking capstone scenario
7. Lean Six Sigma Master Black Belt programme (manual, question banks, statistical practice sets)
8. dbt Analytics Engineering (NaijaCart capstone)
9. React Native Mobile Development (SkillHub Mobile project)
10. Secure Coding with ASP.NET Core (5 days)
11. C# and .NET (5 days)
12. AI & Machine Learning (Mapelead)
13. Full-Stack E-commerce Development (incl. PostgreSQL/Prisma edition)
14. AI Adoption & Cybersecurity — ECOWAS Community Court of Justice
15. AI Video Creation (6-week programme)
Each with a sensible module outline (5–8 modules) and outcomes derived from the title.

### 11.7 Projects (seed as **drafts** so TJ confirms details before publishing; give each a sensible summary from its name)
- **Websites:** PEAJEG Consults; T-CENTER Cleaning
- **E-commerce:** Blessing African Food Market & Beauty Store (Node.js, MySQL, Hostinger)
- **Web apps:** VoxTrade — AI-assisted forex signals (personal product); AI-powered School Management System; SmartClass + SmartClass Facial Attendance; FarmVax; SkillRide; TekGuru; ProLink; LegacyFarm; Togatravels; Ehomestyles; M-Right Digital
- **Plugins (WordPress):** Gaenity Community plugin; AI Chatbot plugin; Accountability plugin; Cophild theme
- **AI & automation:** AI Ad Video Prompt Studio; LinkedIn content automation
- **Concepts/ventures:** ClassAfter — rental marketplace for idle school spaces after hours
- **Oracle DB:** Oracle RAC 19c lab environment build (case study)
- **Courseware (as projects):** 238-page React Native handout; 223-page AI & ML manual; 76-page dbt manual; 70-page Lean Six Sigma MBB manual; 150-question Oracle DBA certification bank

### 11.8 Clients & partners strip (logos `[[upload]]`, hidden until a logo is uploaded)
ECOWAS Community Court of Justice · African American Business School (AABS) · Lagos State Employment Trust Fund (LSETF) — proposal · Timeless Group of Companies · ANWBN Marketplace · PEAJEG Consults · T-CENTER Cleaning · KATDICT

### 11.9 Certifications (seed as **drafts, `isSample = true`**, never public until edited)
Create one placeholder card per track TJ teaches so the layout is ready: Oracle Database, AWS, VMware, Lean Six Sigma, Scrum/Agile, Cybersecurity. Name each `[[Certification name]]` with issuer `[[Issuer]]`, credential ID `[[ID]]`, verify URL `[[URL]]`.

### 11.10 Testimonials (seed **3 sample drafts per service type**, `isSample = true`, status `pending`, author "Sample Reviewer")
They exist only to preview the layout in admin and are **never published automatically**. The dashboard shows "Send review requests to real clients" as the first onboarding task.

### 11.11 Insights (3 draft posts, full text, original)
1. "Shipping AI Agents in Production: Lessons from African Businesses"
2. "Why Oracle RAC Still Matters in 2026 — and How to Learn It on a Laptop"
3. "From Training Room to Production: Designing Bootcamps That Actually Change How Teams Work"

### 11.12 Gallery albums (empty, ready for uploads)
Oracle 19c Bootcamp · Oracle RAC Lab · Corporate Trainings · Speaking & Events · NYSC / KATDICT · Project Launches

### 11.13 Admin account
Created by the setup wizard (Section 12.5) — **never** hard-coded.

---

## 12. HOSTINGER hPANEL DEPLOYMENT (write this into `DEPLOY.md` as well)

Facts to design around:
- Hostinger runs Node.js apps as **"Web Apps"** on **Business Web Hosting or Cloud** plans. Deploy from **GitHub (auto-redeploy on push)** or a **ZIP upload**. Hostinger detects Next.js, runs the build, and keeps the process alive.
- Supported Node versions include **18, 20, 22, 24** → target **22**.
- **Apps run on demand:** after a period with no traffic the process stops and the next request starts it again. Therefore: no in-process timers/cron, keep boot fast, and use an external trigger for scheduled jobs.
- **Database:** MySQL only; host is usually `localhost`.
- Don't assume SSH or a writable app directory survives a redeploy.

### 12.1 `package.json` scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed/index.ts"
  },
  "engines": { "node": ">=20 <25" }
}
```
`next.config.ts`: `output: "standalone"`, `serverExternalPackages: ["sharp", "mysql2", "@node-rs/argon2"]`, security headers, image remote patterns for the S3 driver host. Make sure the build does **not** need a database connection (no DB calls at build time — use `export const dynamic`/ISR with runtime fetching, and `generateStaticParams` must tolerate an empty DB).

### 12.2 Environment variables (`.env.example`)
```
NODE_ENV=production
APP_URL=https://yourdomain.com
ADMIN_PATH=admin
SESSION_SECRET=            # 64+ random chars
SETUP_TOKEN=               # one-time token for /setup; delete after setup
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
STORAGE_DRIVER=local       # local | s3
UPLOAD_DIR=                # absolute path OUTSIDE the app folder, e.g. /home/uXXXXXXX/portfolio-storage
S3_ENDPOINT=  S3_REGION=auto  S3_BUCKET=  S3_ACCESS_KEY_ID=  S3_SECRET_ACCESS_KEY=  S3_PUBLIC_URL=
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=                 # e.g. hello@yourdomain.com
SMTP_PASSWORD=
MAIL_FROM="Tijani Bulama <hello@yourdomain.com>"
ADMIN_NOTIFY_EMAIL=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
CRON_SECRET=
ANALYTICS_SALT=
```
The app must validate env with Zod at boot and print a clear error listing missing variables.

### 12.3 Database migrations without SSH
- `src/instrumentation.ts` → on server start, run pending Drizzle migrations programmatically (`migrate()` from `drizzle-orm/mysql2/migrator`) with a MySQL advisory lock (`GET_LOCK`) so concurrent cold starts don't collide. Idempotent and fast.
- Also expose a protected admin button "Run migrations" and `npm run db:migrate` for local use.

### 12.4 Persistent uploads
- `STORAGE_DRIVER=local`: write to `UPLOAD_DIR` (an absolute path **outside** the deployed app directory, created via hPanel File Manager), serve through `/api/media/[...path]` with long-cache headers and ETags. On boot, verify the directory is writable and show a red warning on the admin dashboard if not.
- `STORAGE_DRIVER=s3`: use `@aws-sdk/client-s3` against any S3-compatible endpoint (Cloudflare R2 recommended — cheap, no egress fees). Switching drivers must not break existing URLs (store driver per media row).
- Include a "Storage health" card on the dashboard and a migration tool to copy local media → S3.

### 12.5 First-run setup wizard
`/setup?token=SETUP_TOKEN` (only works while no Owner exists): checks DB connection, runs migrations, checks upload dir + SMTP (optional), creates the Owner account, forces 2FA enrolment, optionally runs the seed, then disables itself permanently.

### 12.6 Scheduled jobs
`GET /api/cron?secret=CRON_SECRET&task=all` runs: analytics roll-up, pruning, trash purge, email retry queue, scheduled post publishing, cert-expiry reminders, optional backups. Document both options in `DEPLOY.md`: (a) hPanel **Advanced → Cron Jobs** with `curl -s "https://yourdomain.com/api/cron?secret=…&task=all"` every 15 min if the plan offers it, or (b) a free external pinger (e.g. cron-job.org / GitHub Actions schedule). Scheduled posts must also publish lazily on first request after their time, so nothing depends on cron alone.

### 12.7 Step-by-step deployment guide (write fully in `DEPLOY.md`, with checkboxes)
1. **Create the database:** hPanel → Websites → your site → Databases → **MySQL Databases** → create DB name, user, strong password. Note them (host = `localhost`).
2. **Create the uploads folder:** hPanel → File Manager → create `portfolio-storage` in your home directory (outside `public_html` and outside the app folder); copy its absolute path for `UPLOAD_DIR`.
3. **Create a mailbox:** hPanel → Emails → create `hello@yourdomain.com`; use it for SMTP.
4. **Push code to GitHub** (private repo is fine).
5. **Create the Web App:** hPanel → **Websites → Add Website → Node.js Web App** → connect GitHub → pick repo and branch `main`.
6. **Build settings:** Framework **Next.js**, Node **22**, build command `npm run build`, start command `npm run start` (if asked; the app reads `$PORT`), root `/`.
7. **Environment variables:** paste every variable from `.env.example` with production values.
8. **Deploy**, then open `https://yourdomain.com/api/health` → expect `{ ok: true, db: "up" }`.
9. **Run setup:** visit `/setup?token=YOUR_SETUP_TOKEN`, create the Owner account, enrol 2FA, run the seed.
10. **Remove `SETUP_TOKEN`** from env and redeploy.
11. **Domain & SSL:** point the domain to the web app in hPanel, enable SSL, force HTTPS, set `APP_URL`.
12. **Cron:** configure Section 12.6.
13. **Turnstile:** add the domain in Cloudflare Turnstile, set keys.
14. **Search Console:** verify, submit `/sitemap.xml`.
15. **Post-deploy checks:** submit contact + maintenance forms, upload an image, redeploy once and confirm the image still loads, download the CV, check analytics records a hit.
16. **Updating the site later:** `git push` to `main` → Hostinger rebuilds automatically; migrations apply on next boot.
17. **Troubleshooting section:** build runs out of memory (reduce parallelism: `NEXT_PRIVATE_WORKERS=1`, or upgrade plan), changes not showing (check Deployments tab, clear CDN cache, `www` vs apex), `sharp` errors (fallback mode), DB "too many connections" (lower pool), 502 on first hit (cold start — normal, a few seconds), uploads missing after redeploy (`UPLOAD_DIR` points inside the app folder — move it).

Also provide `scripts/make-zip.sh` that produces a clean ZIP (no `node_modules`, no `.next`, no `.env`) for the ZIP-upload route.

---

## 13. TESTING

- **Unit:** validation schemas, permission helper, slug generator, rate limiter, analytics hashing, ticket-number generator, storage drivers (local with temp dir).
- **Integration:** auth (login, lockout, 2FA, reset), CRUD server actions per module against a test MySQL (Docker `mysql:8` via `docker-compose.test.yml`).
- **E2E (Playwright):** home renders; work filter works; project page loads; contact form submits (Turnstile in test mode); maintenance ticket created and status page shows it; admin login → create project → appears on site → delete → goes to trash → restore; CV download increments counter; mobile viewport navigation.
- **Accessibility:** `@axe-core/playwright` on key pages, zero serious violations.

---

## 14. BUILD PHASES (execute in order, commit after each)

1. **Foundation** — scaffold Next.js + TS + Tailwind v4 + shadcn/ui, fonts, theme tokens, env validation, Drizzle + MySQL connection, `docker-compose.yml` with MySQL 8 for local dev, ESLint/Prettier, `CLAUDE.md`, `PLAN.md`.
2. **Data layer** — full schema, migrations, boot-time migrator with lock, seed scripts (Section 11).
3. **Auth & admin shell** — setup wizard, login, 2FA, reset, sessions, roles, audit log, admin layout, command palette.
4. **Content modules** — settings/profile/socials, projects, skills, experience, education, trainings, courses, certifications, testimonials + review requests, posts, services, clients, press, FAQs, CV files. Shared CRUD components (table, form, image field, gallery field, rich text, SEO panel, status/schedule).
5. **Media library & storage drivers** — uploads, processing, usage tracking, health card.
6. **Public site** — every route in Section 3, homepage builder rendering, page builder blocks, menus, SEO/OG/JSON-LD/sitemap/RSS.
7. **Forms, inbox, tickets, newsletter, emails** — Sections 4.4–4.7 and 7.
8. **Analytics** — beacon, collection, roll-ups, dashboard, events; security headers + CSP; cron endpoint; backups export/import.
9. **Polish & QA** — responsive pass at all breakpoints, dark mode pass, motion, empty/loading/error states, Lighthouse ≥ 95, axe clean, full test suite green.
10. **Docs** — `README.md` (local setup in < 5 commands), `DEPLOY.md` (Section 12.7), `ADMIN-GUIDE.md` (non-technical guide for TJ: how to add a project, upload training photos, request a review, publish a cert, swap the CV, read analytics), `.env.example`, `scripts/make-zip.sh`.

---

## 15. DEFINITION OF DONE

- [ ] `npm run build` succeeds with no DB available at build time.
- [ ] Fresh MySQL + `/setup` → working site with seeded content in under 5 minutes.
- [ ] Every admin module supports create / read / update / delete / reorder / draft / publish / trash / restore.
- [ ] Uploaded images and PDFs survive a redeploy.
- [ ] Contact and maintenance forms store data, email both sides, and appear in admin.
- [ ] Review request link works end to end and lands in moderation.
- [ ] CV download works and is counted; certificates open in a viewer with verify links.
- [ ] Analytics dashboard shows real visits and events.
- [ ] No sample testimonial or certification is publicly visible.
- [ ] Lighthouse ≥ 95 (mobile) on Home, Work, a case study, and Contact; axe: zero serious issues.
- [ ] All tests pass; `npm audit` has no high/critical issues.
- [ ] `README.md`, `DEPLOY.md`, `ADMIN-GUIDE.md` complete and accurate.

Begin with Phase 0: write `PLAN.md` and `CLAUDE.md`, show me the plan summary, then proceed through the phases without waiting for further confirmation unless a decision is irreversible.
