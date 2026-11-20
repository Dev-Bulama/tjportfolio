import { describe, expect, it } from "vitest";
import { isPlaceholder, pub, slugify, readingMinutes, ticketNumber, parseTicketNumber, safeUrl, periodLabel, isExpired, whatsappLink } from "../../src/lib/util.js";

describe("placeholders", () => {
  it("detects [[…]] values and hides them publicly", () => {
    expect(isPlaceholder("[[add LinkedIn URL]]")).toBe(true);
    expect(isPlaceholder("https://linkedin.com/in/tj")).toBe(false);
    expect(pub("[[add]]")).toBeUndefined();
    expect(pub("  ")).toBeUndefined();
    expect(pub("Lagos")).toBe("Lagos");
    expect(pub(0)).toBe(0);
  });
});

describe("slugify", () => {
  it("creates clean slugs", () => {
    expect(slugify("Oracle Database 19c Bootcamp — SQL, PL/SQL")).toBe("oracle-database-19c-bootcamp-sql-pl-sql");
    expect(slugify("Blessing African Food Market & Beauty Store")).toBe("blessing-african-food-market-and-beauty-store");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(slugify("  --  ")).toBe("");
    expect(slugify("a".repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

describe("ticket numbers", () => {
  it("formats and parses", () => {
    expect(ticketNumber(2026, 42)).toBe("TJ-MR-2026-0042");
    expect(parseTicketNumber("tj-mr-2026-0042")).toEqual({ year: 2026, seq: 42 });
    expect(parseTicketNumber("TJ-2026-42")).toBeNull();
  });
});

describe("misc", () => {
  it("reading time is at least one minute", () => {
    expect(readingMinutes("<p>hello</p>")).toBe(1);
    expect(readingMinutes(`<p>${"word ".repeat(1100)}</p>`)).toBe(5);
  });
  it("safeUrl only allows safe schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("linkedin.com/in/tj")).toBe("https://linkedin.com/in/tj");
    expect(safeUrl("[[linkedin.com/in/…]]")).toBeUndefined();
    expect(safeUrl("//evil.com")).toBeUndefined();
    expect(safeUrl("/contact")).toBe("/contact");
  });
  it("period labels", () => {
    expect(periodLabel("2020-01-01", null, true)).toBe("Jan 2020 — Present");
    expect(periodLabel("2019-03-01", "2020-02-01")).toBe("Mar 2019 — Feb 2020");
  });
  it("expiry", () => {
    expect(isExpired("2000-01-01")).toBe(true);
    expect(isExpired(null)).toBe(false);
  });
  it("whatsapp link strips non-digits and hides placeholders", () => {
    expect(whatsappLink("+234 801 234 5678")).toBe("https://wa.me/2348012345678");
    expect(whatsappLink("[[add]]")).toBeUndefined();
  });
});
