import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
// @ts-ignore
import confetti from 'canvas-confetti';
import { X, Volume2, Check, Zap, Trophy, Flame, Download, Upload, Settings, Star, Moon, Brain, BookOpen, Target, Shield, Swords, Crown } from 'lucide-react';
import { cn, generateUUID } from './utils/index';
import { Task, Goal, AppView, TimerMode, Theme, SoundOption, Priority, Habit, Profile, Workspace, Achievement } from './types';

import { Sidebar } from './components/layout/Sidebar';
import { NeoChat } from './components/features/NeoChat';
import { DashboardView } from './pages/DashboardView';
import { TimerView } from './pages/TimerView';
import { TasksView } from './pages/TasksView';
import { CalendarView } from './pages/CalendarView';
import { GoalsView } from './pages/GoalsView';
import { JournalView } from './pages/JournalView';
import { BoardView } from './pages/BoardView';
import { PerformanceView } from './pages/PerformanceView';
import { StrategyView } from './pages/StrategyView';
import { UniversalHUD } from './components/layout/UniversalHUD';
import { NeuralSyncView } from './pages/NeuralSyncView';
import { AdvancedTasksView } from './pages/AdvancedTasksView';
import { SettingsView } from './pages/SettingsView';
import { SessionDebrief } from './components/features/SessionDebrief';
import { DocForgeView } from './pages/DocForgeView';
import { CommandPalette } from './components/features/CommandPalette';
import { StudyHubView } from './pages/StudyHubView';

import { BADGES, API_BASE, DEFAULT_SOUNDS, DEFAULT_DURATIONS, MODES_META } from './constants';

// API Configuration
const socket: Socket = io(API_BASE);

