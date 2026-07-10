import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always store DB in the root directory — never affected by cwd
const DB_PATH = path.join(__dirname, '..', '..', '..', 'database.db');
const db = new Database(DB_PATH);
console.log('[DB] Using database at:', DB_PATH);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')) NOT NULL,
    position INTEGER DEFAULT 0,
    dueDate TEXT,
    parentId TEXT,
    goalId TEXT,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('weekly', 'monthly', 'yearly')) NOT NULL,
    target INTEGER DEFAULT 1,
    done INTEGER DEFAULT 0,
    parentId TEXT,
    position INTEGER DEFAULT 0,
    yearId TEXT,
    monthId TEXT,
    autoProgress REAL DEFAULT 0,
    createdAt INTEGER
  );
`);

try { db.exec("ALTER TABLE goals ADD COLUMN category TEXT DEFAULT 'Personal'"); } catch (e) { }
try { db.exec("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch (e) { }
try { db.exec("UPDATE tasks SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch (e) { }
try { db.exec("ALTER TABLE goals ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch (e) { }
try { db.exec("UPDATE goals SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch (e) { }
try { db.exec("ALTER TABLE habits ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch (e) { }
try { db.exec("UPDATE habits SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo'"); } catch (e) { }
try { db.exec("UPDATE tasks SET status = 'todo' WHERE status IS NULL"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN archived INTEGER DEFAULT 0"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN timeSlot TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceInterval INTEGER"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceUnit TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEnds TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEndDate TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEndOccurrences INTEGER"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceCount INTEGER DEFAULT 0"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN importance INTEGER DEFAULT 50"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN urgency INTEGER DEFAULT 50"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN cognitiveCost INTEGER DEFAULT 5"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN dependencyIds TEXT DEFAULT '[]'"); } catch (e) { }

const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
db.prepare('UPDATE tasks SET archived = 1 WHERE completed = 1 AND archived = 0 AND createdAt < ?').run(thirtyDaysAgo);

export default db;
