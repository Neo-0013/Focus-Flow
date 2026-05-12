import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Maximize2, Minimize2, Volume2, VolumeX, Zap, CheckSquare, BarChart2 } from 'lucide-react';
import { cn, generateUUID } from '../utils';
import { Profile, Task } from '../types';
import { io, Socket } from 'socket.io-client';

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
}

// ── Deterministic protocol color ──
const protocolColor = (p?: string) => p === 'gentle' ? 'rgba(134,239,172,0.6)' : p === 'hardcore' ? 'rgba(239,68,68,0.6)' : 'rgba(0,240,255,0.6)';
const protocolGlow  = (p?: string) => p === 'gentle' ? 'rgba(134,239,172,0.2)' : p === 'hardcore' ? 'rgba(239,68,68,0.2)' : 'rgba(0,240,255,0.15)';

// ── Global Audio Ref ──
let neoAudio: HTMLAudioElement | null = null;

// ── Living Orb Button ──
function NeoOrb({ onClick, isOpen, protocol, hasNotif }: { onClick: () => void; isOpen: boolean; protocol?: string; hasNotif: boolean }) {
  const color = protocolColor(protocol);
  const glow  = protocolGlow(protocol);
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full z-50 flex items-center justify-center focus:outline-none"
      style={{ background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.18) 0%, ${glow} 60%, transparent 100%)` }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: color }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Second pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: color }}
        animate={{ scale: [1, 1.3, 1.6], opacity: [0.3, 0.1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 1 }}
      />
      {/* Core */}
      <motion.div
        className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden"
        style={{ background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.25), ${glow})`, boxShadow: `0 0 24px ${color}, inset 0 0 12px rgba(255,255,255,0.08)`, border: `1px solid ${color}` }}
        animate={{ boxShadow: [`0 0 16px ${color}`, `0 0 36px ${color}`, `0 0 16px ${color}`] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-white font-black text-sm tracking-widest" style={{ textShadow: `0 0 12px ${color}` }}>N</span>
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
  return <span>{text}<motion.span animate={{ opacity: [1,0,1] }} transition={{ duration: 0.7, repeat: Infinity }} className="inline-block w-0.5 h-4 bg-current ml-0.5 align-middle" /></span>;
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
  const weekMins = sessions.filter(s => (Date.now() - new Date(s.completedAt).getTime()) < 7*24*60*60*1000 && s.mode === 'work').reduce((a, s) => a + s.duration / 60, 0);
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 grid grid-cols-3 gap-2">
      {[
        { label: 'Sessions', value: sessions.length, color: 'text-focus-cyan' },
        { label: 'Tasks Done', value: `${done}/${total}`, color: 'text-recovery-green' },
        { label: 'Deep Work', value: `${(weekMins/60).toFixed(1)}h`, color: 'text-velocity-purple' },
      ].map(s => (
        <div key={s.label} className="text-center">
          <p className={cn('text-lg font-black', s.color)}>{s.value}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-widest">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ──
export function NeoChat({ tasks, profile, focusSessions = [], onSpeakingChange }: NeoChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notification, setNotification] = useState<{ text: string; type: string } | null>(null);
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const protocol = profile?.aiProtocol || 'strategic';
  const color = protocolColor(protocol);

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

  // ── Initial greeting on protocol change ──
  useEffect(() => {
    const greetings = {
      gentle: "Hello! 🌟 I'm Neo, your guide. I'm genuinely happy you opened this. What would you like to work on today, champion?",
      hardcore: "Neo online. 🦾 Clock's ticking. What are we solving right now?",
      strategic: "Greetings. I'm Neo — your cognitive architect. State your objective and let's engineer a solution.",
    };
    setMessages([{ id: generateUUID(), role: 'neo', text: greetings[protocol as keyof typeof greetings] || greetings.strategic, timestamp: new Date() }]);
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

  // ── Proactive triggers (frontend-driven) ──
  useEffect(() => {
    const overdue = tasks.filter(t => !t.completed && !t.archived && t.dueDate && new Date(t.dueDate) < new Date());
    if (overdue.length >= 3 && !isOpen) {
      const msgs: Record<string, string> = {
        strategic: `${overdue.length} tasks are overdue. Want me to help re-prioritize?`,
        gentle: `Hey, ${overdue.length} tasks need attention 💛 Want help sorting them out?`,
        hardcore: `${overdue.length} OVERDUE. This is unacceptable. Open Neo NOW.`,
      };
      setNotification({ text: msgs[protocol] || msgs.strategic, type: 'overdue' });
    }
  }, [tasks, protocol]);

  // ── Late night check-in ──
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 1 && hour < 5 && !isOpen) {
      setNotification({ text: `It's ${hour}AM. Your brain needs sleep to perform. Shutdown recommended. ⚡`, type: 'sleep' });
    }
  }, []);

  // ── Streaming send ──
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { id: generateUUID(), role: 'user', text: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input.trim();
    setInput('');
    setIsStreaming(true);
    setOrbState('thinking');

    // Detect card requests
    const lower = sentInput.toLowerCase();
    let card: ActionCard | undefined;
    if (lower.includes('show') && (lower.includes('task') || lower.includes('todo'))) {
      card = { type: 'task-list', data: tasks.filter(t => !t.completed && !t.archived) };
    } else if (lower.includes('how am i') || lower.includes('my stats') || lower.includes('performance')) {
      card = { type: 'stat-card', data: { sessions: focusSessions, tasks } };
    }

    const neoId = generateUUID();
    setMessages(prev => [...prev, { id: neoId, role: 'neo', text: '', timestamp: new Date(), streaming: true, card }]);

    try {
      const ctx = encodeURIComponent(JSON.stringify({ aiProtocol: protocol, activeTaskCount: tasks.filter(t => !t.completed).length }));
      const hist = encodeURIComponent(JSON.stringify(messages.slice(-10)));
      const url = `${API}/api/neo/stream?prompt=${encodeURIComponent(sentInput)}&context=${ctx}&history=${hist}`;
      const es = new EventSource(url);
      let fullText = '';

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.done) {
          es.close();
          setIsStreaming(false);
          setOrbState('speaking');
          setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: fullText, streaming: false } : m));
          if (!isMuted && fullText) speak(fullText);
          setTimeout(() => setOrbState('idle'), 3000);
        } else {
          fullText += data.token;
          setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: fullText } : m));
        }
      };
      es.onerror = () => {
        es.close();
        setIsStreaming(false);
        setOrbState('idle');
        if (!fullText) setMessages(prev => prev.map(m => m.id === neoId ? { ...m, text: 'Neural link disrupted. Try again.', streaming: false } : m));
      };
    } catch {
      setIsStreaming(false);
      setOrbState('idle');
    }
  }, [input, isStreaming, messages, tasks, focusSessions, protocol, isMuted]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── Orb animation variants by state ──
  const orbAnimMap = {
    idle: { scale: [1, 1.03, 1], transition: { duration: 3, repeat: Infinity } },
    thinking: { scale: [1, 1.08, 0.96, 1.08, 1], transition: { duration: 0.8, repeat: Infinity } },
    speaking: { scale: [1, 1.05, 1, 1.05, 1], transition: { duration: 0.4, repeat: Infinity } },
  };

  return (
    <>
      {/* ── Proactive notification ── */}
      <AnimatePresence>
        {notification && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
            className="fixed bottom-24 right-6 z-50 max-w-xs"
          >
            <div className="bg-[#0d1515] border rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer"
              style={{ borderColor: color }}
              onClick={() => { setIsOpen(true); setNotification(null); }}
            >
              <motion.div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: `radial-gradient(circle, ${protocolGlow(protocol)}, transparent)`, border: `1px solid ${color}` }}
                animate={{ boxShadow: [`0 0 8px ${color}`, `0 0 18px ${color}`, `0 0 8px ${color}`] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-white font-black text-xs">N</span>
              </motion.div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color }}>Neo</p>
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
              'bg-[#0a0f0f] border shadow-2xl',
              isExpanded
                ? 'top-6 left-6 right-6 bottom-6 md:top-10 md:left-20 md:right-20 md:bottom-10 rounded-[40px]'
                : 'bottom-6 right-6 w-[380px] h-[580px] rounded-[32px]'
            )}
            style={{ borderColor: color, boxShadow: `0 0 80px -20px ${protocolGlow(protocol)}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${protocolGlow(protocol)}, transparent)` }}>
              <div className="flex items-center gap-3">
                {/* Mini orb in header */}
                <motion.div
                  className="w-9 h-9 rounded-full flex items-center justify-center relative"
                  style={{ border: `1px solid ${color}`, background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.12), ${protocolGlow(protocol)})` }}
                  animate={orbAnimMap[orbState]}
                >
                  <span className="text-white font-black text-sm" style={{ textShadow: `0 0 10px ${color}` }}>N</span>
                  {orbState === 'thinking' && (
                    <motion.div className="absolute inset-0 rounded-full border" style={{ borderColor: color }}
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  )}
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">Neo</h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-widest"
                      style={{ color, borderColor: color, background: protocolGlow(protocol) }}>
                      {protocol}
                    </span>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest font-mono" style={{ color }}>
                    {orbState === 'thinking' ? '⚡ Processing...' : orbState === 'speaking' ? '🗣️ Speaking...' : '● Online'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors" title={isMuted ? 'Unmute Neo' : 'Mute Neo'}>
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className="max-w-[88%]">
                    {msg.role === 'neo' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-4 h-4 rounded-full" style={{ background: `radial-gradient(circle, ${color}, transparent)`, border: `1px solid ${color}` }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>Neo</span>
                      </div>
                    )}
                    <div className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-white/[0.04] border border-white/[0.07] text-white/85 rounded-bl-sm'
                    )}
                      style={msg.role === 'user' ? { background: `linear-gradient(135deg, ${protocolGlow(protocol)}, ${color}30)`, border: `1px solid ${color}40` } : {}}
                    >
                      {msg.streaming ? <StreamingText text={msg.text} /> : (msg.text || '...')}
                    </div>
                    {/* Rich cards */}
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
              ))}

              {/* Thinking dots */}
              {isStreaming && messages[messages.length - 1]?.text === '' && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    {[0, 150, 300].map(delay => (
                      <motion.span key={delay} className="w-1.5 h-1.5 rounded-full" style={{ background: color }}
                        animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: delay / 1000 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {['Show my tasks', 'My stats', 'Help me focus', 'Prioritize my day'].map(q => (
                  <button key={q} onClick={() => { setInput(q); }}
                    className="text-[10px] px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all font-mono">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-white/5">
              <div className="relative flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Talk to Neo..."
                  rows={1}
                  className="flex-1 bg-black/40 border border-white/10 rounded-2xl py-3 pl-4 pr-4 text-sm text-white resize-none focus:outline-none transition-colors scrollbar-hide"
                  style={{ borderColor: input ? color + '60' : undefined, maxHeight: '100px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:hover:scale-100 hover:scale-105 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${color}, ${protocolGlow(protocol)})`, boxShadow: input ? `0 0 16px ${protocolGlow(protocol)}` : undefined }}
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
