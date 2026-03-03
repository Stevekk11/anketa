import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import logger from './logger';

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'anketa.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Inicializace tabulky
db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    option  TEXT    NOT NULL CHECK(option IN ('a','b','c')),
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO meta (key, value) VALUES ('reset_time', '0');

  CREATE TABLE IF NOT EXISTS reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    author        TEXT,
    message       TEXT    NOT NULL,
    ip            TEXT,
    status        TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    admin_comment TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: add columns to existing reports tables that predate status/admin_comment
const reportCols = (db.prepare(`PRAGMA table_info(reports)`).all() as { name: string }[]).map(c => c.name);
if (!reportCols.includes('status')) {
  db.exec(`ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))`);
}
if (!reportCols.includes('admin_comment')) {
  db.exec(`ALTER TABLE reports ADD COLUMN admin_comment TEXT`);
}

logger.info(`Databáze inicializována: ${dbPath}`);

export interface PollResults {
  pollId: number;
  counts: { a: number; b: number; c: number };
  total: number;
}

export function saveVote(pollId: number, option: 'a' | 'b' | 'c'): void {
  const stmt = db.prepare('INSERT INTO votes (poll_id, option) VALUES (?, ?)');
  stmt.run(pollId, option);
}

export function getResults(pollId: number): PollResults {
  const rows = db
    .prepare(
      `SELECT option, COUNT(*) as cnt
       FROM votes
       WHERE poll_id = ?
       GROUP BY option`
    )
    .all(pollId) as { option: string; cnt: number }[];

  const counts = { a: 0, b: 0, c: 0 };
  for (const row of rows) {
    if (row.option === 'a' || row.option === 'b' || row.option === 'c') {
      counts[row.option] = row.cnt;
    }
  }
  const total = counts.a + counts.b + counts.c;
  return { pollId, counts, total };
}

export function getAllResults(): PollResults[] {
  return [1, 2].map((id) => getResults(id));
}

export function getLastResetTime(): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'reset_time'").get() as { value: string };
  return row ? parseInt(row.value, 10) : 0;
}

export function resetVotes(): void {
  db.prepare('DELETE FROM votes').run();
  db.prepare("UPDATE meta SET value = ? WHERE key = 'reset_time'").run(Date.now().toString());
}

export interface Report {
  id: number;
  author: string | null;
  message: string;
  ip: string | null;
  status: 'open' | 'closed';
  admin_comment: string | null;
  created_at: string;
}

export function saveReport(author: string, message: string, ip: string): void {
  db.prepare('INSERT INTO reports (author, message, ip) VALUES (?, ?, ?)').run(author || null, message, ip);
}

export function getReports(): Report[] {
  return db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as Report[];
}

export function updateReport(id: number, status: 'open' | 'closed', adminComment: string): void {
  db.prepare('UPDATE reports SET status = ?, admin_comment = ? WHERE id = ?').run(status, adminComment || null, id);
}

export default db;

