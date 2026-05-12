import React from 'react';
import { motion } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, CheckCircle2, Circle, Columns } from 'lucide-react';
import { Task, Priority } from '../types';
import axios from 'axios';
import { cn } from '../utils';

const API_BASE = 'http://localhost:3002';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const BOARD_COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'border-white/10' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-500/30' },
  { id: 'review', title: 'Needs Review', color: 'border-amber-500/30' },
  { id: 'done', title: 'Completed', color: 'border-emerald-500/30' }
] as const;

interface BoardProps {
  tasks: Task[];
  toggleTask: (id: string) => void;
  showToast: (title: string, body: string, type?: string) => void;
}

export function BoardView({ tasks, toggleTask, showToast }: BoardProps) {
  
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    try {
       const isDone = destination.droppableId === 'done';
       await axios.patch(`${API_BASE}/tasks/${draggableId}`, { 
         status: destination.droppableId,
         completed: isDone ? 1 : 0
       });
    } catch {
       showToast("Error", "Failed to move task", "error");
    }
  };

  return (
    <motion.div key="board" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full flex flex-col space-y-6">
      <header className="flex items-center justify-between">
         <h2 className="text-3xl font-bold flex items-center gap-3"><Columns className="w-8 h-8 text-accent" /> Kanban Board</h2>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
         <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-6 h-full min-w-max items-start">
               {BOARD_COLUMNS.map(column => {
                  const columnTasks = tasks.filter(t => t.status === column.id || (!t.status && column.id === 'todo'));
                  
                  return (
                     <div key={column.id} className="w-[320px] shrink-0 h-full flex flex-col bg-panel border border-white/5 rounded-3xl shadow-xl overflow-hidden">
                        <div className={cn("p-4 border-b bg-white/5 flex items-center justify-between", column.color)}>
                           <h3 className="font-bold text-sm text-white/80 uppercase tracking-widest">{column.title}</h3>
                           <span className="text-xs font-bold text-white/40 bg-black/40 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                        </div>
                        
                        <Droppable droppableId={column.id}>
                           {(provided, snapshot) => (
                              <div 
                                ref={provided.innerRef} 
                                {...provided.droppableProps}
                                className={cn(
                                   "flex-1 p-4 space-y-3 overflow-y-auto transition-colors",
                                   snapshot.isDraggingOver && "bg-white/[0.02]"
                                )}
                              >
                                 {columnTasks.map((t, index) => (
                                    // @ts-ignore
                                    <Draggable key={t.id} draggableId={t.id} index={index}>
                                       {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                               "bg-[#161616] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col gap-3 group transition-all",
                                               snapshot.isDragging && "scale-[1.02] rotate-1 shadow-2xl z-50 border-accent/50",
                                               t.completed && column.id !== 'done' && "opacity-50"
                                            )}
                                          >
                                             <div className="flex items-start gap-3">
                                                <div {...provided.dragHandleProps} className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-white/20 hover:text-white/40">
                                                   <GripVertical className="w-4 h-4" />
                                                </div>
                                                <h4 className={cn("text-sm font-bold flex-1 break-words", t.completed && "line-through text-white/40")}>{t.text}</h4>
                                             </div>
                                             
                                             <div className="flex items-center justify-between pl-7">
                                                <span className={cn("px-2 py-0.5 rounded text-[9px] uppercase font-bold border shrink-0", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                                                {t.subTasks && t.subTasks.length > 0 && (
                                                   <span className="text-[10px] text-white/40 font-bold bg-white/5 px-2 py-0.5 rounded-full">
                                                      {t.subTasks.filter(x=>x.completed).length}/{t.subTasks.length} sub
                                                   </span>
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
      </DragDropContext>
    </motion.div>
  );
}
