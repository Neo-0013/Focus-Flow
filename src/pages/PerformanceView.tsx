import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, TrendingUp, Bolt, Activity } from 'lucide-react';
import { cn } from '../utils/index';
import { Task } from '../types';

interface PerformanceViewProps {
  heatmapData: { level: number; count: number; date: string }[];
  activityData: any[];
  focusSessions: any[];
  tasks?: Task[];
}

export function PerformanceView({ heatmapData, activityData, focusSessions, tasks = [] }: PerformanceViewProps) {

  // ── Real focus session stats ──
  const weeklyWorkMinutes = focusSessions
    .filter((s: any) => {
      const diff = (Date.now() - new Date(s.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && s.mode === 'work';
    })
    .reduce((sum, s) => sum + s.duration / 60, 0);

  const deepWorkHours = (weeklyWorkMinutes / 60).toFixed(1);

  const recoveryMinutes = focusSessions
    .filter((s: any) => {
      const diff = (Date.now() - new Date(s.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && (s.mode === 'shortBreak' || s.mode === 'longBreak');
    })
    .reduce((sum, s) => sum + s.duration / 60, 0);

  const recoveryRate = weeklyWorkMinutes > 0
    ? Math.min(Math.round((recoveryMinutes / (weeklyWorkMinutes * 0.25)) * 100), 100)
    : 0;

  const focusScore = Math.min(90 + (focusSessions.length / 10), 100).toFixed(1);

  // ── Task-based stats ──
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const highPriTasksDone = tasks.filter(t => t.priority === 'high' && t.completed).length;
  const highPriTotal = tasks.filter(t => t.priority === 'high').length;

  // ── Chronotype: sessions grouped into 2-hour blocks ──
  const chronoBuckets = useMemo(() => {
    const buckets = Array(12).fill(0);
    focusSessions.forEach((s: any) => {
      if (s.mode !== 'work') return;
      const hour = new Date(s.completedAt).getHours();
      buckets[Math.floor(hour / 2)] += s.duration / 60;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map(v => Math.round((v / max) * 100));
  }, [focusSessions]);

  const peakSlot = chronoBuckets.indexOf(Math.max(...chronoBuckets));
  const peakLabel = `${String(peakSlot * 2).padStart(2, '0')}:00`;

  // ── Equilibrium Matrix radar points ──
  const focusScoreVal = Math.min(parseFloat(focusScore), 100);
  const velocityVal = Math.min((highPriTasksDone / Math.max(highPriTotal, 1)) * 100, 100);
  const enduranceVal = Math.min(parseFloat(deepWorkHours) / 40 * 100, 100);
  const productivityVal = completionRate;

  const health    = recoveryRate;
  const career    = enduranceVal;
  const finance   = velocityVal;
  const education = focusScoreVal;
  const personal  = productivityVal;

  const axes = [health, career, finance, education, personal];
  const axisLabels = ['Health', 'Career', 'Finance', 'Education', 'Personal'];

  const toPoint = (val: number, angleIdx: number) => {
    const r = (val / 100) * 35;
    const rad = (angleIdx * 72 - 90) * (Math.PI / 180);
    return `${50 + r * Math.cos(rad)},${50 + r * Math.sin(rad)}`;
  };
  const polygonPoints = axes.map((v, i) => toPoint(v, i)).join(' ');

  // ── Dynamic AI insights ──
  const insights: { color: string; text: string; source: string }[] = [];
  if (parseFloat(deepWorkHours) < 10) {
    insights.push({ color: 'border-deep-work-red', text: `Only ${deepWorkHours}h of deep work this week. Target is 40h. Schedule more focused Pomodoro sessions.`, source: 'FOCUS ENGINE' });
  } else {
    insights.push({ color: 'border-focus-cyan', text: `Strong output: ${deepWorkHours}h of deep work logged this week. You're building serious momentum.`, source: 'FOCUS ENGINE' });
  }
  if (completionRate < 50 && totalTasks > 0) {
    insights.push({ color: 'border-performance-gold', text: `Task completion at ${completionRate}%. Break larger tasks into sub-tasks to improve throughput.`, source: 'ARCHITECT SYSTEM' });
  } else if (totalTasks > 0) {
    insights.push({ color: 'border-recovery-green', text: `Completion rate is ${completionRate}% — excellent. ${highPriTasksDone}/${highPriTotal} high-priority tasks crushed.`, source: 'ARCHITECT SYSTEM' });
  }
  if (recoveryRate < 40 && weeklyWorkMinutes > 0) {
    insights.push({ color: 'border-velocity-purple', text: `Recovery deficit detected (${recoveryRate}%). Add more short break sessions between Pomodoros.`, source: 'HEALTH ENGINE' });
  }
  if (insights.length === 0) {
    insights.push({ color: 'border-white/10', text: 'Complete tasks and focus sessions to generate real-time insights from your data.', source: 'ARCHITECT SYSTEM' });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-7xl mx-auto space-y-8 pb-12"
    >
      {/* ── Header Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Focus Score"
          value={focusScore}
          icon={<Bolt className="w-5 h-5 text-focus-cyan" />}
          trend={`${focusSessions.length} sessions total`}
          trendColor="text-recovery-green"
          valueColor="text-focus-cyan"
        />
        <StatCard
          label="Deep Work"
          value={`${deepWorkHours}h`}
          subValue="Weekly Target: 40h"
        />
        <StatCard
          label="Task Completion"
          value={`${completionRate}%`}
          subValue={`${completedTasks} / ${totalTasks} tasks done`}
          valueColor={completionRate >= 70 ? 'text-recovery-green' : completionRate >= 40 ? 'text-performance-gold' : 'text-deep-work-red'}
        />
        <StatCard
          label="Recovery Rate"
          value={`${recoveryRate}%`}
          subValue="Work/break ratio"
          valueColor="text-velocity-purple"
          borderClass="border-velocity-purple/20"
        />
      </div>

      {/* ── Radar + Chronotype ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Equilibrium Matrix */}
        <div className="lg:col-span-1 glass-panel p-8 rounded-[32px]">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-focus-cyan" />
            Equilibrium Matrix
          </h3>
          <div className="relative w-full aspect-square flex items-center justify-center">
            <div className="absolute inset-0 border border-white/5 rounded-full" />
            <div className="absolute inset-8 border border-white/5 rounded-full" />
            <div className="absolute inset-16 border border-white/10 rounded-full" />
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {[0,72,144,216,288].map((angle, i) => {
                const rad = (angle - 90) * (Math.PI / 180);
                return <line key={i} x1="50" y1="50" x2={50 + 35 * Math.cos(rad)} y2={50 + 35 * Math.sin(rad)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />;
              })}
              <polygon fill="rgba(0,240,255,0.15)" points={polygonPoints} stroke="#00F0FF" strokeWidth="0.5" />
              {axes.map((v, i) => {
                const rad = (i * 72 - 90) * (Math.PI / 180);
                const r = (v / 100) * 35;
                return <circle key={i} cx={50 + r * Math.cos(rad)} cy={50 + r * Math.sin(rad)} r="1.5" fill="#00F0FF" />;
              })}
            </svg>
            <Label position="top" text="Health" />
            <div className="absolute top-[30%] right-[-10px] text-[10px] font-bold text-white/20 tracking-widest uppercase">Career</div>
            <div className="absolute bottom-[10%] right-[10%] text-[10px] font-bold text-white/20 tracking-widest uppercase">Finance</div>
            <div className="absolute bottom-[10%] left-[10%] text-[10px] font-bold text-white/20 tracking-widest uppercase">Education</div>
            <div className="absolute top-[30%] left-[-10px] text-[10px] font-bold text-white/20 tracking-widest uppercase">Personal</div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {axisLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-focus-cyan/60 shrink-0" />
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest truncate">
                  {label}: <span className="text-white/60">{Math.round(axes[i])}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chronotype Analysis */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-[32px]">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-lg font-bold text-white">Chronotype Analysis</h3>
              <p className="text-sm text-white/40">Your peak focus hours from real session data</p>
            </div>
            {focusSessions.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-performance-gold/10 rounded-xl text-performance-gold text-[10px] font-bold uppercase tracking-widest border border-performance-gold/20">
                <Zap className="w-3.5 h-3.5" /> PEAK AT {peakLabel}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">No sessions yet</div>
            )}
          </div>

          <div className="h-56 flex items-end gap-1.5 px-2 relative border-b border-white/5">
            {chronoBuckets.map((h, i) => (
              <div key={i} className="flex-1 h-full flex items-end group relative">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, 2)}%` }}
                  transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                  className={cn(
                    "w-full rounded-t-sm transition-colors",
                    h > 85 ? "bg-performance-gold shadow-[0_0_20px_rgba(255,199,0,0.3)]" :
                    h > 60 ? "bg-velocity-purple/60" :
                    h > 10 ? "bg-focus-cyan/20 group-hover:bg-focus-cyan/40" :
                    "bg-white/5"
                  )}
                />
                {h > 5 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/0 group-hover:text-white/50 transition-colors whitespace-nowrap">
                    {h}%
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-[10px] font-mono text-white/20 uppercase tracking-widest px-2">
            <span>00</span><span>04</span><span>08</span><span>12</span><span>16</span><span>20</span><span>24</span>
          </div>
          {focusSessions.length === 0 && (
            <p className="text-center text-xs text-white/20 mt-4 font-mono">
              Complete focus sessions to populate your chronotype.
            </p>
          )}
        </div>
      </div>

      {/* ── Neuro-Consistency Heatmap ── */}
      <div className="glass-panel p-8 rounded-[40px]">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-bold text-white">Neuro-Consistency Map</h3>
          <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
            <span>Low</span>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-white/5 rounded-[2px]" />
              <div className="w-3 h-3 bg-focus-cyan/20 rounded-[2px]" />
              <div className="w-3 h-3 bg-focus-cyan/50 rounded-[2px]" />
              <div className="w-3 h-3 bg-focus-cyan rounded-[2px] shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
            </div>
            <span>Intensity</span>
          </div>
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-4 scrollbar-hide">
          {heatmapData.map((d, i) => (
            <div
              key={i}
              title={`${d.date}: ${d.count} actions`}
              className={cn(
                "w-3 h-3 rounded-[2px] transition-all hover:scale-150 hover:z-10 cursor-pointer",
                d.level === 0 ? "bg-white/5" :
                d.level === 1 ? "bg-focus-cyan/20" :
                d.level === 2 ? "bg-focus-cyan/40" :
                d.level === 3 ? "bg-focus-cyan/70" :
                "bg-focus-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]"
              )}
            />
          ))}
        </div>
        <div className="flex justify-between mt-4 text-[10px] font-mono text-white/20 uppercase tracking-widest">
          {['Jan','Mar','May','Jul','Sep','Nov'].map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* ── Intelligence & Log ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 rounded-[32px]">
          <h3 className="text-lg font-bold text-white mb-8">Architect's Intelligence</h3>
          <div className="space-y-4">
            {insights.map((ins, i) => (
              <InsightCard key={i} color={ins.color} text={ins.text} source={ins.source} time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            ))}
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[32px]">
          <h3 className="text-lg font-bold text-white mb-8">Performance Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-white/5">
                <tr className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                  <th className="pb-4">Metric</th><th className="pb-4">Value</th><th className="pb-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <TableRow metric="DEEP_WORK_HOURS"  value={`${deepWorkHours}h`}          status={parseFloat(deepWorkHours) >= 20 ? 'ON TRACK' : 'BELOW TARGET'}                   statusColor={parseFloat(deepWorkHours) >= 20 ? 'text-recovery-green' : 'text-deep-work-red'} />
                <TableRow metric="TASK_COMPLETION"  value={`${completionRate}%`}          status={completionRate >= 70 ? 'OPTIMAL' : 'NEEDS WORK'}                                statusColor={completionRate >= 70 ? 'text-recovery-green' : 'text-performance-gold'} />
                <TableRow metric="RECOVERY_RATE"    value={`${recoveryRate}%`}            status={recoveryRate >= 60 ? 'SAFE' : 'DEFICIT'}                                        statusColor={recoveryRate >= 60 ? 'text-recovery-green' : 'text-velocity-purple'} />
                <TableRow metric="HIGH_PRI_TASKS"   value={`${highPriTasksDone}/${highPriTotal}`} status={highPriTotal > 0 && highPriTasksDone === highPriTotal ? 'COMPLETE' : 'IN PROGRESS'} statusColor="text-focus-cyan" />
                <TableRow metric="TOTAL_SESSIONS"   value={`${focusSessions.length}`}    status="LOGGED"                                                                         statusColor="text-focus-cyan" />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, subValue, icon, trend, trendColor, valueColor, borderClass }: any) {
  return (
    <div className={cn("glass-panel p-6 flex flex-col justify-between h-40 rounded-[32px]", borderClass)}>
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div>
        <p className={cn("text-4xl font-bold tracking-tighter", valueColor || "text-white")}>{value}</p>
        {trend && <p className={cn("text-[10px] font-bold flex items-center gap-1 mt-1", trendColor)}><TrendingUp className="w-3 h-3" /> {trend}</p>}
        {subValue && <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">{subValue}</p>}
      </div>
    </div>
  );
}

function Label({ position, text }: { position: string; text: string }) {
  const classes = { top: "top-0 -translate-y-6", bottom: "bottom-0 translate-y-6", left: "left-0 -translate-x-12", right: "right-0 translate-x-12" }[position];
  return <div className={cn("absolute text-[10px] font-bold text-white/20 tracking-widest uppercase", classes)}>{text}</div>;
}

function InsightCard({ color, text, source, time }: any) {
  return (
    <div className={cn("p-4 border-l-2 bg-white/[0.02] rounded-r-2xl", color)}>
      <p className="text-sm text-white/80 leading-relaxed">{text}</p>
      <p className="text-[9px] text-white/20 mt-3 font-mono uppercase tracking-widest">{source} // {time}</p>
    </div>
  );
}

function TableRow({ metric, value, status, statusColor }: any) {
  return (
    <tr className="border-b border-white/5 group hover:bg-white/[0.01] transition-colors">
      <td className="py-4 font-mono text-[10px] text-white/40 group-hover:text-white/60">{metric}</td>
      <td className="py-4 font-bold text-white/80">{value}</td>
      <td className={cn("py-4 text-right font-bold text-[10px] tracking-widest", statusColor)}>{status}</td>
    </tr>
  );
}
