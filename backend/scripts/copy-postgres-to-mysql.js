// One-off: copies every row from the old PostgreSQL database into the new MySQL one.
// 1. Create the MySQL tables first:   DATABASE_URL=<mysql url> npx prisma migrate deploy
// 2. npm i --no-save pg mysql2
// 3. PG_URL="postgresql://..." MYSQL_URL="mysql://..." node scripts/copy-postgres-to-mysql.js
// ContentItem is emptied in MySQL first (the migration seeded it) and copied from Postgres, so admin edits survive.
process.env.TZ = 'UTC'; // Prisma stores UTC in timestamp-without-time-zone columns; keep node-pg from shifting them
const { Client } = require('pg');
const mysql = require('mysql2/promise');

const TABLES = ['User', 'EmailVerification', 'PasswordResetToken', 'Progress', 'PracticeEntry', 'PracticeDay',
  'SentenceProgress', 'DialogueProgress', 'DebateSession', 'CharacterSession', 'Personalization', 'Subscription',
  'WordProgress', 'FlashcardDeck', 'RoleplaySession', 'ChatSession', 'CallSession', 'PhotoProgress', 'SupportMessage', 'ContentItem'];
const JSON_OIDS = new Set([114, 3802]); // json, jsonb
const BATCH = 50;

(async () => {
  if (!process.env.PG_URL || !process.env.MYSQL_URL) throw new Error('Set PG_URL and MYSQL_URL');
  const pg = new Client({ connectionString: process.env.PG_URL, ssl: process.env.PG_SSL === '1' ? { rejectUnauthorized: false } : undefined });
  await pg.connect();
  const my = await mysql.createConnection({ uri: process.env.MYSQL_URL, timezone: 'Z', multipleStatements: false });
  await my.query('SET FOREIGN_KEY_CHECKS=0');
  await my.query('DELETE FROM `ContentItem`');
  for (const t of TABLES) {
    const res = await pg.query(`SELECT * FROM "${t}"`);
    const cols = res.fields.map((f) => f.name);
    const isJson = res.fields.map((f) => JSON_OIDS.has(f.dataTypeID));
    for (let i = 0; i < res.rows.length; i += BATCH) {
      const chunk = res.rows.slice(i, i + BATCH).map((r) => cols.map((c, k) => {
        const v = r[c];
        return v !== null && isJson[k] ? JSON.stringify(v) : v;
      }));
      await my.query(`INSERT INTO \`${t}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES ?`, [chunk]);
    }
    const [[{ n }]] = await my.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    console.log(`${t.padEnd(18)} postgres ${String(res.rows.length).padStart(6)}  mysql ${String(n).padStart(6)}${res.rows.length === Number(n) ? '' : '   <-- MISMATCH'}`);
  }
  await my.query('SET FOREIGN_KEY_CHECKS=1');
  await my.end(); await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
