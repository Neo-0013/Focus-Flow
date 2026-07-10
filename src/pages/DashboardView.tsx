import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Activity, Zap, CheckCircle2, Trophy, LayoutList, BarChart3, Flame, Check, Trash2, X, RotateCcw, TreePine, Dog, Bird, Clock, Repeat, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { startOfDay, isSameWeek, isSameMonth } from 'date-fns';
import { cn } from '../utils/index';
import { Task, Priority, Habit, Profile, Goal, GoalCategory, AppView } from '../types';
import axios from 'axios';
import { WhatNowPanel } from '../components/features/WhatNowPanel';

const CATEGORIES: GoalCategory[] = ['Health', 'Career', 'Finance', 'Education', 'Personal'];
const CATEGORY_COLORS: Record<GoalCategory, string> = {
  Health: 'bg-emerald-500', Career: 'bg-accent', Finance: 'bg-amber-500', Education: 'bg-purple-500', Personal: 'bg-pink-500'
};
const CATEGORY_DOT_COLORS: Record<GoalCategory, string> = {
  Health: '#10b981', Career: 'var(--accent)', Finance: '#f59e0b', Education: '#a855f7', Personal: '#ec4899'
};

const API_BASE = 'http://localhost:3002';

interface DashboardProps {
  tasks: Task[];
  activityData: any[];
  heatmapData: any[];
  dashboardNewTaskText: string;
  setDashboardNewTaskText: (v: string) => void;
  dashboardNewTaskPriority: Priority;
  setDashboardNewTaskPriority: (v: Priority) => void;
  dashboardDueDate: string;
  setDashboardDueDate: React.Dispatch<React.SetStateAction<string>>;
  dashboardRecurrence: any;
  setDashboardRecurrence: React.Dispatch<React.SetStateAction<any>>;
  handleAddTask: (e?: React.FormEvent) => void;
  setView: (v: AppView) => void;
  toggleTask: (id: string) => void;
  habits: Habit[];
  fetchHabits: () => Promise<void>;
  addXP: (amount: number, reason: string) => Promise<void>;
  workspace: string;
  profile: Profile | null;
  focusSessions: any[];
  dailyGoalMinutes: number;
  focusedTodayMinutes: number;
  goals: Goal[];
  checkAchievement?: (badgeId: string) => Promise<void>;
  aiConfig: { baseUrl: string; apiKey: string; modelId: string };
}

