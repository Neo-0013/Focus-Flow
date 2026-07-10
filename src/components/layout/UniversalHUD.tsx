import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { TimerMode, Task } from '../../types';
import { Play, Pause, SkipForward, ExternalLink, Target } from 'lucide-react';

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

const MODE_CONFIG: Record<TimerMode, { label: string; primary: string; glow: string }> = {
  work: {
    label: 'DEEP WORK',
    primary: '#00F0FF',
    glow: '0 0 40px rgba(0,240,255,0.35), 0 0 80px rgba(0,240,255,0.10)',
  },
  shortBreak: {
    label: 'SHORT BREAK',
    primary: '#10B981',
    glow: '0 0 40px rgba(16,185,129,0.35), 0 0 80px rgba(16,185,129,0.10)',
  },
  longBreak: {
    label: 'LONG BREAK',
    primary: '#A855F7',
    glow: '0 0 40px rgba(168,85,247,0.35), 0 0 80px rgba(168,85,247,0.10)',
  },
};

/** SVG radial progress arc */
function ProgressRing({ progress, color, size = 58, stroke = 2.5 }: { progress: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.9s ease, stroke 0.5s ease' }}
      />
    </svg>
  );
}

/** Animated voice wave bars */
function VoiceWave({ active, color }: { active: boolean; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 12 }}>
      {[0.9, 1.35, 0.7, 1.2, 0.85].map((spd, i) => (
        <motion.div
          key={i}
          style={{ width: 2, borderRadius: 2, background: active ? color : 'rgba(255,255,255,0.15)' }}
          animate={active ? { height: [3, 11, 4, 13, 3] } : { height: 3 }}
          transition={{ duration: spd, repeat: Infinity, delay: i * 0.08 }}
        />
      ))}
    </div>
  );
}

/** The actual pill/oval widget */
function PillBody({
  cfg, timeStr, progress, isActive, isNeoSpeaking, activeTask, toggleTimer, skipNext, onDetach,
}: {
  cfg: (typeof MODE_CONFIG)[TimerMode];
  timeStr: string;
  progress: number;
  isActive: boolean;
  isNeoSpeaking: boolean;
  activeTask?: Task | null;
  toggleTimer: () => void;
  skipNext: () => void;
  onDetach?: () => void;
}) {
  const RING = 58;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'rgba(6, 12, 18, 0.90)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      border: `1px solid ${cfg.primary}22`,
      borderRadius: 9999,
      boxShadow: `${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      padding: '9px 18px 9px 10px',
      position: 'relative',
      overflow: 'hidden',
      minWidth: 290,
      fontFamily: "'Space Grotesk', sans-serif",
      color: 'white',
    }}>
      {/* Shimmer sweep */}
      <motion.div
        style={{
          position: 'absolute', top: 0, left: '-80%', width: '50%', height: '100%',
          background: `linear-gradient(90deg, transparent, ${cfg.primary}09, transparent)`,
          pointerEvents: 'none',
        }}
        animate={{ left: ['-80%', '200%'] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
      />

      {/* ── Ring zone ── */}
      <div style={{ position: 'relative', width: RING, height: RING, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing progress={progress} color={cfg.primary} size={RING} />
        {isActive && (
          <motion.div
            style={{ position: 'absolute', width: RING - 14, height: RING - 14, borderRadius: '50%', background: `${cfg.primary}12` }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <span style={{ color: cfg.primary, fontSize: 13, fontWeight: 700, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {timeStr}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.07)', margin: '0 13px', flexShrink: 0 }} />

      {/* ── Mode + task ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ color: cfg.primary, fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', opacity: 0.85 }}>
          {cfg.label}
        </span>
        {activeTask ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Target size={10} style={{ color: cfg.primary, opacity: 0.75, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {activeTask.text}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <VoiceWave active={isNeoSpeaking} color={cfg.primary} />
            {isNeoSpeaking && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Neo speaking</span>}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 10 }}>
        {/* Play/Pause */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); toggleTimer(); }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          style={{
            background: `${cfg.primary}1e`, border: `1px solid ${cfg.primary}40`, borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: cfg.primary, flexShrink: 0,
          }}
        >
          {isActive ? <Pause size={13} fill={cfg.primary} strokeWidth={0} /> : <Play size={13} fill={cfg.primary} strokeWidth={0} />}
        </motion.button>

        {/* Skip */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); skipNext(); }}
          whileHover={{ scale: 1.1, color: 'rgba(255,255,255,0.75)' }}
          whileTap={{ scale: 0.88 }}
          style={{
            background: 'transparent', border: 'none', borderRadius: '50%',
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.22)',
          }}
        >
          <SkipForward size={12} />
        </motion.button>

        {/* Detach */}
        {onDetach && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onDetach(); }}
            whileHover={{ scale: 1.1, color: 'rgba(255,255,255,0.65)' }}
            whileTap={{ scale: 0.88 }}
            title="Pop out to always-on-top overlay"
            style={{
              background: 'transparent', border: 'none', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.2)',
            }}
          >
            <ExternalLink size={11} />
          </motion.button>
        )}
      </div>
    </div>
  );
}

export function UniversalHUD({
  timeLeft, isActive, mode, toggleTimer, skipNext,
  totalDuration, isNeoSpeaking = false, activeTask, onDetach, isDetached = false,
}: UniversalHUDProps) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.work;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Inject font for both main window and PiP context
  useEffect(() => {
    const docHead = document.head;
    if (!docHead.querySelector('#hud-space-grotesk')) {
      const link = document.createElement('link');
      link.id = 'hud-space-grotesk';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap';
      docHead.appendChild(link);
    }
  }, []);

  // PiP / detached mode — render centred, no motion wrapper
  if (isDetached) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <PillBody cfg={cfg} timeStr={timeStr} progress={progress} isActive={isActive}
          isNeoSpeaking={isNeoSpeaking} activeTask={activeTask}
          toggleTimer={toggleTimer} skipNext={skipNext} onDetach={undefined} />
      </div>
    );
  }

  // Normal overlay — draggable, animated
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.85, y: -16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -16 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{ position: 'fixed', top: 22, right: 22, zIndex: 9999, cursor: 'grab', userSelect: 'none' }}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
    >
      <PillBody cfg={cfg} timeStr={timeStr} progress={progress} isActive={isActive}
        isNeoSpeaking={isNeoSpeaking} activeTask={activeTask}
        toggleTimer={toggleTimer} skipNext={skipNext} onDetach={onDetach} />
    </motion.div>
  );
}
