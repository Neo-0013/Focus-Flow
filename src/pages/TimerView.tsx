import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, Pause, Play, X, Activity, Volume2, Moon, CloudRain, Zap, 
  Coffee, Clock, Plus, LayoutList, Circle, Calendar, Maximize, 
  Headphones, Flame, Waves, Keyboard, Wind, BookmarkPlus, CheckCircle2 
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { cn } from '../utils/index';
import { Task, Priority, TimerMode, AppView } from '../types';

// ── Void Mode Exit Button ──────────────────────────────────────────────────
function VoidExitButton({ onExit }: { onExit: () => void }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const progress = Math.min(100, ((Date.now() - startTime) / 3000) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        onExit();
        setHoldProgress(0);
      }
    }, 30);
  };

  const stopHold = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setHoldProgress(0);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      className="relative overflow-hidden bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-widest select-none cursor-pointer"
    >
      <div
        className="absolute inset-y-0 left-0 bg-red-500/25 transition-none"
        style={{ width: `${holdProgress}%` }}
      />
      <span className="relative z-10">{holdProgress > 0 ? 'Release to cancel' : 'Hold to Exit'}</span>
    </button>
  );
}

const MODES_META: Record<TimerMode, { label: string; icon: React.ReactNode; color: string; glow: string }> = {
  work: { 
    label: 'Focus', 
    icon: <Zap className="w-4 h-4" />, 
    color: 'text-focus-cyan', 
    glow: 'shadow-[0_0_30px_rgba(0,240,255,0.3)]' 
  },
  shortBreak: { 
    label: 'Short Break', 
    icon: <Coffee className="w-4 h-4" />, 
    color: 'text-recovery-green', 
    glow: 'shadow-[0_0_30px_rgba(0,255,102,0.3)]' 
  },
  longBreak: { 
    label: 'Long Break', 
    icon: <Clock className="w-4 h-4" />, 
    color: 'text-recovery-green', 
    glow: 'shadow-[0_0_30px_rgba(0,255,102,0.3)]' 
  },
};

const AMBIENT_TRACKS = [
  { id: 'rain', name: 'Rainfall', url: '/audio/rain.mp3', icon: CloudRain, label: 'Soft Drizzle' },
  { id: 'space', name: 'Deep Space', url: '/audio/space.mp3', icon: Moon, label: 'Vacuum Hum' },
  { id: 'focus', name: 'Binaural', url: '/audio/focus.mp3', icon: Zap, label: 'Alpha Wave' },
  { id: 'waves', name: 'Ocean', url: '/audio/waves.mp3', icon: Waves, label: 'Tidal Flow' },
];

interface TimerProps {
  mode: TimerMode;
  setMode: (m: TimerMode) => void;
  timeLeft: number;
  isActive: boolean;
  setIsActive: (a: boolean) => void;
  resetTimer: () => void;
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
  handleAddTask: (e?: React.FormEvent) => void;
  addDashboardSubTask: () => void;
  setView: (v: AppView) => void;
  toggleTask: (id: string) => void;
  workspace: string;
  timerDurations: { work: number; shortBreak: number; longBreak: number };
  setTimerDurations: (d: { work: number; shortBreak: number; longBreak: number }) => void;
  onSessionComplete: (mode: string, duration: number) => void;
  timerPresets: { id: string; name: string; work: number; shortBreak: number; longBreak: number }[];
  fetchTimerPresets: () => void;
  activePomodoroTaskId?: string;
  setActivePomodoroTaskId?: (id: string | undefined) => void;
  focusSessions?: any[];
  voidModeActive?: boolean;
  setVoidModeActive?: (v: boolean) => void;
}

