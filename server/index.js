import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

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
  
  // Easy migration for existing goals to have a category (SQLite ignores duplicate column errors if we just try/catch or use pragma, but doing it safely requires checking first. Instead we'll try to add it and ignore if it fails)
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

// Performance: Auto-archive completed tasks older than 30 days
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
      completedAt INTEGER NOT NULL
    )
  `);
} catch(e){}

try { db.exec("ALTER TABLE profile ADD COLUMN daily_goal_minutes INTEGER DEFAULT 120"); } catch(e){}

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    streak INTEGER DEFAULT 0,
    lastCompletedAt INTEGER,
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
    level INTEGER DEFAULT 1
  );
  INSERT OR IGNORE INTO profile (id, xp, level) VALUES (1, 0, 1);
  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    badgeId TEXT NOT NULL UNIQUE,
    unlockedAt INTEGER
  );
`);

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
  const { workspaceId, mode, duration, completedAt } = req.body;
  db.prepare('INSERT INTO focus_sessions (id, workspaceId, mode, duration, completedAt) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), workspaceId || 'Personal', mode, duration, completedAt);
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
app.get('/journal', (req, res) => {
  const { workspace, date } = req.query;
  const entry = db.prepare('SELECT * FROM journal_entries WHERE workspaceId = ? AND date = ?').get(workspace || 'Personal', date);
  res.json(entry || { id: crypto.randomUUID(), workspaceId: workspace || 'Personal', date, content: '' });
});

app.post('/journal', (req, res) => {
  const { id, workspaceId, date, content } = req.body;
  const existing = db.prepare('SELECT id FROM journal_entries WHERE id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE journal_entries SET content = ? WHERE id = ?').run(content, id);
  } else {
    db.prepare('INSERT INTO journal_entries (id, workspaceId, date, content) VALUES (?, ?, ?, ?)').run(id, workspaceId, date, content);
  }
  res.json({ success: true });
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
  const { id, text, priority, dueDate, timeSlot, parentId, subTasks, goalId, workspaceId } = req.body;
  const ws = workspaceId || 'Personal';
  const transaction = db.transaction(() => {
    db.prepare('INSERT INTO tasks (id, text, priority, dueDate, timeSlot, parentId, goalId, workspaceId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, text, priority || 'medium', dueDate || null, timeSlot || null, parentId || null, goalId || null, ws, Date.now()
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
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
      if (completed) {
        db.prepare('INSERT INTO task_completions (id, taskId, completedAt) VALUES (?, ?, ?)').run(crypto.randomUUID(), id, Date.now());
      } else {
        db.prepare('DELETE FROM task_completions WHERE taskId = ?').run(id);
      }
    }

    if (subTasks !== undefined) {
      // Get old subtasks to check for newly completed ones
      const oldSubTasks = db.prepare('SELECT id, completed FROM sub_tasks WHERE taskId = ?').all(id);
      
      // Simple sync: delete old and insert new
      db.prepare('DELETE FROM sub_tasks WHERE taskId = ?').run(id);
      if (subTasks.length > 0) {
        const stmt = db.prepare('INSERT INTO sub_tasks (id, taskId, text, completed, createdAt) VALUES (?, ?, ?, ?, ?)');
        for (const st of subTasks) {
          const stId = st.id || crypto.randomUUID();
          stmt.run(stId, id, st.text, st.completed ? 1 : 0, st.createdAt || Date.now());
          
          // Track subtask completion for heatmap activity
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
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const subTasks = db.prepare('SELECT * FROM sub_tasks WHERE taskId = ?').all(id);
    const result = { ...task, completed: !!task.completed, subTasks: subTasks.map(st => ({ ...st, completed: !!st.completed })) };
    io.emit('taskUpdated', result);
    io.emit('activityUpdated');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
        if (lastDateStr === yesterday.toDateString()) {
           streak += 1; 
        } else {
           streak = 1; 
        }
      } else {
        streak = 1; 
      }
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
    if (fields.length > 0) {
      db.prepare(`UPDATE goals SET ${fields} WHERE id = ?`).run(...values, id);
    }
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
    // 1. Weekly -> Monthly rollup
    const monthlyGoals = db.prepare("SELECT id FROM goals WHERE type = 'monthly'").all();
    for (const month of monthlyGoals) {
      const weeklyStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as completed FROM goals WHERE parentId = ?").get(month.id);
      const progress = weeklyStats.total > 0 ? weeklyStats.completed / weeklyStats.total : 0;
      db.prepare("UPDATE goals SET autoProgress = ? WHERE id = ?").run(progress, month.id);
    }

    // 2. Monthly -> Yearly rollup
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROFILE / RPG ENDPOINTS ---
app.get('/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile);
});

app.patch('/profile/xp', (req, res) => {
  const { xp } = req.body;
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const newXp = profile.xp + xp;
  
  // XP curve: Lv2=50, Lv3=200, Lv4=450... formula: Level = floor(sqrt(XP/50)) + 1
  const calcLevel = Math.floor(Math.sqrt(newXp / 50)) + 1;
  const leveledUp = calcLevel > profile.level;
  
  db.prepare('UPDATE profile SET xp = ?, level = ? WHERE id = 1').run(newXp, calcLevel);
  const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  
  io.emit('profileUpdated', updated);
  res.json({ profile: updated, leveledUp });
});

// 5-Year Durability: Backup & Archive Endpoints
app.get('/backup', (req, res) => {
  const tables = ['tasks', 'habits', 'goals', 'journal_entries', 'achievements', 'profile', 'timer_presets', 'focus_sessions'];
  const backup = {};
  try {
    tables.forEach(table => {
      backup[table] = db.prepare(`SELECT * FROM ${table}`).all();
    });
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
            data[table].forEach(row => {
              const values = columns.map(col => row[col]);
              stmt.run(...values);
            });
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

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
