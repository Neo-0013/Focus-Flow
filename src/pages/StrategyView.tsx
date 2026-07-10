import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Sparkles, Network, CheckCircle2, 
  RotateCcw, Plus, X, Brain, Trophy, 
  ChevronRight, ArrowRight, Activity, Terminal, Trash2
} from 'lucide-react';
import { cn } from '../utils/index';
import { Goal, Task, Workspace } from '../types';
import axios from 'axios';
import confetti from 'canvas-confetti';

const API_BASE = 'http://localhost:3002';

interface StrategyProps {
  goals: Goal[];
  tasks: Task[];
  fetchGoals: () => Promise<void>;
  workspace: Workspace;
  aiConfig: { baseUrl: string, apiKey: string, modelId: string };
  showToast: (title: string, body: string, type?: string) => void;
}

export function StrategyView({ goals, tasks, fetchGoals, workspace, aiConfig, showToast }: StrategyProps) {
  const currentYear = new Date().getFullYear().toString();
  
  // Data Binding
  const primaryNode = goals.find(g => g.type === 'yearly' && (g.yearId === currentYear || !g.yearId));
  const monthlyPivots = primaryNode 
    ? goals.filter(g => g.type === 'monthly' && g.parentId === primaryNode.id)
    : [];

  const getProgress = (goal: Goal) => {
    if (goal.done) return 100;
    const linkedTasks = tasks.filter(t => t.goalId === goal.id);
    if (linkedTasks.length === 0) return goal.autoProgress || 0;
    const completed = linkedTasks.filter(t => t.completed).length;
    return Math.round((completed / linkedTasks.length) * 100);
  };

  const primaryProgress = primaryNode ? getProgress(primaryNode) : 0;

  // AI Roadmap State
  const [showAIRoadmapModal, setShowAIRoadmapModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftRoadmap, setDraftRoadmap] = useState<any | null>(null);

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

      if (!response.ok) throw new Error(`API returned ${response.status}: ${await response.text()}`);

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
          id, title: yg.title, type: 'yearly', category: yg.category || 'Career',
          yearId: currentYear, target: 1, workspaceId: workspace
        });
      }

      const realMonthlyIds: Record<string, string> = {};
      for (const mg of draftRoadmap.monthlyGoals) {
        const parentId = realYearlyIds[mg.parentTempId] || Object.values(realYearlyIds)[0];
        if (!parentId) continue; // Safety check
        const id = crypto.randomUUID();
        realMonthlyIds[mg.tempId] = id;
        await axios.post(`${API_BASE}/goals`, {
          id, title: mg.title, type: 'monthly', category: mg.category || 'Career',
          yearId: currentYear, parentId, target: 1, workspaceId: workspace
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
      
      await fetchGoals();
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

  const ganttColors = ['bg-focus-cyan', 'bg-velocity-purple', 'bg-performance-gold', 'bg-recovery-green', 'bg-accent'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="max-w-7xl mx-auto space-y-12 pb-20"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            Strategic <span className="text-focus-cyan">Intelligence</span>
          </h1>
          <p className="text-white/40 max-w-2xl leading-relaxed">
            Architect your path to mastery through hierarchical goal alignment and AI-synthesized technical roadmaps.
          </p>
        </div>
        <button 
          onClick={() => setShowAIRoadmapModal(true)}
          className="flex items-center gap-2 px-6 py-3 glass-panel text-focus-cyan font-bold uppercase tracking-widest hover:bg-focus-cyan hover:text-midnight-base transition-all rounded-xl border border-focus-cyan/20"
        >
          <Sparkles className="w-4 h-4" />
          Generate Roadmap
        </button>
      </div>

      {!primaryNode ? (
        <div className="glass-panel p-12 rounded-[32px] text-center border-dashed border-white/20">
          <Network className="w-16 h-16 text-white/20 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">No Primary Node Detected</h2>
          <p className="text-white/40 max-w-md mx-auto mb-8">
            You don't have a Yearly Goal set for {currentYear}. Generate an AI Roadmap or create one manually to establish your Goal Cascade.
          </p>
          <button 
            onClick={() => setShowAIRoadmapModal(true)}
            className="px-8 py-4 bg-focus-cyan text-midnight-base font-bold uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            Initialize Strategy Engine
          </button>
        </div>
      ) : (
        <>
          {/* Goal Cascade Visualization */}
          <section className="space-y-8">
            <div className="flex items-center gap-3 mb-6">
              <Network className="w-6 h-6 text-performance-gold" />
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-white">Goal Cascade</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
              {/* Yearly Goal Card */}
              <div className="lg:col-span-4">
                <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group hover:border-focus-cyan/50 transition-all border border-white/5 h-full">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Trophy className="w-32 h-32 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-performance-gold mb-6 block uppercase tracking-widest">Primary Node // {currentYear}</span>
                  <h3 className="text-3xl font-bold text-white mb-4 leading-tight">{primaryNode.title}</h3>
                  <div className="flex items-center justify-between gap-4 mt-12">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${primaryProgress}%` }} 
                        className="h-full bg-focus-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]" 
                      />
                    </div>
                    <span className="font-mono text-focus-cyan font-bold">{primaryProgress}%</span>
                  </div>
                </div>
              </div>

              {/* Monthly & Weekly Goals */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {monthlyPivots.length === 0 ? (
                  <div className="glass-panel p-8 rounded-3xl border border-white/5 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest text-center col-span-2">
                    No Monthly Pivots configured.<br/>Use AI to generate a roadmap.
                  </div>
                ) : (
                  monthlyPivots.map((monthly, i) => {
                    const colorClass = ganttColors[i % ganttColors.length];
                    const colorBorder = colorClass.replace('bg-', 'border-l-');
                    const colorText = colorClass.replace('bg-', 'text-');
                    const colorBgLight = colorClass.replace('bg-', 'bg-') + '/5';
                    
                    const monthlyTasks = tasks.filter(t => t.goalId === monthly.id);

                    return (
                      <div key={monthly.id} className="space-y-6">
                        <div className={cn("glass-panel p-6 rounded-2xl border-l-4", colorBorder, colorBgLight)}>
                          <span className={cn("text-[10px] font-bold mb-2 block uppercase tracking-widest", colorText)}>Monthly Pivot</span>
                          <h4 className="text-lg font-bold text-white">{monthly.title}</h4>
                          <p className="text-xs text-white/40 mt-2">{monthly.category || 'General'}</p>
                        </div>
                        <div className="pl-6 border-l border-white/5 space-y-4">
                          {monthlyTasks.map(task => (
                            <WeeklyNode key={task.id} title={task.text} status={task.completed ? 'done' : 'sync'} />
                          ))}
                          {monthlyTasks.length === 0 && (
                            <p className="text-[10px] text-white/20 uppercase tracking-widest">No execution nodes attached.</p>
                          )}
                          <div className="glass-panel p-4 rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-all cursor-not-allowed opacity-50">
                            <button className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-white/20 hover:text-white uppercase tracking-widest pointer-events-none">
                              <Plus className="w-3 h-3" /> External Editor Required
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* AI Roadmap Engine */}
          {monthlyPivots.length > 0 && (
            <section className="space-y-8 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-focus-cyan" />
                  <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-white">AI Roadmap Engine</h2>
                </div>
                <div className="flex bg-midnight-base border border-white/5 rounded-xl p-1">
                  <button className="px-4 py-1.5 text-[10px] font-bold text-focus-cyan bg-white/5 rounded-lg uppercase tracking-widest">Gantt View</button>
                  <button className="px-4 py-1.5 text-[10px] font-bold text-white/20 uppercase tracking-widest">List View</button>
                </div>
              </div>

              <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
                {/* Gantt Header */}
                <div className="grid grid-cols-12 border-b border-white/5 bg-white/[0.02]">
                  <div className="col-span-3 p-6 border-r border-white/5">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Technical Milestones</span>
                  </div>
                  <div className="col-span-9 p-6 flex justify-between font-mono text-[10px] text-white/20 uppercase tracking-widest">
                    <span>WK 1</span>
                    <span>WK 2</span>
                    <span>WK 3</span>
                    <span>WK 4</span>
                  </div>
                </div>

                {/* Gantt Content */}
                <div className="relative min-h-[300px]">
                  {monthlyPivots.map((monthly, i) => {
                    const color = ganttColors[i % ganttColors.length];
                    // Stagger the gantt bars visually for effect based on index
                    const offset = `${i * 15}%`; 
                    const width = '35%';
                    return (
                      <GanttRow 
                        key={monthly.id}
                        color={color} 
                        label={monthly.title}
                        task={(monthly.category || 'General').toUpperCase()} 
                        offset={offset} 
                        width={width} 
                      />
                    );
                  })}

                  {/* Neo AI Terminal Overlay */}
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="absolute bottom-8 right-8 w-80 glass-panel p-6 rounded-2xl border-white/10 shadow-2xl z-20 backdrop-blur-3xl"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-recovery-green animate-pulse" />
                        <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">NEO AI // STRATEGY ENGINE</span>
                      </div>
                      <X className="w-3 h-3 text-white/20 cursor-pointer" />
                    </div>
                    <div className="font-mono text-[11px] text-white/80 space-y-3 leading-relaxed">
                      <p className="text-focus-cyan"> &gt; Analyzing current velocity...</p>
                      <p> &gt; Primary Node at {primaryProgress}%. Maintain consistency.</p>
                      <p className="flex items-center gap-1"> &gt; Confidence: <span className="text-recovery-green">94.8%</span></p>
                      <div className="h-0.5 w-full bg-white/5 mt-4 overflow-hidden rounded-full">
                        <motion.div 
                          animate={{ x: ['-100%', '300%'] }} 
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="h-full bg-focus-cyan w-1/3" 
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>
          )}

          {/* Bento Stats */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            <div className="glass-panel p-8 rounded-[32px] md:col-span-2 flex flex-col md:flex-row gap-8 items-center border border-white/5">
              <div className="w-32 h-32 shrink-0 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                  <motion.circle 
                    cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" 
                    strokeDasharray="377" strokeDashoffset={377 * (1 - Math.max(primaryProgress/100, 0.1))}
                    className="text-focus-cyan" 
                  />
                </svg>
                <span className="text-3xl font-bold text-focus-cyan">{primaryProgress}%</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Neural Efficiency Score</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Your cognitive focus during technical learning sessions is 12% higher than last week's average. 
                  Strategy engine suggests extending deep work blocks.
                </p>
              </div>
            </div>
            <div className="glass-panel p-8 rounded-[32px] bg-gradient-to-br from-velocity-purple/20 to-midnight-base flex flex-col justify-between border border-white/5">
              <Brain className="w-10 h-10 text-velocity-purple" />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Archival Synthesis</h3>
                <p className="text-sm text-white/40 leading-relaxed">Active mapping of concepts from "Architect Journal" into Strategic Goals.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* AI Roadmap Modal */}
      <AnimatePresence>
        {showAIRoadmapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-focus-cyan/30 rounded-[40px] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(0,240,255,0.15)] relative">
              <button disabled={isGenerating} onClick={() => { setShowAIRoadmapModal(false); setDraftRoadmap(null); }} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-focus-cyan/10 flex items-center justify-center border border-focus-cyan/20">
                   <Network className="w-5 h-5 text-focus-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold capitalize leading-tight text-white">{draftRoadmap ? 'Review & Organize Roadmap' : 'AI Strategy Engine'}</h2>
                  <p className="text-xs text-white/40">{draftRoadmap ? 'Fine-tune the plan before committing it to your workspace.' : 'Describe your primary objective. We\'ll build the cascade.'}</p>
                </div>
              </div>
              
              {!draftRoadmap ? (
                <div className="space-y-4">
                  <div>
                    <textarea 
                      autoFocus 
                      value={aiPrompt} 
                      onChange={e=>setAiPrompt(e.target.value)} 
                      placeholder="e.g. Master Machine Learning and transition to an MLOps role..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-focus-cyan/40 resize-none min-h-[120px] text-white" 
                    />
                  </div>
                  <button disabled={isGenerating} onClick={handleGenerateRoadmap} className="w-full py-4 bg-focus-cyan text-midnight-base hover:bg-focus-cyan/90 rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex items-center justify-center gap-2">
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
                         <span className="text-[10px] font-black uppercase tracking-widest text-performance-gold bg-performance-gold/10 px-2 py-0.5 rounded flex items-center gap-1"><Trophy className="w-3 h-3"/> {yg.category || 'YEARLY'}</span>
                         <input value={yg.title} onChange={e => {
                           const yGoals = [...draftRoadmap.yearlyGoals];
                           const idx = yGoals.findIndex(y => y.tempId === yg.tempId);
                           yGoals[idx].title = e.target.value;
                           setDraftRoadmap({...draftRoadmap, yearlyGoals: yGoals});
                         }} className="flex-1 bg-transparent text-sm font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5 text-white" />
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
                                 <div className="w-4 h-4 rounded-full border border-white/20 bg-panel mt-0.5 flex items-center justify-center -ml-[25px]"><div className="w-1.5 h-1.5 rounded-full bg-focus-cyan" /></div>
                                 <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded capitalize">{mg.category || 'General'}</span>
                                 <input value={mg.title} onChange={e => {
                                   const mGoals = [...draftRoadmap.monthlyGoals];
                                   const mIdx = mGoals.findIndex(m => m.tempId === mg.tempId);
                                   mGoals[mIdx].title = e.target.value;
                                   setDraftRoadmap({...draftRoadmap, monthlyGoals: mGoals});
                                 }} className="flex-1 bg-transparent text-xs font-bold border-b border-transparent focus:border-white/20 focus:outline-none pb-0.5 text-white" />
                               </div>
                               <div className="pl-6 space-y-1">
                                 {draftRoadmap.immediateTasks.filter((t: any) => t.parentTempId === mg.tempId).map((tk: any) => {
                                   return (
                                     <div key={tk.tempId} className="group/task flex flex-col gap-1 rounded bg-black/20 p-2 border border-white/5 relative">
                                       <div className="flex items-center gap-2 pr-6">
                                         <span className="w-1 h-3 bg-white/20 rounded-full" />
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
                    <button disabled={isGenerating} onClick={handleCommitRoadmap} className="flex-1 py-4 bg-focus-cyan hover:bg-focus-cyan/90 text-midnight-base rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex items-center justify-center gap-2">
                      {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Network className="w-4 h-4" /></motion.div> : <CheckCircle2 className="w-4 h-4" />}
                      {isGenerating ? 'Committing...' : 'Commit Strategy'}
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

function WeeklyNode({ title, status }: { title: string, status: 'done' | 'sync' }) {
  return (
    <div className="glass-panel p-4 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[9px] font-bold text-white/20 mb-1 block uppercase tracking-[0.2em]">Execution Node</span>
          <h5 className="text-sm font-bold text-white/80">{title}</h5>
        </div>
        {status === 'done' ? (
          <CheckCircle2 className="w-5 h-5 text-recovery-green" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-focus-cyan border-t-transparent animate-spin" />
        )}
      </div>
    </div>
  );
}

function GanttRow({ color, label, task, offset, width }: any) {
  return (
    <div className="grid grid-cols-12 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className="col-span-3 p-6 border-r border-white/5 flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full", color)} />
        <span className="text-xs font-bold text-white/80 line-clamp-1">{label}</span>
      </div>
      <div className="col-span-9 relative h-20 flex items-center p-6">
        <motion.div 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ left: offset, width, transformOrigin: 'left' }}
          className={cn("h-8 border opacity-80 rounded-lg flex items-center px-4 relative overflow-hidden", color.replace('bg-', 'border-').replace('cyan', 'cyan/40').replace('purple', 'purple/40').replace('gold', 'gold/40').replace('green', 'green/40').replace('accent', 'accent/40'), color.replace('bg-', 'bg-') + '/20')}
        >
          <div className={cn("absolute inset-0 opacity-20", color)} />
          <span className={cn("text-[10px] font-bold relative z-10 uppercase tracking-widest truncate max-w-[90%]", color.replace('bg-', 'text-'))}>
            {task}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
