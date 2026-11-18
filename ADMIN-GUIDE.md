# Admin guide

A practical guide to running your website. Sign in at **yourdomain.com/admin** (or the custom admin
address you chose). You'll be asked for the 6-digit code from your authenticator app every time you sign in.

Tip: press **⌘K** (Mac) or **Ctrl+K** (Windows) anywhere in the admin to jump to any page or search your content.

---

## First steps (the dashboard checklist)

The dashboard shows a **Getting started** list until each item is done:

1. **Send review requests to real clients** — see “Ask a client for a review” below.
2. **Replace sample certifications** with your real ones.
3. **Upload your portrait** — Settings → Profile → Portrait.
4. **Review and publish your projects** — they were imported as drafts so you can check each one.
5. **Upload your CV** (PDF) and publish it.
6. **Fill in contact details and social links** — anything still written like `[[add email]]` stays
   hidden on the website until you replace it.

The yellow banner at the top counts the remaining sample items. Samples are **never** shown publicly.

## Draft, published and scheduled

Every item has a **Status** in the Publish box:

- **Draft** — only you can see it. Use **Preview** to view it exactly as visitors would.
- **Published** — live on the website.
- **Scheduled** — choose a date and time; it goes live automatically.

Drafts are **autosaved every 30 seconds**. If you try to leave with unsaved changes, the browser warns you.
**Ctrl/⌘ + S** saves.

**Featured** items appear on the homepage first. **Drag the handle (⋮⋮)** in any list to change the order.

Deleting moves things to **Trash** (see the “Trash” tab on each list). Items can be restored for 30 days,
then they're removed permanently.

## Add a project

1. **Portfolio → Projects → New project.**
2. Fill in the title (the web address is created for you), category and a one- or two-sentence summary.
3. Write the case study in the editor. Use the **H2** button for section headings such as *The problem*,
   *Approach*, *Solution*, *Results*.
4. Add **Key metrics** (e.g. “Checkout time” / “−38%”) and tick the **Tech stack**.
5. Under **Media**, choose a **cover image** and add **gallery** screenshots (drag to reorder, add captions).
6. Under **Client & role**: untick **Show client publicly** for confidential work.
7. Add links (live site, App Store, Play Store) if you have them.
8. Set Status to **Published** and **Save**.

## Upload training photos

Two options:

- **For one training:** open it under **Portfolio → Trainings**, scroll to **Media → Session photos**,
  click **Add photos**, then drag files into the upload box. They appear on that training's page.
- **For the Gallery page:** **Portfolio → Gallery → (album) → Photos → Add photos**.
  Every photo needs **alt text** — one sentence describing the photo for people using screen readers.
  You can also add a caption and the photographer's name.

Photos are automatically resized, converted to fast-loading WebP and **stripped of location data**.

## Ask a client for a review

1. **Inbox → Review requests.**
2. Enter the client's name and email, optionally the project or training, and a personal note.
3. **Send review request.** The client receives a private link that works once and expires (30 days by default).
4. When they submit, you get an email and the review appears under **Portfolio → Testimonials** as
   **Pending**.
5. Open it, check it, then set **Moderation → Approved**. It goes live only if the client ticked the
   consent box.

You can see whether each link was opened and submitted on the Review requests page.

## Publish a certification

1. **Portfolio → Certifications.** Start by opening one of the samples (marked *Sample*) for that track.
2. Replace the name, issuer, dates and credential ID, paste the issuer's **verification URL**, and upload the
   badge and the certificate (image or PDF).
3. **Untick “Sample / placeholder”**, set Status to **Published** and Save.

Expired certificates show an “Expired” badge automatically, and you get an email 30 days before expiry.

## Swap the CV

1. **Profile → CV files.** Open the CV (or create a new one, e.g. “Trainer CV”).
2. Choose the PDF, tick **Primary CV** for the one the “Download CV” button should use, and **Publish**.
3. The **Downloads** column counts every download.

No CV uploaded yet? The site offers a PDF generated automatically from your profile, experience, skills and
certifications, so the button always works.

## Messages and maintenance tickets

- **Inbox → Messages:** contact-form enquiries. Open one to reply by email (the reply is sent from your
  mailbox and saved in the thread) or add a private note. Archive or mark as spam when done.
- **Inbox → Maintenance tickets:** support requests from existing clients, each with a number like
  `TJ-MR-2026-0042`. Drag cards between columns to change status — the client is emailed and can follow
  progress on the status page. Inside a ticket you can post **public replies** (emailed to the client) or
  **internal notes**, set priority and a due date. Red ages mean the ticket is past its response target.
- **Registrations** and **Subscribers** can be exported to CSV.

## Read the analytics

**Site → Analytics** shows visitors and page views for today, 7, 30 or 90 days (or custom dates), the
most-viewed pages and projects, where visitors came from (referrers and campaign tags), countries, devices,
and key actions: CV downloads, contact messages, maintenance requests, WhatsApp and social clicks.
The **funnel** shows how many visitors looked at the contact page and how many sent a message.

Analytics are privacy-friendly: no cookies, no stored IP addresses, and your own visits while signed in are
not counted.

## Other useful screens

| Where | What |
|---|---|
| Settings → Profile | Name, headline, bio, portrait, contact details, availability badge |
| Settings → Branding | Logo, favicon, accent colour (checked for readability), font pairing |
| Settings → SEO | Default title and description, share image, Search Console code |
| Settings → Site & maintenance | Maintenance mode (visitors see “back shortly”; you still see the site) |
| Site → Homepage | Show/hide and reorder homepage sections, change their titles |
| Site → Menus | Header and footer links |
| Site → Pages | Build extra pages from blocks (hero, text, images, cards, FAQ, contact form…) |
| Site → Social links / Stats | Social profiles and the homepage numbers (a value of 0 hides a stat) |
| Settings → Users & roles | Add an editor or assistant; Owner · Admin · Editor · Viewer |
| Settings → Audit log | Who changed what, and when |
| Settings → Backups | Download a full backup (content + files) or restore one |
| Account (top-right menu) | Change password, recovery codes, signed-in devices |

## If something goes wrong

- **Forgot your password:** use “Forgot password?” on the sign-in page.
- **Lost your phone:** sign in with one of your 10 recovery codes, then set up 2FA again under Account.
- **Locked out after wrong passwords:** wait 15 minutes; you'll also receive an email about it.
- **A page shows old content:** Settings → System → **Clear page cache**.
