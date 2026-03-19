import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
// @ts-ignore
import confetti from 'canvas-confetti';
import { X, Volume2, Check, Zap, Trophy, Flame, Download, Upload } from 'lucide-react';
import { cn } from './utils';
import { Task, Goal, AppView, TimerMode, Theme, SoundOption, Priority, Habit, Profile, Workspace, Achievement } from './types';

import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { TimerView } from './views/TimerView';
import { TasksView } from './views/TasksView';
import { CalendarView } from './views/CalendarView';
import { GoalsView } from './views/GoalsView';
import { JournalView } from './views/JournalView';
import { BoardView } from './views/BoardView';

const BADGES = [
  { id: 'early_bird', title: 'Early Bird', description: 'Complete a task before 8 AM', icon: Zap, color: 'text-amber-400' },
  { id: 'weekend_warrior', title: 'Weekend Warrior', description: 'Complete a task on Saturday or Sunday', icon: Trophy, color: 'text-purple-400' },
  { id: 'dedicated_focus', title: 'Dedicated Focus', description: 'Successfully finish a focus session', icon: Flame, color: 'text-orange-500' }
];

// API Configuration
const API_BASE = 'http://localhost:3002';
const socket: Socket = io(API_BASE);

const DEFAULT_SOUNDS: SoundOption[] = [
  { id: 'bell', name: 'Alarm Bell', url: '/audio/bell.mp3' },
  { id: 'rain', name: 'Rain Drop', url: '/audio/rain.mp3' },
  { id: 'cafe', name: 'Cafe Buzz', url: '/audio/cafe.mp3' }
];

const DEFAULT_DURATIONS = { work: 25, shortBreak: 5, longBreak: 15 };

const MODES_META: Record<TimerMode, { label: string }> = {
  work: { label: 'Focus' },
  shortBreak: { label: 'Short Break' },
  longBreak: { label: 'Long Break' },
};

