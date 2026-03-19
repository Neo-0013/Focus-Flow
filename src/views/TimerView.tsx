import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Zap, Coffee, Clock, Plus, X, LayoutList, Circle, Calendar, Volume2, CloudRain, Moon, TreePine, Maximize, Headphones, Flame, Waves, Keyboard, Wind, BookmarkPlus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { cn } from '../utils';
import { Task, Priority, TimerMode } from '../types';

const MODES_META: Record<TimerMode, { label: string; icon: React.ReactNode; color: string }> = {
  work: { label: 'Focus', icon: <Zap className="w-4 h-4" />, color: 'text-emerald-400' },
  shortBreak: { label: 'Short Break', icon: <Coffee className="w-4 h-4" />, color: 'text-accent' },
  longBreak: { label: 'Long Break', icon: <Clock className="w-4 h-4" />, color: 'text-indigo-400' },
};

const AMBIENT_TRACKS = [
  { id: 'rain', name: 'Rainfall', url: '/audio/rain.mp3', icon: CloudRain },
  { id: 'cafe', name: 'Coffee Shop', url: '/audio/cafe.mp3', icon: Coffee },
  { id: 'space', name: 'Deep Space', url: '/audio/space.mp3', icon: Moon },
  { id: 'forest', name: 'Forest Birds', url: '/audio/forest.mp3', icon: TreePine },
  { id: 'keyboard', name: 'Keyboard', url: '/audio/keyboard.mp3', icon: Keyboard },
  { id: 'campfire', name: 'Campfire', url: '/audio/campfire.mp3', icon: Flame },
  { id: 'waves', name: 'Ocean Waves', url: '/audio/waves.mp3', icon: Waves },
  { id: 'thunder', name: 'Thunderstorm', url: '/audio/thunder.mp3', icon: Wind },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-accent/10 text-accent border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

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
  setView: (v: string) => void;
  toggleTask: (id: string) => void;
  workspace: string;
  timerDurations: { work: number; shortBreak: number; longBreak: number };
  setTimerDurations: (d: { work: number; shortBreak: number; longBreak: number }) => void;
  onSessionComplete: (mode: string, duration: number) => void;
  timerPresets: { id: string; name: string; work: number; shortBreak: number; longBreak: number }[];
  fetchTimerPresets: () => void;
}

