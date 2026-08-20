// Dates in this app are YYYY-MM-DD strings (Postgres sometimes returns a full
// timestamp). Display them US-style. Never construct a Date from these.
export function fmtDate(v: string | null | undefined): string {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[1]}-${p[2]}-${p[0]}`;
}
