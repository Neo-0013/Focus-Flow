import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Plus, Trash2, Upload, FileText, Check, HelpCircle,
  Lightbulb, Sparkles, ChevronRight, BookOpen, Clock,
  ArrowLeft, CheckCircle2, XCircle, Search, RefreshCw, AlertCircle,
  Eye, GraduationCap, Globe, Trophy, Flame, Target, Map, Calendar,
  Tag, MessageSquare, Volume2, VolumeX, Zap, TrendingUp, BarChart2,
  GitBranch, Layers, Award, Timer, Filter, X, ChevronDown, ChevronUp,
  Star, Mic, Bookmark, GitCompare, AlignLeft, LayoutGrid
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../utils/index';
import { Subject, StudyMaterial, Flashcard, QuizQuestion } from '../types';
import { MarkdownRenderer } from '../components/features/MarkdownRenderer';
import { HistoryDrawer } from '../components/features/HistoryDrawer';

const API = 'http://localhost:3002';

interface StudyHubProps {
  workspace: string;
  aiConfig: { baseUrl: string; apiKey: string; modelId: string; };
  showToast: (title: string, body: string, type?: string, onUndo?: () => void) => void;
  addXP: (amount: number, reason: string) => void;
}

type SubjectTab = 'materials' | 'flashcards' | 'quiz' | 'guide' | 'analytics' | 'conceptmap' | 'aitools' | 'chat';

interface ConceptNode { id: string; label: string; description: string; x?: number; y?: number; }
interface ConceptEdge { from: string; to: string; label: string; }
interface TimelineEvent { year: string; event: string; description: string; }
interface CompareRow { aspect: string; topicA: string; topicB: string; }
interface ExamPrediction { question: string; topic: string; likelihood: 'High' | 'Medium'; hint: string; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface ExamCountdown { id: string; subjectId: string; examName: string; examDate: number; }
interface StudyTag { id: string; tag: string; }
interface Annotation { id: string; selectedText: string; note: string; color: string; }
interface SearchResult { materialName: string; chunkText: string; score: number; }
interface LeaderboardEntry extends Subject { mastery: number; totalCards: number; totalQuizzes: number; }

// ── Mastery Ring ──────────────────────────────────────────
function MasteryRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#6366f1';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ - fill}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={size < 50 ? 9 : 11} fontWeight="700">{score}%</text>
    </svg>
  );
}

