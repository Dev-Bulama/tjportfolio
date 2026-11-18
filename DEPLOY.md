# Deploying to Hostinger (hPanel Node.js Web App)

This app is a standard Express server. Hostinger runs Node.js apps as **Web Apps** on Business Web
Hosting and Cloud plans, deploying from GitHub (auto-redeploy on push) or a ZIP upload.

Things the app is designed around:

- **Apps sleep when idle.** The next request wakes them (a few seconds). There are no in-process timers;
  scheduled work runs when something calls `/api/cron` (step 12).
- **MySQL only**, host usually `localhost`. The pool is capped at 5 connections.
- **The app folder is replaced on every deploy.** Uploads must live in `UPLOAD_DIR` *outside* the app
  folder (or in S3/R2).
- **No SSH needed.** Database migrations run automatically every time the app starts.
- The build never touches the database, so it works even before the database exists.

> hPanel's menus get renamed from time to time. If a label below doesn't match exactly, look for the
> closest equivalent — the settings themselves (Node version, build/start commands, environment
> variables) are what matter.

---

## Step by step

### 1. Create the database
- [ ] hPanel → **Websites** → your site → **Databases → MySQL Databases**.
- [ ] Create a database, a user and a strong password. Note all three. The host is `localhost`.

### 2. Create the uploads folder (outside the app)
- [ ] hPanel → **File Manager**. In your home directory (next to — not inside — `public_html` and the app
  folder) create `portfolio-storage`.
- [ ] Copy its absolute path (e.g. `/home/u123456789/portfolio-storage`). This is `UPLOAD_DIR`.

### 3. Create a mailbox
- [ ] hPanel → **Emails** → create `hello@yourdomain.com`. You'll use it for SMTP (`smtp.hostinger.com`, port 465, SSL).

### 4. Push the code to GitHub
- [ ] A private repository is fine. Branch `main`.

### 5. Create the Web App
- [ ] hPanel → **Websites → Add Website → Node.js Web App** (wording may vary).
- [ ] Connect GitHub, choose the repository and branch `main`.

