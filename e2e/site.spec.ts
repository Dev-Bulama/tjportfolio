import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { E2E_ADMIN } from "./global-setup.js";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test("home renders with hero, stats and services", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tijani Bulama");
  await expect(page.getByText("I build software that ships")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What I do" })).toBeVisible();
  await expect(page.locator("[data-count]").first()).toBeVisible();
});

test("work filter narrows the grid and project page loads", async ({ page }) => {
  await page.goto("/work");
  const items = page.locator("[data-item]:not([hidden])");
  const all = await items.count();
  expect(all).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Websites" }).click();
  await expect(page).toHaveURL(/category=websites/);
  const filtered = await items.count();
  expect(filtered).toBeLessThan(all);
  await page.getByRole("link", { name: "PEAJEG Consults" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PEAJEG Consults");
});

test("contact form submits", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Your name").fill("E2E Visitor");
  await page.getByLabel("Email", { exact: false }).first().fill("visitor@example.com");
  await page.getByLabel("What is it about?").selectOption("Software project");
  await page.getByLabel("Message").fill("We'd like a quote for a customer portal.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your message is in.")).toBeVisible();
});

test("maintenance ticket is created and the status page shows it", async ({ page }) => {
  await page.goto("/maintenance-request");
  await page.getByLabel("Your name").fill("E2E Client");
  await page.locator("#in-email").fill("client@example.com");
  await page.getByLabel("Issue type").selectOption("downtime");
  await page.getByLabel("Priority").selectOption("critical");
  await page.getByLabel("Describe the issue").fill("The whole site returns 502 since 9am.");
  await page.getByRole("button", { name: "Submit request" }).click();
  const success = page.locator("[data-form-success]");
  await expect(success).toContainText(/TJ-MR-\d{4}-\d{4}/);
  const ticket = (await success.innerText()).match(/TJ-MR-\d{4}-\d{4}/)![0];
  await page.goto(`/status?ticket=${ticket}`);
  await page.locator("#email").fill("client@example.com");
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Ticket ${ticket}`);
  await expect(page.getByText("The whole site returns 502")).toBeVisible();
});

test("admin: create project → appears on site → trash → restore", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);

  await page.goto("/admin/content/projects/new");
  await page.locator("#f-title").fill("E2E Launch Project");
  await page.locator("#f-summary").fill("Created by the end-to-end test.");
  await page.locator("#status").selectOption("published");
  await page.locator("[data-save]").click();
  await expect(page.locator("[data-toast]").first()).toContainText("created");

  await page.goto("/work/e2e-launch-project");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Launch Project");

  await page.goto("/admin/content/projects?q=E2E");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row", { name: /E2E Launch Project/ }).locator("summary").click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  expect((await page.goto("/work/e2e-launch-project"))!.status()).toBe(404);

  await page.goto("/admin/content/projects?trash=1");
  await page.getByRole("row", { name: /E2E Launch Project/ }).locator("summary").click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator("[data-toast]").first()).toContainText("updated");
  expect((await page.goto("/work/e2e-launch-project"))!.status()).toBe(200);
});

test("CV download increments the counter", async ({ page, request }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/content/cvs/1");
  await page.locator("#field-mediaId [data-media-choose]").click();
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await page.setInputFiles("#media-picker [data-mp-file]", { name: "cv.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.locator("#media-picker")).toBeHidden({ timeout: 15000 });
  await page.locator("#status").selectOption("published");
  await page.locator("[data-save]").click();
  await expect(page.locator("[data-toast]").first()).toContainText("saved");

  const r = await request.get("/cv", { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36" } });
  expect(r.headers()["content-type"]).toBe("application/pdf");
  await page.goto("/admin/content/cvs");
  await expect(page.getByRole("row", { name: /Software Engineering/ })).toContainText("1");
});

test("generated OG image, sitemap and health respond", async ({ request }) => {
  expect((await request.get("/og/page.png?title=Test")).headers()["content-type"]).toBe("image/png");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/work/");
  expect((await (await request.get("/api/health")).json()).db).toBe("up");
});

for (const path of ["/", "/work", "/work/peajeg-consults", "/about", "/training", "/contact", "/maintenance-request", "/insights", "/resume", "/certifications"]) {
  test(`axe: no serious violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const v = await axe(page);
    expect(v.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}

test("axe: dark mode home has no serious violations", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect((await axe(page)).map((x) => x.id)).toEqual([]);
});
