import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Play, X, Clock, CheckCircle2, Flame, ArrowRight } from 'lucide-react';
import { Task } from '../../types';
import { cn } from '../../utils/index';

interface SessionDebriefProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBreak: () => void;
  sessionData: {
    duration: number;
    sessionCount: number;
    xpEarned: number;
    task?: Task;
    streak: number;
  } | null;
}

function getInsight(sessionCount: number, hour: number, streak: number): string {
  if (sessionCount === 1 && hour >= 5 && hour < 9) return 'Early start locked in. First session of the day always sets the tone. Momentum is yours.';
  if (sessionCount === 1) return 'Session one complete. The machine is warm. Keep the momentum flowing.';
  if (streak >= 7) return `Day ${streak} of your streak. Most people quit long before this. You didn't.`;
  if (hour >= 22 || hour < 4) return 'Late session. Discipline is elite. Prioritize sleep after this — recovery is performance.';
  if (sessionCount >= 8) return `${sessionCount} sessions today. You're at maximum capacity. A long break is now essential.`;
  if (sessionCount >= 5) return `${sessionCount} sessions in. You're building serious momentum. Protect this energy.`;
  return `Session ${sessionCount} logged. Compounding effort — every session moves the needle.`;
}

export function SessionDebrief({ isOpen, onClose, onStartBreak, sessionData }: SessionDebriefProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 20000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!sessionData) return null;

  const hour = new Date().getHours();
  const insight = getInsight(sessionData.sessionCount, hour, sessionData.streak);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-6 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="pointer-events-auto w-full max-w-lg bg-panel border border-white/10 rounded-[32px] p-6 shadow-2xl"
            style={{ boxShadow: '0 0 80px rgba(0,240,255,0.08), 0 20px 60px rgba(0,0,0,0.6)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-focus-cyan/10 border border-focus-cyan/20 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-focus-cyan" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Session Complete</h3>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">DEBRIEF REPORT</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/20 hover:text-white transition-colors rounded-xl hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { icon: Clock, iconColor: 'text-focus-cyan',  value: `${sessionData.duration}m`,   label: 'Duration'  },
                { icon: Zap,   iconColor: 'text-amber-400',   value: `+${sessionData.xpEarned}`,   label: 'XP Earned' },
                { icon: Flame, iconColor: 'text-orange-500',  value: sessionData.sessionCount,      label: 'Today'     },
              ].map(({ icon: Icon, iconColor, value, label }) => (
                <div key={label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 text-center">
                  <Icon className={cn('w-4 h-4 mx-auto mb-1.5', iconColor)} />
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Task worked on */}
            {sessionData.task && (
              <div className="bg-focus-cyan/5 border border-focus-cyan/10 rounded-2xl p-3 mb-4 flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-focus-cyan shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-0.5">Active Task</p>
                  <p className="text-xs font-bold text-white/80 truncate">{sessionData.task.text}</p>
                </div>
              </div>
            )}

            {/* Neo insight */}
            <div className="border-l-2 border-focus-cyan bg-focus-cyan/[0.03] rounded-r-2xl p-3 mb-5">
              <p className="text-[9px] text-focus-cyan uppercase tracking-widest font-bold mb-1">NEO // INSIGHT</p>
              <p className="text-xs text-white/70 leading-relaxed">{insight}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onStartBreak}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-focus-cyan text-[#050808] rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4 fill-current" /> Start Break
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/60 hover:bg-white/10 transition-all flex items-center gap-2"
              >
                Dismiss <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
