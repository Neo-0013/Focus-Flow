import crypto from 'crypto';
import db from '../config/database.js';
import { getNextDate } from '../utils/helpers.js';

export const getTasks = (req, res) => {
  const ws = req.query.workspace || 'Personal';
  const tasks = db.prepare('SELECT * FROM tasks WHERE workspaceId = ? ORDER BY position ASC').all(ws);
  const subTasks = db.prepare('SELECT * FROM sub_tasks').all();

  const tasksWithSubs = tasks.map(t => ({
    ...t,
    completed: !!t.completed,
    subTasks: subTasks.filter(st => st.taskId === t.id).map(st => ({ ...st, completed: !!st.completed }))
  }));
  res.json(tasksWithSubs);
};

export const createTask = (req, res) => {
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
      importance || 50, urgency || 50, cognitiveCost || 5,
      Array.isArray(dependencyIds) ? JSON.stringify(dependencyIds) : (dependencyIds || '[]')
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
    req.io.emit('taskUpdated', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTask = (req, res) => {
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
    req.io.emit('taskUpdated', finalTask);
    req.io.emit('activityUpdated');
    res.json({ success: true, task: finalTask });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getActivity = (req, res) => {
  const activity = db.prepare('SELECT completedAt FROM task_completions').all();
  res.json(activity);
};

export const deleteTask = (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    req.io.emit('taskDeleted', id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const archiveCompletedTasks = (req, res) => {
  const { workspaceId } = req.body;
  const ws = workspaceId || 'Personal';
  db.prepare('UPDATE tasks SET archived = 1 WHERE completed = 1 AND workspaceId = ?').run(ws);
  res.json({ success: true });
};
