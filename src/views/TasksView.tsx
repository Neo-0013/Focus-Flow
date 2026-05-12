import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListTodo, Plus, Calendar, CheckCircle2, Circle, ChevronDown, Trash2, Check, X, Target, Archive, Repeat, Network, Brain, Clock } from 'lucide-react';
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
  dashboardTimeSlot: string;
  setDashboardTimeSlot: (v: string) => void;
  dashboardImportance: number;
  setDashboardImportance: (v: number) => void;
  dashboardUrgency: number;
  setDashboardUrgency: (v: number) => void;
  dashboardCognitiveCost: number;
  setDashboardCognitiveCost: (v: number) => void;
  dashboardRecurrence: any;
  setDashboardRecurrence: React.Dispatch<React.SetStateAction<any>>;
  handleAddTask: (e?: React.FormEvent) => void;
  addDashboardSubTask: () => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  expandedTasks: Set<string>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  archiveCompletedTasks: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  workspace: string;
  aiConfig: { baseUrl: string, apiKey: string, modelId: string };
  showToast: (title: string, body: string, type?: string) => void;
}

export function TasksView({
  tasks, goals, dashboardNewTaskText, setDashboardNewTaskText,
  dashboardNewSubTask, setDashboardNewSubTask, dashboardNewSubTasks, setDashboardNewSubTasks,
  dashboardNewTaskPriority, setDashboardNewTaskPriority, dashboardDueDate, setDashboardDueDate,
  dashboardNewTaskGoalId, setDashboardNewTaskGoalId,
  dashboardTimeSlot, setDashboardTimeSlot,
  dashboardImportance, setDashboardImportance,
  dashboardUrgency, setDashboardUrgency,
  dashboardCognitiveCost, setDashboardCognitiveCost,
  dashboardRecurrence, setDashboardRecurrence,
  handleAddTask, addDashboardSubTask, toggleTask, deleteTask, expandedTasks, setExpandedTasks,
  archiveCompletedTasks, fetchGoals, workspace, aiConfig, showToast
}: TasksProps & { goals: Goal[] }) {
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [showRecurrenceModal, setShowRecurrenceModal] = React.useState(false);
  const [tempRecurrence, setTempRecurrence] = React.useState<{interval: number; unit: string; ends: string; endDate?: string; endOccurrences?: number}>({ interval: 1, unit: 'day', ends: 'never' });
  
  const [entryType, setEntryType] = React.useState<'task' | 'yearly' | 'monthly' | 'weekly'>('task');
  const [showAIRoadmapModal, setShowAIRoadmapModal] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [draftRoadmap, setDraftRoadmap] = React.useState<any | null>(null);

  const filteredTasks = (showCompleted ? tasks : tasks.filter(t => !t.completed)).filter(t => !t.archived);

  const handleAddEntry = async () => {
    if (entryType === 'task') {
      handleAddTask();
    } else {
      if (!dashboardNewTaskText.trim()) return;
      await axios.post(`${API_BASE}/goals`, { 
        title: dashboardNewTaskText, 
        type: entryType, 
        yearId: new Date().getFullYear().toString(),
        target: 1,
        category: 'Career',
        workspaceId: workspace
      });
      fetchGoals();
      setDashboardNewTaskText('');
      showToast?.('Goal Created', `New ${entryType} goal added to your strategy.`, 'success');
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.modelId || 'llama-3.1-8b-instant',
          messages: [
            {
               role: 'system',
               content: `You are an AI Goal Architect. Output purely JSON: {"yearlyGoals": [{"title": "Milestone 1"}], "monthlyGoals": [{"yearlyGoalIndex": 0, "title": "Sub goal", "category": "Career"}], "immediateTasks": [{"monthlyGoalIndex": 0, "title": "First thing to do", "priority": "high"}]}. Return raw JSON.`
            },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.7,
        })
      });
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content?.trim() || "";
      if (content.startsWith('```')) content = content.replace(/```(?:json)?\n?/, '').replace(/```\n?$/, '');
      setDraftRoadmap(JSON.parse(content));
    } catch (err: any) {
      showToast?.('AI Failure', 'Failed to generate roadmap', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommitRoadmap = async () => {
    if (!draftRoadmap) return;
    setIsGenerating(true);
    try {
      const realYearlyIds: Record<number, string> = {};
      for (let i=0; i<draftRoadmap.yearlyGoals.length; i++) {
        const id = crypto.randomUUID();
        realYearlyIds[i] = id;
        await axios.post(`${API_BASE}/goals`, {
          id, title: draftRoadmap.yearlyGoals[i].title, type: 'yearly', category: 'Career',
          yearId: new Date().getFullYear().toString(), target: 1, workspaceId: workspace
        });
      }
      const realMonthlyIds: Record<number, string> = {};
      for (let i=0; i<draftRoadmap.monthlyGoals.length; i++) {
        const mg = draftRoadmap.monthlyGoals[i];
        const parentId = realYearlyIds[mg.yearlyGoalIndex] || Object.values(realYearlyIds)[0];
        const id = crypto.randomUUID();
        realMonthlyIds[i] = id;
        await axios.post(`${API_BASE}/goals`, {
          id, title: mg.title, type: 'monthly', category: mg.category || 'Career',
          yearId: new Date().getFullYear().toString(), parentId, target: 1, workspaceId: workspace
        });
      }
      for (const t of draftRoadmap.immediateTasks) {
        const goalId = realMonthlyIds[t.monthlyGoalIndex] || Object.values(realMonthlyIds)[0];
        await axios.post(`${API_BASE}/tasks`, {
          id: crypto.randomUUID(), text: t.title, priority: t.priority || 'medium',
          goalId, workspaceId: workspace
        });
      }
      fetchGoals();
      setDraftRoadmap(null);
      setShowAIRoadmapModal(false);
      showToast?.('Roadmap Created', 'AI Architect has deployed your strategic plan.', 'success');
    } catch (err: any) {
      showToast?.('Commit Error', 'Failed to save roadmap', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

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

        <div className="bg-panel border border-white/5 rounded-[32px] p-6 space-y-4 shadow-2xl relative overflow-hidden group/input">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-focus-cyan via-accent to-velocity-purple opacity-30"></div>
          
          <div className="flex items-center gap-2 mb-2">
            {(['task', 'yearly', 'monthly', 'weekly'] as const).map(type => (
              <button
                key={type}
                onClick={() => setEntryType(type)}
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all",
                  entryType === type ? "bg-white text-black border-white" : "text-white/20 border-white/5 hover:text-white/40"
                )}
              >
                {type}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowAIRoadmapModal(true)} className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                <Network className="w-3.5 h-3.5" /> AI Architect
              </button>
            </div>
          </div>

          <div className="relative">
            <Plus className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input 
              value={dashboardNewTaskText} 
              onChange={e => setDashboardNewTaskText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
              placeholder={entryType === 'task' ? "Add a new task..." : `Set a new ${entryType} goal...`} 
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
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="date" 
                    value={dashboardDueDate} 
                    onChange={e => setDashboardDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white/60 focus:outline-none cursor-pointer appearance-none" 
                  />
                  <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                </div>
                <button type="button" onClick={() => {
                   setTempRecurrence(dashboardRecurrence || { interval: 1, unit: 'day', ends: 'never' });
                   setShowRecurrenceModal(true);
                }} className={cn("px-6 py-4 rounded-2xl border transition-all flex items-center justify-center", dashboardRecurrence ? "bg-accent/20 border-accent/50 text-accent" : "bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20")} title="Repeat Task">
                   <Repeat className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 relative group/time">
                <p className="absolute -top-6 left-2 text-[10px] uppercase tracking-widest text-white/20 font-bold group-hover/time:text-white/40 transition-colors">Start Time</p>
                <input 
                  type="time" 
                  value={dashboardTimeSlot} 
                  onChange={e => setDashboardTimeSlot(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white/60 focus:outline-none focus:border-white/20 cursor-pointer transition-all" 
                />
                <Clock className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
              </div>
            
            <select 
              value={dashboardNewTaskGoalId} 
              onChange={e => setDashboardNewTaskGoalId(e.target.value)}
              className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white/60 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="" className="bg-panel">Link to Goal...</option>
              {goals.map(g => (
                <option key={g.id} value={g.id} className="bg-panel">{g.title}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
               <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold ml-2">Cognitive Cost (1-10)</p>
               <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl px-6 py-2">
                  <Brain className="w-4 h-4 text-white/20" />
                  <input type="range" min="1" max="10" value={dashboardCognitiveCost} onChange={e => setDashboardCognitiveCost(parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/5 rounded-full appearance-none accent-purple-500 cursor-pointer" />
                  <span className="text-xs font-black w-4">{dashboardCognitiveCost}</span>
               </div>
            </div>
            <div className="flex-1 space-y-2">
               <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold ml-2">Strategic Impact (0-100)</p>
               <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl px-6 py-2">
                  <Target className="w-4 h-4 text-white/20" />
                  <input type="range" min="0" max="100" value={dashboardImportance} onChange={e => setDashboardImportance(parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/5 rounded-full appearance-none accent-cyan-500 cursor-pointer" />
                  <span className="text-xs font-black w-8">{dashboardImportance}%</span>
               </div>
            </div>
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
                onClick={handleAddEntry}
                className={cn(
                  "px-8 py-4 rounded-2xl font-bold text-sm shadow-lg transition-all",
                  entryType === 'task' ? "bg-accent hover:bg-accent" : "bg-focus-cyan text-black hover:bg-cyan-400"
                )}
              >
                {entryType === 'task' ? "Add Task" : "Set Goal"}
              </button>
            </div>
          </div>
      </header>

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

      <AnimatePresence>
        {showAIRoadmapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-purple-500/30 rounded-[40px] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(168,85,247,0.15)] relative">
              <button disabled={isGenerating} onClick={() => { setShowAIRoadmapModal(false); setDraftRoadmap(null); }} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                   <Network className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold capitalize leading-tight">{draftRoadmap ? 'Review & Organize Roadmap' : 'AI Architect'}</h2>
                  <p className="text-xs text-white/50">{draftRoadmap ? 'Fine-tune the plan before committing it to your workspace.' : 'Describe your ambition. We\'ll plan the rest.'}</p>
                </div>
              </div>
              
              {!draftRoadmap ? (
                <div className="space-y-4">
                  <div>
                    <textarea 
                      autoFocus 
                      value={aiPrompt} 
                      onChange={e=>setAiPrompt(e.target.value)} 
                      placeholder="e.g. Master Robotics, Build a SaaS, or Learn C++ in 6 months..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-purple-500/40 resize-none min-h-[120px]" 
                    />
                  </div>
                  <button disabled={isGenerating} onClick={handleGenerateRoadmap} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2">
                    {isGenerating ? (
                      <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Network className="w-4 h-4" /></motion.div> Designing Roadmap...</>
                    ) : (
                      <>Generate Master Plan <Plus className="w-4 h-4 ml-1"/></>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {draftRoadmap.yearlyGoals.map((yg: any, yIdx: number) => (
                    <div key={yIdx} className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg relative group">
                      <div className="flex items-center gap-3 pr-8">
                         <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded flex items-center gap-1"><Target className="w-3 h-3"/> YEARLY</span>
                         <input value={yg.title} onChange={e => {
                           const yGoals = [...draftRoadmap.yearlyGoals];
                           yGoals[yIdx].title = e.target.value;
                           setDraftRoadmap({...draftRoadmap, yearlyGoals: yGoals});
                         }} className="flex-1 bg-transparent text-sm font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5" />
                      </div>
                      <div className="mt-4 pl-4 border-l-2 border-white/5 space-y-4">
                         {draftRoadmap.monthlyGoals.filter((mg: any) => mg.yearlyGoalIndex === yIdx).map((mg: any, mIdx: number) => (
                             <div key={mIdx} className="space-y-2 relative group/monthly">
                               <div className="flex items-start gap-3 pr-6">
                                 <div className="w-4 h-4 rounded-full border border-white/20 bg-panel mt-0.5 flex items-center justify-center -ml-[25px]"><div className="w-1.5 h-1.5 rounded-full bg-purple-400" /></div>
                                 <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded capitalize">{mg.category || 'Career'}</span>
                                 <input value={mg.title} onChange={e => {
                                   const mGoals = [...draftRoadmap.monthlyGoals];
                                   const realIdx = mGoals.indexOf(mg);
                                   mGoals[realIdx].title = e.target.value;
                                   setDraftRoadmap({...draftRoadmap, monthlyGoals: mGoals});
                                 }} className="flex-1 bg-transparent text-xs font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5" />
                               </div>
                               <div className="pl-6 space-y-1">
                                 {draftRoadmap.immediateTasks.filter((t: any) => t.monthlyGoalIndex === draftRoadmap.monthlyGoals.indexOf(mg)).map((tk: any, tIdx: number) => (
                                     <div key={tIdx} className="group/task flex flex-col gap-1 rounded bg-black/20 p-2 border border-white/5 relative">
                                       <div className="flex items-center gap-2 pr-6">
                                         <span className="w-1 h-3 bg-red-400 rounded-full" />
                                         <input value={tk.title} onChange={e => {
                                           const tsks = [...draftRoadmap.immediateTasks];
                                           const realTIdx = tsks.indexOf(tk);
                                           tsks[realTIdx].title = e.target.value;
                                           setDraftRoadmap({...draftRoadmap, immediateTasks: tsks});
                                         }} className="flex-1 bg-transparent text-[10px] text-white/80 focus:outline-none" />
                                       </div>
                                     </div>
                                 ))}
                               </div>
                             </div>
                         ))}
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-3">
                    <button disabled={isGenerating} onClick={() => setDraftRoadmap(null)} className="py-4 px-6 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm transition-all focus:outline-none">Discard</button>
                    <button disabled={isGenerating} onClick={handleCommitRoadmap} className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2">
                      {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Network className="w-4 h-4" /></motion.div> : <CheckCircle2 className="w-4 h-4" />}
                      {isGenerating ? 'Committing Plan...' : 'Deploy Roadmap'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                            fetchTasks();
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
