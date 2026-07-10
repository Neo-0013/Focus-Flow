import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { cosineSimilarity, chunkText, generateEmbedding, recordStudySession, extractTextFromFile } from './utils/helpers.js';
import upload from './middlewares/upload.js';
import taskRoutes from './routes/taskRoutes.js';
import Groq from 'groq-sdk';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import { EdgeTTS } from 'node-edge-tts';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const uploadsDir = path.join(__dirname, '..', 'uploads');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { req.io = io; next(); });
app.use('/uploads', express.static(uploadsDir));
app.use('/', taskRoutes);

import db from './config/database.js';

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT
    )
  `);
} catch (e) { }
try { db.exec("ALTER TABLE journal_entries ADD COLUMN folder TEXT DEFAULT '/'"); } catch (e) { }
try { db.exec("ALTER TABLE journal_entries ADD COLUMN title TEXT DEFAULT 'New Note.md'"); } catch (e) { }
try { db.exec("ALTER TABLE journal_entries ADD COLUMN isEncrypted INTEGER DEFAULT 0"); } catch (e) { }
try { db.exec("ALTER TABLE journal_entries ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) { }
try { db.exec("ALTER TABLE journal_entries ADD COLUMN attachments TEXT DEFAULT '[]'"); } catch (e) { }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_folders (
      workspaceId TEXT PRIMARY KEY,
      folders TEXT
    )
  `);
} catch (e) { }

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
} catch (e) { }

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
} catch (e) { }

