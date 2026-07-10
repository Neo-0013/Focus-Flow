import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, Zap, ListTodo, Calendar, GraduationCap, Kanban, BookOpen,
  Wind, BarChart3, Target, Network, Scroll, Settings, Search,
  CheckCircle2, Clock, ArrowRight, Hash, FileText, Play, Plus
} from 'lucide-react';
import { cn } from '../../utils/index';
import { AppView, Task } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setView: (v: AppView) => void;
  tasks: Task[];
  setIsActive?: (v: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'navigate' | 'task' | 'action' | 'recent';
  icon: React.FC<any>;
  iconColor?: string;
  action: () => void;
  keywords?: string;
}

const VIEW_COMMANDS: { id: AppView; label: string; sublabel: string; icon: React.FC<any>; iconColor: string }[] = [
  { id: 'dashboard',      label: 'Command Center',      sublabel: 'Navigate',  icon: Home,          iconColor: 'text-cyan-400'   },
  { id: 'strategy',       label: 'Strategic Intelligence', sublabel: 'Navigate', icon: Target,       iconColor: 'text-emerald-400' },
  { id: 'advanced_tasks', label: 'Architect',           sublabel: 'Navigate',  icon: Zap,           iconColor: 'text-yellow-400' },
  { id: 'timer',          label: 'Focus Timer',         sublabel: 'Navigate',  icon: Wind,          iconColor: 'text-blue-400'   },
  { id: 'tasks',          label: 'Task Registry',       sublabel: 'Navigate',  icon: ListTodo,      iconColor: 'text-violet-400' },
  { id: 'board',          label: 'Kanban Board',        sublabel: 'Navigate',  icon: Kanban,        iconColor: 'text-pink-400'   },
  { id: 'calendar',       label: 'Calendar',            sublabel: 'Navigate',  icon: Calendar,      iconColor: 'text-orange-400' },
  { id: 'goals',          label: 'Scholar Goals',       sublabel: 'Navigate',  icon: GraduationCap, iconColor: 'text-indigo-400' },
  { id: 'journal',        label: 'Architect Journal',   sublabel: 'Navigate',  icon: BookOpen,      iconColor: 'text-amber-400'  },
  { id: 'performance',    label: 'Performance Engine',  sublabel: 'Navigate',  icon: BarChart3,     iconColor: 'text-green-400'  },
  { id: 'network',        label: 'Neural Network',      sublabel: 'Navigate',  icon: Network,       iconColor: 'text-red-400'    },
  { id: 'docforge',       label: 'DocForge',            sublabel: 'Navigate',  icon: Scroll,        iconColor: 'text-purple-400' },
  { id: 'settings',       label: 'Settings',            sublabel: 'Navigate',  icon: Settings,      iconColor: 'text-white/50'   },
];

function fuzzyMatch(str: string, query: string): { match: boolean; score: number; indices: number[] } {
  if (!query) return { match: true, score: 0, indices: [] };
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  let si = 0, qi = 0;
  const indices: number[] = [];
  while (si < s.length && qi < q.length) {
    if (s[si] === q[qi]) { indices.push(si); qi++; }
    si++;
  }
  const match = qi === q.length;
  // Score: consecutive matches score higher
  let consecutive = 0;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) consecutive++;
  }
  const score = match ? (consecutive * 10) + (100 - si) : -1;
  return { match, score, indices };
}

