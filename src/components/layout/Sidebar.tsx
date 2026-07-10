import React, { useState } from 'react';
import { Home, Zap, ListTodo, Calendar, GraduationCap, Settings, Crown, Kanban, BookOpen, Wind, BarChart3, Target, Network, Scroll, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/index';
import { AppView, Theme, Profile } from '../../types';

interface SidebarProps {
  view: AppView;
  setView: (v: AppView) => void;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  setShowSettings: (s: boolean) => void;
  setShowProfileModal: (s: boolean) => void;
  profile: Profile | null;
}

const NAV_ITEMS = [
  { id: 'dashboard',      icon: Home,      label: 'Command Center',        group: 'main' },
  { id: 'strategy',       icon: Target,    label: 'Strategy',              group: 'main' },
  { id: 'advanced_tasks', icon: Zap,       label: 'Architect',             group: 'main' },
  { id: 'timer',          icon: Wind,      label: 'Focus Timer',           group: 'focus' },
  { id: 'tasks',          icon: ListTodo,  label: 'Task Registry',         group: 'focus' },
  { id: 'board',          icon: Kanban,    label: 'Kanban Board',          group: 'focus' },
  { id: 'calendar',       icon: Calendar,  label: 'Calendar',              group: 'focus' },
  { id: 'goals',          icon: GraduationCap, label: 'Scholar Goals',     group: 'insights' },
  { id: 'journal',        icon: BookOpen,  label: 'Architect Journal',     group: 'insights' },
  { id: 'study',          icon: Brain,     label: 'NEO Intellect',         group: 'insights' },
  { id: 'performance',    icon: BarChart3, label: 'Performance Engine',    group: 'insights' },
  { id: 'network',        icon: Network,   label: 'Neural Network',        group: 'insights' },
  { id: 'docforge',       icon: Scroll,    label: 'DocForge',              group: 'tools' },
];

export function Sidebar({ view, setView, theme, setTheme, setShowSettings, setShowProfileModal, profile }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <nav className="sidebar-premium w-full md:w-[72px] border-b md:border-b-0 md:border-r border-white/[0.06] flex md:flex-col items-center py-3 md:py-5 px-3 md:px-0 z-40 shrink-0 relative">
      
      {/* Logo / Profile */}
      <div className="flex md:flex-col items-center md:mb-5">
        {profile ? (
          <motion.div
            onClick={() => setShowProfileModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden"
            title="Profile & Trophies"
          >
            {/* XP fill animation */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(profile.xp % 50) / 50 * 100}%` }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500/30 to-orange-400/60 rounded-xl"
            />
            <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/40 group-hover:border-orange-400/80 transition-all duration-300" />
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ boxShadow: '0 0 20px rgba(249,115,22,0.3) inset' }} />
            <Crown className="w-4 h-4 text-orange-400 z-10 drop-shadow-sm" />
            <span className="text-[9px] font-black text-white z-10 leading-none mt-0.5">{profile.level}</span>
          </motion.div>
        ) : (
          <button onClick={() => setView('dashboard')} className="w-11 h-11 bg-gradient-to-br from-white to-white/80 rounded-2xl flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
            <div className="w-4 h-4 bg-black rounded-full" />
          </button>
        )}
      </div>

      {/* Divider line */}
      <div className="hidden md:block w-8 h-px bg-white/[0.06] mx-auto mb-4" />

      {/* Nav Items */}
      <div className="flex md:flex-col gap-1 flex-1 justify-center md:justify-start items-center w-full md:px-3">
        {NAV_ITEMS.map(item => {
          const isActive = view === item.id;
          return (
            <div key={item.id} className="relative w-full flex justify-center">
              <motion.button
                onClick={() => setView(item.id as AppView)}
                onHoverStart={() => setHoveredItem(item.id)}
                onHoverEnd={() => setHoveredItem(null)}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  "sidebar-nav-btn relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-white/30 hover:text-white/80 hover:bg-white/[0.06]"
                )}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent, #00F0FF)15, transparent)',
                      boxShadow: '0 0 20px var(--accent, #00F0FF)20',
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                {/* Left active line */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-line"
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                    style={{ background: 'var(--accent, #00F0FF)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <item.icon className="w-[18px] h-[18px] relative z-10" strokeWidth={isActive ? 2.2 : 1.8} />
              </motion.button>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -6, scale: 0.92 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 hidden md:block pointer-events-none"
                  >
                    <div className="sidebar-tooltip bg-[#0a0f0f] border border-white/10 rounded-lg px-3 py-1.5 whitespace-nowrap shadow-2xl">
                      <span className="text-[11px] font-semibold text-white/90">{item.label}</span>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#0a0f0f] border-l border-b border-white/10 rotate-45" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom: Settings */}
      <div className="mt-auto flex flex-col items-center gap-2 md:px-3 w-full">
        <div className="hidden md:block w-8 h-px bg-white/[0.06] mx-auto mb-2" />
        <div className="relative w-full flex justify-center">
          <motion.button
            onClick={() => setView('settings')}
            onHoverStart={() => setHoveredItem('settings')}
            onHoverEnd={() => setHoveredItem(null)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
              view === 'settings'
                ? "bg-accent/15 text-accent"
                : "text-white/30 hover:text-white/80 hover:bg-white/[0.06]"
            )}
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={view === 'settings' ? 2.2 : 1.8} />
          </motion.button>
          <AnimatePresence>
            {hoveredItem === 'settings' && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 hidden md:block pointer-events-none"
              >
                <div className="sidebar-tooltip bg-[#0a0f0f] border border-white/10 rounded-lg px-3 py-1.5 whitespace-nowrap shadow-2xl">
                  <span className="text-[11px] font-semibold text-white/90">Settings</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#0a0f0f] border-l border-b border-white/10 rotate-45" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
