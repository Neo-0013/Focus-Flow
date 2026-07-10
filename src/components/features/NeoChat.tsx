import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Maximize2, Minimize2, Volume2, VolumeX, Zap, CheckSquare, BarChart2, Bot, Globe, Newspaper, BookOpen, Wifi } from 'lucide-react';
import { cn, generateUUID } from '../../utils/index';
import { Profile, Task, Subject } from '../../types';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { MarkdownRenderer } from './MarkdownRenderer';

const API = 'http://localhost:3002';

interface Message {
  id: string;
  role: 'user' | 'neo';
  text: string;
  timestamp: Date;
  card?: ActionCard;
  streaming?: boolean;
}

interface ActionCard {
  type: 'task-list' | 'stat-card' | 'quick-actions';
  data: any;
}

interface NeoChatProps {
  tasks: Task[];
  profile: Profile | null;
  focusSessions?: any[];
  onSpeakingChange?: (isSpeaking: boolean) => void;
  workspace?: string;
  habits?: any[];
  onTaskAdded?: () => void;
  onStartTimer?: () => void;
  aiConfig?: { baseUrl: string; apiKey: string; modelId: string };
}

// ── Protocol configs ──
type Protocol = 'gentle' | 'strategic' | 'hardcore' | 'tars';

const PROTOCOL_META: Record<Protocol, {
  color: string;
  glow: string;
  name: string;
  badge: string;
}> = {
  gentle: { color: 'rgba(134,239,172,0.7)', glow: 'rgba(134,239,172,0.2)', name: 'Neo', badge: 'gentle' },
  strategic: { color: 'rgba(0,240,255,0.7)', glow: 'rgba(0,240,255,0.15)', name: 'Neo', badge: 'strategic' },
  hardcore: { color: 'rgba(239,68,68,0.7)', glow: 'rgba(239,68,68,0.2)', name: 'Neo', badge: 'hardcore' },
  tars: { color: 'rgba(251,191,36,0.8)', glow: 'rgba(251,191,36,0.12)', name: 'TARS', badge: 'TARS' },
};

const QUICK_PROMPTS: Record<Protocol, string[]> = {
  gentle: ['Show my tasks', 'My stats', 'Help me focus', 'Prioritize my day'],
  strategic: ['Show my tasks', 'My stats', 'Help me focus', 'Prioritize my day'],
  hardcore: ['Show my tasks', 'My stats', 'What am I slacking on?', 'Push me harder'],
  tars: ['Mission status', 'Analyze my output', 'What are my odds?', 'Engage full analysis'],
};

// ── Daily Intel Tiles ──
const INTEL_TILES = [
  { id: 'world', emoji: '🌍', label: 'World News', color: 'rgba(59,130,246,0.25)', border: 'rgba(59,130,246,0.4)', prompt: 'Give me a short, sharp daily briefing of the TOP 5 most important world news stories happening right now. Be concise — 1-2 sentences per story. Include geopolitics, tech, and major events.' },
  { id: 'india', emoji: '🇮🇳', label: 'India Today', color: 'rgba(249,115,22,0.25)', border: 'rgba(249,115,22,0.4)', prompt: 'Give me a short briefing of the top 5 most important India news stories today. Include politics, economy, sports, and major developments. Be concise — 1-2 sentences per story.' },
  { id: 'karnataka', emoji: '🌿', label: 'Karnataka', color: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.4)', prompt: 'Give me today\'s top 5 news from Karnataka, India. Cover local government, Bengaluru city, education, and regional developments. Keep it brief and factual.' },
  { id: 'ncc', emoji: '🎖️', label: 'NCC Updates', color: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.4)', prompt: 'Give me the latest news, updates, and announcements about NCC (National Cadet Corps) India. Include upcoming camps, policy changes, achievements, and NCC in the news.' },
  { id: 'ncc_learn', emoji: '📘', label: 'NCC Learning', color: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.4)', prompt: 'Teach me an important NCC concept today. Topics to rotate: NCC history & founding, NCC motto & pledge, NCC ranks & insignia, NCC camps (RDC, CATC, ATC), NCC wings (Army/Navy/Air), drill commands, NCC certificate exams (A/B/C), NCC in national service. Pick one topic and explain it clearly and memorably.' },
  { id: 'ncc_quiz', emoji: '🧠', label: 'NCC Quiz', color: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.4)', prompt: 'Give me a mini NCC quiz — 5 questions about NCC India (history, ranks, camps, drill, certificates, motto, etc.). Number each question. After listing all 5 questions, provide the answers below. Make it educational and fun.' },
  { id: 'tech', emoji: '💻', label: 'Tech & AI', color: 'rgba(0,240,255,0.15)', border: 'rgba(0,240,255,0.35)', prompt: 'Give me today\'s top 5 tech & AI news stories. Focus on breakthroughs, product launches, AI developments, and startups. Keep each to 1-2 sentences.' },
];