### 6. Build settings
- [ ] Framework: **Express** (or “Other/Node.js” if Express isn't listed).
- [ ] Node version: **22** (20–24 supported).
- [ ] Build command: `npm run build`
- [ ] Start command: `npm start` (entry file, if asked: `dist/server.js`). The app listens on `$PORT`.
- [ ] Root directory: `/`.

Everything the build needs is in `dependencies`, so it also works if the host installs with
`NODE_ENV=production` (dev dependencies skipped).

### 7. Environment variables
Paste every variable from [`.env.example`](.env.example) with production values. At minimum:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://yourdomain.com` (no trailing slash) |
| `SESSION_SECRET` | 64+ random characters |
| `SETUP_TOKEN` | a long random string (removed again in step 10) |
| `DATABASE_HOST` / `PORT` / `NAME` / `USER` / `PASSWORD` | from step 1 |
| `UPLOAD_DIR` | absolute path from step 2 |
| `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` | from step 3 |
| `ADMIN_NOTIFY_EMAIL` | where new messages and tickets are announced |
| `CRON_SECRET`, `ANALYTICS_SALT` | random strings |
| `ADMIN_PATH` | optional: e.g. `studio-7k2` instead of `admin` |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The app validates its environment at boot and logs a clear list of anything missing or invalid.

### 8. Deploy and check health
- [ ] Deploy, then open `https://yourdomain.com/api/health`. Expect `{"ok":true,"db":"up",…}`.
- [ ] If `db` is `down`, the response includes the database error — usually a typo in `DATABASE_*`.

### 9. Run the setup wizard
- [ ] Visit `https://yourdomain.com/setup?token=YOUR_SETUP_TOKEN`.
- [ ] The wizard checks the database, applies migrations, checks the upload folder and SMTP, then creates
  the **Owner** account. Tick **Load starter content** to import the profile, services, trainings,
  draft projects and articles.
- [ ] You're taken straight to two-factor setup (mandatory for the Owner). Scan the QR code and **save the
  10 recovery codes** somewhere safe.
- [ ] The wizard disables itself permanently once an Owner exists.

### 10. Remove the setup token
- [ ] Delete `SETUP_TOKEN` from the environment variables and redeploy.

### 11. Domain & SSL
- [ ] Point the domain at the web app in hPanel, enable SSL and **force HTTPS**.
- [ ] Make sure `APP_URL` matches the final address (apex vs `www`).

### 12. Scheduled jobs (cron)
`GET /api/cron?secret=CRON_SECRET&task=all` does: email retries, scheduled-post publishing, analytics
roll-up and pruning, trash auto-purge (30 days), certificate-expiry reminders. Add `&backup=1` once a day
for an automatic backup (to S3 if configured, otherwise to `UPLOAD_DIR/backups`).

Choose one:

- **(a) hPanel → Advanced → Cron Jobs** (if your plan offers it), every 15 minutes:

  ```bash
  curl -s "https://yourdomain.com/api/cron?secret=YOUR_CRON_SECRET&task=all" > /dev/null
  ```

- **(b) A free external scheduler**, e.g. [cron-job.org](https://cron-job.org), calling the same URL every
  15 minutes. Or a GitHub Actions workflow on a schedule:

  ```yaml
  on: { schedule: [{ cron: "*/15 * * * *" }] }
  jobs: { ping: { runs-on: ubuntu-latest, steps: [{ run: 'curl -fsS "https://yourdomain.com/api/cron?secret=${{ secrets.CRON_SECRET }}&task=all"' }] } }
  ```

Nothing depends on cron alone: scheduled posts also go live on the first request after their time, and
every email is stored before sending and retried later if SMTP was down.

### 13. Cloudflare Turnstile (spam protection)
- [ ] In the Cloudflare dashboard → Turnstile, add your domain and copy the site and secret keys into
  `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`. Redeploy.
- Without keys, forms still have a honeypot and per-IP rate limiting (5 submissions / 10 minutes).

### 14. Google Search Console
- [ ] Verify the domain (paste the verification code in **Admin → Settings → SEO**, or use DNS).
- [ ] Submit `https://yourdomain.com/sitemap.xml`.

### 15. Post-deploy checks
- [ ] Submit the contact form and a maintenance request; both appear in the admin and you receive emails.
- [ ] Upload an image in **Media library**. **Redeploy once** and confirm the image still loads.
- [ ] Upload and publish a CV under **CV files**; click “Download CV” on the site; the download count goes up.
- [ ] Visit a few pages from a phone (signed out); **Analytics** shows the visits within a minute.
- [ ] **Settings → Integrations → Send test email** succeeds.

### 16. Updating the site later
`git push` to `main` → Hostinger rebuilds and restarts automatically. New migrations apply on the next boot.
For ZIP deploys run `scripts/make-zip.sh` and upload the file it creates.

---

## Optional: Cloudflare R2 for uploads
1. Create an R2 bucket and an API token with read/write access to it.
2. Set `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`,
   `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_PUBLIC_URL` (a public bucket
   domain) so images are served straight from R2.
3. **Admin → System → Copy local media → S3** moves existing uploads. Each file remembers its own driver,
   so switching never breaks existing URLs.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build runs out of memory | Retry the deployment; the build is light (Tailwind + esbuild + tsc). If it persists, upgrade the plan. |
| Changes don't show | Check the Deployments tab for a failed build; clear any CDN cache; check `www` vs apex and `APP_URL`. Admin changes appear immediately (the page cache is cleared on save); **Admin → System → Clear page cache** forces it. |
| `sharp` errors / images not resized | The app falls back to storing originals without resizing and shows a warning on the dashboard. Reinstall/redeploy; on unusual CPUs `sharp` may be unavailable. |
| “Too many connections” from MySQL | Set `DATABASE_POOL_SIZE=3`. |
| 502 on the first request | Cold start after idle — normal, a few seconds. `/api/health` warms the app. |
| Uploads disappear after redeploy | `UPLOAD_DIR` points inside the app folder. Move it outside (the dashboard shows a red warning when this happens). |
| `/setup` returns 404 | Either an Owner already exists (expected) or `SETUP_TOKEN` is missing/wrong. |
| Locked out of admin | Wait 15 minutes (lockout), use a 2FA recovery code, or “Forgot password”. Another Owner/Admin can unlock users under **Users & roles**. |
| Forms say “session expired” | The page was open for a long time or cookies are blocked; reload and resend. |
| Emails not arriving | **Admin → System** shows the email queue and last error; check SMTP credentials and run **Retry email queue**. |
