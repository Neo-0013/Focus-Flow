import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TimerMode, Task } from '../types';
import { cn } from '../utils';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Monitor, 
  ExternalLink,
  Target
} from 'lucide-react';

interface UniversalHUDProps {
  timeLeft: number;
  isActive: boolean;
  mode: TimerMode;
  toggleTimer: () => void;
  skipNext: () => void;
  totalDuration: number;
  isNeoSpeaking?: boolean;
  activeTask?: Task | null;
  onDetach?: () => void;
  isDetached?: boolean;
}

const MODES_META: Record<TimerMode, { label: string; color: string; glow: string }> = {
  work: { 
    label: 'Deep Work', 
    color: 'text-focus-cyan', 
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.2)]' 
  },
  shortBreak: { 
    label: 'Short Break', 
    color: 'text-recovery-green', 
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
  },
  longBreak: { 
    label: 'Long Break', 
    color: 'text-velocity-purple', 
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
  },
};

function VoiceWave({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-[2px] h-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ backgroundColor: color }}
          animate={active ? { height: [4, 12, 6, 14, 4] } : { height: 4 }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}

export function UniversalHUD({ 
  timeLeft, 
  isActive, 
  mode, 
  toggleTimer, 
  skipNext, 
  totalDuration,
  isNeoSpeaking = false,
  activeTask,
  onDetach,
  isDetached = false
}: UniversalHUDProps) {
  useEffect(() => {
    // Inject Space Grotesk if not present in the current document context
    if (!document.getElementById('space-grotesk-font')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'space-grotesk-font';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
    }
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const meta = MODES_META[mode] || MODES_META.work;
  const textColor = meta.color === 'text-focus-cyan' ? '#00F0FF' : meta.color === 'text-recovery-green' ? '#10B981' : '#A855F7';

  const Container = isDetached ? 'div' : motion.div;

  return (
    <Container 
      key="universal-hud"
      {...(!isDetached ? {
        initial: { opacity: 0, scale: 0.9, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9, y: 20 },
        drag: true,
        dragMomentum: false
      } : {})}
      className={cn(
        "z-[9999]",
        isDetached ? "w-full h-full p-4 flex items-center justify-center" : "fixed top-8 right-8 cursor-move"
      )}
    >
      <div 
        style={{ 
          background: 'rgba(15, 25, 25, 0.95)', 
          backdropFilter: 'blur(24px)',
          border: `1px solid ${textColor}33`,
          boxShadow: `0 0 30px ${textColor}15`,
          color: 'white'
        }}
        className={cn(
          "relative flex items-center gap-6 p-5 rounded-3xl transition-all duration-500",
        )}
      >
        {/* Timer */}
        <div className="flex flex-col items-center min-w-[100px]">
          <div 
            style={{ color: textColor, fontFamily: "'Space Grotesk', sans-serif" }} 
            className="text-5xl font-bold tracking-tighter leading-none tabular-nums"
          >
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
          <span className="text-[9px] uppercase font-black tracking-[0.2em] opacity-40 mt-1">{meta.label}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={toggleTimer} style={{ color: textColor }} className="p-2 rounded-full hover:bg-white/5 transition-colors">
            {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
          <button onClick={skipNext} className="p-2 text-white/20 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 min-w-[150px] border-l border-white/10 pl-6">
          {activeTask ? (
            <div className="flex items-center gap-2">
              <Target style={{ color: textColor }} className="w-3.5 h-3.5" />
              <span className="text-[12px] font-medium truncate max-w-[120px]">{activeTask.text}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-20">
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[12px]">System Standby</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div style={{ background: isNeoSpeaking ? textColor : 'rgba(255,255,255,0.1)' }} className={cn("w-1.5 h-1.5 rounded-full", isNeoSpeaking && "animate-ping")} />
            <VoiceWave active={isNeoSpeaking} color={textColor} />
          </div>
        </div>

        {!isDetached && onDetach && (
          <button onClick={onDetach} className="p-2 ml-2 text-white/20 hover:text-white transition-colors">
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </Container>
  );
}
