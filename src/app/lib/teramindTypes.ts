// Types shared by the Teramind libs, actions and pages. Types only — no runtime code.
// A "session" is one Teramind login session: a start instant and a length in seconds.
// All *_et fields are US-Eastern wall-clock text `YYYY-MM-DD HH:MM:SS` with no timezone,
// because the payroll code refuses any timestamp that carries one.

/** One agent from Teramind's roster, normalised. */
export type TeramindAgent = { agent_id: number; email: string; name: string; deleted: boolean };

/** One login session exactly as it is saved in `teramind_sessions`. */
export type TeramindSessionSave = {
  agent_id: number;
  employee_id: number | null;
  work_date: string;      // Eastern date of the session START (cross-midnight sessions stay on this date)
  started_et: string;     // 'YYYY-MM-DD HH:MM:SS'
  finished_et: string;    // 'YYYY-MM-DD HH:MM:SS' — may fall on the next calendar day
  started_raw: string;    // the timestamp exactly as Teramind returned it (part of the unique key)
  duration_s: number;
  computer: string;
};

/** A saved session as loaded back for payroll/attendance: the row plus the employee's email. */
export type TeramindSessionRow = TeramindSessionSave & { teramind_email: string };

/** What the payroll file parser hands to processTeramindData — we must produce exactly this. */
export type TeramindRawRow = { email: string; timeStarted: string; timeFinished: string };

/** One chunk of a pull: inclusive date range, `YYYY-MM-DD`. */
export type PullChunk = { from: string; to: string };