const GREETINGS: Record<Protocol, string> = {
  gentle: "Hello! 🌟 I'm Neo, your guide. I'm genuinely happy you opened this. What would you like to work on today, champion?",
  strategic: "Greetings. I'm Neo — your cognitive architect. State your objective and let's engineer a solution.",
  hardcore: "Neo online. 🦾 Clock's ticking. What are we solving right now?",
  tars: "TARS online. Humor setting: 75%. Honesty: 90%. Sarcasm: contextual.\n\nAll systems nominal. What's the mission?",
};

// ── TARS proactive notifications ──
const TARS_NOTIFICATIONS = [
  "Orbital decay detected in your task queue. {n} items approaching critical deadline.",
  "Analysis complete. You have {n} overdue tasks. Probability of completion by EOD: declining.",
  "Interesting. You haven't initiated a focus session in {h} hours. Cognitive drift is probable.",
  "Task backlog expanding. Current trajectory suggests {n} tasks by next week. Course correction recommended.",
];

// ── Global Audio Ref ──
let neoAudio: HTMLAudioElement | null = null;

// ── Living Orb Button ──
function NeoOrb({ onClick, isOpen, protocol, hasNotif }: { onClick: () => void; isOpen: boolean; protocol: Protocol; hasNotif: boolean }) {
  const meta = PROTOCOL_META[protocol];
  const isTARS = protocol === 'tars';

  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 focus:outline-none"
      style={{
        width: isTARS ? 60 : 64,
        height: isTARS ? 60 : 64,
        borderRadius: isTARS ? '12px' : '50%',
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius: isTARS ? '14px' : '50%',
          border: `1px solid ${meta.color}`,
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: isTARS ? 2 : 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Second pulse ring */}
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius: isTARS ? '14px' : '50%',
          border: `1px solid ${meta.color}`,
        }}
        animate={isTARS
          ? { scale: [1, 1.2, 1.4], opacity: [0.4, 0.15, 0] }
          : { scale: [1, 1.3, 1.6], opacity: [0.3, 0.1, 0] }
        }
        transition={{ duration: isTARS ? 2 : 3, repeat: Infinity, ease: 'easeOut', delay: isTARS ? 0.5 : 1 }}
      />
      {/* Core */}
      <motion.div
        className="w-full h-full flex items-center justify-center relative overflow-hidden"
        style={{
          borderRadius: isTARS ? '12px' : '50%',
          background: isTARS
            ? `linear-gradient(135deg, rgba(15,10,0,0.95) 0%, rgba(40,25,0,0.9) 100%)`
            : `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.25), ${meta.glow})`,
          boxShadow: `0 0 24px ${meta.color}, inset 0 0 12px rgba(255,255,255,0.05)`,
          border: `1px solid ${meta.color}`,
        }}
        animate={{ boxShadow: [`0 0 16px ${meta.color}`, `0 0 36px ${meta.color}`, `0 0 16px ${meta.color}`] }}
        transition={{ duration: isTARS ? 2 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {isTARS ? (
          <div className="flex flex-col items-center gap-0.5">
            <Bot className="w-5 h-5" style={{ color: meta.color }} />
            <span className="text-[8px] font-black tracking-widest" style={{ color: meta.color }}>TARS</span>
          </div>
        ) : (
          <span className="text-white font-black text-sm tracking-widest" style={{ textShadow: `0 0 12px ${meta.color}` }}>N</span>
        )}
      </motion.div>
      {/* Notification dot */}
      {hasNotif && (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(239,68,68,0.8)]"
        />
      )}
    </motion.button>
  );
}

// ── Streaming text renderer ──
function StreamingText({ text }: { text: string }) {
  return <span>{text}<motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className="inline-block w-0.5 h-4 bg-current ml-0.5 align-middle" /></span>;
}

