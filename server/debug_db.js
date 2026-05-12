const Database = require('better-sqlite3');
const db = new Database('database.db');
const entries = db.prepare('SELECT * FROM journal_entries').all();
console.log(JSON.stringify(entries, null, 2));
