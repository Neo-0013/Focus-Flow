import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Circle, CheckCircle2, Zap } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { cn } from '../utils';
import { Task, Priority } from '../types';
import axios from 'axios';

const API_BASE = 'http://localhost:3002';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-accent/10 text-accent border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface CalendarProps {
  tasks: Task[];
  currentTime: Date;
  setView: (v: string) => void;
  toggleTask: (id: string) => void;
  showToast: (title: string, body: string, type?: string) => void;
  focusSessions: any[];
}

export function CalendarView({ tasks, currentTime, setView, toggleTask, showToast, focusSessions }: CalendarProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [showCalendarAddModal, setShowCalendarAddModal] = useState<Date | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Local state for the modal
  const [modalTaskText, setModalTaskText] = useState('');
  const [modalTaskPriority, setModalTaskPriority] = useState<Priority>('medium');
  const [modalSubTask, setModalSubTask] = useState('');
  const [modalSubTasks, setModalSubTasks] = useState<string[]>([]);

  const calendarDays = useMemo(() => {
    if (calendarView === 'month') {
      const start = startOfWeek(startOfMonth(calendarDate));
      const end = endOfWeek(endOfMonth(calendarDate));
      return eachDayOfInterval({ start, end });
    } else if (calendarView === 'week') {
      const start = startOfWeek(calendarDate);
      const end = endOfWeek(calendarDate);
      return eachDayOfInterval({ start, end });
    } else {
      return [calendarDate];
    }
  }, [calendarDate, calendarView]);

  const addModalSubTask = () => {
    if (modalSubTask.trim()) {
      setModalSubTasks([...modalSubTasks, modalSubTask.trim()]);
      setModalSubTask('');
    }
  };

  const handleCreateTask = async () => {
    if (!modalTaskText.trim() || !showCalendarAddModal) return;
    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId,
      text: modalTaskText.trim(),
      completed: false,
      priority: modalTaskPriority,
      position: tasks.length,
      createdAt: Date.now(),
      dueDate: format(showCalendarAddModal, 'yyyy-MM-dd'),
      subTasks: modalSubTasks.map(st => ({
        id: crypto.randomUUID(),
        text: st,
        completed: false,
        createdAt: Date.now(),
        taskId: taskId
      })),
      archived: 0
    };
    try {
      await axios.post(`${API_BASE}/tasks`, newTask);
      setModalTaskText('');
      setModalSubTasks([]);
      setModalSubTask('');
      setShowCalendarAddModal(null);
      showToast("Success", "Task added to calendar", "success");
    } catch {
      showToast("Error", "Failed to add task", "error");
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    let timeSlot = null;
    if (destination.droppableId.startsWith('time-')) {
      timeSlot = destination.droppableId.split('-')[1];
    }
    
    try {
      await axios.patch(`${API_BASE}/tasks/${task.id}`, { timeSlot, dueDate: format(calendarDate, 'yyyy-MM-dd') });
    } catch {}
  };

  return (
    <motion.div key="calendar" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-6xl mx-auto h-full flex flex-col space-y-6">
      <div className="bg-panel border border-white/5 rounded-[32px] p-8 flex items-center justify-between shadow-2xl">
        <div>
          <h2 className="text-4xl font-bold mb-1">{format(currentTime, 'HH:mm:ss')}</h2>
          <p className="text-white/40 text-sm font-medium">{format(calendarDate, 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{format(calendarDate, 'MMMM yyyy')}</h2>
          <div className="flex bg-white/5 rounded-xl p-1">
            <button onClick={() => setCalendarDate(new Date())} className="px-4 text-xs font-bold hover:bg-white/10 rounded-lg">Today</button>
            <button onClick={() => setCalendarDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCalendarDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-white/10 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1">
            {['day', 'week', 'month'].map(v => (
              <button key={v} onClick={() => setCalendarView(v as any)} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all", calendarView === v ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white")}>{v}</button>
            ))}
          </div>
          <button onClick={() => setView('tasks')} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-all"><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      {calendarView === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-sidebar py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/20 border-b border-white/5">{day}</div>
          ))}
          {calendarDays.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, calendarDate);
            const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
            return (
              <div 
                key={i} 
                onClick={() => !isCurrentMonth ? null : setShowCalendarAddModal(day)}
                className={cn(
                  "bg-[#0d0d0d] p-4 min-h-[140px] transition-all hover:bg-white/[0.02] relative group cursor-pointer", 
                  !isCurrentMonth && "opacity-20 cursor-default"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-all", isToday ? "bg-accent text-white shadow-lg" : "text-white/40")}>{format(day, 'd')}</span>
                  {isCurrentMonth && dayTasks.length > 0 && (
                    <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-bold">
                      {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <button 
                      key={t.id} 
                      onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}
                      className={cn("w-full text-[10px] px-2 py-1 rounded-lg border border-white/5 truncate flex flex-col gap-1 text-left transition-all hover:scale-105", t.completed ? "bg-emerald-500/10 text-emerald-400/60" : "bg-amber-500/10 text-amber-400")}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.completed ? "bg-emerald-500" : "bg-amber-500")} />
                        <span className="truncate">{t.text}</span>
                      </div>
                    </button>
                  ))}
                  {focusSessions.filter(s => isSameDay(new Date(s.completedAt), day) && s.mode === 'work').slice(0, 2).map((s, idx) => (
                    <div key={idx} className="w-full text-[8px] px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent/60 flex items-center gap-1.5">
                       <Zap className="w-2 h-2" /> Focus ({Math.round(s.duration / 60)}m)
                    </div>
                  ))}
                  {dayTasks.length + focusSessions.filter(s => isSameDay(new Date(s.completedAt), day) && s.mode === 'work').length > 5 && <p className="text-[9px] text-white/20 font-bold ml-1">...</p>}
                </div>
                {isCurrentMonth && (
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3 text-white/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {calendarView === 'week' && (
        <div className="grid grid-cols-7 gap-4 h-full">
          {calendarDays.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
            return (
              <div key={i} onClick={() => setShowCalendarAddModal(day)} className={cn("bg-panel border border-white/5 rounded-[32px] p-6 flex flex-col items-center transition-all cursor-pointer hover:bg-white/[0.02]", isToday && "bg-accent/5 border-blue-600/20")}>
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-1">{format(day, 'EEE')}</p>
                <p className={cn("text-2xl font-bold mb-6", isToday && "text-accent")}>{format(day, 'd')}</p>
                <div className="w-full space-y-2">
                  {dayTasks.map(t => (
                    <div key={t.id} onClick={(e) => { e.stopPropagation(); setEditingTask(t); }} className={cn("p-2 rounded-xl border border-white/5 text-[10px] font-medium transition-all hover:scale-105 cursor-pointer truncate", t.completed ? "bg-emerald-500/10 text-emerald-400/60" : "bg-amber-500/10 text-amber-400")}>{t.text}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {calendarView === 'day' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[600px]">
            {/* Sidebar for Unassigned Tasks */}
            <Droppable droppableId="unassigned">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="col-span-1 bg-panel border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col h-full max-h-[800px]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-white/80">Unassigned</h3>
                    <button onClick={() => setShowCalendarAddModal(calendarDate)} className="p-1 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-hide">
                    {tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarDate) && !t.timeSlot).map((t, index) => (
                      // @ts-ignore
                      <Draggable key={t.id} draggableId={t.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} 
                            onClick={() => setEditingTask(t)}
                            className={cn("bg-panel-dark border border-white/5 rounded-2xl p-4 shadow-lg transition-transform", snapshot.isDragging && "scale-[1.02] shadow-2xl z-50", t.completed && "opacity-50")}
                          >
                            <div className="flex items-start gap-3">
                              <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[8px] uppercase font-bold border shrink-0", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                              <h5 className={cn("text-xs font-medium truncate flex-1", t.completed && "line-through")}>{t.text}</h5>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>

            {/* Hourly Grid */}
            <div className="col-span-1 lg:col-span-3 bg-panel border border-white/5 rounded-[32px] p-8 shadow-2xl overflow-y-auto max-h-[800px]">
              <h3 className="text-xl font-bold mb-8">Schedule for {format(calendarDate, 'MMMM d')}</h3>
              <div className="space-y-4">
                {Array.from({ length: 15 }).map((_, i) => {
                  const hourStr = `${(i + 8).toString().padStart(2, '0')}:00`;
                  const slotTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarDate) && t.timeSlot === hourStr);
                  
                  return (
                    <div key={hourStr} className="flex gap-4 min-h-[80px]">
                      <div className="w-16 text-right shrink-0">
                         <span className="text-xs font-bold text-white/40">{hourStr}</span>
                      </div>
                      <Droppable droppableId={`time-${hourStr}`}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className={cn("flex-1 rounded-2xl p-3 flex flex-col gap-2 relative transition-colors", snapshot.isDraggingOver ? "bg-white/[0.05] border-white/10 border-dashed border" : "bg-white/[0.02] border border-white/5")}>
                            {slotTasks.length === 0 && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-5 h-5 text-white/10" /></div>}
                            {slotTasks.map((t, index) => (
                               // @ts-ignore
                               <Draggable key={t.id} draggableId={t.id} index={index}>
                                  {(provided, snapshot) => (
                                     <div 
                                      ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                      onClick={() => setEditingTask(t)}
                                      className={cn("bg-accent rounded-xl p-3 shadow-lg z-10 transition-transform cursor-pointer hover:bg-accent", snapshot.isDragging && "scale-[1.02] shadow-2xl bg-accent")}
                                     >
                                        <div className="flex items-center gap-2">
                                           <button onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }} className="hover:text-black transition-colors">{t.completed ? <CheckCircle2 className="w-4 h-4 text-black/50" /> : <Circle className="w-4 h-4 text-white/60" />}</button>
                                           <h5 className={cn("text-xs font-bold flex-1 truncate", t.completed && "line-through opacity-70")}>{t.text}</h5>
                                           {t.subTasks && t.subTasks.length > 0 && (
                                              <span className="text-[9px] font-bold text-white/60 bg-white/10 px-1.5 py-0.5 rounded shrink-0">{t.subTasks.filter(x=>x.completed).length}/{t.subTasks.length}</span>
                                           )}
                                        </div>
                                     </div>
                                  )}
                               </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showCalendarAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-white/10 rounded-[40px] p-8 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setShowCalendarAddModal(null)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              <h2 className="text-xl font-bold mb-8">Add Task for {format(showCalendarAddModal, 'd MMMM')}</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Task Title</label>
                  <input autoFocus placeholder="What needs to be done?" value={modalTaskText} onChange={e => setModalTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateTask()} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20 transition-all" />
                </div>
                
                {/* Subtask input inside modal */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Sub-tasks</label>
                  <div className="relative mb-2">
                    <input value={modalSubTask} onChange={e => setModalSubTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addModalSubTask())} placeholder="Add sub-task (press Enter)" className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-6 text-sm focus:outline-none focus:border-white/20 transition-all" />
                    <button type="button" onClick={addModalSubTask} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  {modalSubTasks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {modalSubTasks.map((st, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/40 flex items-center gap-1.5">
                          {st} <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => setModalSubTasks(prev => prev.filter((_, idx) => idx !== i))} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Priority</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button key={p} onClick={() => setModalTaskPriority(p)} className={cn("flex-1 py-3 rounded-xl text-[10px] uppercase font-bold border transition-all", modalTaskPriority === p ? PRIORITY_COLORS[p] : "bg-white/5 text-white/20 border-white/5")}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleCreateTask} className="w-full py-4 bg-accent text-white rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] transition-all">
                  Create Task
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-panel border border-white/10 rounded-[40px] p-8 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setEditingTask(null)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              <h2 className="text-xl font-bold mb-8">Edit Task</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Task Title</label>
                  <input value={editingTask.text} onChange={e => setEditingTask({...editingTask, text: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-white/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Priority</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button key={p} onClick={() => setEditingTask({...editingTask, priority: p})} className={cn("flex-1 py-3 rounded-xl text-[10px] uppercase font-bold border transition-all", editingTask.priority === p ? PRIORITY_COLORS[p] : "bg-white/5 text-white/20 border-white/5")}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2 block">Due Date</label>
                    <input type="date" value={editingTask.dueDate || ''} onChange={e => setEditingTask({...editingTask, dueDate: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white/60 focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={async () => { await axios.delete(`${API_BASE}/tasks/${editingTask.id}`); setEditingTask(null); }} className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-500/20 transition-all">Delete</button>
                  <button onClick={async () => { const { subTasks, ...updates } = editingTask; await axios.patch(`${API_BASE}/tasks/${editingTask.id}`, updates); setEditingTask(null); showToast("Success", "Task updated", "success"); }} className="flex-[2] py-4 bg-white text-black rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] transition-all">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
