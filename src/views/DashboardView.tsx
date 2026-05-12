import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Activity, Zap, CheckCircle2, Trophy, LayoutList, BarChart3, Flame, Check, Trash2, X, RotateCcw, TreePine, Dog, Bird, Clock, Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { startOfDay, isSameWeek, isSameMonth } from 'date-fns';
import { cn } from '../utils';
import { Task, Priority, Habit, Profile, Goal, GoalCategory, AppView } from '../types';
import axios from 'axios';

const CATEGORIES: GoalCategory[] = ['Health', 'Career', 'Finance', 'Education', 'Personal'];
const CATEGORY_COLORS: Record<GoalCategory, string> = {
  Health: 'bg-emerald-500', Career: 'bg-accent', Finance: 'bg-amber-500', Education: 'bg-purple-500', Personal: 'bg-pink-500'
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
}

export function DashboardView({
  tasks, activityData, heatmapData, dashboardNewTaskText, setDashboardNewTaskText,
  dashboardNewTaskPriority, setDashboardNewTaskPriority, dashboardDueDate, setDashboardDueDate,
  dashboardRecurrence, setDashboardRecurrence,
  handleAddTask, setView, toggleTask, habits, fetchHabits, addXP, workspace, profile,
  focusSessions, dailyGoalMinutes, focusedTodayMinutes, goals
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
    // Start from today or yesterday
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

    const displayData = buckets.slice(6, 23); // Show 6 AM to 10 PM
    const max = Math.max(...displayData.map(d => d.tasks), 1);
    return { peakHoursData: displayData, maxTasks: max };
  }, [activityData]);

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6 max-w-6xl mx-auto">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Add Task */}
        <section className="col-span-2 bg-panel border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><Plus className="w-4 h-4" /> Quick Add Task</div>
            <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold">Daily Work Goal</p>
                  <div className="flex items-center gap-2 justify-end">
                    {focusStreak > 0 && <span className="text-[10px] font-black text-orange-500 flex items-center gap-0.5"><Flame className="w-3 h-3"/> {focusStreak} Day Streak</span>}
                    <p className="text-xs font-bold text-white/60">{focusedTodayMinutes} / {dailyGoalMinutes}m</p>
                  </div>
               </div>
               <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min(100, (focusedTodayMinutes / dailyGoalMinutes) * 100)}%` }} 
                    className={cn("h-full transition-all duration-1000", focusedTodayMinutes >= dailyGoalMinutes ? "bg-emerald-500 shadow-[0_0_15px_#10b981]" : "bg-accent shadow-[0_0_15px_var(--accent)]")} 
                  />
               </div>
            </div>
          </div>
          <form onSubmit={handleAddTask} className="flex flex-col lg:flex-row gap-3">
            <input value={dashboardNewTaskText} onChange={e => setDashboardNewTaskText(e.target.value)} placeholder="What needs to be done?" className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3.5 px-6 text-sm focus:outline-none focus:border-accent/40 transition-all font-medium" />
            <div className="flex gap-2 shrink-0">
              <select value={dashboardNewTaskPriority} onChange={e => setDashboardNewTaskPriority(e.target.value as Priority)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-bold text-white/60 focus:outline-none appearance-none w-28 text-center cursor-pointer hover:border-white/20">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input type="date" value={dashboardDueDate} onChange={e => setDashboardDueDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-bold text-white/60 focus:outline-none w-36 cursor-pointer hover:border-white/20" />
              <button type="button" onClick={() => {
                 setTempRecurrence(dashboardRecurrence || { interval: 1, unit: 'day', ends: 'never' });
                 setShowRecurrenceModal(true);
              }} className={cn("p-3.5 rounded-xl border transition-all flex items-center justify-center", dashboardRecurrence ? "bg-accent/20 border-accent/50 text-accent" : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20")} title="Repeat Task">
                 <Repeat className="w-4 h-4" />
              </button>
              <button type="submit" className="bg-accent hover:opacity-90 transition-all px-6 py-3.5 rounded-xl font-bold text-sm shadow-xl whitespace-nowrap text-white">Add Task</button>
            </div>
          </form>
        </section>

      <AnimatePresence>
        {showRecurrenceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl p-6 text-white text-sm">
                <h3 className="text-lg font-bold mb-6">Repeats every</h3>
                <div className="flex gap-4 mb-6">
                   <input type="number" min="1" value={tempRecurrence.interval} onChange={e => setTempRecurrence({...tempRecurrence, interval: parseInt(e.target.value) || 1})} className="w-16 bg-[#3a3a3a] border-none rounded-lg p-3 focus:outline-none" />
                   <select value={tempRecurrence.unit} onChange={e => setTempRecurrence({...tempRecurrence, unit: e.target.value})} className="flex-1 bg-[#3a3a3a] border-none rounded-lg p-3 focus:outline-none cursor-pointer">
                      <option value="day">day</option>
                      <option value="week">week</option>
                      <option value="month">month</option>
                      <option value="year">year</option>
                   </select>
                </div>

                <div className="mb-6">
                   <h3 className="text-white/60 mb-2 font-bold">Starts</h3>
                   <input type="date" value={dashboardDueDate} onChange={e => setDashboardDueDate(e.target.value)} className="w-full bg-[#3a3a3a] border-none rounded-lg p-3 focus:outline-none cursor-pointer" />
                </div>

                <div className="mb-8">
                   <h3 className="text-white/60 mb-3 font-bold">Ends</h3>
                   <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                         <input type="radio" name="ends" checked={tempRecurrence.ends === 'never'} onChange={() => setTempRecurrence({...tempRecurrence, ends: 'never'})} className="w-4 h-4 accent-blue-400" />
                         <span>Never</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                         <input type="radio" name="ends" checked={tempRecurrence.ends === 'on'} onChange={() => setTempRecurrence({...tempRecurrence, ends: 'on', endDate: tempRecurrence.endDate || new Date().toISOString().split('T')[0]})} className="w-4 h-4 accent-blue-400" />
                         <span className="w-16">On</span>
                         <input type="date" value={tempRecurrence.endDate || ''} disabled={tempRecurrence.ends !== 'on'} onChange={e => setTempRecurrence({...tempRecurrence, endDate: e.target.value})} className={cn("flex-1 bg-[#3a3a3a] rounded-lg p-2 focus:outline-none text-xs", tempRecurrence.ends !== 'on' && "opacity-50 pointer-events-none")} />
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                         <input type="radio" name="ends" checked={tempRecurrence.ends === 'after'} onChange={() => setTempRecurrence({...tempRecurrence, ends: 'after', endOccurrences: tempRecurrence.endOccurrences || 30})} className="w-4 h-4 accent-blue-400" />
                         <span className="w-16">After</span>
                         <input type="number" min="1" value={tempRecurrence.endOccurrences || ''} disabled={tempRecurrence.ends !== 'after'} onChange={e => setTempRecurrence({...tempRecurrence, endOccurrences: parseInt(e.target.value) || 1})} className={cn("w-16 bg-[#3a3a3a] rounded-lg p-2 focus:outline-none text-xs", tempRecurrence.ends !== 'after' && "opacity-50 pointer-events-none")} />
                         <span className={cn(tempRecurrence.ends !== 'after' && "opacity-50")}>occurrences</span>
                      </label>
                   </div>
                </div>

                <div className="flex justify-end gap-3 font-bold">
                   <button onClick={() => { setDashboardRecurrence(null); setShowRecurrenceModal(false); }} className="px-5 py-2 text-white hover:bg-white/10 rounded-full transition-all">Clear</button>
                   <button onClick={() => { setDashboardRecurrence(tempRecurrence); setShowRecurrenceModal(false); }} className="px-6 py-2 bg-blue-300 text-blue-900 hover:bg-blue-200 rounded-full transition-all">Done</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Daily Habits Tracker */}
        <section className="col-span-1 bg-panel border border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><Flame className="w-4 h-4 text-orange-500" /> Daily Habits</div>
             <button onClick={() => setShowHabitModal(true)} className="text-white/20 hover:text-white"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3 max-h-[140px] overflow-y-auto pr-2 scrollbar-hide flex-1">
             {habits.map(h => {
                const isDoneToday = h.lastCompletedAt && new Date(h.lastCompletedAt).toDateString() === new Date().toDateString();
                return (
                  <div key={h.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <button onClick={async () => {
                         await axios.patch(`${API_BASE}/habits/${h.id}/toggle`);
                         if (!isDoneToday) addXP(15, 'Completed Daily Habit');
                         fetchHabits();
                       }} className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-all", isDoneToday ? "bg-emerald-500 border-emerald-500 text-black" : "border-white/20 hover:border-white/40")}>
                         {isDoneToday && <Check className="w-3.5 h-3.5" />}
                       </button>
                       <span className={cn("text-xs font-medium transition-colors", isDoneToday && "text-white/40 line-through")}>{h.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full"><Flame className="w-3 h-3" /> {h.streak}</span>
                      <button onClick={async () => {
                         if (confirm("Reset this habit's streak to 0?")) {
                           await axios.patch(`${API_BASE}/habits/${h.id}/reset`);
                           fetchHabits();
                         }
                      }} className="text-white/40 hover:text-white transition-colors" title="Reset Streak"><RotateCcw className="w-3.5 h-3.5"/></button>
                      <button onClick={async () => {
                         if (confirm("Delete this habit?")) await axios.delete(`${API_BASE}/habits/${h.id}`);
                      }} className="text-red-500/60 hover:text-red-500 transition-colors" title="Delete Habit"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                )
             })}
             {habits.length === 0 && (
                <div className="text-center text-white/20 text-xs mt-4">No habits added.</div>
             )}
          </div>
        </section>
      </div>

      {/* Heatmap & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-panel border border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><Activity className="w-4 h-4" /> Activity Heatmap</div>
            <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Last 365 days</span>
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
                        "w-2.5 h-2.5 rounded-[2px] transition-transform hover:scale-125 hover:z-[60] cursor-pointer",
                        !cell || cell.level === 0 ? "bg-panel-dark" :
                        cell.level === 1 ? "bg-accent/30" :
                        cell.level === 2 ? "bg-accent/60" :
                        cell.level === 3 ? "bg-accent/80" : "bg-accent"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 bg-panel border border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><Clock className="w-4 h-4 text-blue-400" /> Live Activity Feed</div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide max-h-[140px] relative">
            {activityData.slice(0, 10).map((act, i) => (
              <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} transition={{delay: i*0.1}} key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white/80">Task Completed</p>
                  <p className="text-[10px] text-white/40">
                    {act && act.completedAt && !isNaN(new Date(act.completedAt).getTime()) 
                      ? new Date(act.completedAt).toLocaleString() 
                      : 'Unknown Date'}
                  </p>
                </div>
              </motion.div>
            ))}
            {activityData.length === 0 && <div className="text-center text-white/20 text-xs mt-4">No recent activity</div>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        {/* Life Balance Radar Chart */}
        <section className="bg-panel border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col min-h-[250px]">
          <h3 className="text-sm font-bold text-white/60 mb-4 text-center">Life Balance</h3>
          <div className="flex-1 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="var(--panel-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name="Achieved" dataKey="Achieved" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.5} />
                <Radar name="Total" dataKey="Total" stroke="var(--panel-border)" fill="var(--text-main)" fillOpacity={0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {CATEGORIES.map(c => (
              <span key={c} className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-white/40">
                <div className={cn("w-2 h-2 rounded-full", CATEGORY_COLORS[c])} /> {c}
              </span>
            ))}
          </div>
        </section>

        {/* Peak Output Analytics */}
        <section className="bg-panel border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><BarChart3 className="w-4 h-4 text-blue-400" /> Peak Productivity</div>
             <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-black">Local</span>
           </div>
           <div className="flex-1 w-full h-full min-h-[150px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={peakHoursData}>
                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                 <XAxis dataKey="hour" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                 <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} />
                 <Bar dataKey="tasks" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                   {peakHoursData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.tasks === maxTasks ? 'var(--accent)' : 'rgba(255,255,255,0.1)'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </section>
      </div>

      {/* Stats & Consolidated Goal Insights Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          {[
            { label: 'Total Focus', value: `${Math.round(focusSessions.filter(s=>s.mode==='work').reduce((a,b)=>a+b.duration, 0) / 60)}m`, icon: Zap, color: 'text-emerald-400' },
            { label: 'Tasks Done', value: tasks.filter(t => t.completed).length, icon: CheckCircle2, color: 'text-accent' },
            { label: 'Sessions', value: focusSessions.filter(s=>s.mode==='work').length, icon: Trophy, color: 'text-purple-400' },
            { label: 'Sub-Tasks', value: tasks.reduce((acc, t) => acc + (t.subTasks?.length || 0), 0), icon: LayoutList, color: 'text-amber-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-panel border border-white/5 rounded-2xl p-5 hover:bg-white/[0.02] transition-colors flex flex-col items-center text-center justify-center">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mb-3"><stat.icon className={cn("w-5 h-5", stat.color)} /></div>
              <p className="text-2xl font-bold mb-1">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{stat.label}</p>
            </div>
          ))}
          
          <div className="col-span-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400"><Trophy className="w-6 h-6" /></div>
             <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Weekly Report</p>
                <p className="text-xs font-medium text-white/60">You've completed <span className="text-white font-bold">{focusSessions.filter(s=>s.mode==='work' && isSameWeek(new Date(s.completedAt), new Date())).length}</span> sessions this week. Best day: <span className="text-white font-bold">{(() => {
                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const map = new Map();
                  focusSessions.forEach(s => {
                    const d = new Date(s.completedAt).getDay();
                    map.set(d, (map.get(d)||0) + s.duration);
                  });
                  let max = -1, day = 'N/A';
                  map.forEach((v,k) => { if(v>max){ max=v; day=days[k]; } });
                  return day;
                })()}</span></p>
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-panel border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><BarChart3 className="w-4 h-4" /> Goal Insights</div>
            <div className="flex bg-white/5 p-1 rounded-xl">
              {['weekly', 'monthly', 'yearly'].map(t => (
                <button 
                  key={t} onClick={() => setChartTab(t as any)} 
                  className={cn("px-4 py-1.5 text-xs font-bold capitalize rounded-lg transition-all", chartTab === t ? "bg-white text-black shadow-md" : "text-white/40 hover:text-white")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[220px] w-full mt-4">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: chartTab === 'monthly' ? 8 : 10 }} dy={10} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.02)'}} 
                      contentStyle={{backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'}} 
                      labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px' }}
                      itemStyle={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(val: number) => [`${val} min`, 'Focus Time']}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={chartTab==='monthly'?12:32}>
                      {chartData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill="var(--accent)" fillOpacity={0.8} />
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
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-white/10 rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setShowHabitModal(false)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                   <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold">New Daily Habit</h2>
              </div>
              <div className="space-y-4">
                <input autoFocus value={newHabitTitle} onChange={e=>setNewHabitTitle(e.target.value)} placeholder="e.g. Drink 2L Water" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20" onKeyDown={e => e.key==='Enter' && saveHabit()} />
                <button onClick={saveHabit} className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-bold text-sm shadow-xl transition-all">Start Tracking</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
