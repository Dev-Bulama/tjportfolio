import { describe, expect, it } from "vitest";
import { sanitizeRich, sanitizePlain, stripPlaceholders } from "../../src/lib/sanitize.js";

describe("sanitizeRich", () => {
  it("removes scripts, handlers and javascript: links", () => {
    const out = sanitizeRich(`<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>`);
    expect(out).not.toMatch(/script|onclick|onerror|javascript:/);
  });
  it("adds rel to external links", () => {
    expect(sanitizeRich('<a href="https://example.com">x</a>')).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("sanitizePlain", () => {
  it("strips tags but keeps characters", () => {
    expect(sanitizePlain("<b>< 2s</b> & more")).toBe("< 2s & more");
  });
});

describe("stripPlaceholders", () => {
  it("drops placeholder paragraphs and orphaned headings", () => {
    const html = "<h2>The problem</h2><p>[[Describe it]]</p><h2>Solution</h2><p>Real text.</p><h2>Results</h2><p>[[Outcomes]]</p>";
    expect(stripPlaceholders(html)).toBe("<h2>Solution</h2><p>Real text.</p>");
  });
  it("keeps normal content", () => {
    expect(stripPlaceholders("<p>Fine</p>")).toBe("<p>Fine</p>");
  });
});