// ── Streak Heatmap ────────────────────────────────────────
function StreakHeatmap({ sessions }: { sessions: Record<string, { cards: number; quizzes: number }> }) {
  const weeks = 26;
  const days = 7;
  const today = new Date();
  const cells: { date: string; level: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < days; d++) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - (w * 7 + (days - 1 - d)));
      const key = dt.toISOString().split('T')[0];
      const s = sessions[key];
      const level = !s ? 0 : (s.cards + s.quizzes) > 10 ? 4 : (s.cards + s.quizzes) > 5 ? 3 : (s.cards + s.quizzes) > 2 ? 2 : 1;
      cells.push({ date: key, level });
    }
  }
  const colors = ['rgba(255,255,255,0.05)', '#312e81', '#4f46e5', '#7c3aed', '#a855f7'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 3 }}>
        {Array.from({ length: weeks }, (_, wi) =>
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cells.slice(wi * days, wi * days + days).map((c, di) => (
              <div key={di} title={c.date} style={{
                width: 12, height: 12, borderRadius: 2,
                backgroundColor: colors[c.level], cursor: 'pointer',
                transition: 'transform 0.1s'
              }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.4)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Less</span>
        {colors.map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />)}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>More</span>
      </div>
    </div>
  );
}

// ── Concept Map SVG ───────────────────────────────────────
function ConceptMapSVG({ nodes, edges }: { nodes: ConceptNode[]; edges: ConceptEdge[] }) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!nodes.length) return;
    const cx = 450, cy = 280, r = 200;
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      pos[n.id] = i === 0 ? { x: cx, y: cy } : { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    setPositions(pos);
  }, [nodes]);

  const handleMouseDown = (id: string, e: React.MouseEvent) => { e.preventDefault(); setDragging(id); };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setPositions(p => ({ ...p, [dragging]: { x: e.clientX - rect.left, y: e.clientY - rect.top } }));
  }, [dragging]);

  const nodeColors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6'];
  const getConnected = (id: string) => edges.filter(e => e.from === id || e.to === id).flatMap(e => [e.from, e.to]).filter(n => n !== id);

  return (
    <svg ref={svgRef} width="100%" height="560" onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}
      style={{ cursor: dragging ? 'grabbing' : 'default', userSelect: 'none' }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(139,92,246,0.6)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = positions[e.from]; const to = positions[e.to];
        if (!from || !to) return null;
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        const isHighlighted = hovered && (getConnected(hovered).includes(e.from) || getConnected(hovered).includes(e.to) || e.from === hovered || e.to === hovered);
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={isHighlighted ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.25)'}
              strokeWidth={isHighlighted ? 2 : 1} markerEnd="url(#arrow)"
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }} />
            <text x={mx} y={my - 4} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">{e.label}</text>
          </g>
        );
      })}
      {nodes.map((n, i) => {
        const p = positions[n.id]; if (!p) return null;
        const col = nodeColors[i % nodeColors.length];
        const isHov = hovered === n.id;
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`}
            onMouseDown={e => handleMouseDown(n.id, e)}
            onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'grab' }}>
            <circle r={isHov ? 46 : 40} fill={col} fillOpacity={isHov ? 0.25 : 0.12}
              stroke={col} strokeOpacity={isHov ? 0.9 : 0.5} strokeWidth={isHov ? 2 : 1.5}
              style={{ transition: 'all 0.2s', filter: isHov ? `drop-shadow(0 0 12px ${col})` : 'none' }} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={isHov ? 12 : 11} fontWeight="600"
              style={{ pointerEvents: 'none' }}>{n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}</text>
            {isHov && n.description && (
              <foreignObject x={-100} y={48} width={200} height={60} style={{ overflow: 'visible' }}>
                <div style={{ background: 'rgba(15,10,40,0.95)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', backdropFilter: 'blur(10px)' }}>{n.description}</div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Timeline Component ────────────────────────────────────
function TimelineView({ events }: { events: TimelineEvent[] }) {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', minWidth: Math.max(events.length * 180, 400) }}>
        {events.map((ev, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 36, left: '50%', right: i === events.length - 1 ? '50%' : 0, height: 2, background: 'linear-gradient(90deg, rgba(139,92,246,0.6), rgba(99,102,241,0.2))' }} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 12px', zIndex: 1 }}>
              <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{ev.year}</div>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#8b5cf6', border: '3px solid rgba(139,92,246,0.3)', boxShadow: '0 0 10px rgba(139,92,246,0.5)' }} />
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, textAlign: 'center', maxWidth: 160 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'white', marginBottom: 4 }}>{ev.event}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{ev.description}</div>
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pomodoro Widget ───────────────────────────────────────
function PomodoroWidget({ subjectName, onClose, addXP, showToast }: {
  subjectName: string;
  onClose: () => void;
  addXP: (amount: number, reason: string) => void;
  showToast: (title: string, body: string, type?: string, onUndo?: () => void) => void;
}) {
  type PMode = 'focus' | 'short' | 'long';
  const DURATIONS: Record<PMode, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const COLORS: Record<PMode, string> = { focus: '#6366f1', short: '#22c55e', long: '#0891b2' };
  const LABELS: Record<PMode, string> = { focus: '🧠 Focus', short: '☕ Short Break', long: '🌊 Long Break' };

  const [pMode, setPMode] = useState<PMode>('focus');
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessions] = useState(0);
  const [customWork, setCustomWork] = useState(25);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentDuration = pMode === 'focus' ? customWork * 60 : DURATIONS[pMode];
  const progress = ((currentDuration - timeLeft) / currentDuration) * 100;
  const color = COLORS[pMode];
  const size = 200;
  const r = (size / 2) - 12;
  const circ = 2 * Math.PI * r;
  const strokeFill = (progress / 100) * circ;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = pMode === 'focus' ? 880 : 523;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch {}
  };

  const switchMode = (m: PMode) => { setPMode(m); setTimeLeft(m === 'focus' ? customWork * 60 : DURATIONS[m]); setIsRunning(false); };
  const reset = () => { setTimeLeft(pMode === 'focus' ? customWork * 60 : DURATIONS[pMode]); setIsRunning(false); };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            playBeep();
            if (pMode === 'focus') {
              setSessions(s => s + 1);
              addXP(50, `🍅 Completed a ${customWork}-min focus session on ${subjectName}!`);
              showToast('Focus Complete! 🎉', `Great work on ${subjectName}! Take a break.`, 'success');
              const next: PMode = (sessionsCompleted + 1) % 4 === 0 ? 'long' : 'short';
              switchMode(next);
            } else {
              showToast('Break Over! ⚡', `Time to focus on ${subjectName}!`, 'info');
              switchMode('focus');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, pMode]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900, width: 320,
        background: 'rgba(8,5,28,0.97)', border: `1px solid ${color}40`,
        borderRadius: 24, padding: 24, backdropFilter: 'blur(20px)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${color}20` }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>🍅 Pomodoro</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{subjectName}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSettings(v => !v)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>⚙️</button>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Focus Duration (minutes)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[15, 20, 25, 30, 45, 60].map(m => (
                  <button key={m} onClick={() => { setCustomWork(m); if (pMode === 'focus') setTimeLeft(m * 60); setIsRunning(false); }}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1px solid ${customWork === m ? color : 'rgba(255,255,255,0.1)'}`, background: customWork === m ? `${color}30` : 'transparent', color: customWork === m ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer', fontWeight: customWork === m ? 700 : 400 }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['focus', 'short', 'long'] as PMode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: `1px solid ${pMode === m ? COLORS[m] : 'rgba(255,255,255,0.08)'}`, background: pMode === m ? `${COLORS[m]}25` : 'transparent', color: pMode === m ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: pMode === m ? 700 : 400, cursor: 'pointer', transition: 'all 0.2s' }}>
            {m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
          </button>
        ))}
      </div>

      {/* Ring Timer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          <svg width={size} height={size}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
              strokeDasharray={circ} strokeDashoffset={circ - strokeFill}
              strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
              style={{ transition: isRunning ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.3s', filter: `drop-shadow(0 0 10px ${color}80)` }} />
            <text x={size/2} y={size/2 - 8} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={32} fontWeight={700} fontFamily="monospace">{fmt(timeLeft)}</text>
            <text x={size/2} y={size/2 + 22} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11}>{LABELS[pMode]}</text>
          </svg>
          {/* Pulsing glow when running */}
          {isRunning && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', animation: 'pomoPulse 2s ease-in-out infinite',
              background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={reset}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16 }}>↺</button>
          <button onClick={() => setIsRunning(v => !v)}
            style={{ background: `linear-gradient(135deg,${color},${color}cc)`, border: 'none', borderRadius: 14, padding: '12px 32px', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 20px ${color}50`, transition: 'all 0.2s' }}>
            {isRunning ? '⏸ Pause' : '▶ Start'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color }}>{sessionsCompleted}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>sessions</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pomoPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────
export function StudyHubView({ workspace, aiConfig, showToast, addXP }: StudyHubProps) {
  // Core state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeTab, setActiveTab] = useState<SubjectTab>('materials');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);

  // Materials
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading flags
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aiGeneratingCards, setAiGeneratingCards] = useState(false);
  const [aiGeneratingQuiz, setAiGeneratingQuiz] = useState(false);

  // Preview modal
  const [previewMaterial, setPreviewMaterial] = useState<StudyMaterial | null>(null);
  const [previewAnnotations, setPreviewAnnotations] = useState<Annotation[]>([]);
  const [annotationNote, setAnnotationNote] = useState('');
  const [annotationColor, setAnnotationColor] = useState('yellow');
  const [selectedText, setSelectedText] = useState('');

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizAnswerChecked, setQuizAnswerChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  // Flashcards
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Study Guide
  const [studyGuideText, setStudyGuideText] = useState('');
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const [guideWebSearch, setGuideWebSearch] = useState(false);

  // Analytics
  const [masteryScore, setMasteryScore] = useState<number>(0);
  const [streakData, setStreakData] = useState<{ sessions: Record<string, any>; currentStreak: number }>({ sessions: {}, currentStreak: 0 });
  const [weakSpots, setWeakSpots] = useState<Flashcard[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Exam countdown
  const [countdowns, setCountdowns] = useState<ExamCountdown[]>([]);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [showAddCountdown, setShowAddCountdown] = useState(false);

  // Tags & Search
  const [materialTags, setMaterialTags] = useState<Record<string, StudyTag[]>>({});
  const [newTag, setNewTag] = useState('');
  const [taggingMaterial, setTaggingMaterial] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // AI Tools
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [conceptEdges, setConceptEdges] = useState<ConceptEdge[]>([]);
  const [generatingConcept, setGeneratingConcept] = useState(false);

  const [examPredictions, setExamPredictions] = useState<ExamPrediction[]>([]);
  const [generatingPredictions, setGeneratingPredictions] = useState(false);

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);

  const [compareTopicA, setCompareTopicA] = useState('');
  const [compareTopicB, setCompareTopicB] = useState('');
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [comparing, setComparing] = useState(false);

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [generatingTimeline, setGeneratingTimeline] = useState(false);

  // History Types & State
  interface HistoryEntry<T> { id: string; timestamp: string; subjectId: string; subjectName: string; data: T; }
  const [guideHistory, setGuideHistory] = useState<HistoryEntry<string>[]>([]);
  const [showGuideHistory, setShowGuideHistory] = useState(false);
  const [predictHistory, setPredictHistory] = useState<HistoryEntry<ExamPrediction[]>[]>([]);
  const [showPredictHistory, setShowPredictHistory] = useState(false);
  const [conceptHistory, setConceptHistory] = useState<HistoryEntry<{nodes: ConceptNode[], edges: ConceptEdge[]}>[]>([]);
  const [showConceptHistory, setShowConceptHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState<HistoryEntry<{score: number, total: number}>[]>([]);
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [flashcardHistory, setFlashcardHistory] = useState<HistoryEntry<number>[]>([]);
  const [showFlashcardHistory, setShowFlashcardHistory] = useState(false);

  const loadHistory = (subjectId: string) => {
    try {
      setGuideHistory(JSON.parse(localStorage.getItem(`neo_guide_history_${subjectId}`) || '[]'));
      setPredictHistory(JSON.parse(localStorage.getItem(`neo_predict_history_${subjectId}`) || '[]'));
      setConceptHistory(JSON.parse(localStorage.getItem(`neo_concept_history_${subjectId}`) || '[]'));
      setQuizHistory(JSON.parse(localStorage.getItem(`neo_quiz_history_${subjectId}`) || '[]'));
      setFlashcardHistory(JSON.parse(localStorage.getItem(`neo_flashcard_history_${subjectId}`) || '[]'));
      setChatHistory(JSON.parse(localStorage.getItem(`neo_chat_history_${subjectId}`) || '[]'));
    } catch {}
  };

  const saveHistory = <T,>(key: string, data: T, subject: Subject, setState: React.Dispatch<React.SetStateAction<HistoryEntry<T>[]>>) => {
    try {
      const newEntry: HistoryEntry<T> = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        timestamp: new Date().toISOString(),
        subjectId: subject.id,
        subjectName: subject.name,
        data
      };
      setState(prev => {
        const next = [newEntry, ...prev].slice(0, 20);
        localStorage.setItem(`neo_${key}_history_${subject.id}`, JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  const deleteHistoryEntry = <T,>(key: string, id: string, subjectId: string, setState: React.Dispatch<React.SetStateAction<HistoryEntry<T>[]>>) => {
    setState(prev => {
      const next = prev.filter(e => e.id !== id);
      localStorage.setItem(`neo_${key}_history_${subjectId}`, JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = <T,>(key: string, subjectId: string, setState: React.Dispatch<React.SetStateAction<HistoryEntry<T>[]>>) => {
    setState([]);
    localStorage.removeItem(`neo_${key}_history_${subjectId}`);
  };

  // Subject Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<HistoryEntry<ChatMessage[]>[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);

  // Daily reminders
  const [dueReviews, setDueReviews] = useState<{ subjectId: string; subjectName: string; dueCount: number }[]>([]);
  const [dismissedReminders, setDismissedReminders] = useState(false);

  // ── Fetch on mount ─────────────────────────────────────
  useEffect(() => { fetchSubjects(); fetchDueReviews(); fetchLeaderboard(); }, [workspace]);

  useEffect(() => {
    if (activeSubject) {
      fetchMaterials(activeSubject.id);
      fetchFlashcards(activeSubject.id);
      fetchMastery(activeSubject.id);
      fetchStreak(activeSubject.id);
      fetchWeakSpots(activeSubject.id);
      fetchCountdowns(activeSubject.id);
      loadHistory(activeSubject.id);
    }
  }, [activeSubject]);

  useEffect(() => {
    if (voiceMode && flashcards.length && !isFlipped) {
      speakText(flashcards[currentCardIndex]?.question);
    }
  }, [currentCardIndex, voiceMode, isFlipped]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── API Calls ──────────────────────────────────────────
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try { const r = await axios.get(`${API}/api/study/subjects?workspace=${workspace}`); setSubjects(r.data || []); }
    catch { showToast('Error', 'Failed to load subjects', 'error'); }
    finally { setLoadingSubjects(false); }
  };

  const fetchMaterials = async (sid: string) => {
    try { const r = await axios.get(`${API}/api/study/subjects/${sid}/materials`); setMaterials(r.data || []); fetchAllTags(r.data || []); }
    catch { showToast('Error', 'Failed to load materials', 'error'); }
  };

  const fetchFlashcards = async (sid: string) => {
    try { const r = await axios.get(`${API}/api/study/subjects/${sid}/flashcards`); setFlashcards(r.data || []); setCurrentCardIndex(0); setIsFlipped(false); }
    catch { showToast('Error', 'Failed to load flashcards', 'error'); }
  };

  const fetchMastery = async (sid: string) => {
    try { const r = await axios.get(`${API}/api/study/subjects/${sid}/mastery`); setMasteryScore(r.data.score || 0); }
    catch { setMasteryScore(0); }
  };

  const fetchStreak = async (sid: string) => {
    try { const r = await axios.get(`${API}/api/study/subjects/${sid}/streak`); setStreakData(r.data); }
    catch { setStreakData({ sessions: {}, currentStreak: 0 }); }
  };

  const fetchWeakSpots = async (sid: string) => {
    try { const r = await axios.get(`${API}/api/study/subjects/${sid}/weakspots`); setWeakSpots(r.data || []); }
    catch { setWeakSpots([]); }
  };

  const fetchLeaderboard = async () => {
    try { const r = await axios.get(`${API}/api/study/leaderboard?workspace=${workspace}`); setLeaderboard(r.data || []); }
    catch { setLeaderboard([]); }
  };

  const fetchCountdowns = async (sid: string) => {
    try {
      const r = await axios.get(`${API}/api/study/subjects/${sid}/countdown`);
      const data: any[] = r.data || [];
      setCountdowns(data);
      // Check if any exam just passed (within last 3 days) and celebrate!
      const now = Date.now();
      data.forEach(c => {
        const examMs = new Date(c.examDate).getTime();
        const daysSince = (now - examMs) / (1000 * 60 * 60 * 24);
        if (daysSince >= 0 && daysSince <= 3 && !sessionStorage.getItem(`celebrated-${c.id}`)) {
          sessionStorage.setItem(`celebrated-${c.id}`, '1');
          setTimeout(() => {
            showToast(
              '🎉 Exam Complete!',
              `"${c.examName}" is done! You made it — now rest and reflect. You crushed it! 💪`,
              'success'
            );
          }, 1500);
        }
      });
    }
    catch { setCountdowns([]); }
  };

  const fetchDueReviews = async () => {
    try { const r = await axios.get(`${API}/api/study/due-reviews?workspace=${workspace}`); setDueReviews(r.data || []); }
    catch { setDueReviews([]); }
  };

  const fetchAllTags = async (mats: StudyMaterial[]) => {
    const tagMap: Record<string, StudyTag[]> = {};
    await Promise.all(mats.map(async m => {
      try { const r = await axios.get(`${API}/api/study/materials/${m.id}/tags`); tagMap[m.id] = r.data || []; }
      catch { tagMap[m.id] = []; }
    }));
    setMaterialTags(tagMap);
  };

  const fetchAnnotations = async (mid: string) => {
    try { const r = await axios.get(`${API}/api/study/materials/${mid}/annotations`); setPreviewAnnotations(r.data || []); }
    catch { setPreviewAnnotations([]); }
  };

  // ── Actions ─────────────────────────────────────────────
  const createSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      await axios.post(`${API}/api/study/subjects`, { name: newSubjectName.trim(), workspaceId: workspace });
      setNewSubjectName(''); setShowAddSubject(false);
      await fetchSubjects(); await fetchLeaderboard();
      showToast('Subject Created', `"${newSubjectName.trim()}" is ready!`, 'success');
      addXP(20, 'Created a new study subject');
    } catch { showToast('Error', 'Failed to create subject', 'error'); }
  };

  const deleteSubject = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Soft delete: hide from UI immediately with undo option
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    setSubjects(prev => prev.filter(s => s.id !== id));
    if (activeSubject?.id === id) setActiveSubject(null);

    let undone = false;
    showToast(
      '🗑️ Subject Deleted',
      `"${name}" removed. Click Undo to restore.`,
      'error',
      () => { undone = true; setSubjects(prev => [subject, ...prev]); }
    );

    // Wait 5s then actually delete if not undone
    setTimeout(async () => {
      if (!undone) {
        try { await axios.delete(`${API}/api/study/subjects/${id}`); }
        catch { showToast('Error', 'Failed to delete subject from server', 'error'); setSubjects(prev => [subject, ...prev]); }
      }
    }, 5000);
  };

  const processUpload = async (files: FileList | File[]) => {
    if (!files.length || !activeSubject) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).slice(0, 10).forEach(file => fd.append('files', file));
    fd.append('subjectId', activeSubject.id);
    try {
      const r = await axios.post(`${API}/api/study/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploadedCount = r.data.uploaded?.length || 1;
      showToast('Uploaded! 📚', `${uploadedCount} file(s) added. Generating embeddings...`, 'success');
      addXP(30 * uploadedCount, 'Uploaded study material');
      await fetchMaterials(activeSubject.id); await fetchMastery(activeSubject.id);
      checkScholarBadge();
    } catch (err: any) { showToast('Upload Failed', err.response?.data?.error || err.message, 'error'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processUpload(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processUpload(e.dataTransfer.files);
  };

  const deleteMaterial = async (id: string) => {
    if (!activeSubject) return;
    try { await axios.delete(`${API}/api/study/materials/${id}`); await fetchMaterials(activeSubject.id); }
    catch { showToast('Error', 'Failed to delete material', 'error'); }
  };

  const generateFlashcards = async () => {
    if (!activeSubject || !aiConfig.apiKey) return showToast('No API Key', 'Set your API key in settings.', 'error');
    setAiGeneratingCards(true);
    try {
      const r = await axios.post(`${API}/api/study/flashcards/generate`, { subjectId: activeSubject.id, aiConfig });
      await fetchFlashcards(activeSubject.id);
      showToast('Flashcards Ready! 🃏', `${r.data.count} cards generated.`, 'success');
      addXP(40, 'Generated AI flashcards');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setAiGeneratingCards(false); }
  };

  const reviewCard = async (rating: 1 | 2 | 3) => {
    const card = flashcards[currentCardIndex]; if (!card) return;
    try { await axios.patch(`${API}/api/study/flashcards/${card.id}/review`, { rating }); }
    catch {}
    setTimeout(() => {
      const nextIndex = Math.min(currentCardIndex + 1, flashcards.length);
      setCurrentCardIndex(nextIndex);
      if (nextIndex >= flashcards.length) {
        if (activeSubject) saveHistory('flashcard', flashcards.length, activeSubject, setFlashcardHistory);
      }
    }, 200);
  };

  const generateQuiz = async () => {
    if (!activeSubject || !aiConfig.apiKey) return showToast('No API Key', 'Set your API key in settings.', 'error');
    setAiGeneratingQuiz(true); setQuizComplete(false); setQuizScore(0); setCurrentQuizIndex(0);
    try {
      const r = await axios.post(`${API}/api/study/quizzes/generate`, { subjectId: activeSubject.id, aiConfig });
      setQuizQuestions(r.data.questions || []);
      addXP(20, 'Started a practice quiz');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setAiGeneratingQuiz(false); }
  };

  const generateStudyGuide = async () => {
    if (!activeSubject || !aiConfig.apiKey) return;
    setGeneratingGuide(true); setStudyGuideText('');
    try {
      const matRes = await axios.get(`${API}/api/study/subjects/${activeSubject.id}/materials`);
      const context = matRes.data.map((m: StudyMaterial) => m.content).join('\n').substring(0, 25000);

      const systemPrompt = `You are a study guide generator for "${activeSubject.name}". Create a comprehensive, well-structured study guide from the uploaded materials. Include key concepts, summaries, important facts, and study tips.`;
      const promptText = `Generate a complete, detailed study guide from these materials:\n\n${context}`;

      const params = new URLSearchParams({
        prompt: promptText,
        systemPrompt,
        aiConfig: JSON.stringify(aiConfig),
        webSearch: guideWebSearch ? 'true' : 'false',
        subjectId: activeSubject.id,
      });

      const resp = await fetch(`${API}/api/neo/stream?${params.toString()}`);
      const reader = resp.body?.getReader();
      const dec = new TextDecoder();
      let buf = '';

      if (!reader) throw new Error('No stream reader');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const raw = trimmed.slice(6);
          try {
            const parsed = JSON.parse(raw);
            if (parsed.done) break;
            if (parsed.token) {
              buf += parsed.token;
              setStudyGuideText(prev => prev + parsed.token);
            }
          } catch { /* skip malformed */ }
        }
      }
      if (activeSubject && buf.trim()) {
        saveHistory('guide', buf.trim(), activeSubject, setGuideHistory);
      }
      addXP(25, 'Generated a study guide');
    } catch (err: any) {
      showToast('Error', 'Failed to generate study guide', 'error');
    } finally {
      setGeneratingGuide(false);
    }
  };

  const addCountdown = async () => {
    if (!activeSubject || !newExamName || !newExamDate) return;
    try {
      await axios.post(`${API}/api/study/subjects/${activeSubject.id}/countdown`, { examName: newExamName, examDate: newExamDate });
      setNewExamName(''); setNewExamDate(''); setShowAddCountdown(false);
      await fetchCountdowns(activeSubject.id);
      showToast('Exam Added! 📅', `Countdown for "${newExamName}" set!`, 'success');
    } catch { showToast('Error', 'Failed to add countdown', 'error'); }
  };

  const deleteCountdown = async (id: string) => {
    try { await axios.delete(`${API}/api/study/countdowns/${id}`); await fetchCountdowns(activeSubject!.id); }
    catch { showToast('Error', 'Failed to delete countdown', 'error'); }
  };

  const addTag = async (materialId: string) => {
    if (!newTag.trim()) return;
    try {
      await axios.post(`${API}/api/study/materials/${materialId}/tags`, { tag: newTag.trim() });
      setNewTag(''); setTaggingMaterial(null);
      await fetchAllTags(materials);
    } catch { showToast('Error', 'Failed to add tag', 'error'); }
  };

  const deleteTag = async (tagId: string, materialId: string) => {
    try { await axios.delete(`${API}/api/study/tags/${tagId}`); await fetchAllTags(materials); }
    catch { showToast('Error', 'Failed to delete tag', 'error'); }
  };

  const openPreview = async (m: StudyMaterial) => {
    setPreviewMaterial(m); setSelectedText(''); setAnnotationNote('');
    await fetchAnnotations(m.id);
  };

  const saveAnnotation = async () => {
    if (!previewMaterial || !selectedText) return;
    try {
      await axios.post(`${API}/api/study/materials/${previewMaterial.id}/annotations`, { selectedText, note: annotationNote, color: annotationColor });
      await fetchAnnotations(previewMaterial.id);
      setSelectedText(''); setAnnotationNote('');
      showToast('Annotation Saved! 📌', '', 'success');
    } catch { showToast('Error', 'Failed to save annotation', 'error'); }
  };

  const deleteAnnotation = async (id: string) => {
    if (!previewMaterial) return;
    try { await axios.delete(`${API}/api/study/annotations/${id}`); await fetchAnnotations(previewMaterial.id); }
    catch {}
  };

  const doSemanticSearch = async () => {
    if (!activeSubject || !searchQuery.trim() || !aiConfig.apiKey) return;
    setSearching(true); setSearchResults([]);
    try {
      const r = await axios.post(`${API}/api/study/search`, { subjectId: activeSubject.id, query: searchQuery, aiConfig });
      setSearchResults(r.data.results || []);
      if (r.data.message) showToast('ℹ️ Search', r.data.message, 'info');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setSearching(false); }
  };

  const summarizeMaterial = async (mid: string) => {
    if (!aiConfig.apiKey) return showToast('No API Key', 'Set your API key in settings.', 'error');
    setSummarizing(mid);
    try {
      const r = await axios.post(`${API}/api/study/materials/${mid}/summarize`, { aiConfig });
      setSummaries(p => ({ ...p, [mid]: r.data.summary }));
      addXP(10, 'Summarized a material');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setSummarizing(null); }
  };

  const generateConceptMap = async () => {
    if (!activeSubject || !aiConfig.apiKey) return showToast('No API Key', 'Set API key in settings.', 'error');
    setGeneratingConcept(true); setConceptNodes([]); setConceptEdges([]);
    try {
      const r = await axios.post(`${API}/api/study/conceptmap`, { subjectId: activeSubject.id, aiConfig });
      setConceptNodes(r.data.nodes || []); setConceptEdges(r.data.edges || []);
      if (activeSubject && (r.data.nodes?.length > 0)) {
        saveHistory('concept', { nodes: r.data.nodes, edges: r.data.edges || [] }, activeSubject, setConceptHistory);
      }
      addXP(30, 'Generated a concept map');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setGeneratingConcept(false); }
  };

  const predictExam = async () => {
    if (!activeSubject || !aiConfig.apiKey) return showToast('No API Key', 'Set API key in settings.', 'error');
    setGeneratingPredictions(true); setExamPredictions([]);
    try {
      const r = await axios.post(`${API}/api/study/predict-exam`, { subjectId: activeSubject.id, aiConfig });
      setExamPredictions(r.data.predictions || []);
      if (activeSubject && r.data.predictions?.length > 0) {
        saveHistory('predict', r.data.predictions, activeSubject, setPredictHistory);
      }
      addXP(20, 'Used Exam Predictor');
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setGeneratingPredictions(false); }
  };

  const generateTimeline = async () => {
    if (!activeSubject || !aiConfig.apiKey) return showToast('No API Key', 'Set API key in settings.', 'error');
    setGeneratingTimeline(true); setTimelineEvents([]);
    try {
      const r = await axios.post(`${API}/api/study/timeline`, { subjectId: activeSubject.id, aiConfig });
      setTimelineEvents(r.data.events || []);
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setGeneratingTimeline(false); }
  };

  const compareTopics = async () => {
    if (!activeSubject || !compareTopicA || !compareTopicB || !aiConfig.apiKey) return;
    setComparing(true); setCompareRows([]);
    try {
      const r = await axios.post(`${API}/api/study/compare`, { subjectId: activeSubject.id, topicA: compareTopicA, topicB: compareTopicB, aiConfig });
      setCompareRows(r.data.rows || []);
    } catch (err: any) { showToast('Error', err.response?.data?.error || err.message, 'error'); }
    finally { setComparing(false); }
  };

  const sendChatMessage = async () => {
    if (!activeSubject || !chatInput.trim() || !aiConfig.apiKey) return;
    const userMsg = chatInput.trim(); setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMessages); setChatLoading(true);
    try {
      const matRes = await axios.get(`${API}/api/study/subjects/${activeSubject.id}/materials`);
      const context = matRes.data.map((m: StudyMaterial) => m.content).join('\n').substring(0, 20000);

      // Build history for the stream endpoint (last 10 exchanges)
      const historyForStream = newMessages.slice(-10).slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'neo',
        text: m.content
      }));

      const systemPrompt = `You are a subject tutor for "${activeSubject.name}". Answer based on these study materials:\n\n${context}\n\nIf the answer is not in the materials, say so and offer a general answer.`;

      const params = new URLSearchParams({
        prompt: userMsg,
        systemPrompt,
        aiConfig: JSON.stringify(aiConfig),
        history: JSON.stringify(historyForStream),
        subjectId: activeSubject.id,
      });

      const resp = await fetch(`${API}/api/neo/stream?${params.toString()}`);
      const reader = resp.body?.getReader();
      const dec = new TextDecoder();
      let buf = ''; let fullResp = '';

      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      if (!reader) throw new Error('No stream reader');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const raw = trimmed.slice(6);
          try {
            const parsed = JSON.parse(raw);
            if (parsed.done) break;
            if (parsed.token) {
              fullResp += parsed.token;
              setChatMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: fullResp };
                return copy;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
      
      if (activeSubject) {
        setChatMessages(currentMessages => {
          saveHistory('chat', currentMessages, activeSubject, setChatHistory);
          return currentMessages;
        });
      }
    } catch { showToast('Chat Error', 'Failed to get response', 'error'); }
    finally { setChatLoading(false); }
  };

  const speakText = async (text: string) => {
    if (!text) return;
    setSpeaking(true);
    try {
      const r = await axios.post(`${API}/api/tts`, { text }, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const audio = new Audio(url);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch { setSpeaking(false); }
  };

  const checkScholarBadge = () => {
    if (materials.length >= 2) addXP(50, '🎓 Scholar Badge: Uploaded 3+ materials!');
  };

  // ── Helper: days until countdown ──────────────────────
  const daysUntil = (ts: number) => Math.max(0, Math.ceil((ts - Date.now()) / 86400000));

  const allTags = Array.from(new Set(Object.values(materialTags).flat().map(t => t.tag)));
  const filteredMaterials = activeTagFilter ? materials.filter(m => materialTags[m.id]?.some(t => t.tag === activeTagFilter)) : materials;

  // ── Styles ─────────────────────────────────────────────
  const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 };
  const btn = (color = '#6366f1') => ({ background: `linear-gradient(135deg,${color},${color}cc)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' as const });
  const input = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', width: '100%' };

  // ── Render: Subject list ───────────────────────────────
  if (!activeSubject) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        {/* Daily reminder banner */}
        {dueReviews.length > 0 && !dismissedReminders && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Flame size={18} color="#f59e0b" />
              <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>
                {dueReviews.length === 1
                  ? `📚 ${dueReviews[0].dueCount} cards due in "${dueReviews[0].subjectName}"!`
                  : `📚 You have cards due for review in ${dueReviews.length} subjects!`}
              </span>
              {dueReviews.map(d => (
                <button key={d.subjectId} onClick={() => { const s = subjects.find(sub => sub.id === d.subjectId); if (s) { setActiveSubject(s); setActiveTab('flashcards'); } }}
                  style={{ background: 'rgba(139,92,246,0.4)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 8, padding: '4px 12px', color: 'white', fontSize: 12, cursor: 'pointer' }}>
                  Review {d.subjectName} ({d.dueCount})
                </button>
              ))}
            </div>
            <button onClick={() => setDismissedReminders(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={16} /></button>
          </motion.div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Brain size={28} color="#8b5cf6" /> NEO Intellect
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0', fontStyle: 'italic' }}>Your AI-powered subject mastery hub</p>
          </div>
          <button onClick={() => setShowAddSubject(v => !v)} style={btn()}>
            <Plus size={15} /> New Subject
          </button>
        </div>

        {/* Add subject form */}
        <AnimatePresence>
          {showAddSubject && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={input} placeholder="Subject name (e.g. Physics, History…)" value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSubject()} autoFocus />
                <button onClick={createSubject} style={btn()}>Create</button>
                <button onClick={() => setShowAddSubject(false)} style={{ ...btn('rgba(255,255,255,0.1)'), color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaderboard & Subjects grid */}
        <div style={{ display: 'grid', gridTemplateColumns: leaderboard.length > 0 ? '1fr 320px' : '1fr', gap: 20, alignItems: 'start' }}>
          {/* Subjects */}
          <div>
            {loadingSubjects ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : subjects.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 60 }}>
                <Brain size={48} color="rgba(139,92,246,0.4)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>No subjects yet. Create one to get started!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
                {subjects.map((s, i) => {
                  const entry = leaderboard.find(l => l.id === s.id);
                  const score = entry?.mastery ?? 0;
                  const nearestCountdown = countdowns.find(c => c.subjectId === s.id);
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => { setActiveSubject(s); setActiveTab('materials'); }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      style={{ ...card, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.2s', padding: 18 }}>
                      {/* Glow accent */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)`, borderRadius: '16px 16px 0 0' }} />

                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: '8px 0 6px', fontSize: 16, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</h3>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {entry && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>📚 {entry.totalCards} cards · 📝 {entry.totalQuizzes} quizzes</span>}
                          </div>
                        </div>
                        <MasteryRing score={score} size={56} />
                      </div>

                      {/* Countdown chip */}
                      {nearestCountdown && (
                        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: daysUntil(nearestCountdown.examDate) <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', border: `1px solid ${daysUntil(nearestCountdown.examDate) <= 3 ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: daysUntil(nearestCountdown.examDate) <= 3 ? '#f87171' : '#a5b4fc' }}>
                          <Calendar size={10} />
                          {daysUntil(nearestCountdown.examDate)}d until {nearestCountdown.examName}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{new Date(s.createdAt).toLocaleDateString()}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={e => deleteSubject(s.id, s.name, e)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#f87171' }}><Trash2 size={13} /></button>
                          <ChevronRight size={16} color="rgba(255,255,255,0.3)" style={{ marginTop: 2 }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="#f59e0b" /> Subject Leaderboard
              </h3>
              {leaderboard.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${s.mastery}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius: 4, transition: 'width 0.8s' }} />
                    </div>
                  </div>
                  <MasteryRing score={s.mastery} size={36} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Subject Detail ─────────────────────────────
  const tabs: { id: SubjectTab; label: string; icon: React.ReactNode }[] = [
    { id: 'materials', label: 'Notes', icon: <FileText size={14} /> },
    { id: 'flashcards', label: 'Flashcards', icon: <BookOpen size={14} /> },
    { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={14} /> },
    { id: 'guide', label: 'Study Guide', icon: <Lightbulb size={14} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={14} /> },
    { id: 'conceptmap', label: 'Concept Map', icon: <GitBranch size={14} /> },
    { id: 'aitools', label: 'AI Tools', icon: <Sparkles size={14} /> },
    { id: 'chat', label: 'Subject Chat', icon: <MessageSquare size={14} /> },
  ];

  const nextCountdown = countdowns[0];
  const dueInSubject = dueReviews.find(d => d.subjectId === activeSubject.id);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => { setActiveSubject(null); fetchLeaderboard(); }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'white' }}>{activeSubject.name}</h2>
            <MasteryRing score={masteryScore} size={48} />
            {streakData.currentStreak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '4px 10px' }}>
                <Flame size={13} color="#f59e0b" /><span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>{streakData.currentStreak} day streak</span>
              </div>
            )}
            {dueInSubject && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '4px 10px' }}>
                <AlertCircle size={12} color="#f87171" /><span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>{dueInSubject.dueCount} cards due!</span>
              </div>
            )}
          </div>

          {/* Exam countdown banner */}
          {nextCountdown && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: daysUntil(nextCountdown.examDate) <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)', border: `1px solid ${daysUntil(nextCountdown.examDate) <= 3 ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.25)'}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, color: daysUntil(nextCountdown.examDate) <= 3 ? '#f87171' : '#a5b4fc', fontWeight: 600 }}>
              <Calendar size={12} /> {daysUntil(nextCountdown.examDate)} days until {nextCountdown.examName}
              {daysUntil(nextCountdown.examDate) <= 7 && ' 🔥'}
            </div>
          )}
        </div>

        {/* Pomodoro toggle button */}
        <button onClick={() => setShowPomodoro(v => !v)}
          style={{ ...btn(showPomodoro ? '#dc2626' : '#059669'), fontSize: 12 }}>
          <Timer size={14} /> {showPomodoro ? 'Close Timer' : 'Pomodoro Focus'}
        </button>
      </div>

      {/* Floating Pomodoro Widget */}
      <AnimatePresence>
        {showPomodoro && activeSubject && (
          <PomodoroWidget
            subjectName={activeSubject.name}
            onClose={() => setShowPomodoro(false)}
            addXP={addXP}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s', background: activeTab === t.id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.05)', color: activeTab === t.id ? 'white' : 'rgba(255,255,255,0.5)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MATERIALS ── */}
      {activeTab === 'materials' && (
        <div>
          {/* Tag filter bar */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={13} color="rgba(255,255,255,0.4)" />
              <button onClick={() => setActiveTagFilter(null)} style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: !activeTagFilter ? 'rgba(99,102,241,0.3)' : 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer' }}>All</button>
              {allTags.map(tag => (
                <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                  style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(139,92,246,0.3)', background: activeTagFilter === tag ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.1)', color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>#{tag}</button>
              ))}
            </div>
          )}

          {/* Semantic Search */}
          <div style={{ ...card, marginBottom: 16, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input style={{ ...input, paddingLeft: 36 }} placeholder="🔍 Semantic search across your notes…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSemanticSearch()} />
              </div>
              <button onClick={doSemanticSearch} disabled={searching} style={btn()}>
                {searching ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />} Search
              </button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#a5b4fc' }}>{r.materialName}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{(r.score * 100).toFixed(0)}% match</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{r.chunkText.substring(0, 250)}…</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
              border: `2px dashed ${isDragging ? '#8b5cf6' : 'rgba(255,255,255,0.15)'}`, 
              borderRadius: 16, 
              padding: 30, 
              textAlign: 'center', 
              marginBottom: 16, 
              background: isDragging ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <Upload size={32} color={isDragging ? '#8b5cf6' : 'rgba(255,255,255,0.3)'} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 6 }}>
              {uploading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...
                </span>
              ) : isDragging ? 'Drop files here' : 'Click or drag files to upload'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Supports multiple .pdf, .txt, .doc, .md (max 10 files)</div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,.md" style={{ display: 'none' }} onChange={handleUpload} />
          </div>

          {/* Materials list */}
          {filteredMaterials.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 40 }}>
              <FileText size={36} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>No materials yet. Upload PDFs, docs, or text files.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredMaterials.map(m => (
                <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <FileText size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{(m.size / 1024).toFixed(1)} KB · {new Date(m.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openPreview(m)} style={{ ...btn('rgba(99,102,241,0.3)'), padding: '6px 12px', fontSize: 12 }}><Eye size={12} /> View</button>
                      <button onClick={() => summarizeMaterial(m.id)} disabled={summarizing === m.id} style={{ ...btn('rgba(139,92,246,0.3)'), padding: '6px 12px', fontSize: 12 }}>
                        {summarizing === m.id ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <AlignLeft size={12} />} Summary
                      </button>
                      <button onClick={() => deleteMaterial(m.id)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 10px', color: '#f87171', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(materialTags[m.id] || []).map(t => (
                      <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: '#a5b4fc' }}>
                        #{t.tag}
                        <button onClick={() => deleteTag(t.id, m.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={9} /></button>
                      </span>
                    ))}
                    {taggingMaterial === m.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input style={{ ...input, width: 120, padding: '3px 8px', fontSize: 11 }} placeholder="tag name" value={newTag}
                          onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag(m.id); if (e.key === 'Escape') setTaggingMaterial(null); }} autoFocus />
                        <button onClick={() => addTag(m.id)} style={{ ...btn(), padding: '3px 8px', fontSize: 11 }}>Add</button>
                        <button onClick={() => setTaggingMaterial(null)} style={{ ...btn('rgba(255,255,255,0.1)'), padding: '3px 8px', fontSize: 11 }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setTaggingMaterial(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 8px', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer' }}>
                        <Tag size={9} /> tag
                      </button>
                    )}
                  </div>

                  {/* Summary */}
                  {summaries[m.id] && (
                    <div style={{ marginTop: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', marginBottom: 6 }}>📋 AI Summary</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{summaries[m.id]}</div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FLASHCARDS ── */}
      {activeTab === 'flashcards' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={generateFlashcards} disabled={aiGeneratingCards} style={btn()}>
              {aiGeneratingCards ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              {aiGeneratingCards ? 'Generating…' : 'AI Generate Cards'}
            </button>
            <button onClick={() => setVoiceMode(v => !v)} style={btn(voiceMode ? '#059669' : 'rgba(255,255,255,0.1)')}>
              {voiceMode ? <Volume2 size={14} /> : <VolumeX size={14} />} {voiceMode ? 'Voice ON' : 'Voice Mode'}
            </button>
            <button onClick={() => setShowFlashcardHistory(true)} style={{ ...btn('rgba(255,255,255,0.08)') }}>
              <Clock size={14} /> History
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{flashcards.length} cards total</span>
          </div>

          {flashcards.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 50 }}>
              <BookOpen size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>No flashcards yet. Upload materials and generate cards with AI!</p>
            </div>
          ) : currentCardIndex >= flashcards.length ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ ...card, textAlign: 'center', padding: 60 }}>
              <CheckCircle2 size={48} color="#22c55e" style={{ marginBottom: 12 }} />
              <h3 style={{ color: 'white', fontSize: 22, margin: '0 0 8px' }}>All caught up! 🎉</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>You've reviewed all {flashcards.length} cards.</p>
              <button onClick={() => { setCurrentCardIndex(0); setIsFlipped(false); }} style={btn()}>Review Again</button>
            </motion.div>
          ) : (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              {/* Progress */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Card {currentCardIndex + 1} of {flashcards.length}</span>
                  {speaking && <span style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}><Volume2 size={12} /> Speaking…</span>}
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${((currentCardIndex + 1) / flashcards.length) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
              </div>

              {/* Card */}
              <div style={{ perspective: 1200 }} onClick={() => { setIsFlipped(v => !v); if (!isFlipped && voiceMode) speakText(flashcards[currentCardIndex]?.answer); }}>
                <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.45, type: 'spring', stiffness: 100 }}
                  style={{ position: 'relative', height: 260, transformStyle: 'preserve-3d', cursor: 'pointer' }}>
                  {/* Front */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Question</span>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'white', textAlign: 'center', lineHeight: 1.5 }}>{flashcards[currentCardIndex].question}</p>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>Tap to reveal answer</span>
                  </div>
                  {/* Back */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.08))', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Answer</span>
                    <p style={{ margin: 0, fontSize: 16, color: 'white', textAlign: 'center', lineHeight: 1.6 }}>{flashcards[currentCardIndex].answer}</p>
                  </div>
                </motion.div>
              </div>

              {/* Rating buttons */}
              {isFlipped && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
                  <button onClick={() => reviewCard(1)} style={{ ...btn('#ef4444'), flex: 1, justifyContent: 'center' }}><XCircle size={14} /> Hard</button>
                  <button onClick={() => reviewCard(2)} style={{ ...btn('#f59e0b'), flex: 1, justifyContent: 'center' }}><AlertCircle size={14} /> Okay</button>
                  <button onClick={() => reviewCard(3)} style={{ ...btn('#22c55e'), flex: 1, justifyContent: 'center' }}><CheckCircle2 size={14} /> Easy</button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
      <HistoryDrawer
        isOpen={showFlashcardHistory} onClose={() => setShowFlashcardHistory(false)} title="Flashcard Sessions"
        entries={flashcardHistory}
        onSelect={(data) => { showToast('History', `Reviewed ${data} cards in this session`, 'info'); setShowFlashcardHistory(false); }}
        onDelete={(id) => deleteHistoryEntry('flashcard', id, activeSubject.id, setFlashcardHistory)}
        onClearAll={() => clearHistory('flashcard', activeSubject.id, setFlashcardHistory)}
        renderPreview={(data) => <div>Reviewed {data} cards</div>}
      />

      {/* ── TAB: QUIZ ── */}
      {activeTab === 'quiz' && (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowQuizHistory(true)} style={btn('rgba(255,255,255,0.08)')}>
              <Clock size={13} /> History
            </button>
          </div>
          {quizQuestions.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 50 }}>
              <GraduationCap size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>Generate a quiz from your uploaded materials.</p>
              <button onClick={generateQuiz} disabled={aiGeneratingQuiz} style={btn()}>
                {aiGeneratingQuiz ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : <><Sparkles size={14} /> Generate Quiz</>}
              </button>
            </div>
          ) : quizComplete ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ ...card, textAlign: 'center', padding: 50 }}>
              <Trophy size={48} color="#f59e0b" style={{ marginBottom: 12 }} />
              <h3 style={{ color: 'white', fontSize: 24, margin: '0 0 8px' }}>Quiz Complete!</h3>
              <div style={{ fontSize: 40, fontWeight: 800, color: quizScore === quizQuestions.length ? '#22c55e' : '#f59e0b', margin: '12px 0' }}>{quizScore}/{quizQuestions.length}</div>
              {quizScore === quizQuestions.length && <p style={{ color: '#86efac', margin: '0 0 20px' }}>🏆 Perfect score! Exam Ready badge earned!</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={generateQuiz} style={btn()}>New Quiz</button>
                <button onClick={() => { setQuizQuestions([]); setQuizComplete(false); }} style={btn('rgba(255,255,255,0.1)')}>Back</button>
              </div>
            </motion.div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Question {currentQuizIndex + 1} of {quizQuestions.length}</span>
                <span style={{ fontSize: 13, color: '#22c55e' }}>Score: {quizScore}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 20 }}>
                <div style={{ height: '100%', width: `${((currentQuizIndex) / quizQuestions.length) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#22c55e)', borderRadius: 4 }} />
              </div>

              {(() => {
                const q = quizQuestions[currentQuizIndex];
                return q ? (
                  <div style={{ ...card }}>
                    <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'white', lineHeight: 1.5 }}>{q.question}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {q.options.map((opt, oi) => {
                        const isSelected = selectedQuizOption === oi;
                        const isCorrect = quizAnswerChecked && oi === q.correctOption;
                        const isWrong = quizAnswerChecked && isSelected && oi !== q.correctOption;
                        return (
                          <button key={oi} onClick={() => !quizAnswerChecked && setSelectedQuizOption(oi)}
                            style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.5)' : isWrong ? 'rgba(239,68,68,0.5)' : isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`, background: isCorrect ? 'rgba(34,197,94,0.12)' : isWrong ? 'rgba(239,68,68,0.12)' : isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', color: 'white', cursor: quizAnswerChecked ? 'default' : 'pointer', textAlign: 'left', fontSize: 13, fontWeight: isSelected ? 600 : 400, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s' }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
                            {opt}
                            {isCorrect && <CheckCircle2 size={16} color="#22c55e" style={{ marginLeft: 'auto' }} />}
                            {isWrong && <XCircle size={16} color="#ef4444" style={{ marginLeft: 'auto' }} />}
                          </button>
                        );
                      })}
                    </div>
                    {!quizAnswerChecked ? (
                      <button onClick={() => { if (selectedQuizOption === null) return; setQuizAnswerChecked(true); if (selectedQuizOption === q.correctOption) setQuizScore(s => s + 1); }}
                        disabled={selectedQuizOption === null} style={{ ...btn(), marginTop: 16, width: '100%', justifyContent: 'center', opacity: selectedQuizOption === null ? 0.5 : 1 }}>
                        Check Answer
                      </button>
                    ) : (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                          <strong style={{ color: '#a5b4fc' }}>Explanation:</strong> {q.explanation}
                        </div>
                        <button onClick={() => { 
                          setSelectedQuizOption(null); 
                          setQuizAnswerChecked(false); 
                          if (currentQuizIndex + 1 >= quizQuestions.length) { 
                            setQuizComplete(true); 
                            const finalScore = quizScore + (selectedQuizOption === q.correctOption ? 1 : 0);
                            if (activeSubject) saveHistory('quiz', { score: finalScore, total: quizQuestions.length }, activeSubject, setQuizHistory);
                            addXP(finalScore * 10, `Quiz completed: ${finalScore}/${quizQuestions.length}`); 
                            if (finalScore === quizQuestions.length) addXP(50, '🏆 Perfect Quiz Score!'); 
                          } else setCurrentQuizIndex(i => i + 1); 
                        }}
                          style={{ ...btn(), width: '100%', justifyContent: 'center' }}>
                          {currentQuizIndex + 1 >= quizQuestions.length ? 'See Results' : 'Next Question'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}
      <HistoryDrawer
        isOpen={showQuizHistory} onClose={() => setShowQuizHistory(false)} title="Quiz"
        entries={quizHistory}
        onSelect={(data) => { showToast('History', `Score: ${data.score}/${data.total}`, 'info'); setShowQuizHistory(false); }}
        onDelete={(id) => deleteHistoryEntry('quiz', id, activeSubject.id, setQuizHistory)}
        onClearAll={() => clearHistory('quiz', activeSubject.id, setQuizHistory)}
        renderPreview={(data) => <div>Score: {data.score} / {data.total}</div>}
      />

      {/* ── TAB: STUDY GUIDE ── */}
      {activeTab === 'guide' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={generateStudyGuide} disabled={generatingGuide} style={btn()}>
              {generatingGuide ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lightbulb size={14} />}
              {generatingGuide ? 'Generating…' : 'Generate Study Guide'}
            </button>
            <button onClick={() => setGuideWebSearch(v => !v)} style={{ ...btn(guideWebSearch ? '#0891b2' : 'rgba(255,255,255,0.08)'), fontSize: 12 }}>
              <Globe size={13} /> {guideWebSearch ? 'Web Search ON' : 'Web Search'}
            </button>
            <button onClick={() => setShowGuideHistory(true)} style={{ ...btn('rgba(255,255,255,0.08)'), marginLeft: 'auto' }}>
              <Clock size={14} /> History
            </button>
          </div>
          {studyGuideText ? (
            <div style={{ ...card, fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.82)' }}>
              <MarkdownRenderer content={studyGuideText} />
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: 50 }}>
              <Lightbulb size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>Click "Generate Study Guide" to create a comprehensive guide from your materials.</p>
            </div>
          )}
        </div>
      )}
      <HistoryDrawer
        isOpen={showGuideHistory} onClose={() => setShowGuideHistory(false)} title="Study Guide"
        entries={guideHistory}
        onSelect={(data) => { setStudyGuideText(data); setShowGuideHistory(false); }}
        onDelete={(id) => deleteHistoryEntry('guide', id, activeSubject.id, setGuideHistory)}
        onClearAll={() => clearHistory('guide', activeSubject.id, setGuideHistory)}
        renderPreview={(data) => <div className="whitespace-pre-wrap line-clamp-3">{data.substring(0, 100)}...</div>}
      />

      {/* ── TAB: ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Mastery breakdown */}
          <div style={{ ...card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={16} color="#8b5cf6" /> Mastery Score — {masteryScore}%
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[{ label: 'Materials Uploaded', val: Math.min(materials.length * 15, 20), max: 20, color: '#6366f1' },
                { label: 'Flashcard Recall', val: Math.round(((flashcards.reduce((a, c) => a + c.difficulty, 0) / (flashcards.length || 1) - 1.3) / (3.0 - 1.3)) * 50), max: 50, color: '#8b5cf6' },
                { label: 'Quizzes Completed', val: Math.min((streakData.sessions ? Object.values(streakData.sessions).reduce((a: number, s: any) => a + s.quizzes, 0) : 0) * 5, 30), max: 30, color: '#a855f7' }
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.val}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>/{item.max}</span></div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{item.label}</div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${(item.val / item.max) * 100}%`, background: item.color, borderRadius: 4, transition: 'width 0.8s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Streak Heatmap */}
          <div style={{ ...card }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={16} color="#f59e0b" /> Study Streak — {streakData.currentStreak} days
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Your activity over the past 26 weeks</p>
            <StreakHeatmap sessions={streakData.sessions || {}} />
          </div>

          {/* Weak Spots */}
          {weakSpots.length > 0 && (
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} color="#ef4444" /> Weak Spots — Focus Here!
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weakSpots.map(card => (
                  <div key={card.id} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <XCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{card.question}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Difficulty: {card.difficulty.toFixed(2)} (needs more practice)</div>
                    </div>
                    <button onClick={() => { setActiveTab('flashcards'); setCurrentCardIndex(flashcards.findIndex(f => f.id === card.id)); setIsFlipped(false); }}
                      style={{ ...btn('#ef4444'), padding: '5px 10px', fontSize: 11 }}>Practice</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveTab('flashcards')} style={{ ...btn(), marginTop: 14, width: '100%', justifyContent: 'center' }}>
                <Zap size={14} /> Start Weak Spot Practice
              </button>
            </div>
          )}

          {/* Exam Countdown Manager */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="#6366f1" /> Exam Countdowns
              </h3>
              <button onClick={() => setShowAddCountdown(v => !v)} style={btn()}><Plus size={13} /> Add Exam</button>
            </div>
            <AnimatePresence>
              {showAddCountdown && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input style={{ ...input, flex: 1, minWidth: 150 }} placeholder="Exam name (e.g. Midterm)" value={newExamName} onChange={e => setNewExamName(e.target.value)} />
                    <input type="date" style={{ ...input, width: 'auto' }} value={newExamDate} onChange={e => setNewExamDate(e.target.value)} />
                    <button onClick={addCountdown} style={btn()}>Set</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {countdowns.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No exams scheduled. Add one to track your countdown!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {countdowns.map(c => {
                  const d = daysUntil(c.examDate);
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: d <= 3 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${d <= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: d <= 3 ? '#f87171' : '#a5b4fc', minWidth: 48, textAlign: 'center' }}>{d}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{c.examName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(c.examDate).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontSize: 12, color: d <= 3 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{d <= 3 ? '🔥 Urgent!' : d <= 14 ? '⚡ Soon' : '📅 Scheduled'}</div>
                      <button onClick={() => deleteCountdown(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: CONCEPT MAP ── */}
      {activeTab === 'conceptmap' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={generateConceptMap} disabled={generatingConcept} style={btn()}>
              {generatingConcept ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <GitBranch size={14} />}
              {generatingConcept ? 'Mapping…' : 'Generate Concept Map'}
            </button>
            <button onClick={() => setShowConceptHistory(true)} style={btn('rgba(255,255,255,0.08)')}>
              <Clock size={14} /> History
            </button>
            {conceptNodes.length > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{conceptNodes.length} concepts · {conceptEdges.length} connections · Drag to rearrange</span>}
          </div>
          {conceptNodes.length > 0 ? (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <ConceptMapSVG nodes={conceptNodes} edges={conceptEdges} />
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: 60 }}>
              <GitBranch size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>Generate a concept map to visualize connections between key ideas in your materials.</p>
            </div>
          )}
        </div>
      )}
      <HistoryDrawer
        isOpen={showConceptHistory} onClose={() => setShowConceptHistory(false)} title="Concept Map"
        entries={conceptHistory}
        onSelect={(data) => { setConceptNodes(data.nodes); setConceptEdges(data.edges); setShowConceptHistory(false); }}
        onDelete={(id) => deleteHistoryEntry('concept', id, activeSubject.id, setConceptHistory)}
        onClearAll={() => clearHistory('concept', activeSubject.id, setConceptHistory)}
        renderPreview={(data) => <div>{data.nodes.length} concepts, {data.edges.length} connections</div>}
      />

      {/* ── TAB: AI TOOLS ── */}
      {activeTab === 'aitools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Exam Predictor */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color="#f59e0b" /> Exam Predictor
              </h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPredictHistory(true)} style={btn('rgba(255,255,255,0.08)')}>
                  <Clock size={13} /> History
                </button>
                <button onClick={predictExam} disabled={generatingPredictions} style={btn('#d97706')}>
                  {generatingPredictions ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                  {generatingPredictions ? 'Predicting…' : 'Predict Exam Questions'}
                </button>
              </div>
            </div>
            {examPredictions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {examPredictions.map((p, i) => (
                  <div key={i} style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.likelihood === 'High' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: p.likelihood === 'High' ? '#f87171' : '#fbbf24' }}>{p.likelihood} Likelihood</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.topic}</span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'white' }}>{i + 1}. {p.question}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>💡 {p.hint}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Click "Predict Exam Questions" to see what's most likely to appear based on your materials and weak spots.</p>
            )}
          </div>
          <HistoryDrawer
            isOpen={showPredictHistory} onClose={() => setShowPredictHistory(false)} title="Exam Predictor"
            entries={predictHistory}
            onSelect={(data) => { setExamPredictions(data); setShowPredictHistory(false); }}
            onDelete={(id) => deleteHistoryEntry('predict', id, activeSubject.id, setPredictHistory)}
            onClearAll={() => clearHistory('predict', activeSubject.id, setPredictHistory)}
            renderPreview={(data) => <div>{data.length} predictions generated</div>}
          />

          {/* Comparison Table */}
          <div style={{ ...card }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitCompare size={16} color="#8b5cf6" /> Comparison Table
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input style={{ ...input, flex: 1, minWidth: 120 }} placeholder="Topic A (e.g. TCP)" value={compareTopicA} onChange={e => setCompareTopicA(e.target.value)} />
              <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', fontSize: 16 }}>vs</span>
              <input style={{ ...input, flex: 1, minWidth: 120 }} placeholder="Topic B (e.g. UDP)" value={compareTopicB} onChange={e => setCompareTopicB(e.target.value)} />
              <button onClick={compareTopics} disabled={comparing || !compareTopicA || !compareTopicB} style={btn()}>
                {comparing ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <GitCompare size={13} />} Compare
              </button>
            </div>
            {compareRows.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Aspect</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#a5b4fc', fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{compareTopicA}</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#c4b5fd', fontSize: 11, fontWeight: 600, background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{compareTopicB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.aspect}</td>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.topicA}</td>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.topicB}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Timeline Generator */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="#22c55e" /> Timeline Generator
              </h3>
              <button onClick={generateTimeline} disabled={generatingTimeline} style={btn('#059669')}>
                {generatingTimeline ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <TrendingUp size={13} />}
                {generatingTimeline ? 'Extracting…' : 'Generate Timeline'}
              </button>
            </div>
            {timelineEvents.length > 0 ? (
              <TimelineView events={timelineEvents} />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Automatically extract dates, years, and key events from your notes into an interactive visual timeline.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: SUBJECT CHAT ── */}
      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowChatHistory(true)} style={btn('rgba(255,255,255,0.08)')}>
              <Clock size={13} /> History
            </button>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column',
            height: 'calc(100vh - 360px)', minHeight: 420, maxHeight: 700,
            background: 'rgba(255,255,255,0.015)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden'
          }}>
          {/* Messages area */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: '16px 16px 8px',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent'
          }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Ask anything about "<strong style={{ color: 'rgba(255,255,255,0.5)' }}>{activeSubject.name}</strong>".<br />
                  The AI is scoped to your uploaded materials.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Summarize the key concepts', 'What are the main topics?', 'Explain in simple terms'].map(hint => (
                    <button key={hint} onClick={() => { setChatInput(hint); }}
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: '6px 14px', color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>

                {/* Assistant avatar */}
                {m.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginBottom: 2 }}>
                    🧠
                  </div>
                )}

                <div style={{
                  maxWidth: 'min(78%, 560px)',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                    : 'rgba(255,255,255,0.07)',
                  border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  fontSize: 13,
                  color: 'white',
                  lineHeight: 1.65,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
                }}>
                  {m.content
                    ? (m.role === 'user' ? m.content : <MarkdownRenderer content={m.content} />)
                    : (chatLoading && i === chatMessages.length - 1)
                      ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)' }}>
                          <span style={{ display: 'flex', gap: 3 }}>
                            {[0, 1, 2].map(d => (
                              <span key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(139,92,246,0.7)', display: 'inline-block', animation: `dotBounce 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                            ))}
                          </span>
                          Thinking…
                        </span>
                      )
                      : null
                  }
                </div>

                {/* User avatar */}
                {m.role === 'user' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginBottom: 2 }}>
                    👤
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={chatEndRef} style={{ height: 4 }} />
          </div>

          {/* Input bar */}
          <div style={{
            display: 'flex', gap: 8, padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(0,0,0,0.2)', alignItems: 'flex-end'
          }}>
            <textarea
              style={{
                ...input, flex: 1, resize: 'none', minHeight: 40, maxHeight: 120,
                lineHeight: '1.5', paddingTop: 10, paddingBottom: 10,
                scrollbarWidth: 'thin', fontFamily: 'inherit', overflowY: 'auto'
              }}
              placeholder={`Ask about ${activeSubject.name}… (Enter to send, Shift+Enter for new line)`}
              value={chatInput}
              rows={1}
              onChange={e => {
                setChatInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                  // Reset height
                  (e.target as HTMLTextAreaElement).style.height = 'auto';
                }
              }}
            />
            <button
              onClick={() => sendChatMessage()}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                ...btn(), padding: '10px 16px', flexShrink: 0,
                opacity: (chatLoading || !chatInput.trim()) ? 0.5 : 1,
                cursor: (chatLoading || !chatInput.trim()) ? 'not-allowed' : 'pointer'
              }}>
              {chatLoading
                ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
        </div>
      )}
      <HistoryDrawer
        isOpen={showChatHistory} onClose={() => setShowChatHistory(false)} title="Chat History"
        entries={chatHistory}
        onSelect={(data) => { setChatMessages(data); setShowChatHistory(false); }}
        onDelete={(id) => deleteHistoryEntry('chat', id, activeSubject.id, setChatHistory)}
        onClearAll={() => clearHistory('chat', activeSubject.id, setChatHistory)}
        renderPreview={(data) => <div>{data.length} messages</div>}
      />

      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>


      {/* ── Material Preview Modal ── */}
      <AnimatePresence>
        {previewMaterial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(10px)' }}
            onClick={e => e.target === e.currentTarget && setPreviewMaterial(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ background: '#0a0520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>{previewMaterial.name}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Select text to annotate · {previewAnnotations.length} annotations</p>
                </div>
                <button onClick={() => setPreviewMaterial(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: 8, color: 'white', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: previewAnnotations.length > 0 ? '1fr 220px' : '1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.8, whiteSpace: 'pre-wrap', userSelect: 'text' }}
                    onMouseUp={() => { const sel = window.getSelection()?.toString().trim(); if (sel) setSelectedText(sel); }}>
                    {previewMaterial.content}
                  </div>
                  {selectedText && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 8, fontWeight: 600 }}>📌 Annotate selected text:</div>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>"{selectedText.substring(0, 120)}{selectedText.length > 120 ? '…' : ''}"</p>
                      <input style={{ ...input, marginBottom: 8 }} placeholder="Add a note (optional)…" value={annotationNote} onChange={e => setAnnotationNote(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {['yellow', 'green', 'blue', 'pink'].map(c => (
                          <button key={c} onClick={() => setAnnotationColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c === 'yellow' ? '#fbbf24' : c === 'green' ? '#22c55e' : c === 'blue' ? '#3b82f6' : '#ec4899', border: annotationColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
                        ))}
                        <button onClick={saveAnnotation} style={{ ...btn(), marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}>Save Annotation</button>
                      </div>
                    </motion.div>
                  )}
                </div>
                {previewAnnotations.length > 0 && (
                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Annotations</div>
                    {previewAnnotations.map(a => (
                      <div key={a.id} style={{ marginBottom: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10, borderLeft: `3px solid ${a.color === 'yellow' ? '#fbbf24' : a.color === 'green' ? '#22c55e' : a.color === 'blue' ? '#3b82f6' : '#ec4899'}` }}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', lineHeight: 1.4 }}>"{a.selectedText.substring(0, 80)}…"</p>
                        {a.note && <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{a.note}</p>}
                        <button onClick={() => deleteAnnotation(a.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 10, marginTop: 4 }}>✕ remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
