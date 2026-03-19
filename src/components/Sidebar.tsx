import React from 'react';
import { Home, Zap, ListTodo, Calendar, GraduationCap, Moon, Sun, Settings, Crown, Kanban, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { AppView, Theme, Profile } from '../types';

interface SidebarProps {
  view: AppView;
  setView: (v: AppView) => void;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  setShowSettings: (s: boolean) => void;
  setShowProfileModal: (s: boolean) => void;
  profile: Profile | null;
}

export function Sidebar({ view, setView, theme, setTheme, setShowSettings, setShowProfileModal, profile }: SidebarProps) {
  return (
    <nav className="w-full md:w-20 bg-sidebar border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center py-4 px-2 md:px-0 z-40 shrink-0">
      
      {profile ? (
        <div onClick={() => setShowProfileModal(true)} className="w-10 h-10 rounded-xl flex flex-col items-center justify-center mb-0 md:mb-8 hover:scale-105 transition-transform group relative cursor-pointer" title={`Profile & Trophies`}>
          <div className="absolute inset-0 border-2 border-orange-500 rounded-xl opacity-30 group-hover:opacity-100 transition-opacity" />
          <motion.div initial={{ height: 0 }} animate={{ height: `${(profile.xp % 50) / 50 * 100}%` }} className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500/20 to-orange-500/50 rounded-xl" />
          <Crown className="w-4 h-4 text-orange-400 z-10" />
          <span className="text-[10px] font-black text-white z-10">{profile.level}</span>
        </div>
      ) : (
        <button onClick={() => setView('dashboard')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-0 md:mb-8 hover:scale-105 transition-transform">
          <div className="w-4 h-4 bg-black rounded-full" />
        </button>
      )}

      <div className="flex md:flex-col gap-2 flex-1 justify-center md:justify-start">
        {[
          { id: 'dashboard', icon: Home, label: 'Dashboard' },
          { id: 'timer', icon: Zap, label: 'Timer' },
          { id: 'tasks', icon: ListTodo, label: 'Tasks' },
          { id: 'board', icon: Kanban, label: 'Board' },
          { id: 'calendar', icon: Calendar, label: 'Calendar' },
          { id: 'goals', icon: GraduationCap, label: 'Scholar' },
          { id: 'journal', icon: BookOpen, label: 'Journal' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as AppView)}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group",
              view === item.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className="w-5 h-5" />
            {view === item.id && <motion.div layoutId="nav-active" className="absolute inset-0 border border-white/10 rounded-xl bg-gradient-to-br from-white/5 to-transparent" />}
          </button>
        ))}
      </div>
      <div className="flex md:flex-col gap-2 items-center">
        <div className="flex md:flex-col gap-3 p-3 bg-white/5 border border-white/5 rounded-[20px] mb-2 items-center">
          {[
            { id: 'midnight', color: '#050505', accent: '#2563eb' },
            { id: 'cyberpunk', color: '#0f0f1b', accent: '#f42a72' },
            { id: 'nordic', color: '#2e3440', accent: '#a3be8c' },
            { id: 'snow', color: '#f8fafc', accent: '#0ea5e9' }
          ].map(t => (
            <button
               key={t.id}
               onClick={() => setTheme(t.id as Theme)}
               className={cn("w-6 h-6 rounded-full border shadow-sm transition-all relative", theme === t.id ? "scale-125 border-white z-10" : "border-white/10 hover:scale-110")}
               style={{ background: `linear-gradient(135deg, ${t.color} 50%, ${t.accent} 50%)` }}
               title={t.id}
            />
          ))}
        </div>
        <button onClick={() => setShowSettings(true)} className="w-12 h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
