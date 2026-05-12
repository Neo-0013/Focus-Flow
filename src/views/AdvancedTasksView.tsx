import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Trophy, Flame, Target, Network, Layers, 
  Clock, Brain, Activity, ChevronRight, Maximize2, 
  Plus, Search, Filter, Shield, MoreVertical, 
  AlertCircle, ChevronDown, CheckCircle2, Circle, Trash2, X
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../utils';
import { Task, Priority } from '../types';
import axios from 'axios';

const API_BASE = 'http://localhost:3002';

interface AdvancedTasksViewProps {
  tasks: Task[];
  fetchTasks: () => Promise<void>;
  workspace: string;
  showToast: (title: string, body: string, type?: string) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  onInitiateShield: () => void;
}

export function AdvancedTasksView({ tasks, fetchTasks, workspace, showToast, toggleTask, deleteTask, onInitiateShield }: AdvancedTasksViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const matrixRef = useRef<HTMLDivElement>(null);

  // Derived Metrics
  const activeTasks = useMemo(() => tasks.filter(t => !t.completed && !t.archived), [tasks]);
  
  const loadIndex = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    const totalCost = activeTasks.reduce((sum, t) => sum + (t.cognitiveCost || 5), 0);
    return Math.min(10, totalCost / activeTasks.length).toFixed(1);
  }, [activeTasks]);

  const loadColor = useMemo(() => {
    const val = parseFloat(loadIndex as string);
    if (val < 4) return '#10b981'; // Emerald
    if (val < 7) return '#8b5cf6'; // Purple
    return '#ef4444'; // Red
  }, [loadIndex]);

  const pieData = [
    { value: parseFloat(loadIndex as string) },
    { value: 10 - parseFloat(loadIndex as string) }
  ];

  const handleUpdateMetrics = async (taskId: string, updates: Partial<Task>) => {
    try {
      await axios.patch(`${API_BASE}/tasks/${taskId}`, updates);
      await fetchTasks();
    } catch (err) {
      showToast('Error', 'Failed to update task metrics', 'error');
    }
  };

  const handleSetTimeSlot = async (taskId: string, hour: number) => {
    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
    await handleUpdateMetrics(taskId, { timeSlot });
    showToast('Architect', `Task scheduled for ${timeSlot}`, 'success');
  };

  const handleDragEnd = (task: Task, info: any) => {
    if (!matrixRef.current) return;
    
    const rect = matrixRef.current.getBoundingClientRect();
    const x = info.point.x - rect.left;
    const y = info.point.y - rect.top;
    
    // Convert pixels to 0-100 percentages
    // X axis is Urgency (left to right)
    // Y axis is Importance (bottom to top, so we subtract from 100)
    const urgency = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    const importance = Math.max(0, Math.min(100, Math.round(100 - (y / rect.height) * 100)));
    
    handleUpdateMetrics(task.id, { urgency, importance });
    showToast('Architect', `Task repositioned: ${importance}% Importance | ${urgency}% Urgency`, 'info');
  };

  // Timeline Logic
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const tasksByHour = useMemo(() => {
    const map: Record<number, Task[]> = {};
    activeTasks.forEach(t => {
      if (t.timeSlot && t.timeSlot.includes(':')) {
        const hour = parseInt(t.timeSlot.split(':')[0]);
        if (!isNaN(hour)) {
          if (!map[hour]) map[hour] = [];
          map[hour].push(t);
        }
      }
    });
    return map;
  }, [activeTasks]);

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-700 pb-8">
      {/* Top HUD Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[400px]">
        
        {/* Impact Matrix (2x2) */}
        <div className="lg:col-span-2 bg-panel border border-white/5 rounded-[40px] p-8 relative overflow-hidden group flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Impact Matrix</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Strategic Orchestration</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                 <Network className="w-3 h-3" /> Draggable Analysis
               </span>
               <button className="p-2 text-white/20 hover:text-white transition-colors"><Maximize2 className="w-4 h-4" /></button>
            </div>
          </div>

          <div ref={matrixRef} className="flex-1 relative border border-white/10 rounded-2xl bg-black/40 overflow-hidden">
             {/* Grid Lines */}
             <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-full h-px bg-white/5" />
               <div className="h-full w-px bg-white/5" />
             </div>
             
             {/* Axis Labels */}
             <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-white/20 uppercase tracking-widest pointer-events-none">Importance</div>
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/20 uppercase tracking-widest pointer-events-none">Urgency</div>

             {/* Quadrant Names */}
             <div className="absolute top-4 right-4 text-[8px] font-bold text-red-400/40 uppercase tracking-widest pointer-events-none">High Stakes</div>
             <div className="absolute top-4 left-4 text-[8px] font-bold text-purple-400/40 uppercase tracking-widest pointer-events-none">Strategic</div>
             <div className="absolute bottom-12 left-4 text-[8px] font-bold text-cyan-400/40 uppercase tracking-widest pointer-events-none">Low Impact</div>
             <div className="absolute bottom-12 right-4 text-[8px] font-bold text-amber-400/40 uppercase tracking-widest pointer-events-none">Delegatable</div>

             {/* Task Bubbles */}
             {activeTasks.map(task => (
               <motion.div
                 key={task.id}
                 drag
                 dragMomentum={false}
                 onDragEnd={(_, info) => handleDragEnd(task, info)}
                 layoutId={task.id}
                 className="absolute cursor-move group/bubble z-10"
                 style={{ 
                   left: `${task.urgency || 50}%`, 
                   bottom: `${task.importance || 50}%`,
                   x: '-50%',
                   y: '50%'
                 }}
               >
                 <div className={cn(
                   "w-4 h-4 rounded-full border-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all group-hover/bubble:scale-150",
                   task.priority === 'high' ? "bg-red-500 border-red-400/50 shadow-red-500/40" :
                   task.priority === 'medium' ? "bg-amber-500 border-amber-400/50 shadow-amber-500/40" :
                   "bg-cyan-500 border-cyan-400/50 shadow-cyan-500/40"
                 )} />
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity whitespace-nowrap bg-panel-dark border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold z-50 pointer-events-none shadow-2xl">
                   {task.text}
                 </div>
               </motion.div>
             ))}
          </div>

          <div className="mt-6 bg-cyan-400/5 border border-cyan-400/10 rounded-2xl p-4 flex items-start gap-3 shrink-0">
             <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5" />
             <p className="text-[11px] leading-relaxed text-cyan-100/60 italic">
               "System identifies high leverage in {activeTasks.length} active nodes. Reposition bubbles to calibrate priority."
             </p>
          </div>
        </div>

        {/* Cognitive Forecast */}
        <div className="bg-panel border border-white/5 rounded-[40px] p-8 flex flex-col items-center justify-between relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/40 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="w-full">
             <h3 className="text-xl font-bold tracking-tight">Cognitive Forecast</h3>
             <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Energy Mapping</p>
           </div>

           <div className="relative w-48 h-48 my-8">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={pieData}
                   innerRadius={65}
                   outerRadius={80}
                   paddingAngle={0}
                   dataKey="value"
                   startAngle={225}
                   endAngle={-45}
                 >
                   <Cell fill={loadColor} stroke="none" />
                   <Cell fill="rgba(255,255,255,0.05)" stroke="none" />
                 </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black tabular-nums tracking-tighter">{loadIndex}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Load Index</span>
             </div>
           </div>

           <div className="w-full space-y-4">
             <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-white/40 uppercase tracking-widest">Efficiency Status</span>
                <span className={cn("font-black", parseFloat(loadIndex as string) < 7 ? "text-emerald-400" : "text-red-400")}>
                   {parseFloat(loadIndex as string) < 4 ? "Peak Optimal" : parseFloat(loadIndex as string) < 7 ? "Nominal" : "Warning: Overload"}
                </span>
             </div>
             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 w-[30%]" />
                <div className="h-full bg-amber-500 w-[40%]" />
                <div className="h-full bg-red-500 w-[30%]" />
             </div>
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/20">
                <span>Morning</span>
                <span>Afternoon</span>
                <span>Evening</span>
             </div>
           </div>
        </div>

        {/* Timeline Rail */}
        <div className="bg-panel border border-white/5 rounded-[40px] p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Timeline Rail</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Visual Time-Block</p>
            </div>
            <span className="text-[10px] font-bold text-white/20 flex items-center gap-1 uppercase tracking-widest"><Clock className="w-3 h-3" /> Live Feed</span>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {hours.map(hour => {
              const hourTasks = tasksByHour[hour] || [];
              return (
                <div 
                  key={hour} 
                  className="relative pl-12 min-h-[60px] group/slot"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId) handleSetTimeSlot(taskId, hour);
                  }}
                >
                  <div className="absolute left-0 top-0 text-[10px] font-bold text-white/20 tabular-nums">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="absolute left-8 top-1 bottom-0 w-px bg-white/5 group-hover/slot:bg-amber-500/20 transition-colors" />
                  <div className="absolute left-[29px] top-1 w-2.5 h-2.5 rounded-full border border-white/10 bg-panel group-hover/slot:border-amber-500/40 transition-colors" />
                  
                  <div className="space-y-2">
                    {hourTasks.length > 0 ? (
                      hourTasks.map(t => (
                        <div 
                          key={t.id} 
                          className={cn(
                            "border-l-2 p-3 rounded-r-xl transition-all hover:bg-white/5 cursor-pointer relative group/item",
                            t.priority === 'high' ? "bg-red-500/10 border-red-500" :
                            t.priority === 'medium' ? "bg-amber-500/10 border-amber-500" :
                            "bg-cyan-500/10 border-cyan-500"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-bold truncate">{t.text}</h4>
                            <button 
                              onClick={() => handleUpdateMetrics(t.id, { timeSlot: null })}
                              className="opacity-0 group-hover/item:opacity-100 text-white/20 hover:text-red-400 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[9px] text-white/40 font-bold uppercase">{t.cognitiveCost || 5} Cost Unit</p>
                        </div>
                      ))
                    ) : (
                      <div className="w-full h-10 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-[9px] font-bold text-white/5 group-hover/slot:text-white/20 group-hover/slot:border-white/10 transition-all uppercase tracking-widest">
                        Drop to Schedule
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* Task Registry Table */}
        <div className="lg:col-span-2 bg-panel border border-white/5 rounded-[40px] p-8 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold tracking-tight">Task Registry</h3>
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                <button className="px-3 py-1 text-[10px] font-bold bg-white/5 rounded-lg">Active</button>
                <button className="px-3 py-1 text-[10px] font-bold text-white/40 hover:text-white">Backlog</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input 
                  type="text" 
                  placeholder="Query Registry..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-white/20 w-48"
                />
              </div>
              <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"><Filter className="w-4 h-4 text-white/40" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-white/20 border-b border-white/5">
                  <th className="pb-4 pl-4">Identifier</th>
                  <th className="pb-4">Operation</th>
                  <th className="pb-4">Cost</th>
                  <th className="pb-4">Impact</th>
                  <th className="pb-4 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.filter(t => !t.archived && t.text.toLowerCase().includes(searchTerm.toLowerCase())).map((task) => (
                  <tr 
                    key={task.id} 
                    draggable 
                    onDragStart={(e) => {
                      e.dataTransfer.setData('taskId', task.id);
                    }}
                    className="group hover:bg-white/[0.01] transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <td className="py-5 pl-4">
                       <span className="text-[10px] font-bold tabular-nums text-white/30 group-hover:text-cyan-400 transition-colors">FF-{task.id.slice(0, 3).toUpperCase()}</span>
                    </td>
                    <td className="py-5">
                       <div className="flex flex-col">
                         <span className={cn("text-sm font-bold transition-all", task.completed && "text-white/20 line-through")}>{task.text}</span>
                         <span className="text-[9px] text-white/20 font-bold uppercase mt-1 tracking-wider">{task.priority} Priority</span>
                       </div>
                    </td>
                    <td className="py-5">
                       <div className="flex gap-0.5">
                         {[1, 2, 3, 4, 5].map(i => (
                           <div key={i} className={cn(
                             "w-1.5 h-3 rounded-full",
                             i <= (task.cognitiveCost || 5) / 2 ? (
                               (task.cognitiveCost || 5) > 7 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                               (task.cognitiveCost || 5) > 4 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                             ) : "bg-white/5"
                           )} />
                         ))}
                       </div>
                    </td>
                    <td className="py-5">
                       <span className="text-xs font-black tabular-nums text-cyan-400">{((task.importance || 50) / 10).toFixed(1)}</span>
                    </td>
                    <td className="py-5 pr-4 text-right">
                       <div className="flex items-center justify-end gap-3">
                         <button 
                           onClick={() => toggleTask(task.id)}
                           className={cn(
                             "w-8 h-8 rounded-lg flex items-center justify-center transition-all border",
                             task.completed ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
                           )}
                         >
                           {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                         </button>
                         <button 
                           onClick={() => deleteTask(task.id)}
                           className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/40 transition-all opacity-0 group-hover:opacity-100"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dependency Graph & AI Sidebar */}
        <div className="flex flex-col gap-6">
          
          {/* Dependency Graph */}
          <div className="bg-panel border border-white/5 rounded-[40px] p-8 h-[300px] relative overflow-hidden group shrink-0">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/40 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-xl font-bold tracking-tight mb-2">Dependency Graph</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-6">Automated Bottleneck Logic</p>
            
            <div className="relative h-40">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path d="M150,20 L100,80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4" />
                <path d="M150,20 L200,80" stroke="rgba(239,68,68,0.2)" strokeWidth="1" />
                <circle cx="150" cy="20" r="3" fill="#8b5cf6" />
                <circle cx="100" cy="80" r="3" fill="#10b981" />
                <circle cx="200" cy="80" r="3" fill="#ef4444" />
              </svg>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg text-[9px] font-bold text-purple-200">PROJECT ALPHA</div>
              <div className="absolute bottom-4 left-1/4 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-[9px] font-bold text-emerald-200">NODES: 04</div>
              <div className="absolute bottom-4 right-1/4 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg text-[9px] font-bold text-red-200">PATH: BLOCKED</div>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
               <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Bottleneck identified in 'Infrastructure'</span>
            </div>
          </div>

          {/* Neo Intelligence */}
          <div className="bg-panel border border-white/5 rounded-[40px] p-8 flex-1 relative overflow-hidden group flex flex-col min-h-[300px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-lg font-bold tracking-tight mb-4 italic flex items-center gap-2">
               <Shield className="w-4 h-4 text-cyan-400" /> Neo Intelligence
            </h3>
            
            <div className="flex-1 space-y-4">
               <div className="bg-black/40 border border-cyan-500/20 p-4 rounded-2xl flex items-start gap-3">
                 <p className="text-[11px] text-cyan-100/70 leading-relaxed italic">
                   System has detected high focus potential. Initiating environmental isolation protocols to secure deep work block.
                 </p>
               </div>
               
               <div className="relative rounded-2xl overflow-hidden border border-white/5 aspect-video bg-black/60 group/video flex-1 min-h-[120px]">
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Flame className="w-8 h-8 text-white/10 group-hover/video:text-white/40 transition-all duration-500" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                     <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Neural Feed Active</span>
                     <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-cyan-400" />
                        <div className="w-1 h-1 rounded-full bg-white/10" />
                        <div className="w-1 h-1 rounded-full bg-white/10" />
                     </div>
                  </div>
               </div>
            </div>

            <button 
              onClick={onInitiateShield}
              className="mt-6 w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_40px_rgba(6,182,212,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
               Initiate Deep Shield
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
