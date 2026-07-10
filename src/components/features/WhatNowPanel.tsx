import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, AlertCircle, Settings, ChevronRight, Loader2, RefreshCw, Clock, BarChart3 } from 'lucide-react';
import { cn } from '../../utils/index';
import { Task, Goal } from '../../types';

interface WhatNowPanelProps {
  tasks: Task[];
  focusSessions: any[];
  aiConfig: { baseUrl: string; apiKey: string; modelId: string };
  peakTimeLabel?: string;
  isInPeakHour?: boolean;
  onNavigateSettings?: () => void;
}

interface Recommendation {
  task: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  score?: number;
}

export function WhatNowPanel({
  tasks,
  focusSessions,
  aiConfig,
  peakTimeLabel,
  isInPeakHour,
  onNavigateSettings,
}: WhatNowPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAsked, setHasAsked] = useState(false);

  const pendingTasks = tasks.filter(t => !t.completed && !t.archived);
  const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]);
  const weekFocusHours = Math.round(
    focusSessions
      .filter(s => s.mode === 'work' && Date.now() - new Date(s.completedAt).getTime() < 7 * 24 * 60 * 60 * 1000)
      .reduce((a, s) => a + s.duration, 0) / 3600 * 10
  ) / 10;

  const askNeo = async () => {
    if (!aiConfig.apiKey) {
      setError('no-key');
      return;
    }
    if (pendingTasks.length === 0) {
      setRecommendations([]);
      setHasAsked(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasAsked(true);

    const taskSummary = pendingTasks
      .slice(0, 15)
      .map(t => `- "${t.text}" [priority: ${t.priority}, importance: ${t.importance}/5, urgency: ${t.urgency}/5, cognitive cost: ${t.cognitiveCost}/5${t.dueDate ? `, due: ${t.dueDate}` : ''}]`)
      .join('\n');

    const currentHour = new Date().getHours();
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

    const prompt = `You are a productivity analyst. Given the following pending tasks with their metrics, identify the TOP 3 tasks to work on RIGHT NOW. 

Current context:
- Time: ${timeOfDay} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
- Peak productivity hour for this user: ${peakTimeLabel || 'unknown'}${isInPeakHour ? ' (they are currently in their peak window!)' : ''}
- Focus hours this week: ${weekFocusHours}h
- Overdue tasks: ${overdueTasks.length}

Pending tasks:
${taskSummary}

Respond in this exact JSON format (no markdown, no explanation, just the JSON):
{
  "recommendations": [
    {"task": "exact task text", "reason": "one concise sentence why (max 12 words)", "priority": "high|medium|low"},
    {"task": "exact task text", "reason": "one concise sentence why (max 12 words)", "priority": "high|medium|low"},
    {"task": "exact task text", "reason": "one concise sentence why (max 12 words)", "priority": "high|medium|low"}
  ]
}`;

    try {
      const API_BASE = 'http://localhost:3002/api';
      const res = await fetch(`${API_BASE}/neo/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiConfig,
          messages: [
            { role: 'system', content: 'You are a precise productivity analyst. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 400,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const content = data.choices[0]?.message?.content?.trim() || '';

      // Clean JSON (remove markdown wrappers if AI adds them)
      const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(clean);

      setRecommendations(parsed.recommendations || []);
    } catch (err: any) {
      setError('api');
      console.error('WhatNow AI error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const PRIORITY_STYLES = {
    high: { dot: 'bg-red-500', label: 'bg-red-500/10 text-red-400 border-red-500/20', text: 'HIGH' },
    medium: { dot: 'bg-yellow-500', label: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', text: 'MED' },
    low: { dot: 'bg-emerald-500', label: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', text: 'LOW' },
  };

  return (
    <div className="dashboard-card overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent pointer-events-none" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/80">What Should I Work On?</p>
              <p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">AI-Powered Prioritization</p>
            </div>
          </div>
          {hasAsked && !isLoading && (
            <button
              onClick={askNeo}
              className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Context strip */}
        {!hasAsked && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-medium">
              <BarChart3 className="w-3 h-3" />
              <span><span className="text-white/60 font-bold">{pendingTasks.length}</span> tasks pending</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-medium">
              <Clock className="w-3 h-3" />
              <span>Peak: <span className={cn("font-bold", isInPeakHour ? "text-focus-cyan" : "text-white/60")}>{peakTimeLabel || '—'}</span></span>
            </div>
            {overdueTasks.length > 0 && (
              <>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5 text-[10px] text-red-400/70 font-medium">
                  <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                  <span><span className="font-bold">{overdueTasks.length}</span> overdue</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* States */}
        <AnimatePresence mode="wait">
          {/* No API key */}
          {error === 'no-key' && (
            <motion.div
              key="no-key"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/15 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-400">AI not configured</p>
                <p className="text-[10px] text-white/40 mt-1">Set up your API key in Settings to enable smart prioritization.</p>
              </div>
              <button
                onClick={onNavigateSettings}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <Settings className="w-3 h-3" /> Settings
              </button>
            </motion.div>
          )}

          {/* API error */}
          {error === 'api' && (
            <motion.div
              key="api-err"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 p-4 bg-red-500/8 border border-red-500/15 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">Analysis failed</p>
                <p className="text-[10px] text-white/40 mt-1">Check your API key and network, then try again.</p>
              </div>
              <button onClick={askNeo} className="ml-auto text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors">
                Retry
              </button>
            </motion.div>
          )}

          {/* Loading */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3 p-4 bg-violet-500/5 border border-violet-500/10 rounded-xl">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-violet-400">Analyzing your task matrix…</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Cross-referencing urgency, importance & cognitive load</p>
                </div>
              </div>
              {/* Skeleton */}
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04] animate-pulse">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.04]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-white/[0.06] rounded-full w-3/4" />
                    <div className="h-2 bg-white/[0.04] rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Results */}
          {!isLoading && !error && recommendations !== null && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2.5"
            >
              {recommendations.length === 0 ? (
                <div className="text-center py-6 text-white/20 text-xs">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-20" />
                  No pending tasks — you're all clear!
                </div>
              ) : (
                recommendations.map((rec, i) => {
                  const style = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-xl transition-all group cursor-default"
                    >
                      {/* Rank */}
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs",
                        i === 0 ? "bg-violet-500/20 text-violet-400" : "bg-white/[0.04] text-white/30"
                      )}>
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 leading-snug truncate">{rec.task}</p>
                        <p className="text-[10px] text-white/35 mt-1 leading-relaxed">{rec.reason}</p>
                      </div>
                      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0", style.label)}>
                        {style.text}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Initial state — CTA button */}
          {!hasAsked && !isLoading && !error && (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                onClick={askNeo}
                disabled={pendingTasks.length === 0}
                className={cn(
                  "w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-sm transition-all group",
                  pendingTasks.length === 0
                    ? "bg-white/[0.02] border border-white/[0.05] text-white/20 cursor-not-allowed"
                    : "bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:border-violet-400/40 active:scale-[0.98]"
                )}
                style={pendingTasks.length > 0 ? { boxShadow: '0 0 30px rgba(139,92,246,0.15)' } : {}}
              >
                <Brain className={cn("w-4 h-4 transition-transform", pendingTasks.length > 0 && "group-hover:scale-110")} />
                {pendingTasks.length === 0 ? 'No pending tasks to analyze' : 'Ask Neo to prioritize now'}
                {pendingTasks.length > 0 && (
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                )}
              </button>
              <p className="text-center text-[9px] text-white/15 mt-2 font-mono">
                Uses urgency · importance · cognitive cost scores
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