export function TimerView({
  mode, setMode, timeLeft, isActive, setIsActive, resetTimer, tasks,
  dashboardNewTaskText, setDashboardNewTaskText, dashboardNewSubTask, setDashboardNewSubTask,
  dashboardNewSubTasks, setDashboardNewSubTasks, dashboardNewTaskPriority, setDashboardNewTaskPriority,
  dashboardDueDate, setDashboardDueDate, handleAddTask, addDashboardSubTask, setView, toggleTask,
  workspace, timerDurations, setTimerDurations, onSessionComplete, timerPresets, fetchTimerPresets,
  activePomodoroTaskId, setActivePomodoroTaskId, focusSessions,
  voidModeActive, setVoidModeActive
}: TimerProps) {
  const [ambientVolumes, setAmbientVolumes] = useState<Record<string, number>>(() => 
    Object.fromEntries(AMBIENT_TRACKS.map(t => [t.id, 45]))
  );
  const [ambientActive, setAmbientActive] = useState<Record<string, boolean>>(() => 
    Object.fromEntries(AMBIENT_TRACKS.map(t => [t.id, false]))
  );
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [isDeepWork, setIsDeepWork] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    await axios.post('http://localhost:3002/timer-presets', {
      name: presetName.trim(),
      work: timerDurations.work,
      shortBreak: timerDurations.shortBreak,
      longBreak: timerDurations.longBreak
    });
    setPresetName('');
    setShowPresetInput(false);
    fetchTimerPresets();
  };

  const deletePreset = async (id: string) => {
    await axios.delete(`http://localhost:3002/timer-presets/${id}`);
    fetchTimerPresets();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsDeepWork(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    AMBIENT_TRACKS.forEach(track => {
      const audio = audioRefs.current[track.id];
      if (audio) {
        audio.volume = ambientVolumes[track.id] / 100;
        if (isActive && ambientActive[track.id]) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      }
    });
  }, [isActive, ambientActive, ambientVolumes]);

  const currentColor = mode === 'work' ? 'text-focus-cyan' : 'text-recovery-green';
  const currentAccentBg = mode === 'work' ? 'bg-focus-cyan' : 'bg-recovery-green';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col lg:grid lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
      
      {/* Deep Work Fullscreen Overlay */}
      <AnimatePresence>
        {isDeepWork && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-midnight-base flex flex-col items-center justify-center p-8"
          >
            <div className="absolute inset-0 shrouded-overlay pointer-events-none z-10"></div>
            <div className="absolute inset-0 vignette pointer-events-none z-10"></div>
            
            <button onClick={() => document.exitFullscreen()} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors z-20">
              <X className="w-8 h-8" />
            </button>
            
            <div className="relative z-20 flex flex-col items-center">
              <motion.div key={timeLeft} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} 
                className={cn("text-[20vw] font-bold tracking-tighter leading-none mb-4 timer-glow", currentColor)}>
                {formatTime(timeLeft)}
              </motion.div>
              <p className="text-white/40 font-bold uppercase tracking-[0.5em] text-sm">
                {MODES_META[mode].label} PHASE &bull; ELITE ARCHITECT ACTIVE
              </p>
              
              <div className="flex items-center gap-12 mt-20 scale-150">
                <button onClick={resetTimer} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <RotateCcw className="w-6 h-6 text-white/40" />
                </button>
                <button onClick={() => setIsActive(!isActive)} className={cn("w-24 h-24 rounded-[32px] text-[#050505] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl", currentAccentBg)}>
                  {isActive ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
                </button>
                <button onClick={() => document.exitFullscreen()} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Maximize className="w-6 h-6 text-white/40" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Void Mode Overlay */}
      <AnimatePresence>
        {voidModeActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] pointer-events-none"
          >
            {/* Top-right indicator + exit */}
            <div className="absolute top-6 right-6 flex items-center gap-3 pointer-events-auto">
              <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Void Mode</span>
              </div>
              <VoidExitButton onExit={() => setVoidModeActive?.(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Timer Section */}
      <div className="lg:col-span-8 flex flex-col gap-8">
        <div className="relative flex-1 bg-background border border-white/5 rounded-[40px] p-8 flex flex-col items-center justify-center overflow-hidden min-h-[600px] shadow-2xl">
          {/* Shrouded Background */}
          <div className="absolute inset-0 shrouded-overlay pointer-events-none z-0"></div>
          <div className="absolute inset-0 vignette pointer-events-none z-0 opacity-50"></div>
          
          <div className="relative z-10 w-full flex flex-col items-center">
            {/* Mode Switcher */}
            <div className="flex bg-midnight-base/80 backdrop-blur-xl border border-white/5 rounded-2xl p-1 mb-12">
              {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => (
                <button 
                  key={m} 
                  onClick={() => setMode(m)} 
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
                    mode === m ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                  )}
                >
                  {MODES_META[m].icon}{MODES_META[m].label}
                </button>
              ))}
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center gap-2">
               <div className="text-[10px] font-bold text-white/30 tracking-[0.4em] uppercase mb-4">
                  Neural State: {isActive ? 'In Session' : 'Standby'}
               </div>
               
               <div className="relative">
                  <svg className="w-72 h-72 -rotate-90 transform">
                    <circle cx="144" cy="144" r="135" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                    <circle 
                      cx="144" 
                      cy="144" 
                      r="135" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      fill="transparent" 
                      strokeDasharray="848" 
                      strokeDashoffset={848 * (1 - timeLeft / (timerDurations[mode] * 60))} 
                      className={cn("transition-all duration-1000", currentColor)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span key={timeLeft} initial={{ opacity: 0.8 }} animate={{ opacity: 1 }}
                      className={cn("text-[90px] font-bold tracking-tighter leading-none select-none timer-glow", currentColor)}>
                      {formatTime(timeLeft)}
                    </motion.span>
                  </div>
               </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center gap-8 mt-12">
               <button onClick={resetTimer} className="w-12 h-12 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 flex items-center justify-center transition-all">
                  <RotateCcw className="w-5 h-5 text-white/40" />
               </button>
               <button onClick={() => setIsActive(!isActive)} 
                 className={cn("w-20 h-20 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-midnight-base", currentAccentBg, MODES_META[mode].glow)}>
                  {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
               </button>
               <button onClick={() => document.documentElement.requestFullscreen()} className="w-12 h-12 rounded-full border border-white/10 hover:border-focus-cyan/30 hover:bg-white/5 flex items-center justify-center transition-all group">
                  <Maximize className="w-5 h-5 text-white/40 group-hover:text-focus-cyan" />
               </button>
            </div>
          </div>
        </div>

        {/* Ambient Soundscape Section */}
        <section className="glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-focus-cyan" />
              <h3 className="font-bold text-lg text-white/90">Ambient Soundscape</h3>
            </div>
            <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase">
              NEURAL OPTIMIZATION ACTIVE
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {AMBIENT_TRACKS.map(track => {
              const Icon = track.icon;
              const active = ambientActive[track.id];
              return (
                <div key={track.id} className="flex flex-col gap-3 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Icon className={cn("w-3.5 h-3.5 transition-colors", active ? "text-focus-cyan" : "text-white/30")} />
                       <label className="text-[10px] font-bold text-white/60 uppercase group-hover:text-white transition-colors tracking-wider">
                        {track.name}
                       </label>
                    </div>
                    <button 
                      onClick={() => setAmbientActive(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
                      className={cn(
                        "w-7 h-3.5 rounded-full relative transition-colors duration-300",
                        active ? "bg-focus-cyan/50" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform duration-300",
                        active ? "left-[16px]" : "left-[2px]"
                      )} />
                    </button>
                  </div>
                  <input 
                    type="range" min="0" max="100" value={ambientVolumes[track.id]}
                    onChange={(e) => setAmbientVolumes(prev => ({ ...prev, [track.id]: parseInt(e.target.value) }))}
                    className={cn("w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-focus-cyan", !active && "opacity-30 pointer-events-none")} 
                  />
                  <div className="flex justify-between items-center text-[8px] text-white/20 font-mono">
                    <span>{track.label}</span>
                    <span>{ambientVolumes[track.id]}%</span>
                  </div>
                  <audio ref={el => { audioRefs.current[track.id] = el; }} src={track.url} loop />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Task & History Sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Quick Add Section */}
        <section className="bg-panel border border-white/5 rounded-[32px] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-white/40 text-[10px] font-bold uppercase tracking-widest">
            <Plus className="w-3.5 h-3.5" /> Direct Neural Input
          </div>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-3">
              <input 
                value={dashboardNewTaskText} onChange={e => setDashboardNewTaskText(e.target.value)} 
                placeholder="What is the mission?" 
                className="w-full bg-midnight-base border border-white/5 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:border-focus-cyan/30 transition-all placeholder:text-white/10" 
              />
              <div className="relative">
                <input 
                  value={dashboardNewSubTask} onChange={e => setDashboardNewSubTask(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDashboardSubTask())} 
                  placeholder="Steps..." 
                  className="w-full bg-midnight-base border border-white/5 rounded-2xl py-2.5 px-5 text-xs focus:outline-none focus:border-focus-cyan/30 transition-all placeholder:text-white/10" 
                />
                <button type="button" onClick={addDashboardSubTask} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/20 hover:text-focus-cyan transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <select 
                value={dashboardNewTaskPriority} onChange={e => setDashboardNewTaskPriority(e.target.value as Priority)}
                className="flex-1 bg-midnight-base border border-white/5 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white/40 uppercase appearance-none focus:outline-none cursor-pointer"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium</option>
                <option value="high">Critical</option>
              </select>
              <button type="submit" className="bg-focus-cyan text-midnight-base px-6 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
                Add
              </button>
            </div>
          </form>
        </section>

        {/* Active Tasks Section */}
        <section className="bg-panel border border-white/5 rounded-[32px] p-6 shadow-xl flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-widest">
              <LayoutList className="w-3.5 h-3.5" /> Active Objectives
            </div>
            <button onClick={() => setView('tasks')} className="text-[10px] text-focus-cyan/40 hover:text-focus-cyan transition-colors">ALL</button>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide">
            {tasks.filter(t => !t.completed).slice(0, 6).map(task => (
              <div key={task.id} className={cn(
                "bg-midnight-base/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group transition-all", 
                activePomodoroTaskId === task.id && "border-focus-cyan/30 bg-focus-cyan/5 shadow-lg"
              )}>
                <button onClick={() => toggleTask(task.id)} className="text-white/10 hover:text-focus-cyan transition-colors">
                  <Circle className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <h5 className="text-[11px] font-bold truncate mb-1 text-white/80">{task.text}</h5>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/20 font-bold uppercase">{task.dueDate ? format(new Date(task.dueDate), 'd MMM') : 'Ongoing'}</span>
                  </div>
                </div>
                <button onClick={() => setActivePomodoroTaskId?.(activePomodoroTaskId === task.id ? undefined : task.id)} 
                  className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", 
                    activePomodoroTaskId === task.id ? "bg-focus-cyan text-midnight-base" : "bg-white/5 text-white/30 hover:bg-white/10"
                  )}>
                   {activePomodoroTaskId === task.id ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
              </div>
            ))}
            {tasks.filter(t => !t.completed).length === 0 && (
              <div className="py-8 text-center text-[10px] text-white/10 uppercase tracking-widest">No Active Missions</div>
            )}
          </div>
        </section>

        {/* Session History Log */}
        <section className="bg-panel border border-white/5 rounded-[32px] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-white/40 text-[10px] font-bold uppercase tracking-widest">
             <Clock className="w-3.5 h-3.5" /> Neural Log
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
             {focusSessions?.slice(0, 8).map((session, idx) => {
               const boundTask = session.taskId ? tasks.find(t => t.id === session.taskId) : null;
               return (
                 <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-midnight-base/30 border border-white/5">
                    <div className={cn(
                      "w-1.5 h-6 rounded-full",
                      session.mode === 'work' ? "bg-focus-cyan" : "bg-recovery-green"
                    )} />
                    <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-bold text-white/80 flex items-center justify-between">
                         {session.mode === 'work' ? 'Deep Work' : 'Recovery'}
                         <span className="text-[9px] text-white/20 font-normal">{format(new Date(session.completedAt), 'HH:mm')}</span>
                       </p>
                       {boundTask && <p className="text-[9px] text-white/40 truncate mt-0.5">{boundTask.text}</p>}
                    </div>
                 </div>
               );
             })}
          </div>
        </section>

        {/* Timer Settings */}
        <section className="bg-panel border border-white/5 rounded-[32px] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-white/40 text-[10px] font-bold uppercase tracking-widest">
             <Clock className="w-3.5 h-3.5" /> Phase Durations (Mins)
          </div>
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase flex items-center gap-2">
                  <Zap className="w-3 h-3 text-focus-cyan" /> Focus
                </span>
                <input 
                  type="number" 
                  min="1" max="120"
                  value={timerDurations.work}
                  onChange={(e) => setTimerDurations({...timerDurations, work: parseInt(e.target.value) || 1})}
                  className="w-16 bg-midnight-base border border-white/5 rounded-xl text-center py-1.5 text-xs font-bold focus:outline-none focus:border-focus-cyan/30 text-white transition-all"
                />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase flex items-center gap-2">
                  <Coffee className="w-3 h-3 text-recovery-green" /> Short Break
                </span>
                <input 
                  type="number" 
                  min="1" max="60"
                  value={timerDurations.shortBreak}
                  onChange={(e) => setTimerDurations({...timerDurations, shortBreak: parseInt(e.target.value) || 1})}
                  className="w-16 bg-midnight-base border border-white/5 rounded-xl text-center py-1.5 text-xs font-bold focus:outline-none focus:border-recovery-green/30 text-white transition-all"
                />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase flex items-center gap-2">
                  <Clock className="w-3 h-3 text-recovery-green" /> Long Break
                </span>
                <input 
                  type="number" 
                  min="1" max="60"
                  value={timerDurations.longBreak}
                  onChange={(e) => setTimerDurations({...timerDurations, longBreak: parseInt(e.target.value) || 1})}
                  className="w-16 bg-midnight-base border border-white/5 rounded-xl text-center py-1.5 text-xs font-bold focus:outline-none focus:border-recovery-green/30 text-white transition-all"
                />
             </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