export default function App() {
  // State
  const [view, setView] = useState<AppView>('dashboard');
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
  const [toasts, setToasts] = useState<{id: string, title: string, body: string, type?: string}[]>([]);
  const [selectedSound, setSelectedSound] = useState<SoundOption>(() => {
    const saved = localStorage.getItem('onyx_selected_sound');
    return saved ? JSON.parse(saved) : DEFAULT_SOUNDS[0];
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);

  // Task Input State (Used across Dashboard, Timer, Tasks)
  const [dashboardNewTaskText, setDashboardNewTaskText] = useState('');
  const [dashboardNewTaskPriority, setDashboardNewTaskPriority] = useState<Priority>('medium');
  const [dashboardNewSubTask, setDashboardNewSubTask] = useState('');
  const [dashboardNewSubTasks, setDashboardNewSubTasks] = useState<string[]>([]);
  const [dashboardDueDate, setDashboardDueDate] = useState('');
  const [dashboardNewTaskGoalId, setDashboardNewTaskGoalId] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const onSessionComplete = async (mode: string, duration: number) => {
    await axios.post(`${API_BASE}/focus-sessions`, { workspaceId: workspace, mode, duration, completedAt: Date.now() }).catch(() => {});
    fetchFocusSessions();
    if (Notification.permission === 'granted') {
      new Notification('FocusFlow', { body: mode === 'work' ? '✅ Focus session done! Take a break.' : '⚡ Break done! Ready to focus?', icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

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
  }, [timerDurations, selectedSound]);

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
         showToast('🏆 Achievement Unlocked!', `You earned the ${badgeId.replace('_', ' ').toUpperCase()} badge!`, 'success');
         confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 } });
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
      }
    } catch {}
  };

  // Toast System
  const showToast = (title: string, body: string, type: string = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
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
      }
      await axios.patch(`${API_BASE}/tasks/${id}`, { completed: !task.completed });
      showToast('Success', `Task marked as ${!task.completed ? 'completed' : 'active'}`, 'success');
    } catch (err) {
      showToast('Error', 'Failed to update task', 'error');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/tasks/${id}`);
      showToast('Task deleted', 'Task has been removed');
    } catch (err) {
      showToast('Error', 'Failed to delete task', 'error');
    }
  };

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dashboardNewTaskText.trim()) return;
    
    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId,
      text: dashboardNewTaskText.trim(),
      completed: false,
      priority: dashboardNewTaskPriority,
      position: tasks.length,
      createdAt: Date.now(),
      dueDate: dashboardDueDate || undefined,
      goalId: dashboardNewTaskGoalId || undefined,
      subTasks: dashboardNewSubTasks.map(st => ({
        id: crypto.randomUUID(),
        text: st,
        completed: false,
        createdAt: Date.now(),
        taskId: taskId
      })),
      archived: 0
    };

    try {
      await axios.post(`${API_BASE}/tasks`, { ...newTask, workspaceId: workspace });
      setDashboardNewTaskText('');
      setDashboardNewSubTasks([]);
      setDashboardNewSubTask('');
      setDashboardDueDate('');
      setDashboardNewTaskGoalId('');
      showToast('Success', 'Task added successfully', 'success');
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
      playNotificationSound();
      if (mode === 'work') {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        addXP(50, 'Finished a Focus Session');
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
    dashboardNewTaskGoalId,
    setDashboardNewTaskGoalId,
    handleAddTask,
    addDashboardSubTask,
    setView,
    toggleTask,
    deleteTask,
    expandedTasks,
    setExpandedTasks,
    goals,
    fetchGoals,
    habits,
    fetchHabits,
    currentTime,
    showToast,
    addXP,
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
  };

  return (
    <div className="min-h-screen bg-app text-white font-sans selection:bg-white/20 flex flex-col md:flex-row overflow-hidden">
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

      <main className="flex-1 relative overflow-y-auto p-4 md:p-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-full" />
            </div>
            <span className="text-xl font-bold tracking-tight pr-4 border-r border-white/10">FocusFlow</span>
            <select value={workspace} onChange={e => setWorkspace(e.target.value as Workspace)} className="ml-2 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none appearance-none">
               <option value="Personal" className="bg-panel text-white">🏠 Personal</option>
               <option value="Work" className="bg-panel text-white">💼 Work</option>
               <option value="Project" className="bg-panel text-white">🚀 Project</option>
            </select>
          </div>
          <div className="hidden lg:flex items-center bg-panel-dark rounded-2xl p-1 border border-white/5">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'timer', label: 'Timer' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'calendar', label: 'Calendar' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id as AppView)}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                  view === item.id ? "bg-accent text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "text-white/40 hover:text-white"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="w-8 h-8" />
        </header>

        <AnimatePresence mode="wait">
          {view === 'dashboard' && <DashboardView {...viewProps} />}
          {view === 'timer' && <TimerView {...viewProps} mode={mode} setMode={setMode} timeLeft={timeLeft} isActive={isActive} setIsActive={setIsActive} resetTimer={resetTimer} />}
          {view === 'calendar' && <CalendarView {...viewProps} focusSessions={focusSessions} />}
          {view === 'goals' && <GoalsView {...viewProps} />}
          {view === 'tasks' && <TasksView {...viewProps} />}
          {view === 'journal' && <JournalView workspace={workspace} />}
          {view === 'board' && <BoardView tasks={tasks} setTasks={setTasks} workspace={workspace} toggleTask={toggleTask} deleteTask={deleteTask} />}
        </AnimatePresence>
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

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div key={toast.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className={cn("px-6 py-4 rounded-2xl border shadow-2xl backdrop-blur-xl min-w-[300px]", toast.type === 'error' ? "bg-red-500/10 border-red-500/20" : toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-panel-dark border-white/10")}>
              <h5 className="font-bold text-sm">{toast.title}</h5>
              <p className="text-xs text-white/60">{toast.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