function HighlightedText({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <span>{text}</span>;
  const indexSet = new Set(indices);
  return (
    <span>
      {text.split('').map((char, i) =>
        indexSet.has(i)
          ? <span key={i} className="text-accent font-bold">{char}</span>
          : <span key={i}>{char}</span>
      )}
    </span>
  );
}

export function CommandPalette({ isOpen, onClose, setView, tasks, setIsActive }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands = useMemo((): CommandItem[] => {
    const navCmds: CommandItem[] = VIEW_COMMANDS.map(v => ({
      id: `nav-${v.id}`,
      label: v.label,
      sublabel: 'Navigate',
      category: 'navigate' as const,
      icon: v.icon,
      iconColor: v.iconColor,
      action: () => { setView(v.id); onClose(); },
      keywords: v.id,
    }));

    const taskCmds: CommandItem[] = tasks
      .filter(t => !t.completed && !t.archived)
      .slice(0, 20)
      .map(t => ({
        id: `task-${t.id}`,
        label: t.text,
        sublabel: `${t.priority} priority${t.dueDate ? ` · due ${t.dueDate}` : ''}`,
        category: 'task' as const,
        icon: CheckCircle2,
        iconColor: t.priority === 'high' ? 'text-red-400' : t.priority === 'medium' ? 'text-yellow-400' : 'text-white/40',
        action: () => { setView('tasks'); onClose(); },
        keywords: t.priority,
      }));

    const actionCmds: CommandItem[] = [
      {
        id: 'action-focus',
        label: 'Start Focus Session',
        sublabel: 'Action',
        category: 'action',
        icon: Play,
        iconColor: 'text-emerald-400',
        action: () => { setView('timer'); setIsActive?.(true); onClose(); },
        keywords: 'pomodoro timer work',
      },
      {
        id: 'action-new-task',
        label: 'Add New Task',
        sublabel: 'Action',
        category: 'action',
        icon: Plus,
        iconColor: 'text-accent',
        action: () => { setView('dashboard'); onClose(); },
        keywords: 'create task todo',
      },
      {
        id: 'action-settings',
        label: 'Open Settings',
        sublabel: 'Action',
        category: 'action',
        icon: Settings,
        iconColor: 'text-white/50',
        action: () => { setView('settings'); onClose(); },
        keywords: 'preferences config theme',
      },
      {
        id: 'action-docforge',
        label: 'New Document in DocForge',
        sublabel: 'Action',
        category: 'action',
        icon: FileText,
        iconColor: 'text-purple-400',
        action: () => { setView('docforge'); onClose(); },
        keywords: 'doc write document create',
      },
    ];

    return [...navCmds, ...taskCmds, ...actionCmds];
  }, [tasks, setView, onClose, setIsActive]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Default: show nav + actions only
      return allCommands.filter(c => c.category === 'navigate' || c.category === 'action');
    }
    return allCommands
      .map(cmd => {
        const searchStr = `${cmd.label} ${cmd.keywords || ''} ${cmd.sublabel || ''}`;
        const result = fuzzyMatch(searchStr, query);
        return { cmd, ...result };
      })
      .filter(r => r.match)
      .sort((a, b) => b.score - a.score)
      .map(r => r.cmd);
  }, [query, allCommands]);

  // Group results
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      const key = cmd.category === 'navigate' ? 'Navigate'
        : cmd.category === 'task' ? 'Tasks'
        : cmd.category === 'action' ? 'Quick Actions'
        : 'Recent';
      if (!groups[key]) groups[key] = [];
      groups[key].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const flatList = filteredCommands;

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatList[selectedIndex]?.action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flatList, selectedIndex, onClose]);

  // Reset selection on filter change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Track flat index across groups
  let flatIdx = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[9999] w-full max-w-[620px] px-4"
          >
            <div
              className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(10,16,16,0.98), rgba(6,10,10,0.99))',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px -20px rgba(0,0,0,0.8), 0 0 60px rgba(0,240,255,0.04)',
              }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
                <Search className="w-4 h-4 text-white/30 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search views, tasks, actions…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-white/30">ESC</kbd>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
                {flatList.length === 0 ? (
                  <div className="text-center py-10 text-white/20 text-sm">
                    <Hash className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    No results for "{query}"
                  </div>
                ) : (
                  Object.entries(grouped).map(([groupName, items]) => (
                    <div key={groupName}>
                      <p className="px-4 pt-2 pb-1 text-[9px] uppercase tracking-widest font-bold text-white/25">
                        {groupName}
                      </p>
                      {items.map(cmd => {
                        const currentIdx = flatIdx++;
                        const isSelected = currentIdx === selectedIndex;
                        const matchData = query ? fuzzyMatch(`${cmd.label} ${cmd.keywords || ''}`, query) : { indices: [] };
                        return (
                          <button
                            key={cmd.id}
                            data-idx={currentIdx}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(currentIdx)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors relative group',
                              isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                            )}
                          >
                            {/* Active indicator */}
                            {isSelected && (
                              <motion.div
                                layoutId="cmd-selected"
                                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-accent"
                                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                              />
                            )}

                            {/* Icon */}
                            <div className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                              isSelected ? 'bg-accent/15' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'
                            )}>
                              <cmd.icon className={cn('w-3.5 h-3.5', cmd.iconColor || 'text-white/50')} />
                            </div>

                            {/* Label */}
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate transition-colors', isSelected ? 'text-white' : 'text-white/70')}>
                                <HighlightedText text={cmd.label} indices={matchData.indices} />
                              </p>
                              {cmd.sublabel && (
                                <p className="text-[10px] text-white/25 mt-0.5">{cmd.sublabel}</p>
                              )}
                            </div>

                            {/* Arrow */}
                            {isSelected && (
                              <ArrowRight className="w-3.5 h-3.5 text-accent/60 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center gap-3 text-[10px] text-white/20 font-mono">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">↵</kbd>
                    select
                  </span>
                </div>
                <span className="text-[10px] text-white/20 font-mono">{flatList.length} result{flatList.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