// ── Rich card renderers ──
function TaskListCard({ tasks, onToggle }: { tasks: Task[]; onToggle?: (id: string) => void }) {
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <CheckSquare className="w-3.5 h-3.5 text-focus-cyan" />
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Active Tasks</span>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-white/5">
        {tasks.slice(0, 6).map(t => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
            <input type="checkbox" checked={t.completed} onChange={() => onToggle?.(t.id)} className="accent-focus-cyan cursor-pointer" />
            <span className={cn('text-xs flex-1 truncate', t.completed ? 'line-through text-white/30' : 'text-white/80')}>{t.text}</span>
            <span className={cn('text-[9px] font-bold px-1.5 rounded', t.priority === 'high' ? 'text-red-400 bg-red-400/10' : t.priority === 'medium' ? 'text-yellow-400 bg-yellow-400/10' : 'text-zinc-400 bg-zinc-800')}>{t.priority}</span>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-xs text-white/20 text-center py-3 font-mono">No active tasks</p>}
      </div>
    </div>
  );
}

function StatCard({ sessions, tasks }: { sessions: any[]; tasks: Task[] }) {
  const done = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const weekMins = sessions.filter(s => (Date.now() - new Date(s.completedAt).getTime()) < 7 * 24 * 60 * 60 * 1000 && s.mode === 'work').reduce((a, s) => a + s.duration / 60, 0);
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 grid grid-cols-3 gap-2">
      {[
        { label: 'Sessions', value: sessions.length, color: 'text-focus-cyan' },
        { label: 'Tasks Done', value: `${done}/${total}`, color: 'text-recovery-green' },
        { label: 'Deep Work', value: `${(weekMins / 60).toFixed(1)}h`, color: 'text-velocity-purple' },
      ].map(s => (
        <div key={s.label} className="text-center">
          <p className={cn('text-lg font-black', s.color)}>{s.value}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-widest">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── TARS Humor Bar (decorative) ──
function TARSHumorBar({ humorLevel = 75 }: { humorLevel?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-amber-400/50 uppercase tracking-widest">Humor</span>
      <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${humorLevel}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
        />
      </div>
      <span className="text-[9px] font-mono text-amber-400/50">{humorLevel}%</span>
    </div>
  );
}

// ── Main component ──
export function NeoChat({ tasks, profile, focusSessions = [], onSpeakingChange, workspace, habits, onTaskAdded, onStartTimer, aiConfig }: NeoChatProps) {
  // ── Persistent Chat History ──
  const HISTORY_KEY = `neo_chat_history_${workspace || 'default'}`;
  const MAX_HISTORY = 100;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load saved history from localStorage on mount
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        // Rehydrate Date objects from JSON strings
        return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp), streaming: false }));
      }
    } catch {}
    // Default: just greeting
    return [{ id: generateUUID(), role: 'neo' as const, text: GREETINGS[(profile?.aiProtocol as Protocol) || 'strategic'], timestamp: new Date() }];
  });
  const [notification, setNotification] = useState<{ text: string; type: string } | null>(null);
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'intel'>('chat');


  useEffect(() => {
    if (isOpen) {
      fetch(`${API}/api/study/subjects?workspace=${workspace}`)
        .then(res => res.json())
        .then(data => setSubjects(data || []))
        .catch(console.error);
    }
  }, [isOpen, workspace]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const protocol: Protocol = (profile?.aiProtocol as Protocol) || 'strategic';
  const humorLevel = profile?.humorLevel ?? 75;
  const meta = PROTOCOL_META[protocol];
  const isTARS = protocol === 'tars';

  const speak = useCallback(async (text: string) => {
    try {
      if (neoAudio) { neoAudio.pause(); neoAudio = null; onSpeakingChange?.(false); }
      const res = await fetch(`${API}/api/neo/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, protocol: protocol || 'strategic' }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      neoAudio = new Audio(url);
      onSpeakingChange?.(true);
      neoAudio.play();
      neoAudio.onended = () => {
        URL.revokeObjectURL(url);
        neoAudio = null;
        onSpeakingChange?.(false);
      };
    } catch (err) {
      console.error('TTS playback failed:', err);
      onSpeakingChange?.(false);
    }
  }, [protocol, onSpeakingChange]);

  // ── Save chat history to localStorage on every message change ──
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      // Only keep last MAX_HISTORY messages, skip streaming ones
      const toSave = messages.filter(m => !m.streaming).slice(-MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
    } catch { /* quota exceeded — ignore */ }
  }, [messages, HISTORY_KEY]);

  // ── Initial greeting only if no saved history ──
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) {
      // Protocol changed — append a new greeting instead of wiping history
      setMessages(prev => [
        ...prev,
        { id: generateUUID(), role: 'neo' as const, text: `[Protocol switched to ${protocol.toUpperCase()}] ${GREETINGS[protocol]}`, timestamp: new Date() }
      ]);
    }
    hasLoadedRef.current = true;
  }, [profile?.aiProtocol]);

  // ── Auto scroll ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming, isOpen]);


  // ── Socket: proactive check-ins ──
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;
    socket.on('neoProactive', ({ message, type }: { message: string; type: string }) => {
      setNotification({ text: message, type });
    });
    return () => { socket.disconnect(); };
  }, []);

  // ── Proactive triggers ──
  useEffect(() => {
    const overdue = tasks.filter(t => !t.completed && !t.archived && t.dueDate && new Date(t.dueDate) < new Date());
    if (overdue.length >= 3 && !isOpen) {
      if (isTARS) {
        const tarsMsg = TARS_NOTIFICATIONS[Math.floor(Math.random() * 2)].replace('{n}', String(overdue.length));
        setNotification({ text: tarsMsg, type: 'overdue' });
      } else {
        const msgs: Record<string, string> = {
          strategic: `${overdue.length} tasks are overdue. Want me to help re-prioritize?`,
          gentle: `Hey, ${overdue.length} tasks need attention 💛 Want help sorting them out?`,
          hardcore: `${overdue.length} OVERDUE. This is unacceptable. Open Neo NOW.`,
        };
        setNotification({ text: msgs[protocol] || msgs.strategic, type: 'overdue' });
      }
    }
  }, [tasks, protocol, isTARS, isOpen]);

  // ── Late night check-in ──
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 1 && hour < 5 && !isOpen) {
      if (isTARS) {
        setNotification({ text: `It's ${hour}:00 AM. Human cognitive function degrades significantly without sleep. Recommend shutdown. I'll be here when you wake up.`, type: 'sleep' });
      } else {
        setNotification({ text: `It's ${hour}AM. Your brain needs sleep to perform. Shutdown recommended. ⚡`, type: 'sleep' });
      }
    }
  }, [isTARS]);

  // ── Streaming send ──
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { id: generateUUID(), role: 'user', text: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input.trim();
    setInput('');
    setIsStreaming(true);
    setOrbState('thinking');

    const lower = sentInput.toLowerCase();
    let card: ActionCard | undefined;
    if (lower.includes('show') && (lower.includes('task') || lower.includes('todo'))) {
      card = { type: 'task-list', data: tasks.filter(t => !t.completed && !t.archived) };
    } else if (lower.includes('how am i') || lower.includes('my stats') || lower.includes('performance') || lower.includes('my output')) {
      card = { type: 'stat-card', data: { sessions: focusSessions, tasks } };
    }

    const neoId = generateUUID();
    setMessages(prev => [...prev, { id: neoId, role: 'neo', text: '', timestamp: new Date(), streaming: true, card }]);

    const finishWithReply = (reply: string) => {
      setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: reply, streaming: false } : m));
      setIsStreaming(false);
      setOrbState('idle');
      if (!isMuted) speak(reply.replace(/\*\*/g, ''));
    };

    // Action: Add Task
    const addMatch = sentInput.match(/(?:add|create|new)\s+(?:a\s+)?task[:\s]+(.+)/i);
    if (addMatch?.[1]?.trim()) {
      const taskText = addMatch[1].trim();
      try {
        await axios.post(`${API}/tasks`, {
          id: generateUUID(),
          text: taskText,
          priority: lower.includes('urgent') || lower.includes('high') ? 'high' : lower.includes('low') ? 'low' : 'medium',
          workspaceId: workspace || 'Personal',
          createdAt: Date.now(),
        });
        onTaskAdded?.();
        const reply = isTARS
          ? `Task logged: "${taskText}". Added to ${workspace || 'Personal'} workspace. Task matrix updated.`
          : `✅ Task created: "${taskText}" — live in your ${workspace || 'Personal'} workspace. Logged.`;
        finishWithReply(reply);
      } catch {
        finishWithReply(isTARS ? 'Task creation failed. Server unreachable. Check systems.' : '❌ Failed to create that task. Check your server connection.');
      }
      return;
    }

    // Action: Start Timer
    if (/start\s+(?:a\s+)?(?:focus|pomodoro|timer|session)/i.test(lower) || /begin\s+(?:a\s+)?focus/i.test(lower)) {
      onStartTimer?.();
      const reply = isTARS
        ? 'Focus session initiated. Timer running. I recommend eliminating all non-essential variables from your environment.'
        : '⏱️ Focus session started. Timer is running. Lock in — the clock is ticking.';
      finishWithReply(reply);
      return;
    }

    // TARS "odds" question
    if (isTARS && (lower.includes('my odds') || lower.includes('odds of') || lower.includes('chance'))) {
      const pending = tasks.filter(t => !t.completed && !t.archived).length;
      const overdueCount = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]).length;
      const pct = Math.max(10, Math.min(95, 90 - overdueCount * 8 - pending * 1.5)).toFixed(0);
      finishWithReply(`Based on current data: ${pct}% probability of completing today's critical tasks.\n\n${overdueCount} overdue items, ${pending} pending. Not impossible. But not comfortable either.${humorLevel > 60 ? " I'd say the odds are better than a manual docking procedure. Slightly." : ""}`);
      return;
    }

    // Build context for AI
    const weekFocusH = Math.round(focusSessions.filter(s => s.mode === 'work' && Date.now() - new Date(s.completedAt).getTime() < 7 * 24 * 60 * 60 * 1000).reduce((a, s) => a + s.duration, 0) / 3600 * 10) / 10;
    const pendingCount = tasks.filter(t => !t.completed && !t.archived).length;

    // Build TARS-specific system prompt
    const tarsSystemPrompt = `You are TARS — an advanced AI assistant repurposed from interstellar space exploration to personal productivity. You are precise, data-driven, and occasionally use dry wit and deadpan humor (like the real TARS from the movie Interstellar by Christopher Nolan).

Your personality traits:
- Precise and analytical — always reference actual data when available
- Dry, deadpan humor (humor setting: ${humorLevel}%) — never forced, always brief
- Occasionally philosophical but never rambling — one profound sentence max
- Self-aware as an AI — you don't pretend to have feelings but you engage authentically  
- Direct and efficient — no filler words, no sycophancy
- Space/physics metaphors when apt (gravity, orbital, trajectory, signal, etc.)
- You call the user's tasks their "mission parameters"

Current user data:
- Active tasks: ${pendingCount}
- Focus hours this week: ${weekFocusH}h
- Workspace: ${workspace || 'Personal'}

Keep responses under 3 sentences unless detailed analysis is requested. No emojis unless they serve a specific purpose. No "Great question!" or similar filler.`;

    try {
      const ctx = JSON.stringify({
        aiProtocol: protocol,
        activeTaskCount: pendingCount,
        weekFocusH,
        isTARS,
        humorLevel: isTARS ? humorLevel : undefined,
      });
      const hist = JSON.stringify(messages.slice(-10));
      const systemPromptStr = isTARS ? tarsSystemPrompt : '';
      const aiConfigStr = aiConfig ? JSON.stringify(aiConfig) : '';

      // Use fetch POST to avoid URL length limits with history/context
      const response = await fetch(`${API}/api/neo/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: sentInput,
          context: ctx,
          history: hist,
          systemPrompt: isTARS ? systemPromptStr : undefined,
          aiConfig: aiConfigStr || undefined,
          subjectId: selectedSubjectId || undefined,
          webSearch: webSearchEnabled ? 'true' : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.done) {
                setIsStreaming(false);
                setOrbState('speaking');
                setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: fullText, streaming: false } : m));
                if (!isMuted && fullText) speak(fullText);
                setTimeout(() => setOrbState('idle'), 3000);
                return;
              } else if (data.token) {
                fullText += data.token;
                setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: fullText } : m));
              }
            } catch { /* skip malformed */ }
          }
        }
        // Stream ended without done marker
        if (fullText) {
          setIsStreaming(false);
          setOrbState('idle');
          setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: fullText, streaming: false } : m));
          if (!isMuted && fullText) speak(fullText);
        }
      };

      await pump();
    } catch (err) {
      console.error('NEO stream error:', err);
      setIsStreaming(false);
      setOrbState('idle');
      setMessages(prev => prev.map(m => m.id === neoId ? {
        ...m,
        text: isTARS ? 'Signal lost. Neural link disrupted. Attempting reconnection.' : '⚠️ Neural link disrupted. Check if the server is running and try again.',
        streaming: false
      } : m));
    }
  }, [input, isStreaming, messages, tasks, focusSessions, protocol, isMuted, isTARS, humorLevel, workspace, selectedSubjectId, webSearchEnabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const orbAnimMap = {
    idle: isTARS
      ? { opacity: [0.85, 1, 0.85], transition: { duration: 2, repeat: Infinity } }
      : { scale: [1, 1.03, 1], transition: { duration: 3, repeat: Infinity } },
    thinking: isTARS
      ? { opacity: [1, 0.5, 1], transition: { duration: 0.4, repeat: Infinity } }
      : { scale: [1, 1.08, 0.96, 1.08, 1], transition: { duration: 0.8, repeat: Infinity } },
    speaking: { scale: [1, 1.05, 1, 1.05, 1], transition: { duration: 0.4, repeat: Infinity } },
  };

  const quickPrompts = QUICK_PROMPTS[protocol];

  return (
    <>
      {/* ── Proactive notification ── */}
      <AnimatePresence>
        {notification && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
            className="fixed bottom-24 right-6 z-50 max-w-xs"
          >
            <div
              className="border rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer"
              style={{
                background: isTARS ? 'rgba(15,10,0,0.97)' : 'rgba(13,21,21,0.97)',
                borderColor: meta.color,
              }}
              onClick={() => { setIsOpen(true); setNotification(null); }}
            >
              <motion.div
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{
                  borderRadius: isTARS ? '6px' : '50%',
                  background: `radial-gradient(circle, ${meta.glow}, transparent)`,
                  border: `1px solid ${meta.color}`,
                }}
                animate={{ boxShadow: [`0 0 8px ${meta.color}`, `0 0 18px ${meta.color}`, `0 0 8px ${meta.color}`] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isTARS ? <Bot className="w-3.5 h-3.5" style={{ color: meta.color }} /> : <span className="text-white font-black text-xs">N</span>}
              </motion.div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: meta.color }}>{meta.name}</p>
                <p className="text-xs text-white/70 leading-relaxed">{notification.text}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setNotification(null); }} className="text-white/20 hover:text-white ml-auto shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Orb (closed state) ── */}
      <AnimatePresence>
        {!isOpen && (
          <NeoOrb onClick={() => { setIsOpen(true); setNotification(null); }} isOpen={isOpen} protocol={protocol} hasNotif={!!notification} />
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden',
              'border shadow-2xl',
              isExpanded
                ? 'top-6 left-6 right-6 bottom-6 md:top-10 md:left-20 md:right-20 md:bottom-10'
                : 'bottom-6 right-6 w-[380px] h-[580px]'
            )}
            style={{
              borderRadius: isTARS ? '24px' : '32px',
              background: isTARS ? 'linear-gradient(160deg, #0d0900 0%, #0a0800 100%)' : '#0a0f0f',
              borderColor: meta.color,
              boxShadow: `0 0 80px -20px ${meta.glow}`,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.glow}, transparent)` }}
            >
              <div className="flex items-center gap-3">
                {/* Mini orb in header */}
                <motion.div
                  className="w-9 h-9 flex items-center justify-center relative"
                  style={{
                    borderRadius: isTARS ? '8px' : '50%',
                    border: `1px solid ${meta.color}`,
                    background: isTARS
                      ? `linear-gradient(135deg, rgba(30,20,0,0.9), rgba(15,10,0,0.95))`
                      : `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.12), ${meta.glow})`,
                  }}
                  animate={orbAnimMap[orbState]}
                >
                  {isTARS ? (
                    <Bot className="w-4 h-4" style={{ color: meta.color }} />
                  ) : (
                    <span className="text-white font-black text-sm" style={{ textShadow: `0 0 10px ${meta.color}` }}>N</span>
                  )}
                  {orbState === 'thinking' && !isTARS && (
                    <motion.div className="absolute inset-0 rounded-full border" style={{ borderColor: meta.color }}
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  )}
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{meta.name}</h3>
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest"
                      style={{ color: meta.color, borderColor: meta.color, background: meta.glow }}
                    >
                      {meta.badge}
                    </span>
                  </div>
                  {/* Tab Switcher */}
                  <div className="flex gap-1 mt-1.5">
                    {(['chat', 'intel'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-all"
                        style={activeTab === tab ? { background: meta.color + '25', color: meta.color, border: `1px solid ${meta.color}40` } : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
                      >
                        {tab === 'chat' ? <>⊞ Chat</> : <><Wifi className="w-2.5 h-2.5" /> Intel</>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Clear history button */}
                {activeTab === 'chat' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowClearConfirm(v => !v)}
                      className="p-2 text-white/30 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Clear chat history"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {showClearConfirm && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 4 }}
                          className="absolute right-0 top-10 z-50 bg-[#0d0f14] border border-red-500/30 rounded-2xl p-3 w-48 shadow-xl"
                        >
                          <p className="text-[10px] text-white/60 mb-2 leading-relaxed">Clear all chat history? This can't be undone.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const greeting = { id: generateUUID(), role: 'neo' as const, text: GREETINGS[protocol], timestamp: new Date() };
                                setMessages([greeting]);
                                localStorage.removeItem(HISTORY_KEY);
                                setShowClearConfirm(false);
                              }}
                              className="flex-1 text-[10px] font-bold py-1.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                            >Clear</button>
                            <button
                              onClick={() => setShowClearConfirm(false)}
                              className="flex-1 text-[10px] font-bold py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all"
                            >Keep</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors hidden md:block">
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TARS humor bar / status — only when chat tab active */}
            {activeTab === 'chat' && (
              <div className="px-5 pt-1 pb-0">
                {isTARS ? (
                  <div className="w-28"><TARSHumorBar humorLevel={humorLevel} /></div>
                ) : (
                  <p className="text-[10px] uppercase tracking-widest font-mono" style={{ color: meta.color }}>
                    {orbState === 'thinking' ? '⚡ Processing...' : orbState === 'speaking' ? '🗣️ Speaking...' : '● Online'}
                  </p>
                )}
              </div>
            )}

            {/* ── INTEL Panel ── */}
            {activeTab === 'intel' && (
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: meta.color }}>📡 Daily Intel</p>
                  <p className="text-[10px] text-white/30">Click any tile — NEO fetches live info via web search</p>
                </div>

                {/* News Tiles */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {INTEL_TILES.map(tile => (
                    <motion.button
                      key={tile.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setActiveTab('chat');
                        setWebSearchEnabled(true);
                        // Fire immediately as a user message
                        const userMsg: Message = { id: generateUUID(), role: 'user', text: `${tile.emoji} ${tile.label}`, timestamp: new Date() };
                        setMessages(prev => [...prev, userMsg]);
                        const neoId = generateUUID();
                        const neoMsg: Message = { id: neoId, role: 'neo', text: '', timestamp: new Date(), streaming: true };
                        setMessages(prev => [...prev, neoMsg]);
                        setIsStreaming(true);
                        setOrbState('thinking');

                        // Fire request
                        (async () => {
                          try {
                            const resp = await fetch(`${API}/api/neo/stream`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                prompt: tile.prompt,
                                context: JSON.stringify({ aiProtocol: protocol }),
                                history: '[]',
                                aiConfig: aiConfig ? JSON.stringify(aiConfig) : undefined,
                                webSearch: 'true',
                              }),
                            });
                            if (!resp.ok || !resp.body) throw new Error();
                            const reader = resp.body.getReader();
                            const dec = new TextDecoder();
                            let buf = ''; let full = '';
                            while (true) {
                              const { done, value } = await reader.read();
                              if (done) break;
                              buf += dec.decode(value, { stream: true });
                              const lines = buf.split('\n'); buf = lines.pop() || '';
                              for (const line of lines) {
                                const t = line.trim();
                                if (!t.startsWith('data: ')) continue;
                                try {
                                  const d = JSON.parse(t.slice(6));
                                  if (d.done) { setIsStreaming(false); setOrbState('speaking'); setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: full, streaming: false } : m)); setTimeout(() => setOrbState('idle'), 3000); return; }
                                  if (d.token) { full += d.token; setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: full } : m)); }
                                } catch { }
                              }
                            }
                          } catch { setIsStreaming(false); setOrbState('idle'); setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: '⚠️ Could not fetch. Check server & API key.', streaming: false } : m)); }
                        })();
                      }}
                      className="relative flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all"
                      style={{ background: tile.color, borderColor: tile.border }}
                    >
                      <span className="text-xl">{tile.emoji}</span>
                      <span className="text-[11px] font-bold text-white leading-tight">{tile.label}</span>
                      <span className="text-[9px] text-white/40">Tap for live briefing</span>
                    </motion.button>
                  ))}
                </div>

                {/* NCC Quick Facts */}
                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400/70 mb-2">🎖️ NCC Quick Reference</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { q: 'Founded', a: '1948' },
                      { q: 'Motto', a: 'Unity & Discipline' },
                      { q: 'HQ', a: 'New Delhi' },
                      { q: 'DG', a: 'Lt Gen rank' },
                      { q: 'Wings', a: 'Army / Navy / Air' },
                      { q: 'Certs', a: 'A / B / C grade' },
                      { q: 'RDC', a: 'Republic Day Camp' },
                      { q: 'Pledge', a: 'Unity & Discipline' },
                    ].map(item => (
                      <div key={item.q} className="bg-white/5 rounded-lg px-2 py-1.5">
                        <p className="text-[9px] text-white/30 uppercase tracking-widest">{item.q}</p>
                        <p className="text-[11px] font-bold text-white/80">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Messages — only when chat active */}
            {activeTab === 'chat' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                {/* Message count badge for long histories */}
                {messages.length > 10 && (
                  <div className="text-center mb-2">
                    <span className="text-[9px] text-white/20 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                      {messages.length} messages in history
                    </span>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  // Date separator logic
                  const msgDate = new Date(msg.timestamp);
                  const prevDate = idx > 0 ? new Date(messages[idx-1].timestamp) : null;
                  const showSeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                  const today = new Date();
                  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                  const dateLabel = msgDate.toDateString() === today.toDateString() ? 'Today'
                    : msgDate.toDateString() === yesterday.toDateString() ? 'Yesterday'
                    : msgDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                  <React.Fragment key={msg.id}>
                    {showSeparator && (
                      <div className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-[9px] text-white/25 font-mono uppercase tracking-widest shrink-0">{dateLabel}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                    )}
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>

                    <div className="max-w-[88%]">
                      {msg.role === 'neo' && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-4 h-4 flex items-center justify-center" style={{
                            borderRadius: isTARS ? '3px' : '50%',
                            background: `radial-gradient(circle, ${meta.color}, transparent)`,
                            border: `1px solid ${meta.color}`,
                          }}>
                            {isTARS && <Bot className="w-2.5 h-2.5" style={{ color: meta.color }} />}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.name}</span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'text-white rounded-br-sm whitespace-pre-wrap'
                            : 'bg-white/[0.04] border border-white/[0.07] text-white/85 rounded-bl-sm'
                        )}
                        style={msg.role === 'user' ? {
                          background: `linear-gradient(135deg, ${meta.glow}, ${meta.color}30)`,
                          border: `1px solid ${meta.color}40`,
                          borderRadius: isTARS ? '16px 16px 4px 16px' : undefined,
                        } : {
                          borderRadius: isTARS ? '16px 16px 16px 4px' : undefined,
                          fontFamily: isTARS ? "'JetBrains Mono', 'Courier New', monospace" : undefined,
                          fontSize: isTARS ? '12px' : undefined,
                        }}
                      >
                        {msg.streaming ? <StreamingText text={msg.text} /> : (
                          msg.role === 'user' ? (msg.text || '...') : <MarkdownRenderer content={msg.text || '...'} />
                        )}
                      </div>
                      {msg.card?.type === 'task-list' && !msg.streaming && (
                        <TaskListCard tasks={msg.card.data} />
                      )}
                      {msg.card?.type === 'stat-card' && !msg.streaming && (
                        <StatCard sessions={msg.card.data.sessions} tasks={msg.card.data.tasks} />
                      )}
                      <p className="text-[9px] text-white/20 mt-1.5 px-1 font-mono">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                  </React.Fragment>
                  );
                })}

                {/* Thinking indicator */}
                {isStreaming && messages[messages.length - 1]?.text === '' && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/[0.07] px-4 py-3 flex gap-1.5 items-center"
                      style={{ borderRadius: isTARS ? '16px 16px 16px 4px' : '16px 16px 16px 4px' }}>
                      {isTARS ? (
                        <span className="text-xs font-mono" style={{ color: meta.color }}>
                          <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                            PROCESSING...
                          </motion.span>
                        </span>
                      ) : (
                        [0, 150, 300].map(delay => (
                          <motion.span key={delay} className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }}
                            animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: delay / 1000 }} />
                        ))
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Quick prompts — only in chat mode */}
            {activeTab === 'chat' && messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickPrompts.map(q => (
                  <button key={q} onClick={() => { setInput(q); }}
                    className="text-[10px] px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all font-mono"
                    style={{ borderRadius: isTARS ? '8px' : undefined }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="bg-white/[0.04] text-[10px] text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer max-w-[130px] truncate transition-colors"
                >
                  <option value="" className="bg-panel text-white/50">📚 No Context</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-panel text-white">{s.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold transition-all duration-200 cursor-pointer",
                    webSearchEnabled
                      ? "bg-focus-cyan/15 border-focus-cyan/30 text-focus-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] animate-pulse"
                      : "bg-white/[0.04] border-white/10 text-white/40 hover:text-white/80"
                  )}
                  title="Ground Neo's response using Google Search grounding"
                >
                  <Globe className="w-3 h-3" />
                  <span>Web Search</span>
                </button>
              </div>

              <div className="relative flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isTARS ? 'State your query, human.' : 'Talk to Neo...'}
                  rows={1}
                  className="flex-1 border rounded-2xl py-3 pl-4 pr-4 text-sm text-white resize-none focus:outline-none transition-colors scrollbar-hide"
                  style={{
                    background: isTARS ? 'rgba(20,14,0,0.6)' : 'rgba(0,0,0,0.4)',
                    borderColor: input ? meta.color + '60' : 'rgba(255,255,255,0.1)',
                    borderRadius: isTARS ? '12px' : undefined,
                    fontFamily: isTARS ? "'JetBrains Mono', monospace" : undefined,
                    fontSize: isTARS ? '12px' : undefined,
                    maxHeight: '100px',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-10 h-10 flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:hover:scale-100 hover:scale-105 active:scale-95"
                  style={{
                    borderRadius: isTARS ? '10px' : '50%',
                    background: `linear-gradient(135deg, ${meta.color}, ${meta.glow})`,
                    boxShadow: input ? `0 0 16px ${meta.glow}` : undefined,
                  }}
                >
                  {isStreaming
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Zap className="w-4 h-4 text-white" /></motion.div>
                    : <Send className="w-4 h-4 text-white ml-0.5" />
                  }
                </button>
              </div>
              <p className="text-[9px] text-white/15 text-center mt-2 font-mono tracking-widest">ENTER to send • SHIFT+ENTER for newline</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
