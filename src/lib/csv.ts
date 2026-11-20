/** RFC 4180 CSV with formula-injection protection (cells starting with = + - @ are prefixed). */
export function toCsv<T extends Record<string, unknown>>(rows: T[], cols: Array<[keyof T & string, string]>): string {
  const cell = (v: unknown): string => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(([, h]) => cell(h)).join(","), ...rows.map((r) => cols.map(([k]) => cell(r[k])).join(","))].join("\r\n") + "\r\n";
}
