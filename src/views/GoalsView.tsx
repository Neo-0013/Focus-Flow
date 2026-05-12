import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Trash2, LayoutGrid, Network, X, Trophy } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import confetti from 'canvas-confetti';
import { cn } from '../utils';
import { Goal, GoalType, GoalCategory, Task, Workspace } from '../types';
import axios from 'axios';

const API_BASE = 'http://localhost:3002';

const CATEGORIES: GoalCategory[] = ['Health', 'Career', 'Finance', 'Education', 'Personal'];
const CATEGORY_COLORS: Record<GoalCategory, string> = {
  Health: 'bg-emerald-500', Career: 'bg-accent', Finance: 'bg-amber-500', Education: 'bg-purple-500', Personal: 'bg-pink-500'
};

interface GoalsProps {
  goals: Goal[];
  tasks: Task[];
  fetchGoals: () => Promise<void>;
  workspace: Workspace;
  aiConfig: { baseUrl: string, apiKey: string, modelId: string };
  showToast: (title: string, body: string, type?: string) => void;
}

export function GoalsView({ goals, tasks, fetchGoals, workspace, aiConfig, showToast }: GoalsProps) {
  const [goalView, setGoalView] = useState<GoalType>('yearly');
  const [goalYear, setGoalYear] = useState(new Date().getFullYear());
  const [displayMode, setDisplayMode] = useState<'kanban' | 'hierarchy'>('kanban');

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAIRoadmapModal, setShowAIRoadmapModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftRoadmap, setDraftRoadmap] = useState<any | null>(null);

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('1');
  const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory>('Personal');

  const filteredGoals = goals.filter(g => g.type === goalView && (g.yearId === goalYear.toString() || !g.yearId));

  const radarData = useMemo(() => {
    return CATEGORIES.map(cat => {
      const catGoals = goals.filter(g => g.category === cat && g.yearId === goalYear.toString());
      const achieved = catGoals.filter(g => g.done).length;
      return { subject: cat, Achieved: achieved, Total: catGoals.length, fullMark: Math.max(catGoals.length, 5) };
    });
  }, [goals, goalYear]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    
    const goal = goals.find(g => g.id === draggableId);
    if (!goal) return;

    let updates: Partial<Goal> = {};
    if (destination.droppableId === 'achieved') {
       updates = { done: 1 };
       confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else if (destination.droppableId === 'in-progress' || destination.droppableId === 'planned') {
       updates = { done: 0 };
    }

    await axios.patch(`${API_BASE}/goals/${goal.id}`, updates);
    fetchGoals();
  };

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;
    await axios.post(`${API_BASE}/goals`, { 
      title: newGoalTitle, 
      type: goalView, 
      yearId: goalYear.toString(),
      target: parseInt(newGoalTarget || "1") || 1,
      category: newGoalCategory,
      workspaceId: workspace
    });
    fetchGoals();
    setShowGoalModal(false);
    setNewGoalTitle('');
    setNewGoalTarget('1');
  };

  const handleStartFresh = async () => {
    const goalsToDelete = goals.filter(g => g.yearId === goalYear.toString() || !g.yearId);
    if (goalsToDelete.length === 0) {
      alert(`You have no goals set for ${goalYear}. The board is already empty!`);
      return;
    }
    
    if (window.confirm(`⚠️ Are you sure you want to DELETE ALL ${goalsToDelete.length} goals attached to ${goalYear}? This will wipe everything clean so you can start from scratch. This cannot be undone.`)) {
      try {
        await Promise.all(goalsToDelete.map(g => axios.delete(`${API_BASE}/goals/${g.id}`)));
        fetchGoals();
      } catch (err) {
        console.error(err);
        alert("Failed to delete some goals.");
      }
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!aiPrompt.trim()) return;
    if (!aiConfig.apiKey) {
      showToast('Missing Config', 'Please provide an AI API Key in Settings first', 'error');
      return;
    }
    
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
               content: `You are an AI Goal Architect. Output purely JSON exactly matching: {"yearlyGoals": [{"title": "Milestone 1"}], "monthlyGoals": [{"yearlyGoalIndex": 0, "title": "Sub goal", "category": "Career"}], "immediateTasks": [{"monthlyGoalIndex": 0, "title": "First thing to do", "priority": "high"}]}. Categories must be exactly one of: Health, Career, Finance, Education, Personal. Return raw JSON.`
            },
            {
               role: 'user',
               content: aiPrompt
            }
          ],
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content?.trim() || "";
      if (content.startsWith('```')) {
         content = content.replace(/```(?:json)?\n?/, '').replace(/```\n?$/, '');
      }

      const roadmap = JSON.parse(content);
      if (!roadmap.yearlyGoals || !roadmap.monthlyGoals) throw new Error("Invalid format returned by AI.");
      
      const yearlyGoals = roadmap.yearlyGoals.map((g: any) => ({ ...g, tempId: crypto.randomUUID() }));
      const monthlyGoals = roadmap.monthlyGoals.map((g: any) => ({ 
        ...g, 
        tempId: crypto.randomUUID(),
        parentTempId: yearlyGoals[g.yearlyGoalIndex]?.tempId || yearlyGoals[0]?.tempId
      }));
      const immediateTasks = (roadmap.immediateTasks || []).map((t: any) => ({ 
        ...t, 
        tempId: crypto.randomUUID(),
        parentTempId: monthlyGoals[t.monthlyGoalIndex]?.tempId || monthlyGoals[0]?.tempId
      }));
      
      setDraftRoadmap({ yearlyGoals, monthlyGoals, immediateTasks });
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.5 } });

    } catch (err: any) {
      console.error(err);
      showToast('AI Failure', err.message || 'Failed to generate roadmap', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommitRoadmap = async () => {
    if (!draftRoadmap) return;
    setIsGenerating(true);
    try {
      const realYearlyIds: Record<string, string> = {};
      for (const yg of draftRoadmap.yearlyGoals) {
        const id = crypto.randomUUID();
        realYearlyIds[yg.tempId] = id;
        await axios.post(`${API_BASE}/goals`, {
          id, title: yg.title, type: 'yearly', category: 'Career',
          yearId: goalYear.toString(), target: 1, workspaceId: workspace
        });
      }

      const realMonthlyIds: Record<string, string> = {};
      for (const mg of draftRoadmap.monthlyGoals) {
        const parentId = realYearlyIds[mg.parentTempId] || Object.values(realYearlyIds)[0];
        const id = crypto.randomUUID();
        realMonthlyIds[mg.tempId] = id;
        await axios.post(`${API_BASE}/goals`, {
          id, title: mg.title, type: 'monthly', category: mg.category || 'Career',
          yearId: goalYear.toString(), parentId, target: 1, workspaceId: workspace
        });
      }

      for (const t of draftRoadmap.immediateTasks) {
        const goalId = realMonthlyIds[t.parentTempId] || Object.values(realMonthlyIds)[0];
        if (goalId) {
           await axios.post(`${API_BASE}/tasks`, {
             id: crypto.randomUUID(), text: t.title, priority: t.priority || 'medium',
             goalId, workspaceId: workspace
           });
        }
      }
      
      fetchGoals();
      setAiPrompt('');
      setDraftRoadmap(null);
      setShowAIRoadmapModal(false);
      showToast('Roadmap Committed', 'Your AI Roadmap is now live on your dashboard!', 'success');
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
    } catch (err: any) {
      showToast('Commit Error', err.message || 'Failed to save roadmap data', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateProgress = (g: Goal) => {
    const linkedTasks = tasks.filter(t => t.goalId === g.id && t.completed).length;
    const manualProgress = g.autoProgress || 0;
    const current = manualProgress + linkedTasks;
    let pct = g.target > 0 ? (current / g.target) * 100 : 0;
    if (g.done) pct = 100;
    return { current, pct: Math.min(100, Math.max(0, pct)) };
  };

  const kanbanColumns = [
    { id: 'planned', title: 'Planned', items: filteredGoals.filter(g => !g.done && calculateProgress(g).pct === 0) },
    { id: 'in-progress', title: 'In Progress', items: filteredGoals.filter(g => !g.done && calculateProgress(g).pct > 0) },
    { id: 'achieved', title: 'Achieved', items: filteredGoals.filter(g => g.done) }
  ];

  return (
    <motion.div key="goals" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full flex flex-col space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold capitalize">{goalView} Goals</h2>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1">
            <button onClick={() => setGoalYear(prev => prev - 1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-1.5 text-xs font-bold">{goalYear}</span>
            <button onClick={() => setGoalYear(prev => prev + 1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1">
            {(['weekly', 'monthly', 'yearly'] as GoalType[]).map(v => (
              <button key={v} onClick={() => setGoalView(v)} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all", goalView === v ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white")}>{v}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-panel p-1 rounded-xl border border-white/5 mr-2">
            <button onClick={handleStartFresh} className="p-2 px-3 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-2 text-xs font-bold rounded-lg group">
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> <span className="hidden md:inline">Start Fresh</span>
            </button>
          </div>
          <div className="flex bg-panel p-1 rounded-xl border border-white/5 mr-2">
            <button onClick={() => setDisplayMode('kanban')} className={cn("p-2 rounded-lg transition-all", displayMode === 'kanban' ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setDisplayMode('hierarchy')} className={cn("p-2 rounded-lg transition-all", displayMode === 'hierarchy' ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}><Network className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowAIRoadmapModal(true)} className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/20 shadow-lg px-4 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all"><Network className="w-4 h-4" /> AI Roadmap</button>
          <button onClick={() => setShowGoalModal(true)} className="bg-accent hover:bg-accent shadow-lg px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all"><Plus className="w-4 h-4" /> Add Goal</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Radar Chart (Life Balance) */}
        <div className="lg:col-span-3 bg-panel border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col">
          <h3 className="text-sm font-bold text-white/60 mb-4 text-center">Life Balance</h3>
          <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
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
        </div>

        {/* Goals Board / Hierarchy */}
        <div className="lg:col-span-9 bg-panel border border-white/5 rounded-[32px] p-6 shadow-2xl overflow-y-auto">
          {displayMode === 'kanban' ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-6 h-full min-h-[500px]">
                {kanbanColumns.map(col => (
                  <Droppable key={col.id} droppableId={col.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 flex flex-col bg-white/[0.02] rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-4 px-2">
                          <h4 className="text-sm font-bold text-white/80">{col.title}</h4>
                          <span className="text-xs text-white/40 font-medium bg-white/5 px-2 py-0.5 rounded-full">{col.items.length}</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          {col.items.map((g, index) => {
                            const { current, pct } = calculateProgress(g);
                            return (
                              // @ts-ignore
                              <Draggable key={g.id} draggableId={g.id} index={index}>
                                {(provided, snapshot) => (
                                  <div 
                                    ref={provided.innerRef} 
                                    {...provided.draggableProps} 
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "bg-panel-dark border border-white/5 rounded-2xl p-4 shadow-lg flex flex-col gap-3 transition-transform",
                                      snapshot.isDragging && "scale-[1.02] shadow-2xl border-white/20 z-50",
                                      g.done && "opacity-60"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <h5 className={cn("text-xs font-bold leading-snug", g.done && "line-through")}>{g.title}</h5>
                                      <button onClick={async () => { await axios.delete(`${API_BASE}/goals/${g.id}`); fetchGoals(); }} className="text-red-400/60 hover:text-red-400 bg-red-400/10 hover:bg-red-400/20 p-1.5 rounded-md transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-auto">
                                      <span className={cn("px-2 py-0.5 rounded text-[8px] uppercase font-bold", CATEGORY_COLORS[g.category || 'Personal'], "bg-opacity-20 text-white")}>
                                        {g.category || 'Personal'}
                                      </span>
                                      <span className="text-[10px] font-bold text-white/40 tabular-nums">{current} / {g.target}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={cn("h-full", pct === 100 ? "bg-emerald-500" : "bg-accent")} />
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <div className="p-8 space-y-12">
              <h3 className="text-center text-white/40 font-bold mb-8">Goal cascading visualization. <br/>(Monthly goals roll up into Yearly, etc.)</h3>
              {goals.filter(g => g.type === 'yearly' && g.yearId === goalYear.toString()).map(yg => (
                <div key={yg.id} className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg max-w-lg mx-auto">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold uppercase text-accent">Yearly Goal</span>
                       <span className="text-[10px] font-bold text-white/60">{calculateProgress(yg).pct.toFixed(0)}%</span>
                    </div>
                    <h4 className="text-sm font-bold">{yg.title}</h4>
                    <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                       <div className="h-full bg-accent" style={{width: `${calculateProgress(yg).pct}%`}} />
                    </div>
                  </div>
                  
                  {/* Monthly children (mock representation, since real parentId linkage needs rigorous UI builder) */}
                  <div className="flex flex-col items-center gap-1 opacity-50">
                     <div className="w-px h-6 bg-white/20" />
                     <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Supporting Goals</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {goals.filter(mg => mg.type === 'monthly' && mg.parentId === yg.id).map(mg => (
                       <div key={mg.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 shadow-sm">
                         <div className="flex items-center justify-between mb-1">
                           <span className="text-[8px] font-bold uppercase text-emerald-400">Monthly Target</span>
                           <span className="text-[8px] font-bold text-white/40">{calculateProgress(mg).pct.toFixed(0)}%</span>
                         </div>
                         <h5 className="text-xs font-bold leading-tight truncate">{mg.title}</h5>
                       </div>
                     ))}
                     {goals.filter(mg => mg.type === 'monthly' && (mg.parentId === yg.id || true)).length === 0 && (
                       <p className="text-xs text-white/20 text-center col-span-full">No supporting monthly goals explicitly linked.</p>
                     )}
                  </div>
                </div>
              ))}
              {goals.filter(g => g.type === 'yearly' && g.yearId === goalYear.toString()).length === 0 && (
                <p className="text-center text-white/20 text-sm">Create yearly goals to see the hierarchy.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Goal Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-white/10 rounded-[40px] p-8 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setShowGoalModal(false)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
              <h2 className="text-xl font-bold mb-6 capitalize">Create New {goalView} Goal</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Title</label>
                  <input autoFocus value={newGoalTitle} onChange={e=>setNewGoalTitle(e.target.value)} placeholder="e.g. Read 12 Books" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20" onKeyDown={e => e.key === 'Enter' && handleAddGoal()} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Target Number</label>
                    <input type="number" min="1" value={newGoalTarget} onChange={e=>setNewGoalTarget(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20 text-center font-bold text-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Category</label>
                    <select value={newGoalCategory} onChange={e=>setNewGoalCategory(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20 cursor-pointer appearance-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={handleAddGoal} className="w-full py-4 bg-accent hover:bg-accent text-white rounded-2xl font-bold text-sm shadow-xl transition-all mt-4">Create Goal</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Roadmap Modal */}
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
                      placeholder="e.g. Write a novel, transition to a Product Manager role, or run a marathon..." 
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
                  {!aiConfig.apiKey && (
                    <p className="text-red-400 text-center text-xs mt-2">API Key missing! Please configure AI settings in the main sidebar first.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {draftRoadmap.yearlyGoals.map((yg: any, yIdx: number) => (
                    <div key={yg.tempId} className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg relative group">
                      <button onClick={() => {
                        const cascadeMonthlyIds = draftRoadmap.monthlyGoals.filter((mg: any) => mg.parentTempId === yg.tempId).map((mg: any) => mg.tempId);
                        setDraftRoadmap({
                          ...draftRoadmap,
                          yearlyGoals: draftRoadmap.yearlyGoals.filter((y: any) => y.tempId !== yg.tempId),
                          monthlyGoals: draftRoadmap.monthlyGoals.filter((m: any) => m.parentTempId !== yg.tempId),
                          immediateTasks: draftRoadmap.immediateTasks.filter((t: any) => !cascadeMonthlyIds.includes(t.parentTempId))
                        });
                      }} className="absolute top-4 right-4 text-red-400/70 hover:text-red-400 bg-red-400/10 hover:bg-red-400/20 p-1.5 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                      
                      <div className="flex items-center gap-3 pr-8">
                         <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded flex items-center gap-1"><Trophy className="w-3 h-3"/> YEARLY</span>
                         <input value={yg.title} onChange={e => {
                           const yGoals = [...draftRoadmap.yearlyGoals];
                           const idx = yGoals.findIndex(y => y.tempId === yg.tempId);
                           yGoals[idx].title = e.target.value;
                           setDraftRoadmap({...draftRoadmap, yearlyGoals: yGoals});
                         }} className="flex-1 bg-transparent text-sm font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5" />
                      </div>
                      <div className="mt-4 pl-4 border-l-2 border-white/5 space-y-4">
                         {draftRoadmap.monthlyGoals.filter((mg: any) => mg.parentTempId === yg.tempId).map((mg: any) => {
                           return (
                             <div key={mg.tempId} className="space-y-2 relative group/monthly">
                               <button onClick={() => {
                                 setDraftRoadmap({
                                   ...draftRoadmap,
                                   monthlyGoals: draftRoadmap.monthlyGoals.filter((m: any) => m.tempId !== mg.tempId),
                                   immediateTasks: draftRoadmap.immediateTasks.filter((t: any) => t.parentTempId !== mg.tempId)
                                 });
                               }} className="absolute -top-1 -right-1 text-red-400/70 hover:text-red-400 bg-red-400/10 hover:bg-red-400/20 p-1.5 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                               <div className="flex items-start gap-3 pr-6">
                                 <div className="w-4 h-4 rounded-full border border-white/20 bg-panel mt-0.5 flex items-center justify-center -ml-[25px]"><div className="w-1.5 h-1.5 rounded-full bg-purple-400" /></div>
                                 <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded capitalize">{mg.category}</span>
                                 <input value={mg.title} onChange={e => {
                                   const mGoals = [...draftRoadmap.monthlyGoals];
                                   const mIdx = mGoals.findIndex(m => m.tempId === mg.tempId);
                                   mGoals[mIdx].title = e.target.value;
                                   setDraftRoadmap({...draftRoadmap, monthlyGoals: mGoals});
                                 }} className="flex-1 bg-transparent text-xs font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5" />
                               </div>
                               <div className="pl-6 space-y-1">
                                 {draftRoadmap.immediateTasks.filter((t: any) => t.parentTempId === mg.tempId).map((tk: any) => {
                                   return (
                                     <div key={tk.tempId} className="group/task flex flex-col gap-1 rounded bg-black/20 p-2 border border-white/5 relative">
                                       <div className="flex items-center gap-2 pr-6">
                                         <span className="w-1 h-3 bg-red-400 rounded-full" />
                                         <input value={tk.title} onChange={e => {
                                           const tsks = [...draftRoadmap.immediateTasks];
                                           const tIdx = tsks.findIndex(t => t.tempId === tk.tempId);
                                           tsks[tIdx].title = e.target.value;
                                           setDraftRoadmap({...draftRoadmap, immediateTasks: tsks});
                                         }} className="flex-1 bg-transparent text-[10px] text-white/80 focus:outline-none" />
                                       </div>
                                       <button onClick={() => {
                                         setDraftRoadmap({
                                           ...draftRoadmap,
                                           immediateTasks: draftRoadmap.immediateTasks.filter((t: any) => t.tempId !== tk.tempId)
                                         });
                                       }} className="absolute top-1/2 -translate-y-1/2 right-2 text-red-400/70 hover:text-red-400 bg-red-400/10 hover:bg-red-400/20 p-1 rounded-md transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           );
                         })}
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-3">
                    <button disabled={isGenerating} onClick={() => setDraftRoadmap(null)} className="py-4 px-6 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm transition-all focus:outline-none">Discard</button>
                    <button disabled={isGenerating} onClick={handleCommitRoadmap} className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2">
                      {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Network className="w-4 h-4" /></motion.div> : <CheckCircle2 className="w-4 h-4" />}
                      {isGenerating ? 'Committing...' : 'Commit to Dashboard'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
