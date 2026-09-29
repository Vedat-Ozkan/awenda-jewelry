// Shared by the admin lead exports. Quotes fields containing , " or newlines,
// and neutralises spreadsheet formula injection (a cell starting with = + - @
// is prefixed with a single quote) since these cells hold visitor-typed text.
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\n");
}

export function csvResponse(rows: string[][], filename: string): Response {
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename=${filename}`,
    },
  });
}
