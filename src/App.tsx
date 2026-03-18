/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Plus, CheckCircle2, Circle, Trash2, Settings, 
  Clock, LayoutList, Coffee, Zap, BarChart3, Volume2, Upload, ChevronDown,
  ChevronLeft, ChevronRight, X, Trophy, Calendar, ArrowRight, Home, ListTodo, 
  Activity, ChevronUp, Bell, GraduationCap, Pencil, Check, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TimerMode = 'work' | 'shortBreak' | 'longBreak';
type Priority = 'low' | 'medium' | 'high';
type CalendarView = 'day' | 'week' | 'month';
type AppView = 'timer' | 'tasks' | 'calendar' | 'dashboard' | 'goals';

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  parentId: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  createdAt: number;
  dueDate?: string;
  parentId?: string;
  subTasks: SubTask[];
  goalId?: string;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  year: number;
  targetCount: number;
  tasks: string[];
  color: string;
}

interface DailyStat {
  date: string;
  sessions: number;
  focusMinutes: number;
  tasksCompleted: number;
  subTasksCompleted: number;
}

interface SoundOption {
  id: string;
  name: string;
  url: string;
}

const DEFAULT_SOUNDS: SoundOption[] = [
  { id: 'bell', name: 'Zen Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
  { id: 'digital', name: 'Digital Beep', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'crystal', name: 'Crystal Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
];

interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
}

interface Toast {
  id: string;
  title: string;
  body: string;
}

const DEFAULT_TIMER_SETTINGS: TimerSettings = { work: 25, shortBreak: 5, longBreak: 15 };

const MODES_META: Record<TimerMode, { label: string; icon: React.ReactNode; color: string }> = {
  work: { label: 'Focus', icon: <Zap className="w-4 h-4" />, color: 'text-emerald-400' },
  shortBreak: { label: 'Short Break', icon: <Coffee className="w-4 h-4" />, color: 'text-blue-400' },
  longBreak: { label: 'Long Break', icon: <Clock className="w-4 h-4" />, color: 'text-indigo-400' },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const HEATMAP_COLORS = ['#0d1117', '#0e4429', '#006d32', '#26a641', '#39d353'];

const GOAL_CATEGORIES = ['Programming', 'Languages', 'Books', 'Courses', 'Health', 'Finance', 'Other'];
const GOAL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

function getDueDateLabel(dueDate: string | undefined, today: string): { label: string; colorClass: string } | null {
  if (!dueDate) return null;
  const d = new Date(dueDate + 'T00:00:00');
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (dueDate < today) return { label, colorClass: 'text-red-400' };
  if (dueDate === today) return { label, colorClass: 'text-amber-400' };
  return { label, colorClass: 'text-white/40' };
}

function getTaskStatusColor(task: Task, today: string): string {
  if (task.completed) return 'bg-emerald-500/20 text-emerald-400';
  if (task.dueDate && task.dueDate < today) return 'bg-red-500/20 text-red-400';
  return 'bg-amber-500/20 text-amber-400';
}

export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER_SETTINGS.work * 60);
  const [isActive, setIsActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('onyx_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('onyx_goals');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [stats, setStats] = useState<DailyStat[]>(() => {
    const saved = localStorage.getItem('onyx_stats');
    return saved ? JSON.parse(saved) : [];
  });
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    try {
      const saved = localStorage.getItem('onyx_timer_settings');
      return saved ? JSON.parse(saved) : DEFAULT_TIMER_SETTINGS;
    } catch { return DEFAULT_TIMER_SETTINGS; }
  });
  const modes = useMemo(() => ({
    work: { ...MODES_META.work, duration: timerSettings.work * 60 },
    shortBreak: { ...MODES_META.shortBreak, duration: timerSettings.shortBreak * 60 },
    longBreak: { ...MODES_META.longBreak, duration: timerSettings.longBreak * 60 },
  }), [timerSettings]);
  const [selectedSound, setSelectedSound] = useState<SoundOption>(DEFAULT_SOUNDS[0]);
  const [customSounds, setCustomSounds] = useState<SoundOption[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimerDatePicker, setShowTimerDatePicker] = useState(false);
  const [showTasksDatePicker, setShowTasksDatePicker] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubTaskText, setNewSubTaskText] = useState<Record<string, string>>({});
  const [dashboardNewTaskText, setDashboardNewTaskText] = useState('');
  const [dashboardNewTaskPriority, setDashboardNewTaskPriority] = useState<Priority>('medium');
  const [dashboardNewSubTasks, setDashboardNewSubTasks] = useState<string[]>([]);
  const [dashboardNewSubTask, setDashboardNewSubTask] = useState('');
  const [dashboardDueDate, setDashboardDueDate] = useState('');
  const [showDashboardDatePicker, setShowDashboardDatePicker] = useState(false);
  const [timerNewSubTasks, setTimerNewSubTasks] = useState<string[]>([]);
  const [timerNewSubTask, setTimerNewSubTask] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
  const [editingSubTaskText, setEditingSubTaskText] = useState('');
  const [calendarAddingDate, setCalendarAddingDate] = useState<string | null>(null);
  const [calendarNewTaskText, setCalendarNewTaskText] = useState('');
  // Dashboard active task editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  // Goals state
  const [goalYear, setGoalYear] = useState(new Date().getFullYear());
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState(GOAL_CATEGORIES[0]);
  const [newGoalTarget, setNewGoalTarget] = useState(10);
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLORS[0]);
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentNotifsRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => { localStorage.setItem('onyx_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('onyx_stats', JSON.stringify(stats)); }, [stats]);
  useEffect(() => { localStorage.setItem('onyx_timer_settings', JSON.stringify(timerSettings)); }, [timerSettings]);
  useEffect(() => { localStorage.setItem('onyx_goals', JSON.stringify(goals)); }, [goals]);
  useEffect(() => { const interval = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(interval); }, []);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    setNotifPermission(Notification.permission);
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notify = useCallback((key: string, title: string, body: string) => {
    if (sentNotifsRef.current.has(key)) return;
    sentNotifsRef.current.add(key);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' });
    } else {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, title, body }]);
      setTimeout(() => dismissToast(id), 5000);
    }
  }, [dismissToast]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    tasks.forEach(task => {
      if (task.completed || !task.dueDate) return;
      if (task.dueDate === today) {
        notify(`due-today-${task.id}-${today}`, 'Task due today', `"${task.text}" is due today.`);
      } else if (task.dueDate < today) {
        notify(`overdue-${task.id}-${today}`, 'Overdue task', `"${task.text}" is overdue.`);
      }
    });
  }, [tasks, notify]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = useCallback(() => { setIsActive(false); setTimeLeft(modes[mode].duration); }, [mode, modes]);

  const updateStats = useCallback((focusMinutes = 0, sessionCompleted = false, taskCompleted = false, subTaskCompleted = false) => {
    const today = new Date().toISOString().split('T')[0];
    setStats(prev => {
      const existing = prev.find(s => s.date === today);
      if (existing) {
        return prev.map(s => s.date === today ? {
          ...s, sessions: s.sessions + (sessionCompleted ? 1 : 0),
          focusMinutes: s.focusMinutes + focusMinutes,
          tasksCompleted: s.tasksCompleted + (taskCompleted ? 1 : 0),
          subTasksCompleted: s.subTasksCompleted + (subTaskCompleted ? 1 : 0)
        } : s);
      }
      return [...prev, { date: today, sessions: sessionCompleted ? 1 : 0, focusMinutes, tasksCompleted: taskCompleted ? 1 : 0, subTasksCompleted: subTaskCompleted ? 1 : 0 }];
    });
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (audioRef.current) audioRef.current.play().catch(() => {});
      if (mode === 'work') updateStats(modes.work.duration / 60, true);
      const today = new Date().toISOString().split('T')[0];
      const modeLabels: Record<TimerMode, string> = { work: 'Focus session complete', shortBreak: 'Short break over', longBreak: 'Long break over' };
      const modeBodies: Record<TimerMode, string> = { work: 'Great work! Time for a break.', shortBreak: 'Break is over — back to focus!', longBreak: 'Long break done — ready to focus?' };
      notify(`timer-end-${mode}-${today}`, modeLabels[mode], modeBodies[mode]);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, timeLeft, mode, updateStats, notify]);

  useEffect(() => { resetTimer(); }, [mode, resetTimer]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(), text: newTaskText.trim(), completed: false,
      priority: newTaskPriority, createdAt: Date.now(), dueDate: newTaskDueDate || undefined, subTasks: [],
    };
    setTasks([newTask, ...tasks]);
    setNewTaskText(''); setNewTaskPriority('medium'); setNewTaskDueDate('');
  };

  const addTaskForDate = (date: string) => {
    const newTask: Task = { id: crypto.randomUUID(), text: 'New Task', completed: false, priority: 'medium', createdAt: Date.now(), dueDate: date, subTasks: [] };
    setTasks([newTask, ...tasks]);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task && !task.completed) updateStats(0, false, true);
      return prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    });
  };

  const deleteTask = (id: string) => { setTasks(tasks.filter(t => t.id !== id)); };

  const updateTaskDueDate = (id: string, dueDate: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, dueDate: dueDate || undefined } : t));
  };

  const updateTaskPriority = (id: string, priority: Priority) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
  };

  const reorderTask = (id: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const activeTasks = prev.filter(t => !t.completed);
      const idx = activeTasks.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const newActive = [...activeTasks];
      if (direction === 'up' && idx > 0) [newActive[idx], newActive[idx - 1]] = [newActive[idx - 1], newActive[idx]];
      else if (direction === 'down' && idx < newActive.length - 1) [newActive[idx], newActive[idx + 1]] = [newActive[idx + 1], newActive[idx]];
      const completed = prev.filter(t => t.completed);
      return [...newActive, ...completed];
    });
  };

  const saveTaskEdit = (id: string) => {
    if (!editingTaskText.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text: editingTaskText.trim() } : t));
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => { const newSet = new Set(prev); newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId); return newSet; });
  };

  const addSubTask = (taskId: string) => {
    const text = newSubTaskText[taskId]?.trim();
    if (!text) return;
    const newSubTask: SubTask = { id: crypto.randomUUID(), text, completed: false, createdAt: Date.now(), parentId: taskId };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subTasks: [...t.subTasks, newSubTask] } : t));
    setNewSubTaskText(prev => ({ ...prev, [taskId]: '' }));
  };

  const toggleSubTask = (taskId: string, subTaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subTask = t.subTasks.find(st => st.id === subTaskId);
      if (subTask && !subTask.completed) updateStats(0, false, false, true);
      return { ...t, subTasks: t.subTasks.map(st => st.id === subTaskId ? { ...st, completed: !st.completed } : st) };
    }));
  };

  const deleteSubTask = (taskId: string, subTaskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subTasks: t.subTasks.filter(st => st.id !== subTaskId) } : t));
  };

  const editSubTask = (taskId: string, subTaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const subTask = task?.subTasks.find(st => st.id === subTaskId);
    if (subTask) { setEditingSubTaskId(subTaskId); setEditingSubTaskText(subTask.text); }
  };

  const saveSubTaskEdit = (taskId: string, subTaskId: string) => {
    if (!editingSubTaskText.trim()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subTasks: t.subTasks.map(st => st.id === subTaskId ? { ...st, text: editingSubTaskText.trim() } : st) } : t));
    setEditingSubTaskId(null); setEditingSubTaskText('');
  };

  const reorderSubTask = (taskId: string, subTaskId: string, direction: 'up' | 'down') => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subTasks = [...t.subTasks];
      const index = subTasks.findIndex(st => st.id === subTaskId);
      if (index === -1) return t;
      if (direction === 'up' && index > 0) [subTasks[index], subTasks[index - 1]] = [subTasks[index - 1], subTasks[index]];
      else if (direction === 'down' && index < subTasks.length - 1) [subTasks[index], subTasks[index + 1]] = [subTasks[index + 1], subTasks[index]];
      return { ...t, subTasks };
    }));
  };

  const getTaskProgress = (task: Task) => {
    const total = task.subTasks.length;
    const completed = task.subTasks.filter(st => st.completed).length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  // Goals helpers
  const addGoal = () => {
    if (!newGoalTitle.trim()) return;
    const goal: Goal = { id: crypto.randomUUID(), title: newGoalTitle.trim(), category: newGoalCategory, year: goalYear, targetCount: newGoalTarget, tasks: [], color: newGoalColor };
    setGoals(prev => [...prev, goal]);
    setNewGoalTitle(''); setNewGoalTarget(10); setShowAddGoal(false);
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    setTasks(prev => prev.map(t => t.goalId === id ? { ...t, goalId: undefined } : t));
  };

  const linkTaskToGoal = (taskId: string, goalId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, goalId } : t));
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: g.tasks.includes(taskId) ? g.tasks : [...g.tasks, taskId] } : g));
    setLinkingGoalId(null);
  };

  const unlinkTaskFromGoal = (taskId: string, goalId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, goalId: undefined } : t));
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: g.tasks.filter(id => id !== taskId) } : g));
  };

  const getGoalProgress = (goal: Goal) => {
    const linked = tasks.filter(t => t.goalId === goal.id);
    const completed = linked.filter(t => t.completed).length;
    const pct = goal.targetCount > 0 ? Math.min(100, Math.round((completed / goal.targetCount) * 100)) : 0;
    return { completed, total: linked.length, target: goal.targetCount, pct };
  };

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSound = { id: `custom-${Date.now()}`, name: file.name, url };
      setCustomSounds(prev => [...prev, newSound]);
      setSelectedSound(newSound);
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const progress = (1 - timeLeft / modes[mode].duration) * 100;

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const stat = stats.find(s => s.date === dateStr);
      const activities = (stat?.sessions || 0) + (stat?.tasksCompleted || 0) + (stat?.subTasksCompleted || 0);
      return { name: d.toLocaleDateString(undefined, { weekday: 'short' }), minutes: stat?.focusMinutes || 0, tasks: activities };
    }).reverse();
  }, [stats]);

  const totalFocusTime = stats.reduce((acc, s) => acc + s.focusMinutes, 0);
  const totalTasks = stats.reduce((acc, s) => acc + s.tasksCompleted, 0);
  const totalSessions = stats.reduce((acc, s) => acc + s.sessions, 0);
  const totalSubTasks = stats.reduce((acc, s) => acc + s.subTasksCompleted, 0);

  const heatmapData = useMemo(() => {
    const tasksByDate: Record<string, number> = {};
    tasks.forEach(task => {
      const dateKey = task.dueDate || new Date(task.createdAt).toISOString().split('T')[0];
      if (task.completed) tasksByDate[dateKey] = (tasksByDate[dateKey] || 0) + 1;
      task.subTasks.forEach(st => { if (st.completed) tasksByDate[dateKey] = (tasksByDate[dateKey] || 0) + 1; });
    });
    const data: { date: string; count: number; level: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const stat = stats.find(s => s.date === dateStr);
      const count = (stat?.sessions || 0) + (tasksByDate[dateStr] || 0);
      let level = 0;
      if (count >= 1) level = 1; if (count >= 3) level = 2; if (count >= 5) level = 3; if (count >= 8) level = 4;
      data.push({ date: dateStr, count, level });
    }
    return data;
  }, [stats, tasks]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate(), startingDay = firstDay.getDay();
    const days: { date: string; day: number; isCurrentMonth: boolean; tasks: Task[] }[] = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d.toISOString().split('T')[0], day: prevMonthLastDay - i, isCurrentMonth: false, tasks: [] });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i), dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, day: i, isCurrentMonth: true, tasks: tasks.filter(t => t.dueDate === dateStr) });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d.toISOString().split('T')[0], day: i, isCurrentMonth: false, tasks: [] });
    }
    return days;
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarDate);
    if (calendarView === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    else if (calendarView === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCalendarDate(newDate);
  };

  const goToToday = () => { setCalendarDate(new Date()); };
  const getToday = () => new Date().toISOString().split('T')[0];

  const handleDashboardAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboardNewTaskText.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(), text: dashboardNewTaskText.trim(), completed: false,
      priority: dashboardNewTaskPriority, createdAt: Date.now(), dueDate: dashboardDueDate || undefined,
      subTasks: dashboardNewSubTasks.filter(st => st.trim()).map(st => ({ id: crypto.randomUUID(), text: st.trim(), completed: false, createdAt: Date.now(), parentId: '' })),
    };
    setTasks([newTask, ...tasks]);
    if (dashboardDueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (dashboardDueDate === today) notify(`due-today-${newTask.id}-${today}`, 'Task due today', `"${newTask.text}" is due today.`);
      else if (dashboardDueDate < today) notify(`overdue-${newTask.id}-${today}`, 'Overdue task', `"${newTask.text}" is overdue.`);
    }
    setDashboardNewTaskText(''); setDashboardNewTaskPriority('medium'); setDashboardNewSubTasks([]); setDashboardDueDate('');
  };

  const addDashboardSubTask = () => {
    if (dashboardNewSubTask.trim()) { setDashboardNewSubTasks([...dashboardNewSubTasks, dashboardNewSubTask.trim()]); setDashboardNewSubTask(''); }
  };

  const removeDashboardSubTask = (index: number) => { setDashboardNewSubTasks(dashboardNewSubTasks.filter((_, i) => i !== index)); };

  const handleCalendarAddTask = (date: string) => {
    if (!calendarNewTaskText.trim()) return;
    const newTask: Task = { id: crypto.randomUUID(), text: calendarNewTaskText.trim(), completed: false, priority: 'medium', createdAt: Date.now(), dueDate: date, subTasks: [] };
    setTasks(prev => [newTask, ...prev]);
    setCalendarNewTaskText(''); setCalendarAddingDate(null);
  };

  const addTimerSubTask = () => {
    if (timerNewSubTask.trim()) { setTimerNewSubTasks([...timerNewSubTasks, timerNewSubTask.trim()]); setTimerNewSubTask(''); }
  };

  const removeTimerSubTask = (index: number) => { setTimerNewSubTasks(timerNewSubTasks.filter((_, i) => i !== index)); };

  const NAV_ITEMS = [
    { id: 'dashboard' as AppView, icon: Home, label: 'Dashboard' },
    { id: 'timer' as AppView, icon: Zap, label: 'Timer' },
    { id: 'tasks' as AppView, icon: LayoutList, label: 'Tasks' },
    { id: 'calendar' as AppView, icon: Calendar, label: 'Calendar' },
    { id: 'goals' as AppView, icon: GraduationCap, label: 'Goals' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white/20 flex">
      <audio ref={audioRef} src={selectedSound.url} />

      {/* Left Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-14 bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-4 z-40">
        {/* Logo */}
        <button onClick={() => setView('dashboard')} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mb-6 hover:scale-105 transition-transform" aria-label="Dashboard">
          <div className="w-4 h-4 bg-black rounded-full" />
        </button>

        {/* Nav items */}
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={cn("relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group", view === item.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white hover:bg-white/5")}
              title={item.label}>
              <item.icon className="w-5 h-5" />
              {view === item.id && <motion.div layoutId="sidebarActive" className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              <span className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Settings at bottom */}
        <button onClick={() => setShowSettings(true)} className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all" title="Settings">
          <Settings className="w-5 h-5" />
          {notifPermission === 'granted' && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
        </button>
      </nav>

      {/* Main content */}
      <div className="flex-1 ml-14 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">

          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {/* Quick Add Task */}
                <div className="floating-card p-6">
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-4"><Plus className="w-5 h-5 text-white/40" />Quick Add Task</h3>
                  <form onSubmit={handleDashboardAddTask} className="space-y-4">
                    <div className="relative">
                      <input type="text" value={dashboardNewTaskText} onChange={e => setDashboardNewTaskText(e.target.value)} placeholder="What needs to be done?" className="task-input w-full" />
                      <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={dashboardNewSubTask} onChange={e => setDashboardNewSubTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDashboardSubTask())} placeholder="Add sub-tasks (press Enter)" className="task-input flex-1" />
                        <button type="button" onClick={addDashboardSubTask} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl"><Plus className="w-4 h-4" /></button>
                      </div>
                      {dashboardNewSubTasks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {dashboardNewSubTasks.map((st, i) => (<motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-sm">{st}<button type="button" onClick={() => removeDashboardSubTask(i)} className="hover:text-red-400"><X className="w-3 h-3" /></button></motion.span>))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button key={p} type="button" onClick={() => setDashboardNewTaskPriority(p)} className={cn("flex-1 py-2 rounded-xl text-[10px] uppercase font-bold border", dashboardNewTaskPriority === p ? PRIORITY_COLORS[p] : "bg-white/5 text-white/20")}>{p}</button>
                      ))}
                      <div className="relative">
                        <button type="button" onClick={() => setShowDashboardDatePicker(v => !v)}
                          className={cn("p-2.5 rounded-xl border transition-all flex items-center gap-1.5", dashboardDueDate ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10")}
                          title={dashboardDueDate ? `Due: ${new Date(dashboardDueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Set due date'}>
                          <Calendar className="w-4 h-4" />
                          {dashboardDueDate && <span className="text-[10px] font-medium">{new Date(dashboardDueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                        </button>
                        {showDashboardDatePicker && (
                          <div className="absolute bottom-full mb-2 right-0 z-20 p-3 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl">
                            <input type="date" value={dashboardDueDate} onChange={e => { setDashboardDueDate(e.target.value); setShowDashboardDatePicker(false); }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" autoFocus />
                            {dashboardDueDate && <button type="button" onClick={() => { setDashboardDueDate(''); setShowDashboardDatePicker(false); }} className="mt-2 w-full text-[10px] text-white/40 hover:text-red-400 text-center">Clear date</button>}
                          </div>
                        )}
                      </div>
                      <button type="submit" className="quick-add-btn">Add Task</button>
                    </div>
                  </form>
                </div>

                {/* Activity Heatmap */}
                <div className="floating-card p-6">
                  <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-medium flex items-center gap-2"><Activity className="w-5 h-5 text-white/40" />Activity Heatmap</h3><span className="text-xs text-white/40">Last 365 days</span></div>
                  <div className="overflow-x-auto pb-4">
                    <div className="flex gap-1 min-w-max">
                      {Array.from({ length: 53 }, (_, wi) => (<div key={wi} className="flex flex-col gap-1">
                        {heatmapData.slice(wi * 7, (wi + 1) * 7).map((day, di) => (<div key={di} className="w-3 h-3 rounded-sm" style={{ backgroundColor: HEATMAP_COLORS[day.level] }} title={`${day.date}: ${day.count} activities`} />))}
                      </div>))}
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-[10px] text-white/40"><span>Less</span>{HEATMAP_COLORS.map((c, i) => (<div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />))}<span>More</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="grid grid-cols-2 gap-4">
                    {[{ icon: Zap, color: 'text-emerald-400', label: 'Total Focus', value: `${totalFocusTime}m` },{ icon: CheckCircle2, color: 'text-blue-400', label: 'Tasks Done', value: totalTasks },{ icon: Trophy, color: 'text-indigo-400', label: 'Sessions', value: totalSessions },{ icon: ListTodo, color: 'text-amber-400', label: 'Sub-tasks', value: totalSubTasks }].map(item => (
                      <div key={item.label} className="stat-card">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4"><item.icon className={`w-6 h-6 ${item.color}`} /></div>
                        <h3 className="text-white/40 text-xs uppercase tracking-widest mb-1">{item.label}</h3><p className="text-3xl font-bold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="floating-card p-6">
                    <h3 className="text-lg font-medium flex items-center gap-2 mb-6"><BarChart3 className="w-5 h-5 text-white/40" />Weekly Activity</h3>
                    <div className="h-[200px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10 }} dy={10} /><YAxis hide /><Bar dataKey="tasks" name="Activities" radius={[4, 4, 0, 0]} barSize={20}>{chartData.map((_, i) => (<Cell key={i} fill="#34d399" fillOpacity={0.8} />))}</Bar></BarChart></ResponsiveContainer></div>
                  </div>
                </div>

                {/* Active Tasks - editable */}
                <div className="floating-card p-6">
                  <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-medium flex items-center gap-2"><LayoutList className="w-5 h-5 text-white/40" />Active Tasks</h3><button onClick={() => setView('tasks')} className="text-sm text-white/40 hover:text-white">View All <ArrowRight className="w-4 h-4 inline" /></button></div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {tasks.filter(t => !t.completed).slice(0, 8).map((task, idx, arr) => {
                      const prog = getTaskProgress(task);
                      const isEditing = editingTaskId === task.id;
                      return (
                        <div key={task.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl group">
                          <button onClick={() => toggleTask(task.id)} className="shrink-0"><Circle className="w-4 h-4 text-white/40 hover:text-white" /></button>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input type="text" value={editingTaskText} onChange={e => setEditingTaskText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveTaskEdit(task.id); if (e.key === 'Escape') { setEditingTaskId(null); } }}
                                onBlur={() => saveTaskEdit(task.id)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white" autoFocus />
                            ) : (
                              <span className="text-sm text-white/80 block truncate">{task.text}</span>
                            )}
                            {(() => { const dl = getDueDateLabel(task.dueDate, getToday()); return dl ? <span className={cn("text-[10px]", dl.colorClass)}>{dl.label}</span> : null; })()}
                            {prog.total > 0 && (<div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1 bg-white/10 rounded-full"><div className="h-full bg-emerald-400" style={{ width: `${prog.percentage}%` }} /></div><span className="text-[10px] text-white/40">{prog.percentage}%</span></div>)}
                          </div>
                          {/* Priority cycle */}
                          <button onClick={() => updateTaskPriority(task.id, task.priority === 'low' ? 'medium' : task.priority === 'medium' ? 'high' : 'low')}
                            className={cn("px-2 py-0.5 rounded text-[9px] uppercase font-bold border shrink-0 opacity-60 group-hover:opacity-100 transition-opacity", PRIORITY_COLORS[task.priority])} title="Click to change priority">
                            {task.priority}
                          </button>
                          {/* Edit */}
                          <button onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }}
                            className="p-1 text-white/30 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Edit task">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {/* Reorder */}
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => reorderTask(task.id, 'up')} disabled={idx === 0} className="p-0.5 hover:text-white disabled:opacity-20" title="Move up"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => reorderTask(task.id, 'down')} disabled={idx === arr.length - 1} className="p-0.5 hover:text-white disabled:opacity-20" title="Move down"><ArrowDown className="w-3 h-3" /></button>
                          </div>
                          <button onClick={() => deleteTask(task.id)} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })}
                    {tasks.filter(t => !t.completed).length === 0 && <div className="text-center py-8 text-white/30"><p>No active tasks</p></div>}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'timer' && (
              <motion.div key="timer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <section className="lg:col-span-7 flex flex-col items-center">
                  <div className="w-full timer-card">
                    <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full rounded-b-[40px]"><motion.div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} /></div>
                    <div className="flex justify-center gap-2 mb-12">
                      {(Object.keys(modes) as TimerMode[]).map(m => (<button key={m} onClick={() => setMode(m)} className={cn("px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2", mode === m ? 'bg-white text-black' : 'text-white/40 hover:text-white/70 hover:bg-white/5')}>{modes[m].icon}{modes[m].label}</button>))}
                    </div>
                    <div className="text-center mb-12">
                      <motion.div key={timeLeft} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-8xl md:text-[120px] font-mono font-light tracking-tighter timer-glow">{formatTime(timeLeft)}</motion.div>
                      <p className={cn("text-sm uppercase tracking-[0.2em] font-medium mt-4", modes[mode].color)}>{isActive ? 'Deep Focus' : 'Ready to start?'}</p>
                    </div>
                    <div className="flex items-center justify-center gap-6">
                      <button onClick={resetTimer} className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"><RotateCcw className="w-6 h-6" /></button>
                      <button onClick={toggleTimer} className="w-20 h-20 rounded-3xl bg-white text-black flex items-center justify-center hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.15)]">{isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}</button>
                      <div className="w-14 h-14" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full mt-8">
                    {[{ label: 'Sessions', value: totalSessions },{ label: 'Focus Time', value: `${totalFocusTime}m` },{ label: 'Tasks', value: totalTasks }].map(s => (<div key={s.label} className="stat-card"><p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{s.label}</p><p className="text-lg font-semibold">{s.value}</p></div>))}
                  </div>
                </section>
                <section className="lg:col-span-5 space-y-4">
                  <div className="floating-card p-4">
                    <div className="flex items-center gap-2 mb-3"><Plus className="w-4 h-4 text-white/40" /><span className="text-sm font-medium">Quick Add Task</span></div>
                    <form onSubmit={e => { e.preventDefault(); if (newTaskText.trim()) { const newTask: Task = { id: crypto.randomUUID(), text: newTaskText.trim(), completed: false, priority: newTaskPriority, createdAt: Date.now(), dueDate: newTaskDueDate || undefined, subTasks: timerNewSubTasks.filter(st => st.trim()).map(st => ({ id: crypto.randomUUID(), text: st.trim(), completed: false, createdAt: Date.now(), parentId: '' })) }; setTasks([newTask, ...tasks]); setNewTaskText(''); setNewTaskPriority('medium'); setNewTaskDueDate(''); setTimerNewSubTasks([]); }}} className="space-y-2">
                      <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Add a task..." className="task-input w-full" />
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input type="text" value={timerNewSubTask} onChange={e => setTimerNewSubTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTimerSubTask())} placeholder="Add sub-tasks (press Enter)" className="task-input flex-1 text-xs" />
                          <button type="button" onClick={addTimerSubTask} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl"><Plus className="w-4 h-4" /></button>
                        </div>
                        {timerNewSubTasks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {timerNewSubTasks.map((st, i) => (<motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-xs">{st}<button type="button" onClick={() => removeTimerSubTask(i)} className="hover:text-red-400"><X className="w-3 h-3" /></button></motion.span>))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as Priority)} className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white/60">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                        <button type="button" onClick={() => setShowTimerDatePicker(!showTimerDatePicker)} className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /></button>
                        <button type="submit" className="quick-add-btn">Add</button>
                      </div>
                      {showTimerDatePicker && (
                        <div className="p-2 bg-[#1a1a1a] border border-white/10 rounded-xl">
                          <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-full" />
                        </div>
                      )}
                    </form>
                  </div>
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><LayoutList className="w-5 h-5 text-white/40" /><h2 className="text-lg font-medium">Active Tasks</h2></div><button onClick={() => setView('tasks')} className="text-sm text-white/40 hover:text-white">View All</button></div>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    <AnimatePresence>
                      {tasks.filter(t => !t.completed).slice(0, 5).map(task => {
                        const prog = getTaskProgress(task);
                        const isExpanded = expandedTasks.has(task.id);
                        const hasSubTasks = task.subTasks.length > 0;
                        return (<motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="floating-card p-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleTask(task.id)}>{task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-white/40" />}</button>
                            <div className="flex-1 min-w-0">
                              <span className={cn("text-sm block truncate", task.completed ? 'text-white/30 line-through' : 'text-white/80')}>{task.text}</span>
                              {(() => { const dl = getDueDateLabel(task.dueDate, getToday()); return dl ? <span className={cn("text-[10px] block", dl.colorClass)}>{dl.label}</span> : null; })()}
                              {hasSubTasks && (<div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1 bg-white/10 rounded-full"><div className="h-full bg-emerald-400" style={{ width: `${prog.percentage}%` }} /></div><span className="text-[10px] text-white/40">{prog.percentage}%</span></div>)}
                            </div>
                            {hasSubTasks && <button onClick={() => toggleExpanded(task.id)} className="p-1 hover:bg-white/10 rounded">{isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}</button>}
                            <button onClick={() => deleteTask(task.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <AnimatePresence>{isExpanded && hasSubTasks && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-7 mt-2 space-y-2">
                            {task.subTasks.map((st, idx) => (<div key={st.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg group">
                              <button onClick={() => toggleSubTask(task.id, st.id)}>{st.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}</button>
                              {editingSubTaskId === st.id ? (<input type="text" value={editingSubTaskText} onChange={e => setEditingSubTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveSubTaskEdit(task.id, st.id)} onBlur={() => saveSubTaskEdit(task.id, st.id)} className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs" autoFocus />) : (<span className={cn("text-xs flex-1", st.completed ? 'text-white/30 line-through' : 'text-white/70')}>{st.text}</span>)}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => reorderSubTask(task.id, st.id, 'up')} disabled={idx === 0} className="p-1 hover:text-white disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                <button onClick={() => reorderSubTask(task.id, st.id, 'down')} disabled={idx === task.subTasks.length - 1} className="p-1 hover:text-white disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                                <button onClick={() => editSubTask(task.id, st.id)} className="p-1 hover:text-blue-400"><Settings className="w-3 h-3" /></button>
                                <button onClick={() => deleteSubTask(task.id, st.id)} className="p-1 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>))}
                            <div className="flex gap-2"><input type="text" value={newSubTaskText[task.id] || ''} onChange={e => setNewSubTaskText(prev => ({ ...prev, [task.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSubTask(task.id)} placeholder="Add sub-task..." className="flex-1 bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-xs" /><button onClick={() => addSubTask(task.id)} className="p-1.5 bg-white/10 rounded-lg"><Plus className="w-3 h-3" /></button></div>
                          </motion.div>)}</AnimatePresence>
                        </motion.div>);
                      })}
                    </AnimatePresence>
                  </div>
                </section>
              </motion.div>
            )}

            {view === 'tasks' && (
              <motion.div key="tasks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center gap-2 mb-6"><LayoutList className="w-5 h-5 text-white/40" /><h2 className="text-xl font-medium">Tasks</h2><span className="text-sm text-white/40">({tasks.filter(t => !t.completed).length} active)</span></div>
                <form onSubmit={addTask} className="space-y-3">
                  <div className="relative">
                    <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Add a new task..." className="task-input w-full" />
                    <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowTasksDatePicker(!showTasksDatePicker)} className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-left text-white/60 flex items-center justify-between">
                      <span>{newTaskDueDate ? new Date(newTaskDueDate).toLocaleDateString() : 'Select date'}</span><Calendar className="w-4 h-4" />
                    </button>
                    {showTasksDatePicker && (
                      <div className="absolute z-50 mt-1 p-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl">
                        <input type="date" value={newTaskDueDate} onChange={e => { setNewTaskDueDate(e.target.value); setShowTasksDatePicker(false); }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>
                    )}
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (<button key={p} type="button" onClick={() => setNewTaskPriority(p)} className={cn("flex-1 py-2 rounded-xl text-[10px] uppercase font-bold border", newTaskPriority === p ? PRIORITY_COLORS[p] : "bg-white/5 text-white/20")}>{p}</button>))}
                  </div>
                </form>
                <div className="space-y-3">
                  <AnimatePresence>
                    {tasks.length === 0 ? (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 floating-card">No tasks yet.</motion.div>) : (
                      tasks.sort((a, b) => { const p = { high: 3, medium: 2, low: 1 }; return p[b.priority] - p[a.priority]; }).map(task => {
                        const prog = getTaskProgress(task), isExpanded = expandedTasks.has(task.id), hasSubTasks = task.subTasks.length > 0;
                        return (<motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="group">
                          <div className="flex items-center gap-4 p-4 floating-card">
                            <button onClick={() => toggleTask(task.id)}>{task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-white/40" />}</button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase font-bold border", PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                                {(() => { const dl = getDueDateLabel(task.dueDate, getToday()); return dl ? <span className={cn("text-[10px]", dl.colorClass)}>{dl.label}</span> : null; })()}
                              </div>
                              <span className={cn("text-sm block truncate", task.completed ? 'text-white/30 line-through' : 'text-white/80')}>{task.text}</span>
                              {hasSubTasks && (<div className="mt-2"><div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>Sub-tasks</span><span>{prog.completed}/{prog.total} ({prog.percentage}%)</span></div><div className="h-1 bg-white/10 rounded-full overflow-hidden"><motion.div className="h-full bg-emerald-400" initial={{ width: 0 }} animate={{ width: `${prog.percentage}%` }} /></div></div>)}
                              <input type="date" value={task.dueDate || ''} onChange={e => updateTaskDueDate(task.id, e.target.value)} className="mt-1 bg-transparent border-0 text-[10px] text-white/30 hover:text-white/60 cursor-pointer p-0 w-auto" title="Set due date" />
                            </div>
                            <button onClick={() => toggleExpanded(task.id)} className="p-2 hover:bg-white/10 rounded-lg">{isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}</button>
                            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <AnimatePresence>{isExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-11 mt-2 space-y-2">
                            {task.subTasks.map((st, idx) => (<div key={st.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl group">
                              <button onClick={() => toggleSubTask(task.id, st.id)}>{st.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}</button>
                              {editingSubTaskId === st.id ? (<input type="text" value={editingSubTaskText} onChange={e => setEditingSubTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveSubTaskEdit(task.id, st.id)} onBlur={() => saveSubTaskEdit(task.id, st.id)} className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm" autoFocus />) : (<span className={cn("text-sm flex-1", st.completed ? 'text-white/30 line-through' : 'text-white/70')}>{st.text}</span>)}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => reorderSubTask(task.id, st.id, 'up')} disabled={idx === 0} className="p-1 hover:text-white disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                <button onClick={() => reorderSubTask(task.id, st.id, 'down')} disabled={idx === task.subTasks.length - 1} className="p-1 hover:text-white disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                                <button onClick={() => editSubTask(task.id, st.id)} className="p-1 hover:text-blue-400"><Settings className="w-3 h-3" /></button>
                                <button onClick={() => deleteSubTask(task.id, st.id)} className="p-1 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>))}
                            <div className="flex gap-2"><input type="text" value={newSubTaskText[task.id] || ''} onChange={e => setNewSubTaskText(prev => ({ ...prev, [task.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSubTask(task.id)} placeholder="Add sub-task..." className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm" /><button onClick={() => addSubTask(task.id)} className="p-2 bg-white/10 rounded-xl"><Plus className="w-4 h-4" /></button></div>
                          </motion.div>)}</AnimatePresence>
                        </motion.div>);
                      })
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {view === 'calendar' && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-200px)] min-h-[600px]">
                <div className="floating-card p-6 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-semibold">{calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                      <button onClick={goToToday} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium">Today</button>
                      <button onClick={() => navigateCalendar('prev')} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={() => navigateCalendar('next')} className="p-2 hover:bg-white/5 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-mono text-white/60">{currentTime.toLocaleTimeString()}</div>
                      <div className="flex gap-2 bg-white/5 rounded-xl p-1">{(['day', 'week', 'month'] as CalendarView[]).map(v => (<button key={v} onClick={() => setCalendarView(v)} className={cn("px-4 py-2 rounded-lg text-sm font-medium", calendarView === v ? "bg-white text-black" : "text-white/60 hover:text-white")}>{v}</button>))}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2 mb-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="text-center text-xs font-medium text-white/40 uppercase py-2">{d}</div>))}</div>
                  {calendarView === 'month' && (
                    <div className="grid grid-cols-7 gap-2 flex-1">
                      {getDaysInMonth(calendarDate).map((day, i) => {
                        const isToday = day.date === getToday();
                        return (<div key={i} className={cn("p-2 rounded-xl transition-all min-h-[80px]", !day.isCurrentMonth && "opacity-30", isToday && "bg-white/10 ring-1 ring-white/30", calendarAddingDate === day.date ? "bg-white/10" : "hover:bg-white/5 cursor-pointer")}
                          onClick={() => { if (calendarAddingDate !== day.date) setCalendarAddingDate(day.date); }}>
                          <div className="flex items-center justify-between mb-1"><span className={cn("text-sm font-medium", isToday ? "text-white" : "text-white/60")}>{day.day}</span>{day.tasks.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{day.tasks.filter(t => t.completed).length}/{day.tasks.length}</span>}</div>
                          {day.tasks.slice(0, 2).map(t => (
                            <div key={t.id} onClick={e => e.stopPropagation()}>
                              <div className={cn("text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer mb-0.5 flex items-center gap-1", getTaskStatusColor(t, getToday()), t.completed && "line-through opacity-60")} onClick={() => toggleTask(t.id)}>
                                <span className="flex-1 truncate">{t.text}</span>
                                {t.subTasks.length > 0 && <button onClick={e => { e.stopPropagation(); toggleExpanded(t.id); }} className="shrink-0 hover:opacity-80">{expandedTasks.has(t.id) ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}</button>}
                              </div>
                              {t.subTasks.length > 0 && expandedTasks.has(t.id) && (
                                <div className="ml-1 mb-1 space-y-0.5">
                                  {t.subTasks.map(st => (<div key={st.id} onClick={e => { e.stopPropagation(); toggleSubTask(t.id, st.id); }} className={cn("text-[9px] px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1", st.completed ? "text-emerald-400/60 line-through" : "text-white/50 hover:text-white/80")}>{st.completed ? <CheckCircle2 className="w-2 h-2 shrink-0" /> : <Circle className="w-2 h-2 shrink-0" />}<span className="truncate">{st.text}</span></div>))}
                                </div>
                              )}
                            </div>
                          ))}
                          {day.tasks.length > 2 && <div className="text-[10px] text-white/40">+{day.tasks.length - 2} more</div>}
                          {calendarAddingDate === day.date && (
                            <div onClick={e => e.stopPropagation()} className="mt-1">
                              <input type="text" value={calendarNewTaskText} onChange={e => setCalendarNewTaskText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCalendarAddTask(day.date); if (e.key === 'Escape') { setCalendarAddingDate(null); setCalendarNewTaskText(''); } }} placeholder="Task name..." className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-1 text-[10px] text-white" autoFocus onClick={e => e.stopPropagation()} />
                              <div className="flex gap-1 mt-1">
                                <button onClick={e => { e.stopPropagation(); handleCalendarAddTask(day.date); }} className="flex-1 py-0.5 bg-white/20 rounded text-[9px] hover:bg-white/30">Add</button>
                                <button onClick={e => { e.stopPropagation(); setCalendarAddingDate(null); setCalendarNewTaskText(''); }} className="flex-1 py-0.5 bg-white/5 rounded text-[9px] hover:bg-white/10">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>);
                      })}
                    </div>
                  )}
                  {calendarView === 'week' && (
                    <div className="grid grid-cols-7 gap-2 flex-1">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(calendarDate); d.setDate(d.getDate() - d.getDay() + i);
                        const dateStr = d.toISOString().split('T')[0];
                        const dayTasks = tasks.filter(t => t.dueDate === dateStr);
                        const isToday = dateStr === getToday();
                        return (<div key={i} className={cn("p-2 rounded-xl min-h-[150px] hover:bg-white/5 transition-colors cursor-pointer", isToday && "bg-white/10", calendarAddingDate === dateStr && "bg-white/10")} onClick={() => { if (calendarAddingDate !== dateStr) setCalendarAddingDate(dateStr); }}>
                          <div className="text-center mb-2"><span className={cn("text-xs font-medium", isToday ? "text-white" : "text-white/40")}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span></div>
                          <div className={cn("text-lg font-medium text-center mb-2", isToday ? "text-white" : "text-white/60")}>{d.getDate()}</div>
                          {dayTasks.slice(0, 3).map(t => (
                            <div key={t.id} onClick={e => e.stopPropagation()}>
                              <div onClick={() => toggleTask(t.id)} className={cn("text-[10px] px-1.5 py-1 rounded truncate cursor-pointer mb-0.5 flex items-center gap-1", getTaskStatusColor(t, getToday()), t.completed && "line-through opacity-60", "hover:opacity-80")}>
                                <span className="flex-1 truncate">{t.text}</span>
                                {t.subTasks.length > 0 && <button onClick={e => { e.stopPropagation(); toggleExpanded(t.id); }} className="shrink-0">{expandedTasks.has(t.id) ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}</button>}
                              </div>
                              {t.subTasks.length > 0 && expandedTasks.has(t.id) && (
                                <div className="ml-1 mb-1 space-y-0.5">
                                  {t.subTasks.map(st => (<div key={st.id} onClick={e => { e.stopPropagation(); toggleSubTask(t.id, st.id); }} className={cn("text-[9px] px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1", st.completed ? "text-emerald-400/60 line-through" : "text-white/50 hover:text-white/80")}>{st.completed ? <CheckCircle2 className="w-2 h-2 shrink-0" /> : <Circle className="w-2 h-2 shrink-0" />}<span className="truncate">{st.text}</span></div>))}
                                </div>
                              )}
                            </div>
                          ))}
                          {dayTasks.length > 3 && <div className="text-[10px] text-white/40 text-center">+{dayTasks.length - 3} more</div>}
                          {calendarAddingDate === dateStr && (
                            <div onClick={e => e.stopPropagation()} className="mt-1">
                              <input type="text" value={calendarNewTaskText} onChange={e => setCalendarNewTaskText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCalendarAddTask(dateStr); if (e.key === 'Escape') { setCalendarAddingDate(null); setCalendarNewTaskText(''); } }} placeholder="Task name..." className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-1 text-[10px] text-white" autoFocus onClick={e => e.stopPropagation()} />
                              <div className="flex gap-1 mt-1">
                                <button onClick={e => { e.stopPropagation(); handleCalendarAddTask(dateStr); }} className="flex-1 py-0.5 bg-white/20 rounded text-[9px] hover:bg-white/30">Add</button>
                                <button onClick={e => { e.stopPropagation(); setCalendarAddingDate(null); setCalendarNewTaskText(''); }} className="flex-1 py-0.5 bg-white/5 rounded text-[9px] hover:bg-white/10">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>);
                      })}
                    </div>
                  )}
                  {calendarView === 'day' && (
                    <div className="space-y-2">
                      <div className="p-4 rounded-xl bg-white/5 mb-4">
                        <div className="text-3xl font-mono font-light mb-2">{currentTime.toLocaleTimeString()}</div>
                        <div className="text-white/60">{calendarDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white/60">Tasks for today</span>
                        <button onClick={() => { addTaskForDate(getToday()); setView('tasks'); }} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1"><Plus className="w-3 h-3" /> Add Task</button>
                      </div>
                      {tasks.filter(t => t.dueDate === getToday()).length === 0 ? (
                        <div className="text-center py-8 text-white/30">No tasks for today</div>
                      ) : (
                        tasks.filter(t => t.dueDate === getToday()).map(task => {
                          const prog = getTaskProgress(task);
                          const hasSubTasks = task.subTasks.length > 0;
                          const statusColor = getTaskStatusColor(task, getToday());
                          const borderColor = statusColor.includes('emerald') ? 'border-emerald-500' : statusColor.includes('red') ? 'border-red-500' : 'border-amber-500';
                          return (<div key={task.id} className={cn("p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border-l-2", borderColor)}>
                            <div className="flex items-center gap-3">
                              <button onClick={() => toggleTask(task.id)}>{task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-white/40" />}</button>
                              <span className={cn("flex-1 text-sm", task.completed ? 'text-white/30 line-through' : 'text-white/80')}>{task.text}</span>
                              {(() => { const dl = getDueDateLabel(task.dueDate, getToday()); return dl ? <span className={cn("text-[10px]", dl.colorClass)}>{dl.label}</span> : null; })()}
                              {hasSubTasks && <button onClick={() => toggleExpanded(task.id)} className="p-1 hover:bg-white/10 rounded">{expandedTasks.has(task.id) ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}</button>}
                              <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold border", PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                            </div>
                            {hasSubTasks && !expandedTasks.has(task.id) && (<div className="mt-2 ml-8"><div className="flex items-center gap-2 mb-1"><div className="flex-1 h-1 bg-white/10 rounded-full"><div className="h-full bg-emerald-400" style={{ width: `${prog.percentage}%` }} /></div><span className="text-[10px] text-white/40">{prog.completed}/{prog.total}</span></div></div>)}
                            {hasSubTasks && expandedTasks.has(task.id) && (
                              <div className="mt-2 ml-8 space-y-1">
                                {task.subTasks.map(st => (<div key={st.id} className="flex items-center gap-2 text-xs py-1">
                                  <button onClick={() => toggleSubTask(task.id, st.id)}>{st.completed ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Circle className="w-3 h-3 text-white/40" />}</button>
                                  <span className={cn("text-xs", st.completed ? "text-emerald-400/60 line-through" : "text-white/70")}>{st.text}</span>
                                </div>))}
                              </div>
                            )}
                          </div>);
                        })
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'goals' && (
              <motion.div key="goals" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-6 h-6 text-white/40" />
                    <h2 className="text-xl font-medium">Yearly Goals</h2>
                    <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                      <button onClick={() => setGoalYear(y => y - 1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="px-3 text-sm font-semibold">{goalYear}</span>
                      <button onClick={() => setGoalYear(y => y + 1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <button onClick={() => setShowAddGoal(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Add Goal
                  </button>
                </div>

                {/* Add Goal Form */}
                <AnimatePresence>
                  {showAddGoal && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="floating-card p-5 space-y-4">
                        <h3 className="text-sm font-medium text-white/60">New Goal for {goalYear}</h3>
                        <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)} placeholder="Goal title (e.g. Learn TypeScript)" className="task-input w-full" onKeyDown={e => e.key === 'Enter' && addGoal()} />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Category</label>
                            <select value={newGoalCategory} onChange={e => setNewGoalCategory(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white/80">
                              {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Target Tasks</label>
                            <input type="number" min="1" max="365" value={newGoalTarget} onChange={e => setNewGoalTarget(parseInt(e.target.value) || 1)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white/80" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-2">Color</label>
                          <div className="flex gap-2">
                            {GOAL_COLORS.map(c => (<button key={c} type="button" onClick={() => setNewGoalColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", newGoalColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c }} />))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={addGoal} className="flex-1 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all">Create Goal</button>
                          <button onClick={() => setShowAddGoal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Goals by category */}
                {goals.filter(g => g.year === goalYear).length === 0 ? (
                  <div className="text-center py-16 floating-card">
                    <GraduationCap className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/30">No goals for {goalYear} yet.</p>
                    <p className="text-white/20 text-sm mt-1">Click "Add Goal" to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.filter(g => g.year === goalYear).map(goal => {
                      const gp = getGoalProgress(goal);
                      const linkedTasks = tasks.filter(t => t.goalId === goal.id);
                      return (
                        <div key={goal.id} className="floating-card p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                              <div>
                                <h3 className="font-medium text-white">{goal.title}</h3>
                                <span className="text-[10px] text-white/40 uppercase tracking-widest">{goal.category}</span>
                              </div>
                            </div>
                            <button onClick={() => deleteGoal(goal.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-white/30 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
                              <span>{gp.completed} / {gp.target} tasks completed</span>
                              <span className="font-semibold" style={{ color: goal.color }}>{gp.pct}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full" style={{ backgroundColor: goal.color }} initial={{ width: 0 }} animate={{ width: `${gp.pct}%` }} transition={{ duration: 0.6 }} />
                            </div>
                          </div>

                          {/* Linked tasks */}
                          {linkedTasks.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-white/30 uppercase tracking-widest">Linked Tasks</span>
                              {linkedTasks.slice(0, 4).map(t => (
                                <div key={t.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                  <button onClick={() => toggleTask(t.id)} className="shrink-0">{t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-white/30" />}</button>
                                  <span className={cn("text-xs flex-1 truncate", t.completed ? "text-white/30 line-through" : "text-white/70")}>{t.text}</span>
                                  <button onClick={() => unlinkTaskFromGoal(t.id, goal.id)} className="p-1 hover:text-red-400 text-white/20 shrink-0" title="Unlink"><X className="w-3 h-3" /></button>
                                </div>
                              ))}
                              {linkedTasks.length > 4 && <p className="text-[10px] text-white/30 pl-2">+{linkedTasks.length - 4} more</p>}
                            </div>
                          )}

                          {/* Link task button */}
                          <div>
                            {linkingGoalId === goal.id ? (
                              <div className="space-y-2">
                                <span className="text-[10px] text-white/40">Select a task to link:</span>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {tasks.filter(t => !t.goalId && !t.completed).map(t => (
                                    <button key={t.id} onClick={() => linkTaskToGoal(t.id, goal.id)} className="w-full text-left px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 truncate">{t.text}</button>
                                  ))}
                                  {tasks.filter(t => !t.goalId && !t.completed).length === 0 && <p className="text-[10px] text-white/30 px-2">No unlinked tasks available.</p>}
                                </div>
                                <button onClick={() => setLinkingGoalId(null)} className="text-[10px] text-white/30 hover:text-white/60">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setLinkingGoalId(goal.id)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Link a task
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toast overlay */}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
              {toasts.map(toast => (
                <motion.div key={toast.id} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
                  className="pointer-events-auto flex items-start gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 shadow-xl max-w-xs">
                  <Bell className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{toast.title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{toast.body}</p>
                  </div>
                  <button onClick={() => dismissToast(toast.id)} className="p-1 hover:bg-white/10 rounded-lg shrink-0"><X className="w-3 h-3 text-white/40" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showSettings && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm floating-card p-5 max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold">Settings</h2>
                    <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-white/40" /></button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-bold text-white/30 block mb-2">Timer Durations (min)</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([{ key: 'work' as const, label: 'Focus' }, { key: 'shortBreak' as const, label: 'Short' }, { key: 'longBreak' as const, label: 'Long' }] as { key: keyof TimerSettings; label: string }[]).map(({ key, label }) => (
                          <div key={key} className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-2">
                            <span className="text-[10px] text-white/40">{label}</span>
                            <input type="number" min="1" max="120" value={timerSettings[key]}
                              onChange={e => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val >= 1 && val <= 120) { setTimerSettings(prev => ({ ...prev, [key]: val })); if (mode === key) { setIsActive(false); setTimeLeft(val * 60); } } }}
                              className="w-full bg-transparent text-center text-sm font-semibold text-white focus:outline-none" />
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setTimerSettings(DEFAULT_TIMER_SETTINGS); setIsActive(false); setTimeLeft(DEFAULT_TIMER_SETTINGS[mode] * 60); }} className="w-full mt-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-white/50 hover:text-white">Reset to Defaults</button>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-bold text-white/30 block mb-2">Notification Sound</label>
                      <div className="space-y-1">
                        {[...DEFAULT_SOUNDS, ...customSounds].map(sound => (
                          <button key={sound.id} onClick={() => { setSelectedSound(sound); new Audio(sound.url).play(); }}
                            className={cn("w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-sm", selectedSound.id === sound.id ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10")}>
                            <div className="flex items-center gap-2"><Volume2 className="w-3.5 h-3.5" /><span className="text-xs font-medium">{sound.name}</span></div>
                            {selectedSound.id === sound.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-bold text-white/30 block mb-2">Upload Custom Sound</label>
                      <label className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer text-white/40 hover:text-white/60">
                        <Upload className="w-4 h-4" /><span className="text-xs">Choose audio file</span>
                        <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="w-full mt-4 py-2.5 bg-white text-black rounded-xl font-semibold text-sm hover:scale-[1.02] transition-all">Done</button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
