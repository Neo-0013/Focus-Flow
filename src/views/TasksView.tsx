import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListTodo, Plus, Calendar, CheckCircle2, Circle, ChevronDown, Trash2, Check, X, Target, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils';
import { Task, Priority, Goal } from '../types';
import axios from 'axios';

const API_BASE = 'http://localhost:3002';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-accent/10 text-accent border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface TasksProps {
  tasks: Task[];
  dashboardNewTaskText: string;
  setDashboardNewTaskText: (v: string) => void;
  dashboardNewSubTask: string;
  setDashboardNewSubTask: (v: string) => void;
  dashboardNewSubTasks: string[];
  setDashboardNewSubTasks: React.Dispatch<React.SetStateAction<string[]>>;
  dashboardNewTaskPriority: Priority;
  setDashboardNewTaskPriority: (v: Priority) => void;
  dashboardDueDate: string;
  setDashboardDueDate: (v: string) => void;
  dashboardNewTaskGoalId: string;
  setDashboardNewTaskGoalId: (v: string) => void;
  handleAddTask: (e?: React.FormEvent) => void;
  addDashboardSubTask: () => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  expandedTasks: Set<string>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  archiveCompletedTasks: () => Promise<void>;
}

export function TasksView({
  tasks, goals, dashboardNewTaskText, setDashboardNewTaskText,
  dashboardNewSubTask, setDashboardNewSubTask, dashboardNewSubTasks, setDashboardNewSubTasks,
  dashboardNewTaskPriority, setDashboardNewTaskPriority, dashboardDueDate, setDashboardDueDate,
  dashboardNewTaskGoalId, setDashboardNewTaskGoalId,
  handleAddTask, addDashboardSubTask, toggleTask, deleteTask, expandedTasks, setExpandedTasks,
  archiveCompletedTasks
}: TasksProps & { goals: Goal[] }) {
  const [showCompleted, setShowCompleted] = React.useState(true);
  const filteredTasks = (showCompleted ? tasks : tasks.filter(t => !t.completed)).filter(t => !t.archived);

  return (
    <motion.div key="tasks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <ListTodo className="w-6 h-6" /> Tasks <span className="text-white/20 text-sm font-normal">({tasks.filter(t => !t.completed).length} active)</span>
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                showCompleted ? "bg-white/5 border-white/10 text-white/40 hover:text-white" : "bg-accent/10 border-accent/30 text-accent"
              )}
            >
              {showCompleted ? "Hide Completed" : "Show Completed"}
            </button>
            <button 
              onClick={archiveCompletedTasks}
              title="Archive and hide completed tasks"
              className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-panel border border-white/5 rounded-[32px] p-6 space-y-4 shadow-2xl">
          <div className="relative">
            <Plus className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input 
              value={dashboardNewTaskText} 
              onChange={e => setDashboardNewTaskText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a new task..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-lg focus:outline-none focus:border-white/20 transition-all" 
            />
          </div>
          <div className="relative">
            <input 
              value={dashboardNewSubTask} 
              onChange={e => setDashboardNewSubTask(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDashboardSubTask())} 
              placeholder="Add sub-tasks (press Enter)" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-6 text-sm focus:outline-none focus:border-white/20 transition-all" 
            />
            <button type="button" onClick={addDashboardSubTask} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {dashboardNewSubTasks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dashboardNewSubTasks.map((st, i) => (
                <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/40 flex items-center gap-1.5">
                  {st} <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => setDashboardNewSubTasks(prev => prev.filter((_, idx) => idx !== i))} />
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
              <input 
                type="date" 
                value={dashboardDueDate} 
                onChange={e => setDashboardDueDate(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white/60 focus:outline-none cursor-pointer appearance-none" 
              />
              <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
            </div>
            
            <div className="flex-1 relative">
              <select 
                value={dashboardNewTaskGoalId} 
                onChange={e => setDashboardNewTaskGoalId(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-10 pr-6 py-4 text-sm font-bold text-white/60 focus:outline-none cursor-pointer appearance-none"
              >
                 <option value="">No Goal Linked</option>
                 {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
            </div>

            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
              {(['low', 'medium', 'high'] as Priority[]).map(p => (
                <button 
                  key={p} 
                  onClick={() => setDashboardNewTaskPriority(p)} 
                  className={cn(
                    "px-8 py-4 rounded-2xl text-[10px] uppercase font-bold border transition-all flex-1 md:flex-none", 
                    dashboardNewTaskPriority === p ? PRIORITY_COLORS[p] : "bg-white/5 text-white/20 border-white/5"
                  )}
                >
                  {p}
                </button>
              ))}
              <button 
                onClick={handleAddTask}
                className="bg-accent hover:bg-accent px-8 py-4 rounded-2xl font-bold text-sm shadow-lg transition-all"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 pb-20">
        <AnimatePresence>
        {filteredTasks.map(task => {
          const completedSub = (task.subTasks || []).filter(st => st.completed).length;
          const totalSub = task.subTasks?.length || 0;
          const progress = totalSub > 0 ? (completedSub / totalSub) * 100 : 0;
          const isExpanded = expandedTasks.has(task.id);
          
          return (
            <motion.div layout initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} key={task.id} className="bg-panel border border-white/5 rounded-[32px] overflow-hidden transition-all hover:bg-white/[0.01]">
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => toggleTask(task.id)} 
                    className={cn("transition-all hover:scale-110", task.completed ? "text-emerald-500" : "text-white/20 hover:text-white")}
                  >
                    {task.completed ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={cn("px-2 py-0.5 rounded-[4px] text-[9px] uppercase font-bold border", PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                      {task.goalId && goals.find(g => g.id === task.goalId) && (
                         <span className="px-2 py-0.5 rounded-[4px] text-[9px] uppercase font-bold text-black bg-blue-400">
                           {goals.find(g => g.id === task.goalId)?.title}
                         </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[10px] text-amber-400/60 font-bold uppercase tracking-wider">
                          {format(new Date(task.dueDate), 'd MMM')}
                        </span>
                      )}
                    </div>
                    
                    <h4 className={cn("text-lg font-bold truncate transition-all", task.completed && "text-white/10 line-through")}>
                      {task.text}
                    </h4>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.1em]">Sub-tasks</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${progress}%` }} 
                          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                        />
                      </div>
                      <span className="text-[10px] text-white/20 font-bold tabular-nums">
                        {completedSub}/{totalSub} ({Math.round(progress)}%)
                      </span>
                      <button 
                        onClick={() => {
                          const next = new Set(expandedTasks);
                          if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                          setExpandedTasks(next);
                        }} 
                        className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <ChevronDown className={cn("w-4 h-4 text-white/40 transition-transform duration-300", isExpanded && "rotate-180")} />
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={() => deleteTask(task.id)} className="p-3 text-white/10 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-[10px] text-white/10 font-medium ml-[52px]">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-black/20 border-t border-white/5 p-6 ml-14 space-y-4"
                  >
                    {(task.subTasks || []).map(st => (
                      <div key={st.id} className="flex items-center gap-4 group/sub">
                        <button 
                          onClick={async () => {
                            const updatedSubTasks = (task.subTasks || []).map(s => s.id === st.id ? { ...s, completed: !s.completed } : s);
                            await axios.patch(`${API_BASE}/tasks/${task.id}`, { subTasks: updatedSubTasks });
                          }} 
                          className={cn(
                            "w-5 h-5 rounded-lg border flex items-center justify-center transition-all hover:scale-110", 
                            st.completed ? "bg-emerald-500 border-emerald-500" : "border-white/10 hover:border-white/20"
                          )}
                        >
                          {st.completed && <Check className="w-3.5 h-3.5 text-black" />}
                        </button>
                        <span className={cn("flex-1 text-sm transition-all", st.completed ? "text-white/10 line-through" : "text-white/60")}>
                          {st.text}
                        </span>
                      </div>
                    ))}
                    <div className="relative pt-2">
                      <Plus className="absolute left-4 top-[60%] -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                      <input 
                        placeholder="Add sub-task..." 
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-white/10 transition-all" 
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            const newSub = { 
                              id: crypto.randomUUID(), 
                              text: e.currentTarget.value.trim(), 
                              completed: false, 
                              createdAt: Date.now(), 
                              taskId: task.id 
                            };
                            const updatedSubTasks = [...(task.subTasks || []), newSub];
                            await axios.patch(`${API_BASE}/tasks/${task.id}`, { subTasks: updatedSubTasks });
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
