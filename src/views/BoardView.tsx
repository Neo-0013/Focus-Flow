import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Kanban, GripVertical, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Task, Workspace } from '../types';
import { cn } from '../utils';
import axios from 'axios';

interface BoardViewProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  workspace: Workspace;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', icon: Circle, color: 'text-white/40' },
  { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-amber-400' },
  { id: 'done', title: 'Completed', icon: CheckCircle2, color: 'text-emerald-400' }
] as const;

export function BoardView({ tasks, setTasks, workspace, toggleTask, deleteTask }: BoardViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggedTaskId(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    const task = tasks.find(t => t.id === id);
    if (!task || task.status === targetStatus) return;

    const isCompleted = targetStatus === 'done';
    
    // Optistic UI Sync
    setTasks(prev => prev.map(t => t.id === id ? { 
      ...t, 
      status: targetStatus as any, 
      completed: isCompleted 
    } : t));

    try {
      await axios.patch(`http://localhost:3002/tasks/${id}`, { 
        status: targetStatus,
        completed: isCompleted
      });
      if (isCompleted && !task.completed) {
         toggleTask(id);
      }
    } catch (err) {}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3"><Kanban className="w-8 h-8 text-accent" /> Kanban Board</h1>
        <p className="text-white/40 mt-2 font-medium">Manage the {workspace} workspace flow.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 pb-8 overflow-x-auto">
        {COLUMNS.map(col => {
          const columnTasks = tasks.filter(t => (t.status || (t.completed ? 'done' : 'todo')) === col.id);
          
          return (
            <div 
              key={col.id}
              className="bg-panel border border-white/5 rounded-3xl p-4 flex flex-col min-w-[300px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center gap-2 mb-4 px-2">
                <col.icon className={cn("w-5 h-5", col.color)} />
                <h3 className="font-bold">{col.title}</h3>
                <span className="ml-auto bg-white/5 px-2 py-0.5 rounded-md text-xs font-bold text-white/40">{columnTasks.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 px-2 pb-4 min-h-[50px]">
                <AnimatePresence>
                  {columnTasks.map(task => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={() => setDraggedTaskId(null)}
                      className={cn(
                        "bg-black/40 border border-white/5 p-4 rounded-2xl cursor-grab active:cursor-grabbing hover:border-white/20 transition-all",
                        draggedTaskId === task.id ? 'opacity-50 scale-95' : '',
                        task.priority === 'high' ? 'border-l-2 border-l-red-500/50' : task.priority === 'medium' ? 'border-l-2 border-l-amber-500/50' : 'border-l-2 border-l-blue-500/50'
                      )}
                    >
                      <div className="flex gap-3">
                        <GripVertical className="w-4 h-4 text-white/20 shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-medium leading-tight mb-2">{task.text}</p>
                          <div className="flex items-center justify-between text-xs text-white/20">
                            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