export function DashboardView({
  tasks, activityData, heatmapData, dashboardNewTaskText, setDashboardNewTaskText,
  dashboardNewTaskPriority, setDashboardNewTaskPriority, dashboardDueDate, setDashboardDueDate,
  dashboardRecurrence, setDashboardRecurrence,
  handleAddTask, setView, toggleTask, habits, fetchHabits, addXP, workspace, profile,
  focusSessions, dailyGoalMinutes, focusedTodayMinutes, goals, checkAchievement, aiConfig
}: DashboardProps) {
  const [chartTab, setChartTab] = useState<'weekly'|'monthly'|'yearly'>('weekly');
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [tempRecurrence, setTempRecurrence] = useState<{interval: number; unit: string; ends: string; endDate?: string; endOccurrences?: number}>({ interval: 1, unit: 'day', ends: 'never' });
  const [newHabitTitle, setNewHabitTitle] = useState('');

  const radarData = React.useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    return CATEGORIES.map(cat => {
      const catGoals = goals.filter(g => g.category === cat && g.yearId === currentYear);
      const achieved = catGoals.filter(g => g.done).length;
      return { subject: cat, Achieved: achieved, Total: catGoals.length, fullMark: Math.max(catGoals.length, 5) };
    });
  }, [goals]);

  // Daily Focus Streak Calculation
  const focusStreak = React.useMemo(() => {
    const focusByDay = new Map<string, number>();
    focusSessions.filter(s => s.mode === 'work').forEach(s => {
      const d = new Date(s.completedAt).toDateString();
      focusByDay.set(d, (focusByDay.get(d) || 0) + Math.round(s.duration / 60));
    });

    let streak = 0;
    const checkDate = new Date();
    if ((focusByDay.get(checkDate.toDateString()) || 0) < dailyGoalMinutes) {
       checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (focusByDay.has(checkDate.toDateString()) && (focusByDay.get(checkDate.toDateString()) || 0) >= dailyGoalMinutes) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  }, [focusSessions, dailyGoalMinutes]);

  const saveHabit = async () => {
    if (!newHabitTitle.trim()) return;
    await axios.post(`${API_BASE}/habits`, { title: newHabitTitle, workspaceId: workspace });
    setNewHabitTitle('');
    setShowHabitModal(false);
    fetchHabits();
  };

  const { peakHoursData, maxTasks } = React.useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i >= 12 ? 'p' : 'a'}`,
      tasks: 0,
      rawHour: i
    }));
    
    activityData.forEach(act => {
      if (act && act.completedAt) {
        const d = new Date(act.completedAt);
        if (!isNaN(d.getTime())) {
          const hr = d.getHours();
          if (buckets[hr]) buckets[hr].tasks += 1;
        }
      }
    });

    const displayData = buckets.slice(6, 23);
    const max = Math.max(...displayData.map(d => d.tasks), 1);
    return { peakHoursData: displayData, maxTasks: max };
  }, [activityData]);

  // Today's Intel
  const intelTasks = React.useMemo(() => {
    return tasks
      .filter(t => !t.completed && !t.archived)
      .sort((a, b) => {
        const scoreA = (a.importance * a.urgency) / Math.max(a.cognitiveCost, 1);
        const scoreB = (b.importance * b.urgency) / Math.max(b.cognitiveCost, 1);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [tasks]);

  const overdueCount = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => !t.completed && !t.archived && t.dueDate && t.dueDate < today).length;
  }, [tasks]);

  const { isInPeakHour, peakTimeLabel } = React.useMemo(() => {
    const currentHour = new Date().getHours();
    const peak = [...peakHoursData].sort((a, b) => b.tasks - a.tasks)[0];
    if (!peak || peak.tasks === 0) return { isInPeakHour: false, peakTimeLabel: 'No data yet' };
    const isIn = Math.abs(peak.rawHour - currentHour) <= 1;
    const h = peak.rawHour;
    const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`;
    return { isInPeakHour: isIn, peakTimeLabel: label };
  }, [peakHoursData]);

  const habitsCompletedToday = habits.filter(h =>
    h.lastCompletedAt && new Date(h.lastCompletedAt).toDateString() === new Date().toDateString()
  ).length;

  const progressPct = Math.min(100, (focusedTodayMinutes / dailyGoalMinutes) * 100);
  const totalFocusHours = Math.round(focusSessions.filter(s=>s.mode==='work').reduce((a,b)=>a+b.duration, 0) / 3600 * 10) / 10;

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-5 max-w-6xl mx-auto">

      {/* ── Today's Intel Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5">
        <div className="absolute inset-0 bg-gradient-to-r from-focus-cyan/[0.04] via-transparent to-velocity-purple/[0.03] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-focus-cyan/20 to-transparent" />
        
        <div className="flex flex-wrap items-start gap-6 relative">
          {/* Priority Picks */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-[9px] text-white/25 uppercase tracking-[0.18em] font-bold mb-3 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-focus-cyan inline-block" />
              Top Priority
            </p>
            <div className="space-y-2">
              {intelTasks.length === 0 ? (
                <p className="text-xs text-white/25 italic">All clear — no pending tasks.</p>
              ) : intelTasks.map((task, i) => (
                <div key={task.id} className="flex items-center gap-3 group">
                  <span className={cn(
                    'text-[9px] font-black w-4 text-center tabular-nums shrink-0',
                    i === 0 ? 'text-focus-cyan' : i === 1 ? 'text-white/30' : 'text-white/20'
                  )}>#{i + 1}</span>
                  <p className={cn(
                    "text-xs font-medium truncate transition-colors",
                    i === 0 ? 'text-white/90' : 'text-white/50'
                  )}>{task.text}</p>
                  {i === 0 && <span className="shrink-0 text-[9px] font-black text-focus-cyan/60 bg-focus-cyan/10 px-1.5 py-0.5 rounded-md">NOW</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch bg-white/[0.06]" />

          {/* Peak Hour */}
          <div className="text-center shrink-0">
            <p className="text-[9px] text-white/25 uppercase tracking-[0.18em] font-bold mb-2">
              {isInPeakHour ? '⚡ Peak Window' : 'Peak Hour'}
            </p>
            <p className={cn('text-2xl font-black tabular-nums', isInPeakHour ? 'text-focus-cyan' : 'text-white/40')}>{peakTimeLabel}</p>
            {isInPeakHour && (
              <p className="text-[9px] text-focus-cyan/60 mt-1 font-bold">You're in it now</p>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch bg-white/[0.06]" />

          {/* Status badges */}
          <div className="flex flex-col gap-2 shrink-0 justify-center">
            {overdueCount > 0 && (
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                {overdueCount} Overdue
              </span>
            )}
            {habits.length > 0 && (
              <span className={cn(
                'text-[9px] font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5',
                habitsCompletedToday === habits.length
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
              )}>
                <span className={cn("w-1 h-1 rounded-full", habitsCompletedToday === habits.length ? "bg-emerald-500" : "bg-orange-500")} />
                {habitsCompletedToday}/{habits.length} Habits
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Add + Habits ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Add Task */}
        <section className="col-span-2 dashboard-card p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-white/60" />
              </div>
              <span className="text-sm font-semibold text-white/70">Quick Add Task</span>
            </div>
            {/* Daily goal progress */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest text-white/20 font-bold">Daily Focus Goal</p>
                <div className="flex items-center gap-2 justify-end mt-0.5">
                  {focusStreak > 0 && (
                    <span className="text-[10px] font-black text-orange-500 flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> {focusStreak}d
                    </span>
                  )}
                  <p className="text-xs font-bold text-white/60 tabular-nums">{focusedTodayMinutes}<span className="text-white/25">/{dailyGoalMinutes}m</span></p>
                </div>
              </div>
              <div className="relative w-28 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    progressPct >= 100
                      ? "bg-emerald-500 shadow-[0_0_12px_#10b981]"
                      : "bg-accent shadow-[0_0_12px_var(--accent)]"
                  )}
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleAddTask} className="flex flex-col gap-3">
            <input
              value={dashboardNewTaskText}
              onChange={e => setDashboardNewTaskText(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] focus:border-accent/40 rounded-xl py-3.5 px-5 text-sm focus:outline-none transition-all font-medium placeholder:text-white/20"
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={dashboardNewTaskPriority}
                onChange={e => setDashboardNewTaskPriority(e.target.value as Priority)}
                className="bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-xl px-4 py-2.5 text-xs font-bold text-white/50 focus:outline-none appearance-none w-28 text-center cursor-pointer transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={dashboardDueDate}
                onChange={e => setDashboardDueDate(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-xl px-4 py-2.5 text-xs font-bold text-white/50 focus:outline-none w-36 cursor-pointer transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  setTempRecurrence(dashboardRecurrence || { interval: 1, unit: 'day', ends: 'never' });
                  setShowRecurrenceModal(true);
                }}
                className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center justify-center",
                  dashboardRecurrence
                    ? "bg-accent/15 border-accent/40 text-accent"
                    : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white hover:border-white/20"
                )}
                title="Repeat Task"
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="ml-auto bg-accent hover:opacity-90 active:scale-95 transition-all px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg text-white"
                style={{ boxShadow: '0 4px 20px var(--accent)40' }}
              >
                Add Task
              </button>
            </div>
          </form>
        </section>

        {/* Recurrence Modal */}
        <AnimatePresence>
          {showRecurrenceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#131a1a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-white text-sm">
                <h3 className="text-lg font-bold mb-6">Repeats every</h3>
                <div className="flex gap-4 mb-6">
                  <input type="number" min="1" value={tempRecurrence.interval} onChange={e => setTempRecurrence({...tempRecurrence, interval: parseInt(e.target.value) || 1})} className="w-16 bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-white/25" />
                  <select value={tempRecurrence.unit} onChange={e => setTempRecurrence({...tempRecurrence, unit: e.target.value})} className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none cursor-pointer">
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                    <option value="year">year</option>
                  </select>
                </div>
                <div className="mb-6">
                  <h3 className="text-white/50 mb-2 font-bold text-xs uppercase tracking-widest">Starts</h3>
                  <input type="date" value={dashboardDueDate} onChange={e => setDashboardDueDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none cursor-pointer" />
                </div>
                <div className="mb-8">
                  <h3 className="text-white/50 mb-3 font-bold text-xs uppercase tracking-widest">Ends</h3>
                  <div className="space-y-3">
                    {[
                      { val: 'never', label: 'Never' },
                      { val: 'on', label: 'On' },
                      { val: 'after', label: 'After' },
                    ].map(opt => (
                      <label key={opt.val} className="flex items-center gap-3 cursor-pointer">
                        <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", tempRecurrence.ends === opt.val ? "border-accent bg-accent/20" : "border-white/20")} onClick={() => setTempRecurrence({...tempRecurrence, ends: opt.val})}>
                          {tempRecurrence.ends === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </div>
                        <span className="w-12 text-sm">{opt.label}</span>
                        {opt.val === 'on' && (
                          <input type="date" value={tempRecurrence.endDate || ''} disabled={tempRecurrence.ends !== 'on'} onChange={e => setTempRecurrence({...tempRecurrence, endDate: e.target.value})} className={cn("flex-1 bg-white/5 border border-white/10 rounded-lg p-2 focus:outline-none text-xs", tempRecurrence.ends !== 'on' && "opacity-30 pointer-events-none")} />
                        )}
                        {opt.val === 'after' && (
                          <>
                            <input type="number" min="1" value={tempRecurrence.endOccurrences || ''} disabled={tempRecurrence.ends !== 'after'} onChange={e => setTempRecurrence({...tempRecurrence, endOccurrences: parseInt(e.target.value) || 1})} className={cn("w-16 bg-white/5 border border-white/10 rounded-lg p-2 focus:outline-none text-xs", tempRecurrence.ends !== 'after' && "opacity-30 pointer-events-none")} />
                            <span className={cn("text-sm", tempRecurrence.ends !== 'after' && "opacity-30")}>occurrences</span>
                          </>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 font-bold">
                  <button onClick={() => { setDashboardRecurrence(null); setShowRecurrenceModal(false); }} className="px-5 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-all">Clear</button>
                  <button onClick={() => { setDashboardRecurrence(tempRecurrence); setShowRecurrenceModal(false); }} className="px-6 py-2 bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 rounded-xl transition-all">Done</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Daily Habits */}
        <section className="col-span-1 dashboard-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <span className="text-sm font-semibold text-white/70">Daily Habits</span>
            </div>
            <div className="flex items-center gap-2">
              {habits.length > 0 && (
                <span className="text-[10px] font-bold text-white/30 tabular-nums">{habitsCompletedToday}/{habits.length}</span>
              )}
              <button onClick={() => setShowHabitModal(true)} className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white flex items-center justify-center transition-all">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {habits.length > 0 && (
            <div className="h-0.5 bg-white/[0.05] rounded-full mb-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(habitsCompletedToday / habits.length) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn("h-full rounded-full", habitsCompletedToday === habits.length ? "bg-emerald-500" : "bg-orange-500")}
              />
            </div>
          )}

          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 flex-1">
            {habits.map(h => {
              const isDoneToday = h.lastCompletedAt && new Date(h.lastCompletedAt).toDateString() === new Date().toDateString();
              return (
                <div key={h.id} className="flex items-center justify-between group py-1">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={async () => {
                        await axios.patch(`${API_BASE}/habits/${h.id}/toggle`);
                        if (!isDoneToday) addXP(15, 'Completed Daily Habit');
                        fetchHabits();
                      }}
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                        isDoneToday
                          ? "bg-emerald-500 border-emerald-500 text-black shadow-[0_0_8px_#10b981]"
                          : "border-white/15 hover:border-white/30"
                      )}
                    >
                      {isDoneToday && <Check className="w-3 h-3" />}
                    </button>
                    <span className={cn("text-xs font-medium transition-colors", isDoneToday ? "text-white/30 line-through" : "text-white/70")}>{h.title}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-orange-500 flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5" /> {h.streak}
                    </span>
                    <button onClick={async () => { if (confirm("Reset streak?")) { await axios.patch(`${API_BASE}/habits/${h.id}/reset`); fetchHabits(); }}} className="text-white/20 hover:text-white transition-colors" title="Reset Streak"><RotateCcw className="w-3 h-3"/></button>
                    <button onClick={async () => { if (confirm("Delete?")) await axios.delete(`${API_BASE}/habits/${h.id}`); }} className="text-red-500/40 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3"/></button>
                  </div>
                </div>
              );
            })}
            {habits.length === 0 && (
              <div className="text-center text-white/20 text-xs mt-6 space-y-2">
                <Flame className="w-6 h-6 text-white/10 mx-auto" />
                <p>No habits yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Focus Hours',
            value: totalFocusHours,
            suffix: 'h',
            icon: Zap,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            glow: '0 0 20px rgba(16,185,129,0.15)'
          },
          {
            label: 'Tasks Done',
            value: tasks.filter(t => t.completed).length,
            suffix: '',
            icon: CheckCircle2,
            color: 'text-accent',
            bg: 'bg-accent/10',
            glow: '0 0 20px var(--accent)20'
          },
          {
            label: 'Sessions',
            value: focusSessions.filter(s=>s.mode==='work').length,
            suffix: '',
            icon: Trophy,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            glow: '0 0 20px rgba(168,85,247,0.15)'
          },
          {
            label: 'Sub-Tasks',
            value: tasks.reduce((acc, t) => acc + (t.subTasks?.length || 0), 0),
            suffix: '',
            icon: LayoutList,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            glow: '0 0 20px rgba(245,158,11,0.15)'
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.3 }}
            className="dashboard-card p-5 flex flex-col gap-3 cursor-default group"
            style={{ boxShadow: undefined }}
            whileHover={{ y: -3, boxShadow: stat.glow } as any}
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all", stat.bg)}>
              <stat.icon className={cn("w-4.5 h-4.5", stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-white">
                {stat.value}<span className="text-base text-white/40">{stat.suffix}</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── What Should I Work On? ── */}
      <div className="relative">
        <WhatNowPanel
          tasks={tasks}
          focusSessions={focusSessions}
          aiConfig={aiConfig}
          peakTimeLabel={peakTimeLabel}
          isInPeakHour={isInPeakHour}
          onNavigateSettings={() => setView('settings')}
        />
      </div>

      {/* ── Heatmap + Live Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 dashboard-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-white/40" />
              <span className="text-sm font-semibold text-white/60">Activity Heatmap</span>
            </div>
            <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Last 365 days</span>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 53 }).map((_, wi) => (
              <div key={wi} className="flex flex-col gap-[3px] shrink-0">
                {Array.from({ length: 7 }).map((_, di) => {
                  const cell = heatmapData[wi * 7 + di];
                  return (
                    <div
                      key={di}
                      title={cell ? `${cell.count} tasks on ${cell.date}` : ""}
                      className={cn(
                        "w-2.5 h-2.5 rounded-[2px] transition-transform hover:scale-150 hover:z-[60] cursor-pointer",
                        !cell || cell.level === 0 ? "bg-white/[0.04]" :
                        cell.level === 1 ? "bg-accent/25" :
                        cell.level === 2 ? "bg-accent/50" :
                        cell.level === 3 ? "bg-accent/75" : "bg-accent"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 justify-end">
            <span className="text-[9px] text-white/20 mr-1">Less</span>
            {[0, 1, 2, 3, 4].map(l => (
              <div key={l} className={cn("w-2.5 h-2.5 rounded-[2px]",
                l === 0 ? "bg-white/[0.04]" :
                l === 1 ? "bg-accent/25" :
                l === 2 ? "bg-accent/50" :
                l === 3 ? "bg-accent/75" : "bg-accent"
              )} />
            ))}
            <span className="text-[9px] text-white/20 ml-1">More</span>
          </div>
        </section>

        <section className="lg:col-span-4 dashboard-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-400/60" />
            <span className="text-sm font-semibold text-white/60">Live Activity</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[160px]">
            {activityData.slice(0, 10).map((act, i) => (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.04] transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-accent" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/70">Task Completed</p>
                  <p className="text-[9px] text-white/30 mt-0.5">
                    {act && act.completedAt && !isNaN(new Date(act.completedAt).getTime())
                      ? new Date(act.completedAt).toLocaleString()
                      : 'Unknown Date'}
                  </p>
                </div>
              </motion.div>
            ))}
            {activityData.length === 0 && (
              <div className="text-center text-white/20 text-xs mt-6">No recent activity</div>
            )}
          </div>
        </section>
      </div>

      {/* ── Analytics: Radar + Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Life Balance Radar */}
        <section className="dashboard-card p-6 flex flex-col min-h-[260px]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white/60">Life Balance</span>
            <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">This Year</span>
          </div>
          <div className="flex-1 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 600 }} />
                <Radar name="Achieved" dataKey="Achieved" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={1.5} />
                <Radar name="Total" dataKey="Total" stroke="rgba(255,255,255,0.1)" fill="rgba(255,255,255,0.03)" fillOpacity={1} strokeWidth={1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-3">
            {CATEGORIES.map(c => (
              <span key={c} className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-white/30">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_DOT_COLORS[c] }} />
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* Peak Productivity Bar */}
        <section className="dashboard-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400/60" />
              <span className="text-sm font-semibold text-white/60">Peak Productivity</span>
            </div>
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-black">Local</span>
          </div>
          <div className="flex-1 w-full min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.1)" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#080d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '11px' }}
                />
                <Bar dataKey="tasks" fill="var(--accent)" radius={[3, 3, 0, 0]}>
                  {peakHoursData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.tasks === maxTasks ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}
                      style={entry.tasks === maxTasks ? { filter: 'drop-shadow(0 0 4px var(--accent))' } : {}}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* ── Goal Insights Chart + Weekly Report ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-8">
        {/* Weekly report + mini stats */}
        <div className="lg:col-span-4 space-y-4">
          <div className="dashboard-card p-5 bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.05]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                <Trophy className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Weekly Report</p>
                <p className="text-sm font-bold text-white/80 mt-0.5">
                  {focusSessions.filter(s=>s.mode==='work' && isSameWeek(new Date(s.completedAt), new Date())).length} sessions
                </p>
              </div>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Best day: <span className="text-white/70 font-semibold">{(() => {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const map = new Map();
                focusSessions.forEach(s => { const d = new Date(s.completedAt).getDay(); map.set(d, (map.get(d)||0) + s.duration); });
                let max = -1, day = 'N/A';
                map.forEach((v,k) => { if(v>max){ max=v; day=days[k]; } });
                return day;
              })()}</span>
            </p>
          </div>

          <button onClick={() => setView('performance')} className="dashboard-card p-5 w-full text-left flex items-center gap-3 hover:border-accent/20 transition-colors group">
            <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white/70">Performance Engine</p>
              <p className="text-[10px] text-white/30 mt-0.5">View detailed analytics</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* Goal Insights Chart */}
        <div className="lg:col-span-8 dashboard-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white/40" />
              <span className="text-sm font-semibold text-white/60">Goal Insights</span>
            </div>
            <div className="flex bg-white/[0.04] p-1 rounded-xl gap-0.5">
              {(['weekly', 'monthly', 'yearly'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setChartTab(t)}
                  className={cn(
                    "relative px-3 py-1.5 text-[10px] font-bold capitalize rounded-lg transition-all",
                    chartTab === t ? "text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  {chartTab === t && (
                    <motion.div layoutId="chart-tab" className="absolute inset-0 rounded-lg bg-white/10 border border-white/10" transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
                  )}
                  <span className="relative z-10">{t}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const chartData = (() => {
                  const workspaceSessions = focusSessions.filter(s => s.mode === 'work');
                  if (chartTab === 'weekly') {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const durations = new Array(7).fill(0);
                    const today = startOfDay(new Date());
                    workspaceSessions.forEach(s => {
                      const date = new Date(s.completedAt);
                      if (isSameWeek(date, today)) durations[date.getDay()] += Math.round(s.duration / 60);
                    });
                    return days.map((day, i) => ({ name: day, minutes: durations[i] }));
                  } else if (chartTab === 'monthly') {
                    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                    const data = Array.from({ length: daysInMonth }, (_, i) => ({ name: `${i + 1}`, minutes: 0 }));
                    workspaceSessions.forEach(s => {
                      const date = new Date(s.completedAt);
                      if (isSameMonth(date, new Date())) data[date.getDate() - 1].minutes += Math.round(s.duration / 60);
                    });
                    return data;
                  } else {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const data = months.map(m => ({ name: m, minutes: 0 }));
                    workspaceSessions.forEach(s => {
                      const date = new Date(s.completedAt);
                      if (date.getFullYear() === new Date().getFullYear()) data[date.getMonth()].minutes += Math.round(s.duration / 60);
                    });
                    return data;
                  }
                })();

                return (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: chartTab === 'monthly' ? 8 : 10 }} dy={8} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#080d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginBottom: '4px' }}
                      itemStyle={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(val: number) => [`${val} min`, 'Focus Time']}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={chartTab==='monthly'?10:32}>
                      {chartData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill="var(--accent)" fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                );
              })()}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {showHabitModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              className="dashboard-card p-8 w-full max-w-sm relative"
            >
              <button onClick={() => setShowHabitModal(false)} className="absolute top-6 right-6 p-2 text-white/30 hover:text-white rounded-xl hover:bg-white/5 transition-all"><X className="w-5 h-5"/></button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold">New Daily Habit</h2>
              </div>
              <div className="space-y-3">
                <input
                  autoFocus
                  value={newHabitTitle}
                  onChange={e => setNewHabitTitle(e.target.value)}
                  placeholder="e.g. Drink 2L Water"
                  className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] focus:border-orange-500/40 rounded-2xl py-4 px-6 focus:outline-none transition-all"
                  onKeyDown={e => e.key==='Enter' && saveHabit()}
                />
                <button
                  onClick={saveHabit}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-400 active:scale-95 text-white rounded-2xl font-bold text-sm shadow-xl transition-all"
                  style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}
                >
                  Start Tracking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