export default function App() {
  // State
  const [view, setViewRaw] = useState<AppView>('dashboard');
  const [voidModeActive, setVoidModeActive] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<{duration: number; sessionCount: number; xpEarned: number; task?: Task; streak: number} | null>(null);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timerDurations, setTimerDurations] = useState(() => {
    const saved = localStorage.getItem('onyx_timer_durations');
    return saved ? JSON.parse(saved) : DEFAULT_DURATIONS;
  });
  const [timeLeft, setTimeLeft] = useState(timerDurations.work * 60);
  const [isActive, setIsActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>('Personal');
  const [activityData, setActivityData] = useState<any[]>([]);
  const [theme, setTheme] = useState<Theme>(() => {
     const saved = localStorage.getItem('onyx_theme');
     // fallback for users who had "dark" or "system" saved previously
     if (saved === 'dark' || saved === 'light' || saved === 'system') return 'midnight';
     return (saved as Theme) || 'midnight';
  });
  const [customAccent, setCustomAccent] = useState<string>(() => localStorage.getItem('onyx_accent') || '');
  const [toasts, setToasts] = useState<{id: string, title: string, body: string, type?: string, onUndo?: () => void}[]>([]);
  const [selectedSound, setSelectedSound] = useState<SoundOption>(() => {
    const saved = localStorage.getItem('onyx_selected_sound');
    return saved ? JSON.parse(saved) : DEFAULT_SOUNDS[0];
  });
  const [aiConfig, setAiConfig] = useState(() => {
    const saved = localStorage.getItem('onyx_ai_config');
    return saved ? JSON.parse(saved) : { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '', modelId: 'gemini-2.5-flash' };
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showUniversalHUD, setShowUniversalHUD] = useState(false);
  const [isHUDDetached, setIsHUDDetached] = useState(false);
  const [pipWindow, setPipWindow] = useState<any>(null);
  const pipRootRef = useRef<Root | null>(null);
  const [isNeoSpeaking, setIsNeoSpeaking] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);


  // Task Input State (Used across Dashboard, Timer, Tasks)
  const [dashboardNewTaskText, setDashboardNewTaskText] = useState('');
  const [dashboardNewTaskPriority, setDashboardNewTaskPriority] = useState<Priority>('medium');
  const [dashboardDueDate, setDashboardDueDate] = useState('');
  const [dashboardRecurrence, setDashboardRecurrence] = useState<any>(null);
  const [dashboardNewSubTask, setDashboardNewSubTask] = useState('');
  const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | undefined>(undefined);
  const [dashboardNewSubTasks, setDashboardNewSubTasks] = useState<string[]>([]);
  const [dashboardNewTaskGoalId, setDashboardNewTaskGoalId] = useState('');
  const [dashboardTimeSlot, setDashboardTimeSlot] = useState('');
  const [dashboardImportance, setDashboardImportance] = useState(50);
  const [dashboardUrgency, setDashboardUrgency] = useState(50);
  const [dashboardCognitiveCost, setDashboardCognitiveCost] = useState(5);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const [timerPresets, setTimerPresets] = useState<any[]>([]);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
  const [focusedTodayMinutes, setFocusedTodayMinutes] = useState(0);
  const [focusSessions, setFocusSessions] = useState<any[]>([]);

  const fetchFocusSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/focus-sessions?workspace=${workspace}`);
      setFocusSessions(res.data);
      const today = new Date().toDateString();
      const todayMin = res.data.filter((s: any) => new Date(s.completedAt).toDateString() === today && s.mode === 'work')
        .reduce((sum: number, s: any) => sum + Math.round(s.duration / 60), 0);
      setFocusedTodayMinutes(todayMin);
    } catch(e) {}
  };

  const fetchTimerPresets = async () => {
    try { const r = await axios.get(`${API_BASE}/timer-presets`); setTimerPresets(r.data); } catch(e) {}
  };

  const onSessionComplete = async (mode: string, duration: number, taskId?: string) => {
    try {
      await axios.post(`${API_BASE}/focus-sessions`, {
        workspaceId: workspace,
        mode,
        duration,
        taskId,
        completedAt: Date.now()
      });
    } catch(e) {}
    fetchFocusSessions();
    if (Notification.permission === 'granted') {
      new Notification('FocusFlow', { body: mode === 'work' ? '✅ Focus session done! Take a break.' : '⚡ Break done! Ready to focus?', icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  // ── Screen Wake Lock: prevent sleep while timer is running ──
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[WakeLock] Screen wake lock released');
          });
          console.log('[WakeLock] Screen wake lock acquired');
        } catch (err: any) {
          console.warn('[WakeLock] Could not acquire wake lock:', err.message);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    if (isActive) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock if the page becomes visible again while timer is active
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
        await acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isActive]);

  // ── Ctrl+K Command Palette ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Initialization & Socket
  useEffect(() => {
    fetchTasks();
    fetchActivity();
    fetchGoals();
    fetchHabits();
    fetchProfile();
    fetchAchievements();
    fetchTimerPresets();
    fetchFocusSessions();
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    socket.on('taskUpdated', (updatedTask) => {
      setTasks(prev => {
        const index = prev.findIndex(t => t.id === updatedTask.id);
        if (index > -1) {
          const newTasks = [...prev];
          newTasks[index] = updatedTask;
          return newTasks;
        }
        return [updatedTask, ...prev];
      });
    });

    socket.on('taskDeleted', (deletedId) => {
      setTasks(prev => prev.filter(t => t.id !== deletedId));
    });

    socket.on('activityUpdated', () => {
      fetchActivity();
    });

    socket.on('goalsRefreshed', () => {
      fetchGoals();
    });

    socket.on('habitsRefreshed', () => {
      fetchHabits();
    });

    socket.on('profileUpdated', setProfile);

    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      socket.off('taskUpdated');
      socket.off('taskDeleted');
      socket.off('activityUpdated');
      socket.off('goalsRefreshed');
      socket.off('habitsRefreshed');
      socket.off('profileUpdated');
    };
  }, [workspace]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('onyx_timer_durations', JSON.stringify(timerDurations));
    localStorage.setItem('onyx_selected_sound', JSON.stringify(selectedSound));
    localStorage.setItem('onyx_ai_config', JSON.stringify(aiConfig));
  }, [timerDurations, selectedSound, aiConfig]);

  // Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-midnight', 'theme-cyberpunk', 'theme-nordic', 'theme-snow', 'dark', 'light');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('onyx_theme', theme);
  }, [theme]);

  // Custom Accent Color
  useEffect(() => {
    if (customAccent) {
      document.documentElement.style.setProperty('--accent', customAccent);
      localStorage.setItem('onyx_accent', customAccent);
    } else {
      document.documentElement.style.removeProperty('--accent');
    }
  }, [customAccent]);

  // Auto Dark Mode based on time (6am-8pm = stay on theme, else switch to midnight)
  useEffect(() => {
    const checkTime = () => {
      const h = new Date().getHours();
      const isDayTime = h >= 6 && h < 20;
      const autoDark = localStorage.getItem('onyx_auto_dark');
      if (autoDark === 'true') {
        setTheme(isDayTime ? 'nordic' : 'midnight');
      }
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Data Fetching
  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks?workspace=${workspace}`);
      setTasks(res.data);
    } catch (err) { }
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get(`${API_BASE}/activity`);
      setActivityData(res.data);
    } catch (err) {}
  };

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`${API_BASE}/goals?workspace=${workspace}`);
      setGoals(res.data);
    } catch (err) {}
  };

  const fetchHabits = async () => {
    try {
      const res = await axios.get(`${API_BASE}/habits?workspace=${workspace}`);
      setHabits(res.data);
    } catch (err) {}
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/profile`);
      setProfile(res.data);
    } catch {}
  };

  const fetchAchievements = async () => {
    try {
      const res = await axios.get(`${API_BASE}/achievements`);
      setAchievements(res.data);
    } catch {}
  };

  const checkAchievement = async (badgeId: string) => {
    if (achievements.find(a => a.badgeId === badgeId)) return;
    try {
      const res = await axios.post(`${API_BASE}/achievements`, { badgeId });
      if (res.data.success && res.data.newlyUnlocked) {
         fetchAchievements();
         showToast('🏆 Achievement Unlocked!', `You earned the ${badgeId.replace(/_/g, ' ').toUpperCase()} badge!`, 'success');
         confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 } });
         // Meta: The Architect (15+ badges)
         if (achievements.length >= 14) checkAchievement('the_architect');
      }
    } catch {}
  };

  const addXP = async (amount: number, reason: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/profile/xp`, { xp: amount });
      showToast('✨ XP Earned', `+${amount} XP: ${reason}`, 'success');
      if (res.data.leveledUp) {
        showToast('🎉 LEVEL UP!', `You are now Level ${res.data.profile.level}!`, 'success');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        if (res.data.profile.level >= 5) checkAchievement('level_5');
        if (res.data.profile.level >= 10) checkAchievement('level_10');
      }
    } catch {}
  };

  // Toast System
  const showToast = (title: string, body: string, type: string = 'info', onUndo?: () => void) => {
    const id = generateUUID();
    setToasts(prev => [...prev, { id, title, body, type, onUndo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), onUndo ? 6000 : 5000);
  };

  // Guarded view navigation — blocked during Void Mode
  const setView = (newView: AppView) => {
    if (voidModeActive && newView !== 'timer') {
      showToast('🚫 Void Mode Active', 'Complete your session or hold Exit to break out.', 'error');
      return;
    }
    setViewRaw(newView);
  };

  // Task Actions
  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      if (!task.completed) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        addXP(20, 'Completed a Task');
        const hour = new Date().getHours();
        if (hour < 8) checkAchievement('early_bird');
        const day = new Date().getDay();
        if (day === 0 || day === 6) checkAchievement('weekend_warrior');
        // Count-based achievements
        const completedCount = tasks.filter(t => t.completed).length + 1;
        if (completedCount >= 10) checkAchievement('task_master');
        if (completedCount >= 100) checkAchievement('centurion');
        if (completedCount >= 5) checkAchievement('perfect_day');
      }
      await axios.patch(`${API_BASE}/tasks/${id}`, { completed: !task.completed });
      await fetchTasks();
      showToast('Success', `Task marked as ${!task.completed ? 'completed' : 'active'}`, 'success');
    } catch (err) {
      showToast('Error', 'Failed to update task', 'error');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/tasks/${id}`);
      await fetchTasks();
      showToast('Task deleted', 'Task has been removed');
    } catch (err) {
      showToast('Error', 'Failed to delete task', 'error');
    }
  };

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dashboardNewTaskText.trim()) return;
    
    const taskId = generateUUID();
    const payload = {
      id: taskId,
      text: dashboardNewTaskText,
      priority: dashboardNewTaskPriority,
      dueDate: dashboardDueDate || null,
      timeSlot: dashboardTimeSlot || null,
      parentId: null,
      subTasks: dashboardNewSubTasks.map(st => ({
        id: generateUUID(),
        text: st,
        completed: false,
        createdAt: Date.now(),
        taskId: taskId
      })),
      goalId: dashboardNewTaskGoalId || null,
      workspaceId: workspace,
      recurrenceEnds: dashboardRecurrence?.ends,
      recurrenceEndDate: dashboardRecurrence?.endDate,
      recurrenceEndOccurrences: dashboardRecurrence?.endOccurrences,
      importance: dashboardImportance,
      urgency: dashboardUrgency,
      cognitiveCost: dashboardCognitiveCost
    };

    try {
      await axios.post(`${API_BASE}/tasks`, payload);
      await fetchTasks();
      setDashboardNewTaskText('');
      setDashboardNewSubTasks([]);
      setDashboardNewTaskGoalId('');
      setDashboardDueDate('');
      setDashboardRecurrence(null);
      addXP(10, 'Planned Ahead');
      showToast('Success', 'Task added successfully', 'success');
      // Achievement checks
      if (dashboardDueDate) {
        const withDueDates = tasks.filter(t => t.dueDate).length + 1;
        if (withDueDates >= 5) checkAchievement('planner');
      }
      const totalSubTasks = tasks.reduce((acc, t) => acc + (t.subTasks?.length || 0), 0) + dashboardNewSubTasks.length;
      if (totalSubTasks >= 25) checkAchievement('sub_task_pro');
    } catch (err) {
      showToast('Error', 'Failed to add task', 'error');
    }
  };

  const addDashboardSubTask = () => {
    if (dashboardNewSubTask.trim()) {
      setDashboardNewSubTasks([...dashboardNewSubTasks, dashboardNewSubTask.trim()]);
      setDashboardNewSubTask('');
    }
  };

  // Timer Logic
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setVoidModeActive(false);
      playNotificationSound();
      if (mode === 'work') {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        addXP(50, 'Finished a Focus Session');
        // Achievements
        checkAchievement('dedicated_focus');
        checkAchievement('first_focus');
        const nowHour = new Date().getHours();
        if (nowHour >= 22 || nowHour < 4) checkAchievement('night_owl');
        if (timerDurations.work >= 90) checkAchievement('marathon_man');
        const totalWorkSessions = focusSessions.filter((s: any) => s.mode === 'work').length + 1;
        if (totalWorkSessions >= 50) checkAchievement('sessions_50');
        if (totalWorkSessions >= 100) checkAchievement('sessions_100');
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const weekMins = focusSessions
          .filter((s: any) => s.mode === 'work' && (Date.now() - new Date(s.completedAt).getTime()) < weekMs)
          .reduce((a: number, s: any) => a + s.duration / 60, 0) + timerDurations.work;
        if (weekMins >= 600) checkAchievement('deep_architect');
        // Week warrior: 5-day consecutive focus days
        const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0);
        let consecutive = 1;
        for (let i = 1; i <= 6; i++) {
          const d = new Date(todayBase); d.setDate(todayBase.getDate() - i);
          if (focusSessions.some((s: any) => s.mode === 'work' && new Date(s.completedAt).toDateString() === d.toDateString())) consecutive++;
          else break;
        }
        if (consecutive >= 5) checkAchievement('week_warrior');
        // Session debrief
        const todayCount = focusSessions.filter((s: any) => s.mode === 'work' && new Date(s.completedAt).toDateString() === new Date().toDateString()).length + 1;
        const activeTaskForDebrief = tasks.find(t => t.id === activePomodoroTaskId);
        setDebriefData({ duration: timerDurations.work, sessionCount: todayCount, xpEarned: 50, task: activeTaskForDebrief, streak: consecutive });
        setShowDebrief(true);
        // Log session
        axios.post(`${API_BASE}/focus-sessions`, {
          workspaceId: workspace,
          mode: 'work',
          duration: timerDurations.work * 60,
          completedAt: Date.now(),
          taskId: activePomodoroTaskId
        }).then(() => fetchFocusSessions()).catch(console.error);
      }
      if (Notification.permission === 'granted') {
        new Notification('Timer Complete', { body: `${MODES_META[mode].label} finished!` });
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, timeLeft, mode]);

  const archiveCompletedTasks = async () => {
    if (!confirm("Archive all completed tasks? They will be hidden from the main list but kept in your history.")) return;
    try {
      await axios.post(`${API_BASE}/tasks/archive-completed`, { workspaceId: workspace });
      fetchTasks();
      showToast("Archived", "Tasks moved to archive", "success");
    } catch (err) { showToast("Error", "Failed to archive", "error"); }
  };

  const initiateDeepShield = async () => {
    setIsActive(true);
    setViewRaw('timer');
    setVoidModeActive(true);
    showToast('⚡ Void Mode Active', 'Navigation locked. Complete your session or hold Exit to break out.', 'success');
    addXP(15, 'Isolation Protocol');
    checkAchievement('void_mode_user');
    if ('documentPictureInPicture' in window && !isHUDDetached) {
       handleDetachHUD();
    }
  };

  const exportData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/backup`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focus-flow-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showToast("Exported", "Data saved to JSON", "success");
    } catch (err) { showToast("Error", "Backup failed", "error"); }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("RESTORE DATA? This will overwrite your current history with the backup file. This cannot be undone.")) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await axios.post(`${API_BASE}/restore`, json);
        window.location.reload();
      } catch (err) { showToast("Error", "Invalid backup file", "error"); }
    };
    reader.readAsText(file);
  };

  const resetTimer = () => {
    setIsActive(false);
    const duration = mode === 'work' ? timerDurations.work : mode === 'shortBreak' ? timerDurations.shortBreak : timerDurations.longBreak;
    setTimeLeft(duration * 60);
    if (audioRef.current) audioRef.current.volume = 0.5;
  };

  const handleSkipNext = () => {
    if (mode === 'work') setMode('shortBreak');
    else if (mode === 'shortBreak') setMode('work');
    else setMode('work');
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error("Audio playback failed:", err);
        showToast("Audio Error", "Please interact with the page to enable sounds", "error");
      });
    }
  };

  useEffect(() => { resetTimer(); }, [mode, timerDurations]);

  // Heatmap logic for Dashboard
  const heatmapData = React.useMemo(() => {
    const data = Array.from({ length: 365 }, () => 0);
    const now = new Date();
    now.setHours(0,0,0,0);
    activityData.forEach(act => {
      const date = new Date(act.completedAt);
      date.setHours(0,0,0,0);
      const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 365) data[364 - diff]++;
    });
    return data.map((val, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (364 - i));
      return { level: val > 4 ? 4 : val, count: val, date: d.toLocaleDateString() };
    });
  }, [activityData]);

  const viewProps = {
    tasks,
    activityData,
    heatmapData,
    dashboardNewTaskText,
    setDashboardNewTaskText,
    dashboardNewSubTask,
    setDashboardNewSubTask,
    dashboardNewSubTasks,
    setDashboardNewSubTasks,
    dashboardNewTaskPriority,
    setDashboardNewTaskPriority,
    dashboardDueDate,
    setDashboardDueDate,
    dashboardRecurrence,
    setDashboardRecurrence,
    dashboardNewTaskGoalId,
    setDashboardNewTaskGoalId,
    dashboardTimeSlot,
    setDashboardTimeSlot,
    dashboardImportance,
    setDashboardImportance,
    dashboardUrgency,
    setDashboardUrgency,
    dashboardCognitiveCost,
    setDashboardCognitiveCost,
    activePomodoroTaskId,
    setActivePomodoroTaskId,
    handleAddTask,
    addDashboardSubTask,
    setView,
    toggleTask,
    deleteTask,
    fetchTasks,
    expandedTasks,
    setExpandedTasks,
    goals,
    fetchGoals,
    habits,
    fetchHabits,
    currentTime,
    showToast,
    addXP,
    checkAchievement,
    workspace,
    profile,
    timerDurations,
    setTimerDurations,
    onSessionComplete,
    timerPresets,
    fetchTimerPresets,
    dailyGoalMinutes,
    setDailyGoalMinutes,
    focusedTodayMinutes,
    focusSessions,
    fetchFocusSessions,
    archiveCompletedTasks,
    exportData,
    importData,
    aiConfig,
  };

  const handleDetachHUD = async () => {
    if (!('documentPictureInPicture' in window)) {
      alert('Your browser does not support the System Overlay feature. Please use a recent version of Chrome/Edge.');
      return;
    }

    try {
      // @ts-ignore
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 440,
        height: 140,
      });

      // Inject styles more robustly
      const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
      styles.forEach((el) => {
        pip.document.head.appendChild(el.cloneNode(true));
      });

      // Set background and layout
      pip.document.body.style.background = '#050808';
      pip.document.body.style.margin = '0';
      pip.document.body.style.display = 'flex';
      pip.document.body.style.alignItems = 'center';
      pip.document.body.style.justifyContent = 'center';
      pip.document.body.style.height = '100vh';
      pip.document.body.style.width = '100vw';
      pip.document.title = 'Neo Focus HUD';

      // Create a stable root for the React Portal
      const root = pip.document.createElement('div');
      root.id = 'pip-root';
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.display = 'flex';
      root.style.alignItems = 'center';
      root.style.justifyContent = 'center';
      pip.document.body.appendChild(root);

      // Initialize a separate React Root in the PiP window
      const reactRoot = createRoot(pip.document.getElementById('pip-root')!);
      pipRootRef.current = reactRoot;

      setPipWindow(pip);
      setIsHUDDetached(true);

      // Handle window close
      pip.addEventListener('pagehide', () => {
        if (pipRootRef.current) {
          pipRootRef.current.unmount();
          pipRootRef.current = null;
        }
        setPipWindow(null);
        setIsHUDDetached(false);
      });
    } catch (e) {
      console.error('Failed to open PiP window:', e);
    }
  };

  const activeTask = tasks.find(t => t.id === activePomodoroTaskId) || tasks.find(t => !t.completed && !t.archived);

  // Update PiP window React tree whenever state changes
  useEffect(() => {
    if (isHUDDetached && pipRootRef.current) {
      pipRootRef.current.render(
        <UniversalHUD 
          timeLeft={timeLeft}
          isActive={isActive}
          mode={mode}
          toggleTimer={() => setIsActive(!isActive)}
          skipNext={handleSkipNext}
          totalDuration={mode === 'work' ? timerDurations.work * 60 : mode === 'shortBreak' ? timerDurations.shortBreak * 60 : timerDurations.longBreak * 60}
          isNeoSpeaking={isNeoSpeaking}
          activeTask={activeTask}
          isDetached={true}
        />
      );
    }
  }, [isHUDDetached, timeLeft, isActive, mode, isNeoSpeaking, activeTask, timerDurations]);

  return (
    <div className={cn("h-screen w-screen bg-app text-white font-sans selection:bg-accent/30 flex flex-col md:flex-row overflow-hidden relative", `theme-${theme}`)}>
      <audio ref={audioRef} src={selectedSound.url} />

      <Sidebar 
        view={view} 
        setView={setView} 
        theme={theme} 
        setTheme={setTheme} 
        setShowSettings={setShowSettings} 
        setShowProfileModal={setShowProfileModal}
        profile={profile}
      />

      <main className="flex-1 relative overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-8 py-4 border-b border-white/[0.05] backdrop-blur-2xl bg-app/80">
          {/* Left: Logo + Workspace */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-dark rounded-xl flex items-center justify-center shadow-[0_0_15px_var(--accent)40]">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight leading-none">FocusFlow</span>
              <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold leading-none mt-0.5">Architect OS</span>
            </div>
            <div className="w-px h-7 bg-white/[0.06] mx-1" />
            <div className="workspace-selector relative">
              <select
                value={workspace}
                onChange={e => setWorkspace(e.target.value as Workspace)}
                className="bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer border border-white/[0.07] hover:border-white/[0.15] rounded-xl pl-3 pr-8 py-2 text-xs font-bold focus:outline-none appearance-none text-white/70 hover:text-white"
              >
                <option value="Personal" className="bg-panel text-white">🏠 Personal</option>
                <option value="Work" className="bg-panel text-white">💼 Work</option>
                <option value="Project" className="bg-panel text-white">🚀 Project</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" /></svg>
              </div>
            </div>
          </div>

          {/* Center: Quick Nav pills */}
          <div className="hidden xl:flex items-center bg-white/[0.03] rounded-2xl p-1 border border-white/[0.06] gap-0.5">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'timer', label: 'Timer' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'advanced_tasks', label: 'Architect' },
              { id: 'calendar', label: 'Calendar' },
              { id: 'board', label: 'Board' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id as AppView)}
                className={cn(
                  "relative px-4 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  view === item.id
                    ? "text-white"
                    : "text-white/30 hover:text-white/70"
                )}
              >
                {view === item.id && (
                  <motion.div
                    layoutId="header-nav-active"
                    className="absolute inset-0 rounded-xl bg-accent/20 border border-accent/30"
                    style={{ boxShadow: '0 0 12px var(--accent)20' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Right: HUD toggle + Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUniversalHUD(!showUniversalHUD)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                showUniversalHUD
                  ? "bg-focus-cyan/10 border-focus-cyan/30 text-focus-cyan shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                  : "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white hover:border-white/20"
              )}
              title="Toggle Universal HUD"
            >
              <span className="material-symbols-outlined text-[15px]">timer</span>
              <span className="hidden sm:block">HUD</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8">

        <AnimatePresence mode="wait">
          {view === 'dashboard' && <DashboardView {...viewProps} aiConfig={aiConfig} />}
          {view === 'timer' && <TimerView {...viewProps} mode={mode} setMode={setMode} timeLeft={timeLeft} isActive={isActive} setIsActive={setIsActive} resetTimer={resetTimer} voidModeActive={voidModeActive} setVoidModeActive={setVoidModeActive} />}
          {view === 'calendar' && <CalendarView {...viewProps} focusSessions={focusSessions} />}
          {view === 'goals' && <GoalsView {...viewProps} />}
          {view === 'tasks' && <TasksView {...viewProps} />}
          {view === 'advanced_tasks' && (
            <AdvancedTasksView 
              tasks={tasks} 
              fetchTasks={fetchTasks} 
              workspace={workspace} 
              showToast={showToast} 
              toggleTask={toggleTask} 
              deleteTask={deleteTask}
              onInitiateShield={initiateDeepShield}
            />
          )}
          {view === 'journal' && <JournalView workspace={workspace} tasks={tasks} toggleTask={toggleTask} goals={goals} fetchGoals={fetchGoals} />}
          {view === 'board' && <BoardView tasks={tasks.filter(t => !t.archived && (workspace === 'Personal' || t.workspaceId === workspace))} toggleTask={toggleTask} showToast={setToasts as any} />}
          {view === 'performance' && <PerformanceView heatmapData={heatmapData} activityData={activityData} focusSessions={focusSessions} tasks={tasks} />}
          {view === 'strategy' && <StrategyView goals={goals} tasks={tasks} fetchGoals={fetchGoals} workspace={workspace} aiConfig={aiConfig} showToast={setToasts as any} />}
          {view === 'network' && <NeuralSyncView showToast={showToast} />}
          {view === 'settings' && <SettingsView profile={profile} showToast={showToast} setTheme={setTheme} customAccent={customAccent} setCustomAccent={setCustomAccent} aiConfig={aiConfig} setAiConfig={setAiConfig} />}
          {view === 'docforge' && <DocForgeView aiConfig={aiConfig} showToast={showToast} />}
          {view === 'study' && <StudyHubView workspace={workspace} aiConfig={aiConfig} showToast={showToast} addXP={addXP} />}
        </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-white/10 rounded-[40px] p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              
              <div className="flex items-center gap-6 mb-8 mt-2">
                <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center border border-accent/30 relative">
                  <Flame className="w-10 h-10 text-accent" />
                  <div className="absolute -bottom-3 text-[10px] uppercase tracking-widest font-black bg-accent px-3 py-1 rounded-full text-black shadow-lg">LVL {profile?.level}</div>
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">Scholar Profile</h2>
                  <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${(profile?.xp || 0) % 50 / 50 * 100}%` }} />
                  </div>
                  <p className="text-xs font-bold text-white/40">{profile?.xp} Total XP &bull; {50 - ((profile?.xp || 0) % 50)} XP to next level</p>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white/80"><Trophy className="text-amber-400 w-5 h-5" /> Trophy Room</h3>
                <span className="text-xs font-bold text-white/40">{achievements.length} / {BADGES.length} Unlocked</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BADGES.map(b => {
                   const unlocked = achievements.some(a => a.badgeId === b.id);
                   const match = achievements.find(a=>a.badgeId===b.id);
                   const date = match ? new Date(match.unlockedAt).toLocaleDateString() : null;
                   return (
                     <div key={b.id} className={cn("p-4 rounded-3xl border flex gap-4 transition-all hover:bg-white/[0.02]", unlocked ? "bg-white/[0.01] border-white/10" : "bg-black/20 border-white/5 opacity-40")}>
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border", unlocked ? "bg-accent/10 border-accent/20" : "bg-white/5 border-white/5 grayscale")}>
                          <b.icon className={cn("w-6 h-6", unlocked ? b.color : "text-white/20")} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm mb-1">{b.title}</h4>
                          <p className="text-[10px] text-white/60 mb-2 leading-tight">{b.description}</p>
                          {unlocked ? (
                             <span className="inline-block text-[9px] font-black tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-md uppercase">Unlocked {date}</span>
                          ) : (
                             <span className="inline-block text-[9px] font-black tracking-widest text-white/20 bg-white/5 border border-white/5 px-2 py-1 rounded-md uppercase">Locked</span>
                          )}
                        </div>
                     </div>
                   );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative z-10 bg-panel border-l border-white/10 w-full max-w-sm h-full flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
              </div>
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-4">Timer Durations (Min)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(timerDurations).map(([key, val]) => (
                      <div key={key} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                        <p className="text-[10px] text-white/40 font-bold capitalize mb-1">{key === 'work' ? 'Focus' : key === 'shortBreak' ? 'Short' : 'Long'}</p>
                        <input type="number" value={val as number} onChange={e => setTimerDurations(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="bg-transparent text-xl font-bold w-full text-center focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-4">Notification Sound</p>
                  <div className="space-y-2">
                    {DEFAULT_SOUNDS.map(sound => (
                      <button key={sound.id} onClick={() => setSelectedSound(sound)} className={cn("w-full flex items-center justify-between p-4 rounded-2xl border transition-all", selectedSound.id === sound.id ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-white/60 hover:border-white/20")}>
                        <div className="flex items-center gap-3"><Volume2 className="w-4 h-4" /><span className="text-sm font-bold">{sound.name}</span></div>
                        {selectedSound.id === sound.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-4">App Theme</p>
                  <div className="flex gap-4 mb-8">
                    {[
                      { id: 'midnight', color: '#050505', accent: '#2563eb', name: 'Midnight' },
                      { id: 'cyberpunk', color: '#0f0f1b', accent: '#f42a72', name: 'Cyberpunk' },
                      { id: 'nordic', color: '#2e3440', accent: '#a3be8c', name: 'Nordic' },
                      { id: 'snow', color: '#f8fafc', accent: '#0ea5e9', name: 'Snow' }
                    ].map(t => (
                      <button
                         key={t.id}
                         onClick={() => setTheme(t.id as Theme)}
                         className={cn("w-12 h-12 rounded-full border shadow-sm transition-all focus:outline-none", theme === t.id ? "scale-110 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "border-white/10 hover:scale-105")}
                         style={{ background: `linear-gradient(135deg, ${t.color} 50%, ${t.accent} 50%)` }}
                         title={t.name}
                      />
                    ))}
                  </div>

                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-4">Accent Color</p>
                  <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="w-6 h-6 rounded-full border-2 border-accent" style={{ background: customAccent || 'var(--accent)' }} />
                    <span className="text-sm text-white/60 flex-1">Custom Accent</span>
                    <input type="color" value={customAccent || '#3b82f6'} onChange={e => setCustomAccent(e.target.value)} className="w-10 h-8 rounded-lg border-0 bg-transparent cursor-pointer" />
                    {customAccent && <button onClick={() => setCustomAccent('')} className="text-white/20 hover:text-white text-xs">Reset</button>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-4">Auto Dark Mode</p>
                  <button onClick={() => {
                    const cur = localStorage.getItem('onyx_auto_dark') === 'true';
                    localStorage.setItem('onyx_auto_dark', (!cur).toString());
                  }} className={cn('w-full flex items-center justify-between p-4 rounded-2xl border transition-all', localStorage.getItem('onyx_auto_dark') === 'true' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/20')}>
                    <span className="text-sm font-bold">Auto-switch theme by time of day</span>
                    <span className="text-[10px] font-black uppercase">{localStorage.getItem('onyx_auto_dark') === 'true' ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                   <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2">AI Roadmap Configuration</p>
                   <div className="space-y-2">
                      <input type="text" value={aiConfig.baseUrl} onChange={e => setAiConfig(prev=>({...prev, baseUrl: e.target.value}))} placeholder="Base URL (e.g. https://generativelanguage.googleapis.com/v1beta/openai)" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-white/20" />
                      <input type="password" value={aiConfig.apiKey} onChange={e => setAiConfig(prev=>({...prev, apiKey: e.target.value}))} placeholder="API Key (Google AI Studio Key)" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-white/20" />
                      <input type="text" value={aiConfig.modelId} onChange={e => setAiConfig(prev=>({...prev, modelId: e.target.value}))} placeholder="Model ID (e.g. gemini-2.5-flash)" className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-white/20" />
                   </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                   <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2">5-Year Data Safety</p>
                   <div className="grid grid-cols-2 gap-3">
                      <button onClick={exportData} className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
                         <Download className="w-3.5 h-3.5" /> Export JSON
                      </button>
                      <label className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer">
                         <Upload className="w-3.5 h-3.5" /> Import JSON
                         <input type="file" accept=".json" onChange={importData} className="hidden" />
                      </label>
                   </div>
                   <p className="text-[9px] text-white/10 italic text-center">Back up your data often to keep your 5-year history safe.</p>
                </div>
              </div>
              {/* Footer */}
              <div className="p-6 border-t border-white/5">
                <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] transition-all">Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 250 }}
              className={cn(
                "relative px-5 py-4 rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden",
                toast.type === 'error'
                  ? "bg-red-950/90 border-red-500/25"
                  : toast.type === 'success'
                  ? "bg-emerald-950/90 border-emerald-500/25"
                  : "bg-[#0a0f10]/95 border-white/10"
              )}
            >
              {/* Accent line on left */}
              <div className={cn(
                "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full",
                toast.type === 'error' ? "bg-red-500" : toast.type === 'success' ? "bg-emerald-500" : "bg-accent"
              )} />
              <div className="pl-3 flex items-start justify-between gap-3">
                <div>
                  <h5 className="font-bold text-sm text-white">{toast.title}</h5>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{toast.body}</p>
                </div>
                {toast.onUndo && (
                  <button
                    onClick={() => {
                      toast.onUndo?.();
                      setToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-all mt-0.5"
                  >Undo</button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* AI Assistant */}
      <NeoChat
        tasks={tasks}
        profile={profile}
        focusSessions={focusSessions}
        onSpeakingChange={setIsNeoSpeaking}
        workspace={workspace}
        habits={habits}
        onTaskAdded={fetchTasks}
        onStartTimer={() => { setIsActive(true); setViewRaw('timer'); }}
        aiConfig={aiConfig}
      />
      {/* Session Debrief */}
      <SessionDebrief
        isOpen={showDebrief}
        onClose={() => setShowDebrief(false)}
        onStartBreak={() => { setShowDebrief(false); setMode('shortBreak'); setIsActive(true); }}
        sessionData={debriefData}
      />

      {/* Universal HUD Overlay */}
      <AnimatePresence>
        {showUniversalHUD && !isHUDDetached && (
          <UniversalHUD 
            timeLeft={timeLeft}
            isActive={isActive}
            mode={mode}
            toggleTimer={() => setIsActive(!isActive)}
            skipNext={handleSkipNext}
            totalDuration={mode === 'work' ? timerDurations.work * 60 : mode === 'shortBreak' ? timerDurations.shortBreak * 60 : timerDurations.longBreak * 60}
            isNeoSpeaking={isNeoSpeaking}
            activeTask={activeTask}
            onDetach={handleDetachHUD}
          />
        )}
      </AnimatePresence>

      {/* ── Command Palette ── */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        setView={setView}
        tasks={tasks}
        setIsActive={setIsActive}
      />
    </div>
  );
}