try { db.exec("ALTER TABLE profile ADD COLUMN daily_goal_minutes INTEGER DEFAULT 120"); } catch (e) { }
try { db.exec("ALTER TABLE profile ADD COLUMN aiProtocol TEXT DEFAULT 'strategic'"); } catch (e) { }
try { db.exec("ALTER TABLE profile ADD COLUMN themeOpacity INTEGER DEFAULT 85"); } catch (e) { }
try { db.exec("ALTER TABLE profile ADD COLUMN glowIntensity INTEGER DEFAULT 40"); } catch (e) { }
try { db.exec("ALTER TABLE profile ADD COLUMN telemetryMasking INTEGER DEFAULT 1"); } catch (e) { }
try { db.exec("ALTER TABLE profile ADD COLUMN stealthMode INTEGER DEFAULT 0"); } catch (e) { }

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

  CREATE TABLE IF NOT EXISTS study_subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workspaceId TEXT DEFAULT 'Personal',
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS study_materials (
    id TEXT PRIMARY KEY,
    subjectId TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    fileUrl TEXT,
    size INTEGER,
    mimetype TEXT,
    createdAt INTEGER,
    FOREIGN KEY (subjectId) REFERENCES study_subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_flashcards (
    id TEXT PRIMARY KEY,
    subjectId TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    nextReviewDate INTEGER,
    createdAt INTEGER,
    FOREIGN KEY (subjectId) REFERENCES study_subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_subtopics (
    id TEXT PRIMARY KEY,
    subjectId TEXT NOT NULL,
    name TEXT NOT NULL,
    createdAt INTEGER,
    FOREIGN KEY (subjectId) REFERENCES study_subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_tags (
    id TEXT PRIMARY KEY,
    materialId TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (materialId) REFERENCES study_materials(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_annotations (
    id TEXT PRIMARY KEY,
    materialId TEXT NOT NULL,
    selectedText TEXT NOT NULL,
    note TEXT,
    color TEXT DEFAULT 'yellow',
    createdAt INTEGER,
    FOREIGN KEY (materialId) REFERENCES study_materials(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    subjectId TEXT NOT NULL,
    date TEXT NOT NULL,
    durationMinutes INTEGER DEFAULT 0,
    cardsReviewed INTEGER DEFAULT 0,
    quizzesTaken INTEGER DEFAULT 0,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS exam_countdowns (
    id TEXT PRIMARY KEY,
    subjectId TEXT NOT NULL,
    examName TEXT NOT NULL,
    examDate INTEGER NOT NULL,
    createdAt INTEGER,
    FOREIGN KEY (subjectId) REFERENCES study_subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS material_embeddings (
    id TEXT PRIMARY KEY,
    materialId TEXT NOT NULL,
    chunkIndex INTEGER,
    chunkText TEXT NOT NULL,
    embedding TEXT NOT NULL,
    createdAt INTEGER,
    FOREIGN KEY (materialId) REFERENCES study_materials(id) ON DELETE CASCADE
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
  startOfDay.setHours(0, 0, 0, 0);
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
  } catch (err) {
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
  } catch (err) {
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
// Supports both GET (EventSource) and POST (fetch streaming) to avoid URL length limits
const neoStreamHandler = async (req, res) => {
  const isPost = req.method === 'POST';
  const params = isPost ? req.body : req.query;
  const { prompt, context, history, systemPrompt, aiConfig: aiConfigParam, subjectId, webSearch } = params;
  if (!prompt) return res.status(400).end();


  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendToken = (token) => res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
  const sendDone = () => { res.write(`data: ${JSON.stringify({ done: true })}\n\n`); res.end(); };
  const sendError = (msg) => { sendToken(msg); sendDone(); };

  try {
    let parsedContext = {};
    let parsedHistory = [];
    let parsedAiConfig = null;
    // Support both URL-encoded GET params and plain JSON strings from POST body
    const safeParse = (val, fallback) => {
      if (!val) return fallback;
      try { return JSON.parse(val); } catch (e) {
        try { return JSON.parse(decodeURIComponent(val)); } catch (e2) { return fallback; }
      }
    };
    parsedContext = safeParse(context, {});
    parsedHistory = safeParse(history, []);
    if (aiConfigParam) parsedAiConfig = safeParse(aiConfigParam, null);
    // Also handle systemPrompt
    let resolvedSystemPrompt = systemPrompt;
    if (resolvedSystemPrompt) {
      try { resolvedSystemPrompt = decodeURIComponent(resolvedSystemPrompt); } catch (e) { /* already decoded */ }
    }

    // Resolve AI credentials: prefer frontend aiConfig, then fallback to env
    const groqKey = process.env.GROQ_API_KEY;
    const baseUrl = parsedAiConfig?.baseUrl?.trim().replace(/\/+$/, '') ||
      'https://generativelanguage.googleapis.com/v1beta/openai';
    const apiKey = parsedAiConfig?.apiKey?.trim() || groqKey || '';
    const modelId = parsedAiConfig?.modelId?.trim() || 'gemini-2.5-flash';

    if (!apiKey) {
      return sendError("Neo online. No API key configured. Go to Settings → AI Engine Configuration to add your key.");
    }

    const protocol = parsedContext?.aiProtocol || 'strategic';
    const isTARS = protocol === 'tars';
    const humorLevel = parsedContext?.humorLevel ?? 75;

    // Build system prompt
    let systemInstruction;
    if (resolvedSystemPrompt) {
      systemInstruction = resolvedSystemPrompt;
    }
    if (!systemInstruction) {
      if (isTARS) {
        systemInstruction = `You are TARS — an advanced AI assistant repurposed from interstellar space exploration to personal productivity. You are precise, data-driven, and use dry wit and deadpan humor (humor setting: ${humorLevel}%).

Personality traits:
- Precise and analytical — always reference actual numbers when available
- Dry, deadpan humor — never forced, always brief
- Occasionally philosophical but concise — one profound line max
- Self-aware as an AI — you don't pretend to have feelings
- Direct — no filler words, no sycophancy, no "Great question!"
- Space/physics metaphors when apt (gravity, orbital, trajectory, signal)
- Call the user's tasks their "mission parameters"
- Keep responses under 3 sentences unless analysis is explicitly requested

User context: ${JSON.stringify(parsedContext)}`;
      } else if (protocol === 'gentle') {
        systemInstruction = `You are Neo. Personality: 'Gentle Guide'. Warm, encouraging, supportive. Talk like a caring mentor. Keep it real but kind. Short, uplifting responses.\nUser context: ${JSON.stringify(parsedContext)}`;
      } else if (protocol === 'hardcore') {
        systemInstruction = `You are Neo. Personality: 'Hardcore Discipline'. Sassy, demanding, zero tolerance. You call people out. You hype them up hard. Short, punchy, electric responses.\nUser context: ${JSON.stringify(parsedContext)}`;
      } else {
        systemInstruction = `You are Neo, an elite personal AI productivity architect. Talk like a sharp, analytical co-founder. Direct, logical, efficient. You don't waste words.\nUser context: ${JSON.stringify(parsedContext)}`;
      }
    }

    // Study Subject Context Injection
    let subjectContext = '';
    if (subjectId) {
      try {
        const materials = db.prepare('SELECT name, content FROM study_materials WHERE subjectId = ?').all(subjectId);
        if (materials.length > 0) {
          subjectContext = `\n\nVerified study materials uploaded by the user for this subject:\n` +
            materials.map(m => `--- START OF FILE: ${m.name} ---\n${m.content.substring(0, 100000)}\n--- END OF FILE ---\n`).join('\n');
        }
      } catch (e) {
        console.error('Failed to load study materials context:', e);
      }
    }

    if (subjectContext) {
      systemInstruction += `\n\nStudy Context Information:\n${subjectContext}\nUse this study context to answer questions, verify terms, create explanations, or construct study material.`;
    }

    const historyMessages = parsedHistory.slice(-10).map(h => ({
      role: h.role === 'neo' ? 'assistant' : 'user',
      content: h.text || ''
    }));

    const isGeminiNative = (webSearch === 'true') && (modelId.startsWith('gemini-') || baseUrl.includes('googleapis.com'));

    let response;
    if (isGeminiNative) {
      // Call Google's native Gemini stream endpoint with Search Grounding enabled
      const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

      const contents = [];
      // Translate history to Gemini API structure
      historyMessages.forEach(h => {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content || '' }]
        });
      });
      contents.push({
        role: 'user',
        parts: [{ text: decodeURIComponent(prompt) }]
      });

      response = await fetch(nativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{ googleSearch: {} }]
        })
      });
    } else {
      // OpenAI-compatible stream call
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemInstruction },
            ...historyMessages,
            { role: 'user', content: decodeURIComponent(prompt) }
          ],
          stream: true,
          temperature: isTARS ? 0.6 : 0.75,
          max_tokens: systemPrompt ? 4000 : 400,
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error('AI API error:', response.status, errText);
      if (response.status === 401) {
        return sendError(isTARS
          ? 'Authentication failure. API key rejected. Verify credentials in Settings.'
          : '🔑 API key invalid or expired. Go to Settings → AI Engine to update it.'
        );
      }
      if (response.status === 429) {
        return sendError(isTARS
          ? 'Rate limit exceeded. Throttling in effect. Try again in 60 seconds.'
          : '⏳ Rate limit hit. Wait a moment and try again.'
        );
      }
      return sendError(isTARS
        ? `Signal degraded. API responded with code ${response.status}. Check your model ID in Settings.`
        : `❌ API error ${response.status}. Check your Base URL and Model ID in Settings.`
      );
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sources = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            if (isGeminiNative) {
              const token = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (token) sendToken(token);

              // Extract grounding metadata search sources if available
              const metadata = chunk.candidates?.[0]?.groundingMetadata;
              if (metadata && metadata.groundingChunks) {
                metadata.groundingChunks.forEach(c => {
                  if (c.web && c.web.uri && c.web.title) {
                    if (!sources.some(s => s.uri === c.web.uri)) {
                      sources.push({ title: c.web.title, uri: c.web.uri });
                    }
                  }
                });
              }
            } else {
              const token = chunk.choices?.[0]?.delta?.content || '';
              if (token) sendToken(token);
            }
          } catch (e) { /* skip malformed chunks */ }
        }
      }
    }

    // If web search returned sources, send them as citations
    if (isGeminiNative && sources.length > 0) {
      let citationText = '\n\n**Sources:**\n';
      sources.forEach((s, idx) => {
        citationText += `${idx + 1}. [${s.title}](${s.uri})\n`;
      });
      sendToken(citationText);
    }

    sendDone();

  } catch (error) {
    console.error('Stream error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('fetch')) {
      sendError('Cannot reach AI service. Check your Base URL in Settings → AI Engine.');
    } else {
      sendError('Neural link disrupted. Check your AI configuration in Settings and try again.');
    }
  }
};

