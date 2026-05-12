import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import { EdgeTTS } from 'node-edge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const db = new Database('database.db');

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
  
try { db.exec("ALTER TABLE goals ADD COLUMN category TEXT DEFAULT 'Personal'"); } catch(e){}
try { db.exec("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch(e){}
try { db.exec("UPDATE tasks SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch(e){}
try { db.exec("ALTER TABLE goals ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch(e){}
try { db.exec("UPDATE goals SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch(e){}
try { db.exec("ALTER TABLE habits ADD COLUMN workspaceId TEXT DEFAULT 'Personal'"); } catch(e){}
try { db.exec("UPDATE habits SET workspaceId = 'Personal' WHERE workspaceId IS NULL"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo'"); } catch(e){}
try { db.exec("UPDATE tasks SET status = 'todo' WHERE status IS NULL"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN archived INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN timeSlot TEXT"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceInterval INTEGER"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceUnit TEXT"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEnds TEXT"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEndDate TEXT"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceEndOccurrences INTEGER"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN recurrenceCount INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN importance INTEGER DEFAULT 50"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN urgency INTEGER DEFAULT 50"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN cognitiveCost INTEGER DEFAULT 5"); } catch(e){}
try { db.exec("ALTER TABLE tasks ADD COLUMN dependencyIds TEXT DEFAULT '[]'"); } catch(e){}

function getNextDate(baseDateStr, unit, interval) {
  let date = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  if (unit === 'day') date.setDate(date.getDate() + interval);
  else if (unit === 'week') date.setDate(date.getDate() + interval * 7);
  else if (unit === 'month') date.setMonth(date.getMonth() + interval);
  else if (unit === 'year') date.setFullYear(date.getFullYear() + interval);
  return date.toISOString().split('T')[0];
}

const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
db.prepare('UPDATE tasks SET archived = 1 WHERE completed = 1 AND archived = 0 AND createdAt < ?').run(thirtyDaysAgo);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT
    )
  `);
} catch(e){}
try { db.exec("ALTER TABLE journal_entries ADD COLUMN folder TEXT DEFAULT '/'"); } catch(e){}
try { db.exec("ALTER TABLE journal_entries ADD COLUMN title TEXT DEFAULT 'New Note.md'"); } catch(e){}
try { db.exec("ALTER TABLE journal_entries ADD COLUMN isEncrypted INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE journal_entries ADD COLUMN tags TEXT DEFAULT '[]'"); } catch(e){}
try { db.exec("ALTER TABLE journal_entries ADD COLUMN attachments TEXT DEFAULT '[]'"); } catch(e){}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_folders (
      workspaceId TEXT PRIMARY KEY,
      folders TEXT
    )
  `);
} catch(e){}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS timer_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      work INTEGER NOT NULL,
      shortBreak INTEGER NOT NULL,
      longBreak INTEGER NOT NULL
    )
  `);
} catch(e){}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      workspaceId TEXT DEFAULT 'Personal',
      mode TEXT NOT NULL,
      duration INTEGER NOT NULL,
      taskId TEXT,
      completedAt INTEGER NOT NULL
    )
  `);
} catch(e){}

try { db.exec("ALTER TABLE profile ADD COLUMN daily_goal_minutes INTEGER DEFAULT 120"); } catch(e){}
try { db.exec("ALTER TABLE profile ADD COLUMN aiProtocol TEXT DEFAULT 'strategic'"); } catch(e){}
try { db.exec("ALTER TABLE profile ADD COLUMN themeOpacity INTEGER DEFAULT 85"); } catch(e){}
try { db.exec("ALTER TABLE profile ADD COLUMN glowIntensity INTEGER DEFAULT 40"); } catch(e){}
try { db.exec("ALTER TABLE profile ADD COLUMN telemetryMasking INTEGER DEFAULT 1"); } catch(e){}
try { db.exec("ALTER TABLE profile ADD COLUMN stealthMode INTEGER DEFAULT 0"); } catch(e){}

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    streak INTEGER DEFAULT 0,
    lastCompletedAt INTEGER,
    workspaceId TEXT DEFAULT 'Personal',
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS sub_tasks (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    createdAt INTEGER,
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    completedAt INTEGER,
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    daily_goal_minutes INTEGER DEFAULT 120,
    aiProtocol TEXT DEFAULT 'strategic',
    themeOpacity INTEGER DEFAULT 85,
    glowIntensity INTEGER DEFAULT 40,
    telemetryMasking INTEGER DEFAULT 1,
    stealthMode INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO profile (id, xp, level, aiProtocol, themeOpacity, glowIntensity, telemetryMasking, stealthMode) VALUES (1, 0, 1, 'strategic', 85, 40, 1, 0);
  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    badgeId TEXT NOT NULL UNIQUE,
    unlockedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS neural_sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    baseTime INTEGER,
    activeNodes INTEGER DEFAULT 0
  );
`);

// Seed default neural sectors if empty
const sectorsCount = db.prepare('SELECT COUNT(*) as c FROM neural_sectors').get().c;
if (sectorsCount === 0) {
  db.prepare('INSERT INTO neural_sectors (id, name, description, icon, baseTime, activeNodes) VALUES (?, ?, ?, ?, ?, ?)').run('sector-1', 'Quantum State', 'Deep Architecture', 'memory', 45, 12);
  db.prepare('INSERT INTO neural_sectors (id, name, description, icon, baseTime, activeNodes) VALUES (?, ?, ?, ?, ?, ?)').run('sector-2', 'Alpha Void', 'Flow Mechanics', 'waves', 25, 8);
  db.prepare('INSERT INTO neural_sectors (id, name, description, icon, baseTime, activeNodes) VALUES (?, ?, ?, ?, ?, ?)').run('sector-3', 'Nexus Point', 'Silent Assembly', 'blur_on', 90, 3);
}

// Achievements Endpoints
app.get('/achievements', (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements').all();
  res.json(achievements);
});

app.post('/achievements', (req, res) => {
  const { badgeId } = req.body;
  try {
    const existing = db.prepare('SELECT * FROM achievements WHERE badgeId = ?').get(badgeId);
    if (!existing) {
      db.prepare('INSERT INTO achievements (id, badgeId, unlockedAt) VALUES (?, ?, ?)').run(crypto.randomUUID(), badgeId, Date.now());
      res.json({ success: true, newlyUnlocked: true });
    } else {
      res.json({ success: true, newlyUnlocked: false });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Neural Sectors
app.get('/neural/sectors', (req, res) => {
  const sectors = db.prepare('SELECT * FROM neural_sectors').all();
  res.json(sectors);
});

app.post('/neural/join', (req, res) => {
  const { sectorId } = req.body;
  try {
    db.prepare('UPDATE neural_sectors SET activeNodes = activeNodes + 1 WHERE id = ?').run(sectorId);
    const updated = db.prepare('SELECT * FROM neural_sectors WHERE id = ?').get(sectorId);
    io.emit('neuralPulse', { frequency: Math.floor(Math.random() * (500 - 300) + 300) });
    io.emit('neuralSectorsUpdated', db.prepare('SELECT * FROM neural_sectors').all());
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/neural/leave', (req, res) => {
  const { sectorId } = req.body;
  try {
    db.prepare('UPDATE neural_sectors SET activeNodes = MAX(0, activeNodes - 1) WHERE id = ?').run(sectorId);
    io.emit('neuralPulse', { frequency: Math.floor(Math.random() * (500 - 300) + 300) });
    io.emit('neuralSectorsUpdated', db.prepare('SELECT * FROM neural_sectors').all());
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Timer Presets
app.get('/timer-presets', (req, res) => {
  res.json(db.prepare('SELECT * FROM timer_presets').all());
});
app.post('/timer-presets', (req, res) => {
  const { name, work, shortBreak, longBreak } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO timer_presets (id, name, work, shortBreak, longBreak) VALUES (?, ?, ?, ?, ?)').run(id, name, work, shortBreak, longBreak);
  res.json(db.prepare('SELECT * FROM timer_presets WHERE id = ?').get(id));
});
app.delete('/timer-presets/:id', (req, res) => {
  db.prepare('DELETE FROM timer_presets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Focus Sessions
app.get('/focus-sessions', (req, res) => {
  const { workspace } = req.query;
  const sessions = db.prepare('SELECT * FROM focus_sessions WHERE workspaceId = ? ORDER BY completedAt DESC LIMIT 200').all(workspace || 'Personal');
  res.json(sessions);
});
app.post('/focus-sessions', (req, res) => {
  const { workspaceId, mode, duration, completedAt, taskId } = req.body;
  db.prepare('INSERT INTO focus_sessions (id, workspaceId, mode, duration, completedAt, taskId) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), workspaceId || 'Personal', mode, duration, completedAt, taskId || null);
  res.json({ success: true });
});

app.get('/focus-sessions/today', (req, res) => {
  const { workspace } = req.query;
  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);
  const row = db.prepare('SELECT SUM(duration) as total FROM focus_sessions WHERE workspaceId = ? AND mode = "work" AND completedAt >= ?').get(workspace || 'Personal', startOfDay.getTime());
  res.json({ totalMinutes: Math.round((row.total || 0) / 60) });
});

// Journal Endpoints
app.get('/journal/history', (req, res) => {
  const { workspace } = req.query;
  const entries = db.prepare('SELECT * FROM journal_entries WHERE workspaceId = ? ORDER BY date DESC').all(workspace || 'Personal');
  res.json(entries);
});

app.get('/journal', (req, res) => {
  const { workspace, date } = req.query;
  const entry = db.prepare('SELECT * FROM journal_entries WHERE workspaceId = ? AND date = ?').get(workspace || 'Personal', date);
  res.json(entry || { id: crypto.randomUUID(), workspaceId: workspace || 'Personal', date, content: '' });
});

app.post('/journal', (req, res) => {
  const { id, workspaceId, date, content, folder, title, isEncrypted, tags, attachments } = req.body;
  const tagsJson = JSON.stringify(tags || []);
  const attachmentsJson = JSON.stringify(attachments || []);
  const existing = db.prepare('SELECT id FROM journal_entries WHERE id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE journal_entries SET content = ?, folder = ?, title = ?, isEncrypted = ?, tags = ?, attachments = ? WHERE id = ?')
      .run(content, folder || '/', title || 'New Note.md', isEncrypted ? 1 : 0, tagsJson, attachmentsJson, id);
  } else {
    db.prepare('INSERT INTO journal_entries (id, workspaceId, date, content, folder, title, isEncrypted, tags, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, workspaceId, date, content, folder || '/', title || 'New Note.md', isEncrypted ? 1 : 0, tagsJson, attachmentsJson);
  }
  res.json({ success: true });
});

app.delete('/journal/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Folders Tree State
app.get('/api/folders', (req, res) => {
  const { workspace } = req.query;
  const ws = workspace || 'Personal';
  try {
    const row = db.prepare('SELECT folders FROM workspace_folders WHERE workspaceId = ?').get(ws);
    if (row && row.folders) {
      res.json(JSON.parse(row.folders));
    } else {
      res.json(['/Robotics', '/Cybersecurity', '/Personal_Sprints']);
    }
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', (req, res) => {
  const { workspace, folders } = req.body;
  const ws = workspace || 'Personal';
  try {
    db.prepare('INSERT INTO workspace_folders (workspaceId, folders) VALUES (?, ?) ON CONFLICT(workspaceId) DO UPDATE SET folders=excluded.folders')
      .run(ws, JSON.stringify(folders));
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Journal File Upload
app.post('/journal/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const url = `http://localhost:3002/uploads/${req.file.filename}`;
  res.json({ url, name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
});

// Journal AI Intelligence Analysis
app.post('/journal/analyze', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.json({ 
        alignment: 0, 
        suggestion: "Neo online. Configure GROQ_API_KEY to enable Document Intelligence." 
      });
    }

    const groq = new Groq({ apiKey: groqKey });
    const cleanText = content.replace(/<[^>]*>?/gm, '').substring(0, 4000);

    const prompt = `You are the FocusFlow Architect AI. Analyze this journal entry and provide:
1. Strategy Alignment Score (0-100) based on technical clarity and goal-oriented focus.
2. A single, punchy, tactical suggestion for the next step.

Return ONLY a JSON object: {"alignment": number, "suggestion": "string"}

Document Content:
${cleanText}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{"alignment": 0, "suggestion": "Analysis failed."}');
    res.json(result);
  } catch (err) {
    console.error('AI Analysis Error:', err);
    res.status(500).json({ error: 'AI Analysis failed' });
  }
});

// Journal AI Summarization
app.post('/journal/summarize', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.json({ summary: "Neo online. Configure GROQ_API_KEY to enable AI Summarization." });
    }

    const groq = new Groq({ apiKey: groqKey });
    const cleanText = content.replace(/<[^>]*>?/gm, '').substring(0, 4000);

    const prompt = `You are the FocusFlow AI. Summarize the following engineering/robotics journal entry in a clear, concise bullet-point format. Maximum 4 bullets.
    
Document Content:
${cleanText}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ summary: completion.choices[0]?.message?.content || 'Summarization failed.' });
  } catch (err) {
    console.error('AI Summarize Error:', err);
    res.status(500).json({ error: 'AI Summarization failed' });
  }
});

// Journal Tags patch
app.patch('/journal/:id/tags', (req, res) => {
  const { tags } = req.body;
  try {
    db.prepare('UPDATE journal_entries SET tags = ? WHERE id = ?').run(JSON.stringify(tags || []), req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Task Endpoints
app.get('/tasks', (req, res) => {
  const ws = req.query.workspace || 'Personal';
  const tasks = db.prepare('SELECT * FROM tasks WHERE workspaceId = ? ORDER BY position ASC').all(ws);
  const subTasks = db.prepare('SELECT * FROM sub_tasks').all();
  
  const tasksWithSubs = tasks.map(t => ({
    ...t,
    completed: !!t.completed,
    subTasks: subTasks.filter(st => st.taskId === t.id).map(st => ({ ...st, completed: !!st.completed }))
  }));
  res.json(tasksWithSubs);
});

app.post('/tasks', (req, res) => {
  const { 
    id, text, priority, dueDate, timeSlot, parentId, subTasks, goalId, workspaceId, 
    recurrenceInterval, recurrenceUnit, recurrenceEnds, recurrenceEndDate, recurrenceEndOccurrences,
    importance, urgency, cognitiveCost, dependencyIds
  } = req.body;
  const ws = workspaceId || 'Personal';
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO tasks (
        id, text, priority, dueDate, timeSlot, parentId, goalId, workspaceId, createdAt, 
        recurrenceInterval, recurrenceUnit, recurrenceEnds, recurrenceEndDate, recurrenceEndOccurrences, recurrenceCount,
        importance, urgency, cognitiveCost, dependencyIds
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, text, priority || 'medium', dueDate || null, timeSlot || null, parentId || null, goalId || null, ws, Date.now(),
      recurrenceInterval || null, recurrenceUnit || null, recurrenceEnds || null, recurrenceEndDate || null, recurrenceEndOccurrences || null, 0,
      importance || 50, urgency || 50, cognitiveCost || 5, dependencyIds || '[]'
    );
    if (subTasks && subTasks.length > 0) {
      const stmt = db.prepare('INSERT INTO sub_tasks (id, taskId, text, completed, createdAt) VALUES (?, ?, ?, ?, ?)');
      for (const st of subTasks) {
        stmt.run(st.id, id, st.text, st.completed ? 1 : 0, st.createdAt);
      }
    }
  });

  try {
    transaction();
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const newSubTasks = db.prepare('SELECT * FROM sub_tasks WHERE taskId = ?').all(id);
    const result = { ...newTask, completed: !!newTask.completed, subTasks: newSubTasks.map(st => ({ ...st, completed: !!st.completed })) };
    io.emit('taskUpdated', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { completed, subTasks, ...updates } = req.body;
  
  const transaction = db.transaction(() => {
    if (completed !== undefined) {
      const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      let applyCompletion = true;
      if (completed && existingTask && existingTask.recurrenceUnit) {
        const newCount = (existingTask.recurrenceCount || 0) + 1;
        let terminate = false;
        let nextDateStr = null;
        if (existingTask.recurrenceEnds === 'after' && newCount >= existingTask.recurrenceEndOccurrences) terminate = true;
        if (!terminate) {
           nextDateStr = getNextDate(existingTask.dueDate, existingTask.recurrenceUnit, existingTask.recurrenceInterval || 1);
           if (existingTask.recurrenceEnds === 'on' && nextDateStr > existingTask.recurrenceEndDate) terminate = true;
        }
        if (!terminate) {
          applyCompletion = false;
          db.prepare('UPDATE tasks SET dueDate = ?, recurrenceCount = ? WHERE id = ?').run(nextDateStr, newCount, id);
          db.prepare('INSERT INTO task_completions (id, taskId, completedAt) VALUES (?, ?, ?)').run(crypto.randomUUID(), id, Date.now());
        } else {
          db.prepare('UPDATE tasks SET recurrenceCount = ? WHERE id = ?').run(newCount, id);
        }
      }
      if (applyCompletion) {
        db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
        if (completed) db.prepare('INSERT INTO task_completions (id, taskId, completedAt) VALUES (?, ?, ?)').run(crypto.randomUUID(), id, Date.now());
        else db.prepare('DELETE FROM task_completions WHERE taskId = ?').run(id);
      }
    }
    if (subTasks !== undefined) {
      const oldSubTasks = db.prepare('SELECT id, completed FROM sub_tasks WHERE taskId = ?').all(id);
      db.prepare('DELETE FROM sub_tasks WHERE taskId = ?').run(id);
      if (subTasks.length > 0) {
        const stmt = db.prepare('INSERT INTO sub_tasks (id, taskId, text, completed, createdAt) VALUES (?, ?, ?, ?, ?)');
        for (const st of subTasks) {
          const stId = st.id || crypto.randomUUID();
          stmt.run(stId, id, st.text, st.completed ? 1 : 0, st.createdAt || Date.now());
          const oldSt = oldSubTasks.find(old => old.id === st.id);
          if (st.completed && (!oldSt || !oldSt.completed)) {
            db.prepare('INSERT INTO task_completions (id, taskId, completedAt) VALUES (?, ?, ?)').run(crypto.randomUUID(), id, Date.now());
          }
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updates);
      db.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...values, id);
    }
  });

  try {
    transaction();
    const subTasksQuery = db.prepare('SELECT * FROM sub_tasks WHERE taskId = ?').all(id);
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const finalTask = { ...updatedTask, completed: !!updatedTask.completed, subTasks: subTasksQuery.map(st => ({ ...st, completed: !!st.completed })) };
    io.emit('taskUpdated', finalTask);
    io.emit('activityUpdated');
    res.json({ success: true, task: finalTask });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/activity', (req, res) => {
  const activity = db.prepare('SELECT completedAt FROM task_completions').all();
  res.json(activity);
});

app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    io.emit('taskDeleted', id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Habit Endpoints
app.get('/habits', (req, res) => {
  const ws = req.query.workspace || 'Personal';
  const habits = db.prepare('SELECT * FROM habits WHERE workspaceId = ? ORDER BY createdAt ASC').all(ws);
  res.json(habits);
});

app.post('/habits', (req, res) => {
  const { title, workspaceId } = req.body;
  const ws = workspaceId || 'Personal';
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO habits (id, title, streak, lastCompletedAt, workspaceId, createdAt) VALUES (?, ?, 0, NULL, ?, ?)').run(id, title, ws, Date.now());
    io.emit('habitsRefreshed');
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/habits/:id/toggle', (req, res) => {
  const { id } = req.params;
  try {
    const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    let { streak, lastCompletedAt } = habit;
    const now = new Date();
    const todayStr = now.toDateString();
    const lastDate = lastCompletedAt ? new Date(lastCompletedAt) : null;
    const lastDateStr = lastDate ? lastDate.toDateString() : null;
    if (lastDateStr === todayStr) {
      streak = Math.max(0, streak - 1);
      lastCompletedAt = null; 
    } else {
      if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDateStr === yesterday.toDateString()) streak += 1; 
        else streak = 1; 
      } else streak = 1; 
      lastCompletedAt = Date.now();
    }
    db.prepare('UPDATE habits SET streak = ?, lastCompletedAt = ? WHERE id = ?').run(streak, lastCompletedAt, id);
    io.emit('habitsRefreshed');
    res.json({ success: true, streak, lastCompletedAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/habits/:id/reset', (req, res) => {
  db.prepare('UPDATE habits SET streak = 0, lastCompletedAt = NULL WHERE id = ?').run(req.params.id);
  io.emit('habitsRefreshed');
  res.json({ success: true });
});

app.delete('/habits/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
    io.emit('habitsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Goal Endpoints
app.get('/goals', (req, res) => {
  const ws = req.query.workspace || 'Personal';
  const goals = db.prepare('SELECT * FROM goals WHERE workspaceId = ? ORDER BY position ASC').all(ws);
  res.json(goals.map(g => ({ ...g, done: !!g.done })));
});

app.post('/goals', (req, res) => {
  const { id, title, type, category, target, yearId, monthId, parentId, workspaceId } = req.body;
  const ws = workspaceId || 'Personal';
  try {
    db.prepare('INSERT INTO goals (id, title, type, category, target, yearId, monthId, parentId, workspaceId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id || crypto.randomUUID(), title, type, category || 'Personal', target || 1, yearId || null, monthId || null, parentId || null, ws, Date.now()
    );
    io.emit('goalsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/goals/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    if (fields.length > 0) db.prepare(`UPDATE goals SET ${fields} WHERE id = ?`).run(...values, id);
    io.emit('goalsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/goals/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
    io.emit('goalsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/goals/rollup', (req, res) => {
  const transaction = db.transaction(() => {
    const monthlyGoals = db.prepare("SELECT id FROM goals WHERE type = 'monthly'").all();
    for (const month of monthlyGoals) {
      const weeklyStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as completed FROM goals WHERE parentId = ?").get(month.id);
      const progress = weeklyStats.total > 0 ? weeklyStats.completed / weeklyStats.total : 0;
      db.prepare("UPDATE goals SET autoProgress = ? WHERE id = ?").run(progress, month.id);
    }
    const yearlyGoals = db.prepare("SELECT id FROM goals WHERE type = 'yearly'").all();
    for (const year of yearlyGoals) {
      const monthlyStats = db.prepare("SELECT AVG(autoProgress) as avgProgress FROM goals WHERE parentId = ?").get(year.id);
      db.prepare("UPDATE goals SET autoProgress = ? WHERE id = ?").run(monthlyStats.avgProgress || 0, year.id);
    }
  });
  try {
    transaction();
    io.emit('goalsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/goals/:id/cascade', (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;
  const transaction = db.transaction(() => {
    const children = db.prepare('SELECT id, target FROM goals WHERE parentId = ?').all();
    for (const child of children) {
      const newTarget = Math.max(1, child.target + (delta / children.length));
      db.prepare('UPDATE goals SET target = ? WHERE id = ?').run(newTarget, child.id);
    }
  });
  try {
    transaction();
    io.emit('goalsRefreshed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Profile Endpoints
app.get('/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile);
});

app.patch('/profile', (req, res) => {
  const updates = req.body;
  const fields = Object.keys(updates);
  if (fields.length === 0) return res.status(400).json({ error: "No fields provided" });
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = Object.values(updates);
  
  try {
    db.prepare(`UPDATE profile SET ${setClause} WHERE id = 1`).run(...values);
    const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    io.emit('profileUpdated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/profile/xp', (req, res) => {
  const { xp } = req.body;
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const newXp = (profile.xp || 0) + xp;
  const calcLevel = Math.floor(Math.sqrt(newXp / 50)) + 1;
  const leveledUp = calcLevel > (profile.level || 1);
  db.prepare('UPDATE profile SET xp = ?, level = ? WHERE id = 1').run(newXp, calcLevel);
  const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  io.emit('profileUpdated', updated);
  res.json({ profile: updated, leveledUp });
});

// Backup & Restore
app.get('/backup', (req, res) => {
  const tables = ['tasks', 'habits', 'goals', 'journal_entries', 'achievements', 'profile', 'timer_presets', 'focus_sessions'];
  const backup = {};
  try {
    tables.forEach(table => { backup[table] = db.prepare(`SELECT * FROM ${table}`).all(); });
    res.json(backup);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/restore', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).send('Invalid backup data');
  try {
    db.transaction(() => {
      Object.keys(data).forEach(table => {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
          if (data[table].length > 0) {
            const columns = Object.keys(data[table][0]);
            const placeholders = columns.map(() => '?').join(',');
            const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
            const stmt = db.prepare(query);
            data[table].forEach(row => { stmt.run(...columns.map(col => row[col])); });
          }
        } catch (e) { console.error(`Restore failed for table ${table}:`, e); }
      });
    })();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/tasks/archive-completed', (req, res) => {
  const { workspaceId } = req.body;
  const ws = workspaceId || 'Personal';
  db.prepare('UPDATE tasks SET archived = 1 WHERE completed = 1 AND workspaceId = ?').run(ws);
  res.json({ success: true });
});

// Semantic Search
app.post('/journal/search', async (req, res) => {
  const { query, workspace } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  try {
    const entries = db.prepare('SELECT id, title, content, folder FROM journal_entries WHERE workspaceId = ? AND isEncrypted = 0').all(workspace || 'Personal');
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey || entries.length === 0) return res.json({ results: [] });
    const groq = new Groq({ apiKey: groqKey });
    const context = entries.map(e => `ID:${e.id} Title:${e.title} Path:${e.folder} Content:${e.content.substring(0, 200)}`).join('\n---\n');
    const prompt = `You are a Semantic Retrieval Engine. Given a list of journal entries and a user query, identify the top 3 most relevant entries. Return ONLY a JSON array of IDs in a field named "results". Query: "${query}" Entries: ${context}`;
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });
    const response = JSON.parse(completion.choices[0]?.message?.content || '{"results": []}');
    const ids = response.results || [];
    res.json({ results: entries.filter(e => ids.includes(e.id)) });
  } catch (error) { res.status(500).json({ error: 'Search failed' }); }
});

app.post('/api/neo/chat', async (req, res) => {
  const { prompt, context, history = [] } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.json({ reply: "I'm Neo. High-performance productivity is my specialty. Try using Pomodoro to boost your focus!" });
    const groq = new Groq({ apiKey: groqKey });
    const protocol = context?.aiProtocol || 'strategic';
    let personality = "You are Neo, an elite personal AI productivity architect. Short, punchy, professional advice. Use markdown sparingly.";
    if (protocol === 'gentle') personality = "You are Neo. Personality: 'Gentle Guide'. Extremely supportive, kind, and encouraging. Use words like 'friend', 'champion', 'wonderful'. Soft approach to productivity.";
    else if (protocol === 'hardcore') personality = "You are Neo. Personality: 'Hardcore Discipline'. Brutally honest, sassy, and demanding. Zero tolerance for laziness. Sharp wit, sarcasm, order the user to 'LOCK IN'. You're the boss.";
    else personality = "You are Neo. Personality: 'Strategic Partner'. Analytical, direct, efficient. No fluff. High-density logic and clarity.";
    const systemInstruction = `${personality}\nContext about the user right now: ${JSON.stringify(context || {})}`;
    // Build messages with history (cap at 10 turns)
    const historyMessages = history.slice(-10).map(h => ({ role: h.role === 'neo' ? 'assistant' : 'user', content: h.text }));
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemInstruction }, ...historyMessages, { role: 'user', content: prompt }],
      model: "llama-3.3-70b-versatile",
    });
    res.json({ reply: completion.choices[0]?.message?.content || "cognitive reboot required." });
  } catch (error) { res.status(500).json({ error: 'Neo error' }); }
});

// SSE Streaming endpoint — streams tokens word by word
app.get('/api/neo/stream', async (req, res) => {
  const { prompt, context, history } = req.query;
  if (!prompt) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      res.write(`data: ${JSON.stringify({ token: "Neo online. GROQ_API_KEY not configured.", done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }
    const groq = new Groq({ apiKey: groqKey });
    let parsedContext = {};
    let parsedHistory = [];
    try { parsedContext = JSON.parse(decodeURIComponent(context || '{}')); } catch(e) {}
    try { parsedHistory = JSON.parse(decodeURIComponent(history || '[]')); } catch(e) {}

    const protocol = parsedContext?.aiProtocol || 'strategic';
    let personality = "You are Neo, an elite personal AI productivity architect. Be conversational, sharp, and real — like a brilliant friend who happens to be brutally honest. No corporate fluff. Use short paragraphs. Max 3 sentences per thought.";
    if (protocol === 'gentle') personality = "You are Neo. Personality: 'Gentle Guide'. Warm, encouraging, supportive. Talk like a caring mentor. Keep it real but kind. Short, uplifting responses.";
    else if (protocol === 'hardcore') personality = "You are Neo. Personality: 'Hardcore Discipline'. Sassy, demanding, zero tolerance. You call people out. You hype them up hard. You swear loyalty to results only. Short, punchy, electric responses.";
    else personality = "You are Neo. Personality: 'Strategic Partner'. Talk like a sharp, analytical co-founder. Direct, logical, efficient. You don't waste words. You solve problems.";

    const systemInstruction = `${personality}\nUser context: ${JSON.stringify(parsedContext)}`;
    const historyMessages = parsedHistory.slice(-10).map(h => ({ role: h.role === 'neo' ? 'assistant' : 'user', content: h.text }));

    const stream = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemInstruction }, ...historyMessages, { role: 'user', content: decodeURIComponent(prompt) }],
      model: "llama-3.3-70b-versatile",
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ token: "Neural link disrupted. Try again.", done: false })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

// Proactive Neo — trigger a message via socket (called by frontend timers or events)
app.post('/api/neo/proactive', (req, res) => {
  const { message, type } = req.body;
  io.emit('neoProactive', { message, type, timestamp: Date.now() });
  res.json({ success: true });
});

// Ensure TTS temp directory
const ttsDir = path.join(__dirname, 'tts_cache');
if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });

// Neural TTS endpoint — generates high-fidelity voice audio
app.post('/api/neo/tts', async (req, res) => {
  const { text, protocol } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // Map protocol to voice
  const voiceMap = {
    gentle: { voice: 'en-US-AriaNeural', rate: '-5%', pitch: '+5%' },
    hardcore: { voice: 'en-GB-RyanNeural', rate: '+12%', pitch: '-8%' },
    strategic: { voice: 'en-US-GuyNeural', rate: '+5%', pitch: 'default' },
  };
  const cfg = voiceMap[protocol] || voiceMap.strategic;

  // Sanitize text for TTS (strip markdown)
  const cleanText = text.replace(/[#*_`>\[\]()!]/g, '').replace(/\n+/g, '. ').substring(0, 800);

  const audioFile = path.join(ttsDir, `neo-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp3`);

  try {
    const tts = new EdgeTTS({
      voice: cfg.voice,
      lang: 'en-US',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: cfg.rate,
      pitch: cfg.pitch,
    });
    await tts.ttsPromise(cleanText, audioFile);

    // Stream the file back
    res.setHeader('Content-Type', 'audio/mpeg');
    const stream = fs.createReadStream(audioFile);
    stream.pipe(res);
    stream.on('end', () => {
      // Cleanup temp file
      fs.unlink(audioFile, () => {});
    });
  } catch (err) {
    console.error('TTS Error:', err);
    // Cleanup on error
    fs.unlink(audioFile, () => {});
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
