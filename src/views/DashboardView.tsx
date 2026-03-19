import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Activity, Zap, CheckCircle2, Trophy, LayoutList, BarChart3, Flame, Check, Trash2, X, RotateCcw, TreePine } from 'lucide-react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { startOfDay, isSameWeek, isSameMonth } from 'date-fns';
import { cn } from '../utils';
import { Task, Priority, Habit, Profile } from '../types';
import axios from 'axios';

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
  setDashboardDueDate: (v: string) => void;
  handleAddTask: (e?: React.FormEvent) => void;
  setView: (v: string) => void;
  toggleTask: (id: string) => void;
  habits: Habit[];
  fetchHabits: () => Promise<void>;
  addXP: (amount: number, reason: string) => Promise<void>;
  workspace: string;
  profile: Profile | null;
  focusSessions: any[];
  dailyGoalMinutes: number;
  focusedTodayMinutes: number;
}

export function DashboardView({
  tasks, activityData, heatmapData, dashboardNewTaskText, setDashboardNewTaskText,
  dashboardNewTaskPriority, setDashboardNewTaskPriority, dashboardDueDate, setDashboardDueDate,
  handleAddTask, setView, toggleTask, habits, fetchHabits, addXP, workspace, profile,
  focusSessions, dailyGoalMinutes, focusedTodayMinutes
}: DashboardProps) {
  const [chartTab, setChartTab] = useState<'weekly'|'monthly'|'yearly'>('weekly');
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');

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
      const hr = new Date(act.completedAt).getHours();
      buckets[hr].tasks += 1;
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
                  <p className="text-xs font-bold text-white/60">{focusedTodayMinutes} / {dailyGoalMinutes}m</p>
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
              <button type="submit" className="bg-accent hover:opacity-90 transition-all px-6 py-3.5 rounded-xl font-bold text-sm shadow-xl whitespace-nowrap text-white">Add Task</button>
            </div>
          </form>
        </section>

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

      {/* Heatmap */}
      <section className="bg-panel border border-white/5 rounded-2xl p-5 shadow-2xl">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        {/* Zen Garden */}
        <section className="bg-panel border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-[250px]">
           <div className="absolute top-6 left-6 flex items-center gap-2 text-white/60 text-sm font-medium"><TreePine className="w-4 h-4 text-emerald-500" /> Focus Garden</div>
           <div className="relative flex items-end justify-center h-40 mt-6 w-full max-w-[200px]">
             <div className="absolute bottom-0 w-[150%] left-[-25%] h-2 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full" />
             <TreePine 
               className="text-emerald-500 mb-1 transition-all duration-1000 origin-bottom" 
               style={{ 
                 width: Math.min(180, 40 + (profile?.level || 1) * 8), 
                 height: Math.min(180, 40 + (profile?.level || 1) * 8),
                 filter: `drop-shadow(0 0 ${Math.min(20, (profile?.level || 1))}px rgba(16, 185, 129, 0.4))`
               }} 
             />
           </div>
           <p className="mt-6 text-white/40 text-[10px] font-bold uppercase tracking-widest text-center">Level {profile?.level || 1} Scholar Tree</p>
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
              <BarChart data={(() => {
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
              })()}>
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
                  {(new Array(31).fill(0)).map((_, i) => (
                    <Cell key={i} fill="var(--accent)" fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
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