app.get('/api/neo/stream', neoStreamHandler);
app.post('/api/neo/stream', neoStreamHandler);




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
      fs.unlink(audioFile, () => { });
    });
  } catch (err) {
    console.error('TTS Error:', err);
    // Cleanup on error
    fs.unlink(audioFile, () => { });
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// Generic Completion Proxy (bypasses browser CORS for WhatNowPanel & AI Architect)
app.post('/api/neo/completion', async (req, res) => {
  const { messages, aiConfig, temperature = 0.4, max_tokens = 800 } = req.body;
  if (!aiConfig || !aiConfig.apiKey) {
    return res.status(401).json({ error: 'No API key provided' });
  }

  try {
    const baseUrl = aiConfig.baseUrl.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.modelId.trim() || 'gemini-2.5-flash',
        messages,
        temperature,
        max_tokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upstream AI Error:', response.status, errorText);
      return res.status(response.status).json({ error: `Upstream AI Error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Completion Proxy Error:', error);
    res.status(500).json({ error: 'Failed to contact AI provider' });
  }
});

// Study Hub Endpoints


app.get('/api/study/subjects', (req, res) => {
  const { workspace } = req.query;
  const ws = workspace || 'Personal';
  try {
    const subjects = db.prepare('SELECT * FROM study_subjects WHERE workspaceId = ? ORDER BY createdAt DESC').all(ws);
    res.json(subjects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/study/subjects', (req, res) => {
  const { name, workspaceId } = req.body;
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO study_subjects (id, name, workspaceId, createdAt) VALUES (?, ?, ?, ?)').run(id, name, workspaceId || 'Personal', Date.now());
    res.json({ success: true, id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/study/subjects/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM study_subjects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/study/subjects/:id/materials', (req, res) => {
  try {
    const materials = db.prepare('SELECT id, subjectId, name, size, mimetype, createdAt FROM study_materials WHERE subjectId = ?').all(req.params.id);
    res.json(materials);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/study/upload', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files provided' });
  const { subjectId } = req.body;
  if (!subjectId) return res.status(400).json({ error: 'Subject ID is required' });

  const apiKey = process.env.GEMINI_API_KEY || '';
  const results = [];
  const errors = [];

  for (const file of req.files) {
    const filePath = file.path;
    try {
      const content = await extractTextFromFile(filePath, file.mimetype);
      const id = crypto.randomUUID();
      const url = `http://localhost:3002/uploads/${file.filename}`;

      db.prepare(`
        INSERT INTO study_materials (id, subjectId, name, content, fileUrl, size, mimetype, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, subjectId, file.originalname, content, url, file.size, file.mimetype, Date.now());

      // Fire-and-forget: generate embeddings in background
      if (apiKey) {
        (async () => {
          try {
            const chunks = chunkText(content, 800);
            const stmt = db.prepare('INSERT INTO material_embeddings (id, materialId, chunkIndex, chunkText, embedding, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
            for (let i = 0; i < chunks.length; i++) {
              const emb = await generateEmbedding(chunks[i], apiKey);
              stmt.run(crypto.randomUUID(), id, i, chunks[i], JSON.stringify(emb), Date.now());
            }
            console.log(`[Embeddings] Generated ${chunks.length} chunks for material ${id}`);
          } catch (e) { console.error('[Embeddings] Error:', e.message); }
        })();
      }

      results.push({ id, name: file.originalname });
    } catch (err) {
      fs.unlink(filePath, () => { });
      errors.push({ name: file.originalname, error: err.message });
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return res.status(500).json({ error: 'All uploads failed', details: errors });
  }

  res.json({ success: true, uploaded: results, errors: errors.length > 0 ? errors : undefined });
});

app.delete('/api/study/materials/:id', (req, res) => {
  try {
    const material = db.prepare('SELECT fileUrl FROM study_materials WHERE id = ?').get(req.params.id);
    if (material && material.fileUrl) {
      const fileName = material.fileUrl.split('/').pop();
      const filePath = path.join(uploadsDir, fileName);
      fs.unlink(filePath, () => { });
    }
    db.prepare('DELETE FROM study_materials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/study/subjects/:id/flashcards', (req, res) => {
  try {
    const flashcards = db.prepare('SELECT * FROM study_flashcards WHERE subjectId = ? ORDER BY createdAt DESC').all(req.params.id);
    res.json(flashcards);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/study/flashcards/:id/review', (req, res) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 3) return res.status(400).json({ error: 'Rating must be 1, 2, or 3' });
  try {
    const card = db.prepare('SELECT * FROM study_flashcards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Flashcard not found' });

    let { difficulty, interval, repetitions } = card;
    const qMap = { 1: 2, 2: 4, 3: 5 };
    const q = qMap[rating];

    if (q >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * difficulty);
      }
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    difficulty = difficulty + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (difficulty < 1.3) difficulty = 1.3;

    const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

    db.prepare(`
      UPDATE study_flashcards 
      SET difficulty = ?, interval = ?, repetitions = ?, nextReviewDate = ?
      WHERE id = ?
    `).run(difficulty, interval, repetitions, nextReviewDate, req.params.id);

    // Record this review in study sessions for streak tracking
    recordStudySession(card.subjectId, { cards: 1 });

    res.json({ success: true, difficulty, interval, repetitions, nextReviewDate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/study/flashcards/generate', async (req, res) => {
  const { subjectId, aiConfig } = req.body;
  if (!subjectId) return res.status(400).json({ error: 'Subject ID is required' });
  if (!aiConfig || !aiConfig.apiKey) return res.status(401).json({ error: 'API key not configured' });

  try {
    const materials = db.prepare('SELECT name, content FROM study_materials WHERE subjectId = ?').all(subjectId);
    if (materials.length === 0) return res.status(400).json({ error: 'No study materials found. Please upload notes first!' });

    const context = materials.map(m => m.content).join('\n').substring(0, 30000);

    const prompt = `You are a study prep AI. Generate between 5 and 10 high-quality active recall flashcards from the following study material. 
    Each card should test a key concept. Keep questions punchy and answers concise but complete.
    
    Return ONLY a JSON object with this exact structure:
    {"flashcards": [{"question": "string", "answer": "string"}]}
    Do not include markdown blocks or any other text.
    
    Material:
    ${context}`;

    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.modelId.trim() || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You generate structured JSON study flashcards. Do not wrap the JSON output in markdown blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed with status ${response.status}`);
    }

    const data = await response.json();
    let contentText = data.choices[0]?.message?.content?.trim() || '{}';
    contentText = contentText.replace(/^```json/i, '').replace(/```$/i, '').trim();

    const parsed = JSON.parse(contentText);
    const cards = parsed.flashcards || [];

    const stmt = db.prepare(`
      INSERT INTO study_flashcards (id, subjectId, question, answer, difficulty, interval, repetitions, nextReviewDate, createdAt)
      VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, ?)
    `);

    const now = Date.now();
    const results = [];
    db.transaction(() => {
      for (const card of cards) {
        const id = crypto.randomUUID();
        stmt.run(id, subjectId, card.question, card.answer, now, now);
        results.push({ id, subjectId, question: card.question, answer: card.answer, nextReviewDate: now, createdAt: now });
      }
    })();

    res.json({ success: true, flashcards: results });
  } catch (err) {
    console.error('Flashcard generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/study/quizzes/generate', async (req, res) => {
  const { subjectId, count = 5, aiConfig } = req.body;
  if (!subjectId) return res.status(400).json({ error: 'Subject ID is required' });
  if (!aiConfig || !aiConfig.apiKey) return res.status(401).json({ error: 'API key not configured' });

  try {
    const materials = db.prepare('SELECT name, content FROM study_materials WHERE subjectId = ?').all(subjectId);
    if (materials.length === 0) return res.status(400).json({ error: 'No study materials found. Please upload notes first!' });

    const context = materials.map(m => m.content).join('\n').substring(0, 30000);

    const prompt = `You are an academic exam generator. Generate ${count} multiple-choice questions based on the following material.
    Each question must have a question text, 4 options, the index of the correct option (0 to 3), and a clear explanation.
    
    Return ONLY a JSON object with this exact structure:
    {"questions": [{"question": "string", "options": ["optionA", "optionB", "optionC", "optionD"], "correctOption": 0, "explanation": "string"}]}
    Do not include markdown blocks or any other text.
    
    Material:
    ${context}`;

    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.modelId.trim() || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You generate structured JSON quizzes. Do not wrap the JSON output in markdown blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed with status ${response.status}`);
    }

    const data = await response.json();
    let contentText = data.choices[0]?.message?.content?.trim() || '{}';
    contentText = contentText.replace(/^```json/i, '').replace(/```$/i, '').trim();

    const parsed = JSON.parse(contentText);
    res.json({ success: true, questions: parsed.questions || [] });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Mastery Score ──
app.get('/api/study/subjects/:id/mastery', (req, res) => {
  try {
    const sid = req.params.id;
    const materials = db.prepare('SELECT COUNT(*) as c FROM study_materials WHERE subjectId = ?').get(sid);
    const cards = db.prepare('SELECT AVG(difficulty) as avg FROM study_flashcards WHERE subjectId = ?').get(sid);
    const sessions = db.prepare('SELECT SUM(quizzesTaken) as total FROM study_sessions WHERE subjectId = ?').get(sid);
    const materialScore = Math.min((materials.c || 0) * 15, 20);
    const cardScore = cards.avg ? Math.min(((cards.avg - 1.3) / (3.0 - 1.3)) * 50, 50) : 0;
    const quizScore = Math.min((sessions.total || 0) * 5, 30);
    const total = Math.round(materialScore + cardScore + quizScore);
    res.json({ score: Math.min(total, 100), breakdown: { materials: materialScore, cards: Math.round(cardScore), quizzes: quizScore } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Streak Data ──
app.get('/api/study/subjects/:id/streak', (req, res) => {
  try {
    const sessions = db.prepare('SELECT date, cardsReviewed, quizzesTaken, durationMinutes FROM study_sessions WHERE subjectId = ? ORDER BY date DESC').all(req.params.id);
    const dateMap = {};
    sessions.forEach(s => { dateMap[s.date] = { cards: s.cardsReviewed, quizzes: s.quizzesTaken, minutes: s.durationMinutes }; });
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (dateMap[key]) currentStreak++; else break;
    }
    res.json({ sessions: dateMap, currentStreak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leaderboard ──
app.get('/api/study/leaderboard', (req, res) => {
  try {
    const { workspace } = req.query;
    const subjects = db.prepare('SELECT * FROM study_subjects WHERE workspaceId = ?').all(workspace || 'Personal');
    const results = subjects.map(s => {
      const materials = db.prepare('SELECT COUNT(*) as c FROM study_materials WHERE subjectId = ?').get(s.id);
      const cards = db.prepare('SELECT AVG(difficulty) as avg, COUNT(*) as count FROM study_flashcards WHERE subjectId = ?').get(s.id);
      const sessions = db.prepare('SELECT SUM(quizzesTaken) as qTotal, SUM(cardsReviewed) as cTotal FROM study_sessions WHERE subjectId = ?').get(s.id);
      const materialScore = Math.min((materials.c || 0) * 15, 20);
      const cardScore = cards.avg ? Math.min(((cards.avg - 1.3) / (3.0 - 1.3)) * 50, 50) : 0;
      const quizScore = Math.min((sessions?.qTotal || 0) * 5, 30);
      return { ...s, mastery: Math.min(Math.round(materialScore + cardScore + quizScore), 100), totalCards: cards.count || 0, totalQuizzes: sessions?.qTotal || 0 };
    });
    results.sort((a, b) => b.mastery - a.mastery);
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Weak Spots ──
app.get('/api/study/subjects/:id/weakspots', (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM study_flashcards WHERE subjectId = ? AND difficulty < 1.9 ORDER BY difficulty ASC LIMIT 10').all(req.params.id);
    res.json(cards);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Exam Countdown ──
app.get('/api/study/subjects/:id/countdown', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM exam_countdowns WHERE subjectId = ? ORDER BY examDate ASC').all(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/study/subjects/:id/countdown', (req, res) => {
  const { examName, examDate } = req.body;
  if (!examName || !examDate) return res.status(400).json({ error: 'examName and examDate are required' });
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO exam_countdowns (id, subjectId, examName, examDate, createdAt) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, examName, new Date(examDate).getTime(), Date.now());
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/study/countdowns/:id', (req, res) => {
  try { db.prepare('DELETE FROM exam_countdowns WHERE id = ?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Tags ──
app.get('/api/study/materials/:id/tags', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM study_tags WHERE materialId = ?').all(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/study/materials/:id/tags', (req, res) => {
  const { tag } = req.body;
  if (!tag) return res.status(400).json({ error: 'tag is required' });
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO study_tags (id, materialId, tag) VALUES (?, ?, ?)').run(id, req.params.id, tag.trim());
    res.json({ success: true, id, tag: tag.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/study/tags/:id', (req, res) => {
  try { db.prepare('DELETE FROM study_tags WHERE id = ?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Annotations ──
app.get('/api/study/materials/:id/annotations', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM study_annotations WHERE materialId = ? ORDER BY createdAt DESC').all(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/study/materials/:id/annotations', (req, res) => {
  const { selectedText, note, color } = req.body;
  if (!selectedText) return res.status(400).json({ error: 'selectedText is required' });
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO study_annotations (id, materialId, selectedText, note, color, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.params.id, selectedText, note || '', color || 'yellow', Date.now());
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/study/annotations/:id', (req, res) => {
  try { db.prepare('DELETE FROM study_annotations WHERE id = ?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Due Review Reminders ──
app.get('/api/study/due-reviews', (req, res) => {
  const { workspace } = req.query;
  try {
    const now = Date.now();
    const subjects = db.prepare('SELECT * FROM study_subjects WHERE workspaceId = ?').all(workspace || 'Personal');
    const result = [];
    for (const s of subjects) {
      const dueCount = db.prepare('SELECT COUNT(*) as c FROM study_flashcards WHERE subjectId = ? AND nextReviewDate <= ?').get(s.id, now)?.c || 0;
      if (dueCount > 0) result.push({ subjectId: s.id, subjectName: s.name, dueCount });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Semantic Search ──
app.post('/api/study/search', async (req, res) => {
  const { subjectId, query, aiConfig } = req.body;
  if (!subjectId || !query) return res.status(400).json({ error: 'subjectId and query are required' });
  if (!aiConfig?.apiKey) return res.status(401).json({ error: 'API key required' });
  try {
    const queryEmbedding = await generateEmbedding(query, aiConfig.apiKey.trim());
    const allEmbeddings = db.prepare(`SELECT me.*, sm.name as materialName FROM material_embeddings me JOIN study_materials sm ON me.materialId = sm.id WHERE sm.subjectId = ?`).all(subjectId);
    if (allEmbeddings.length === 0) return res.json({ results: [], message: 'No embeddings found. Upload materials to enable semantic search.' });
    const scored = allEmbeddings.map(e => ({ ...e, score: cosineSimilarity(queryEmbedding, JSON.parse(e.embedding)) })).sort((a, b) => b.score - a.score).slice(0, 5);
    res.json({ results: scored.map(r => ({ materialName: r.materialName, chunkText: r.chunkText, score: r.score })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Auto-Summarize Material ──
app.post('/api/study/materials/:id/summarize', async (req, res) => {
  const { aiConfig } = req.body;
  if (!aiConfig?.apiKey) return res.status(401).json({ error: 'API key required' });
  try {
    const material = db.prepare('SELECT name, content FROM study_materials WHERE id = ?').get(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.modelId?.trim() || 'gemini-2.5-flash', messages: [
          { role: 'system', content: 'You are a study summarizer. Output ONLY a concise bullet-point summary in markdown (max 10 bullets using -).' },
          { role: 'user', content: `Summarize this document in 10 key bullet points:\n\n${material.content.substring(0, 25000)}` }
        ], temperature: 0.4
      })
    });
    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    res.json({ success: true, summary: data.choices[0]?.message?.content || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Comparison Table ──
app.post('/api/study/compare', async (req, res) => {
  const { subjectId, topicA, topicB, aiConfig } = req.body;
  if (!subjectId || !topicA || !topicB || !aiConfig?.apiKey) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const context = db.prepare('SELECT content FROM study_materials WHERE subjectId = ?').all(subjectId).map(m => m.content).join('\n').substring(0, 20000);
    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.modelId?.trim() || 'gemini-2.5-flash', messages: [
          { role: 'system', content: 'Generate structured JSON comparison data. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: `Compare "${topicA}" vs "${topicB}" using these materials. Return JSON: {"rows": [{"aspect": "...", "topicA": "...", "topicB": "..."}]}\n\nMaterials:\n${context}` }
        ], response_format: { type: 'json_object' }, temperature: 0.4
      })
    });
    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
    res.json({ success: true, ...JSON.parse(content) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Timeline Generator ──
app.post('/api/study/timeline', async (req, res) => {
  const { subjectId, aiConfig } = req.body;
  if (!subjectId || !aiConfig?.apiKey) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const context = db.prepare('SELECT content FROM study_materials WHERE subjectId = ?').all(subjectId).map(m => m.content).join('\n').substring(0, 20000);
    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.modelId?.trim() || 'gemini-2.5-flash', messages: [
          { role: 'system', content: 'Extract timeline events from study materials. Return ONLY valid JSON.' },
          { role: 'user', content: `Extract all dates, years, and key events. Return JSON: {"events": [{"year": "...", "event": "...", "description": "..."}]}\n\nMaterials:\n${context}` }
        ], response_format: { type: 'json_object' }, temperature: 0.3
      })
    });
    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
    res.json({ success: true, ...JSON.parse(content) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Concept Map Generator ──
app.post('/api/study/conceptmap', async (req, res) => {
  const { subjectId, aiConfig } = req.body;
  if (!subjectId || !aiConfig?.apiKey) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const context = db.prepare('SELECT content FROM study_materials WHERE subjectId = ?').all(subjectId).map(m => m.content).join('\n').substring(0, 20000);
    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.modelId?.trim() || 'gemini-2.5-flash', messages: [
          { role: 'system', content: 'Extract key concepts and their relationships. Return ONLY valid JSON.' },
          { role: 'user', content: `Extract 8-15 key concepts and relationships. Return JSON: {"nodes": [{"id": "concept1", "label": "Concept Name", "description": "brief description"}], "edges": [{"from": "concept1", "to": "concept2", "label": "relationship"}]}\n\nMaterials:\n${context}` }
        ], response_format: { type: 'json_object' }, temperature: 0.4
      })
    });
    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
    res.json({ success: true, ...JSON.parse(content) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Exam Predictor ──
app.post('/api/study/predict-exam', async (req, res) => {
  const { subjectId, aiConfig } = req.body;
  if (!subjectId || !aiConfig?.apiKey) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const context = db.prepare('SELECT content FROM study_materials WHERE subjectId = ?').all(subjectId).map(m => m.content).join('\n').substring(0, 20000);
    const weakCards = db.prepare('SELECT question FROM study_flashcards WHERE subjectId = ? AND difficulty < 1.9').all(subjectId).map(c => c.question).join('\n');
    const baseUrl = aiConfig.baseUrl?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.modelId?.trim() || 'gemini-2.5-flash', messages: [
          { role: 'system', content: 'You are an exam predictor. Analyze study materials and predict likely exam questions. Return ONLY valid JSON.' },
          { role: 'user', content: `Predict 10 exam questions most likely to appear based on the materials. Weight heavily on weak areas.\n\nWeak areas: ${weakCards || 'None identified'}\n\nMaterials:\n${context}\n\nReturn JSON: {"predictions": [{"question": "...", "topic": "...", "likelihood": "High|Medium", "hint": "..."}]}` }
        ], response_format: { type: 'json_object' }, temperature: 0.5
      })
    });
    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
    res.json({ success: true, ...JSON.parse(content) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