export function TimerView({
  mode, setMode, timeLeft, isActive, setIsActive, resetTimer, tasks,
  dashboardNewTaskText, setDashboardNewTaskText, dashboardNewSubTask, setDashboardNewSubTask,
  dashboardNewSubTasks, setDashboardNewSubTasks, dashboardNewTaskPriority, setDashboardNewTaskPriority,
  dashboardDueDate, setDashboardDueDate, handleAddTask, addDashboardSubTask, setView, toggleTask,
  workspace, timerDurations, setTimerDurations, onSessionComplete, timerPresets, fetchTimerPresets
}: TimerProps) {
  const defaultVols: Record<string, number> = Object.fromEntries(AMBIENT_TRACKS.map(t => [t.id, 0.5]));
  const defaultActive: Record<string, boolean> = Object.fromEntries(AMBIENT_TRACKS.map(t => [t.id, false]));
  const [ambientVolumes, setAmbientVolumes] = React.useState<Record<string, number>>(defaultVols);
  const [ambientActive, setAmbientActive] = React.useState<Record<string, boolean>>(defaultActive);
  const audioRefs = React.useRef<Record<string, HTMLAudioElement | null>>({});
  const [isDeepWork, setIsDeepWork] = React.useState(false);
  
  const [binauralEnabled, setBinauralEnabled] = React.useState(false);
  const binauralCtx = React.useRef<AudioContext | null>(null);
  const oscillators = React.useRef<OscillatorNode[]>([]);
  const [presetName, setPresetName] = React.useState('');
  const [showPresetInput, setShowPresetInput] = React.useState(false);

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

  React.useEffect(() => {
    if (binauralEnabled && isActive) {
      if (!binauralCtx.current) binauralCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = binauralCtx.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const leftOsc = ctx.createOscillator();
      const rightOsc = ctx.createOscillator();
      const leftPan = ctx.createStereoPanner();
      const rightPan = ctx.createStereoPanner();
      const gainNode = ctx.createGain();

      leftOsc.frequency.value = 200;
      rightOsc.frequency.value = 240; 
      
      leftPan.pan.value = -1;
      rightPan.pan.value = 1;
      gainNode.gain.value = 0.1;

      leftOsc.connect(leftPan);
      rightOsc.connect(rightPan);
      leftPan.connect(gainNode);
      rightPan.connect(gainNode);
      gainNode.connect(ctx.destination);

      leftOsc.start();
      rightOsc.start();
      oscillators.current = [leftOsc, rightOsc];
    } else {
      oscillators.current.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch(e){} });
      oscillators.current = [];
    }

    return () => {
      oscillators.current.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch(e){} });
      oscillators.current = [];
    };
  }, [binauralEnabled, isActive]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsDeepWork(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    AMBIENT_TRACKS.forEach(track => {
      const audio = audioRefs.current[track.id];
      if (audio) {
        audio.volume = ambientVolumes[track.id];
        if (isActive && ambientActive[track.id]) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      }
    });
  }, [isActive, ambientActive, ambientVolumes]);

  return (
    <motion.div key="timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-6xl mx-auto h-full flex flex-col lg:grid lg:grid-cols-12 gap-8">
      
      <AnimatePresence>
        {isDeepWork && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8"
          >
             <button onClick={() => document.exitFullscreen()} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"><X className="w-8 h-8" /></button>
             
             <div className="flex-1 flex flex-col items-center justify-center mt-12 w-full max-w-4xl px-4">
               <div className="text-center w-full">
                 <motion.div key={timeLeft} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-[20vw] font-mono font-black tracking-tighter leading-none mb-8 text-accent drop-shadow-[0_0_80px_var(--accent)]">{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</motion.div>
                 <p className="text-white/40 font-bold uppercase tracking-[0.5em] mb-24">{MODES_META[mode].label} MODE &bull; DEEP WORK</p>
               </div>
               
               <div className="flex items-center gap-12 z-10 scale-[1.5]">
                 <button onClick={resetTimer} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><RotateCcw className="w-6 h-6 text-white/40" /></button>
                 <button onClick={() => setIsActive(!isActive)} className="w-24 h-24 rounded-[32px] bg-accent text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_var(--accent)]">{isActive ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-2" />}</button>
                 <button onClick={() => document.exitFullscreen()} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><Maximize className="w-6 h-6 text-white/40" /></button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="lg:col-span-8 space-y-8">
        <div className="bg-panel border border-white/5 rounded-[40px] p-12 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden min-h-[500px]">
          {/* Preset Panel */}
          {(timerPresets.length > 0 || showPresetInput) && (
            <div className="flex flex-wrap items-center gap-2 mb-4 z-10">
              {timerPresets.map(p => (
                <div key={p.id} className="group flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 hover:border-accent/40 transition-all cursor-pointer"
                  onClick={() => setTimerDurations({ work: p.work, shortBreak: p.shortBreak, longBreak: p.longBreak })}>
                  <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">{p.name}</span>
                  <span className="text-[10px] text-white/20 group-hover:text-white/40">{p.work}/{p.shortBreak}/{p.longBreak}</span>
                  <button onClick={e => { e.stopPropagation(); deletePreset(p.id); }} className="ml-1 text-white/10 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {showPresetInput && (
                <div className="flex items-center gap-2 bg-white/5 border border-accent/30 rounded-xl px-3 py-1.5">
                  <input
                    autoFocus
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowPresetInput(false); }}
                    placeholder="Name this preset…"
                    className="bg-transparent text-xs font-bold focus:outline-none w-32 placeholder:text-white/20"
                  />
                  <button onClick={savePreset} className="text-accent text-xs font-black hover:opacity-80">Save</button>
                  <button onClick={() => setShowPresetInput(false)} className="text-white/20 hover:text-white"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center w-full justify-between mb-12 z-10">
            <div className="flex bg-white/5 rounded-2xl p-1">
              {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => (
                <button key={m} onClick={() => setMode(m)} className={cn("px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all", mode === m ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white")}>{MODES_META[m].icon}{MODES_META[m].label}</button>
              ))}
            </div>
            <button
              onClick={() => setShowPresetInput(s => !s)}
              title="Save current durations as a preset"
              className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border transition-all", showPresetInput ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-white/30 hover:text-white hover:border-white/20")}
            >
              <BookmarkPlus className="w-3.5 h-3.5" /> Save Preset
            </button>
          </div>
          <div className="text-center relative z-10">
            <motion.div key={timeLeft} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-[180px] font-mono font-light tracking-tighter leading-none mb-8 drop-shadow-[0_0_50px_rgba(255,255,255,0.1)]">{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</motion.div>
            <p className="text-accent text-xs font-bold uppercase tracking-[0.3em] mb-12">
              {isActive ? (mode === 'work' ? 'Focusing...' : 'Resting...') : (mode === 'work' ? 'Ready to focus?' : mode === 'shortBreak' ? 'Take a short break' : 'Take a long break')}
            </p>
          </div>
          <div className="flex items-center gap-8 z-10">
            <button onClick={resetTimer} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><RotateCcw className="w-6 h-6 text-white/40" /></button>
            <button onClick={() => setIsActive(!isActive)} className="w-24 h-24 rounded-[32px] bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl">{isActive ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}</button>
            <button onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(()=>{});
              }
            }} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-accent/20 transition-colors group" title="Deep Work Mode">
              <Maximize className="w-6 h-6 text-white/40 group-hover:text-accent" />
            </button>
          </div>

          <button onClick={() => setBinauralEnabled(!binauralEnabled)} className={cn("absolute bottom-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors py-2 px-4 rounded-full border border-white/5", binauralEnabled ? "text-accent bg-accent/10 border-accent/20 shadow-[0_0_20px_var(--accent)]" : "text-white/20 hover:text-white/40 hover:bg-white/5")}>
            <Headphones className="w-3.5 h-3.5" /> 40Hz Gamma Focus
          </button>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[{ label: 'Sessions', value: '7' }, { label: 'Focus Time', value: '175m' }, { label: 'Tasks', value: tasks.filter(t => t.completed).length }].map(stat => (
            <div key={stat.label} className="bg-panel border border-white/5 rounded-3xl p-8 text-center hover:bg-white/[0.02] transition-colors">
              <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-4 space-y-6">
        <section className="bg-panel border border-white/5 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4 text-white/60 text-sm font-medium"><Plus className="w-4 h-4" /> Quick Add Task</div>
          <form onSubmit={handleAddTask} className="space-y-4">
            <input 
              value={dashboardNewTaskText} 
              onChange={e => setDashboardNewTaskText(e.target.value)} 
              placeholder="Add a task..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-6 text-sm focus:outline-none focus:border-white/20 transition-all" 
            />
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
                  <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/40 flex items-center gap-1.5">
                    {st} <X className="w-2.5 h-2.5 cursor-pointer hover:text-red-400" onClick={() => setDashboardNewSubTasks(prev => prev.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select 
                value={dashboardNewTaskPriority}
                onChange={e => setDashboardNewTaskPriority(e.target.value as Priority)}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white/60 appearance-none focus:outline-none cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              
              <div className="relative w-12 h-[42px] shrink-0">
                <input 
                  type="date" 
                  value={dashboardDueDate} 
                  onChange={e => setDashboardDueDate(e.target.value)}
                  className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10" 
                />
                <div className={cn("p-3 bg-white/5 border border-white/5 rounded-2xl transition-all h-full w-full flex items-center justify-center", dashboardDueDate ? "text-accent" : "text-white/20")}>
                  <Calendar className="w-4 h-4" />
                </div>
              </div>

              <button type="submit" className="bg-accent hover:bg-accent px-6 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-blue-900/20 transition-all">
                Add
              </button>
            </div>
          </form>
        </section>
        <section className="bg-panel border border-white/5 rounded-3xl p-6 shadow-2xl flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium"><LayoutList className="w-4 h-4" /> Active Tasks</div>
            <button onClick={() => setView('tasks')} className="text-[10px] text-white/20 hover:text-white transition-colors">View All</button>
          </div>
          <div className="space-y-3">
            {tasks.filter(t => !t.completed).slice(0, 5).map(task => (
              <div key={task.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group">
                <button onClick={() => toggleTask(task.id)} className="text-white/20 hover:text-white"><Circle className="w-4 h-4" /></button>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-medium truncate mb-1">{task.text}</h5>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-amber-400/60 font-bold uppercase">{task.dueDate ? format(new Date(task.dueDate), 'd MMM') : 'Today'}</span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[40%]" /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ambient Mixer */}
        <section className="bg-panel border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <Volume2 className="w-5 h-5 text-white/40" />
            <h3 className="font-bold text-white/80">Zen Mode Mixer</h3>
            <span className="ml-auto text-xs font-bold text-white/20 uppercase tracking-widest">Ambient Audio</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {AMBIENT_TRACKS.map(track => {
              const Icon = track.icon;
              const active = ambientActive[track.id];
              return (
                <div key={track.id} className={cn("p-4 rounded-2xl border transition-all flex flex-col gap-3", active ? "bg-white/10 border-white/20" : "bg-white/5 border-transparent")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", active ? "text-accent" : "text-white/40")} />
                      <span className="text-xs font-bold text-white/60">{track.name}</span>
                    </div>
                    <button 
                      onClick={() => setAmbientActive(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
                      className={cn("w-10 h-5 rounded-full relative transition-colors", active ? "bg-accent" : "bg-white/10")}
                    >
                      <div className={cn("w-3 h-3 rounded-full bg-white absolute top-1 transition-all", active ? "right-1" : "left-1")} />
                    </button>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={ambientVolumes[track.id]} 
                    onChange={e => setAmbientVolumes(prev => ({ ...prev, [track.id]: parseFloat(e.target.value) }))}
                    className={cn("w-full h-1 bg-white/10 rounded-full appearance-none outline-none overflow-hidden", !active && "opacity-50 pointer-events-none")}
                  />
                  <audio ref={el => audioRefs.current[track.id] = el} src={track.url} loop />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
