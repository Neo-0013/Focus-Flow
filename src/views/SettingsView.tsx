import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import axios from 'axios';
import { 
  RefreshCcw, 
  Save, 
  Palette, 
  Bot, 
  Database, 
  Download, 
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { Profile } from '../types';
import { cn } from '../utils';

const API_BASE = 'http://localhost:3002';

interface SettingsViewProps {
  profile: Profile | null;
  showToast: (title: string, body: string, type?: string) => void;
  setTheme: (t: any) => void;
  customAccent: string;
  setCustomAccent: (c: string) => void;
}

export function SettingsView({ profile, showToast, setTheme, customAccent, setCustomAccent }: SettingsViewProps) {
  const [localProfile, setLocalProfile] = useState<Partial<Profile>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setLocalProfile({
        aiProtocol: profile.aiProtocol || 'strategic',
        themeOpacity: profile.themeOpacity || 85,
        glowIntensity: profile.glowIntensity || 40,
        telemetryMasking: !!profile.telemetryMasking,
        stealthMode: !!profile.stealthMode
      });
    }
  }, [profile]);

  const handleUpdate = (field: keyof Profile, value: any) => {
    setLocalProfile(prev => ({ ...prev, [field]: value }));
  };

  const deployConfig = async () => {
    setIsSaving(true);
    try {
      await axios.patch(`${API_BASE}/profile`, {
        ...localProfile,
        telemetryMasking: localProfile.telemetryMasking ? 1 : 0,
        stealthMode: localProfile.stealthMode ? 1 : 0
      });
      showToast('Config Deployed', 'System parameters calibrated successfully.', 'success');
    } catch (err) {
      showToast('Deployment Failed', 'Matrix synchronization error.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetDefaults = () => {
    setLocalProfile({
      aiProtocol: 'strategic',
      themeOpacity: 85,
      glowIntensity: 40,
      telemetryMasking: true,
      stealthMode: false
    });
    showToast('Defaults Restored', 'System reverted to baseline parameters.', 'info');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col gap-8 min-h-full"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-5xl font-bold font-['Space_Grotesk'] text-white tracking-tight mb-2">Architect Control</h1>
          <p className="font-mono text-zinc-500 text-xs tracking-[0.3em] uppercase">SYSTEM CONFIGURATION // CALIBRATION MATRIX</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={resetDefaults}
            className="px-6 py-3 border border-white/10 rounded hover:bg-white/5 transition-colors font-bold text-[10px] uppercase tracking-[0.2em] text-white flex items-center gap-2"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button 
            onClick={deployConfig}
            disabled={isSaving}
            className="px-6 py-3 bg-focus-cyan/10 border border-focus-cyan text-focus-cyan rounded hover:bg-focus-cyan/20 transition-all font-bold text-[10px] uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Syncing...' : (
              <>
                <Save className="w-3.5 h-3.5" />
                Deploy Config
              </>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Theme Engine Panel */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-onyx-surface border border-white/5 rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-velocity-purple"></div>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2 bg-velocity-purple/10 rounded-lg">
                <Palette className="w-5 h-5 text-velocity-purple fill-current" />
              </div>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] text-white">Theme Engine</h2>
            </div>

            <div className="space-y-10">
              {/* Glass Opacity */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Structural Opacity</label>
                    <p className="text-xs text-zinc-500">Adjust baseline glassmorphism intensity.</p>
                  </div>
                  <span className="font-mono text-sm text-velocity-purple font-bold">{localProfile.themeOpacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={localProfile.themeOpacity}
                  onChange={(e) => handleUpdate('themeOpacity', parseInt(e.target.value))}
                  className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-velocity-purple"
                />
              </div>

              {/* Glow Intensity */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Emissive Output</label>
                    <p className="text-xs text-zinc-500">Manage active state glow propagation.</p>
                  </div>
                  <span className="font-mono text-sm text-velocity-purple font-bold">{localProfile.glowIntensity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={localProfile.glowIntensity}
                  onChange={(e) => handleUpdate('glowIntensity', parseInt(e.target.value))}
                  className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-velocity-purple"
                />
              </div>

              {/* Accent Color Palette */}
              <div className="pt-8 border-t border-white/5">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-6">Primary Signature</label>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { id: 'focus-cyan', color: '#00F0FF', name: 'Focus Cyan' },
                    { id: 'velocity-purple', color: '#7000FF', name: 'Velocity Purple' },
                    { id: 'recovery-green', color: '#00FF66', name: 'Recovery Green' },
                    { id: 'performance-gold', color: '#FFC700', name: 'Performance Gold' }
                  ].map(t => (
                    <button 
                      key={t.id}
                      onClick={() => setCustomAccent(t.color)}
                      className={cn(
                        "w-12 h-12 rounded-full transition-all relative flex items-center justify-center",
                        customAccent === t.color 
                          ? "ring-2 ring-offset-4 ring-offset-midnight-base ring-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                          : "hover:ring-2 hover:ring-offset-2 hover:ring-offset-midnight-base hover:ring-white/20"
                      )}
                      style={{ backgroundColor: t.color }}
                    >
                      {customAccent === t.color && <CheckCircle2 className="w-5 h-5 text-black" />}
                    </button>
                  ))}
                  
                  <div className="ml-auto flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Custom</span>
                    <input 
                      type="color" 
                      value={customAccent} 
                      onChange={(e) => setCustomAccent(e.target.value)}
                      className="w-8 h-8 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Neo AI Calibration */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#0A0D10] border border-white/10 rounded-2xl p-8 relative overflow-hidden backdrop-blur-3xl shadow-[inset_0_0_30px_rgba(0,240,255,0.05)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-focus-cyan/5 blur-3xl rounded-full"></div>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2 bg-focus-cyan/10 rounded-lg">
                <Bot className="w-5 h-5 text-focus-cyan fill-current" />
              </div>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] text-white">Neo AI Protocol</h2>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { 
                  id: 'gentle', 
                  name: 'Gentle Guide', 
                  desc: 'Supportive nudges, positive reinforcement, flexible boundaries.',
                  color: 'text-recovery-green',
                  glow: 'shadow-[0_0_8px_rgba(0,255,102,0.8)]'
                },
                { 
                  id: 'strategic', 
                  name: 'Strategic Partner', 
                  desc: 'Balanced analytical feedback, context-aware interruptions.',
                  color: 'text-focus-cyan',
                  glow: 'shadow-[0_0_8px_rgba(0,240,255,0.8)]'
                },
                { 
                  id: 'hardcore', 
                  name: 'Hardcore Discipline', 
                  desc: 'Zero tolerance for distraction. Aggressive session locking.',
                  color: 'text-red-500',
                  glow: 'shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                }
              ].map(mode => (
                <label 
                  key={mode.id}
                  className={cn(
                    "relative flex cursor-pointer rounded-xl border p-5 transition-all group",
                    localProfile.aiProtocol === mode.id 
                      ? `bg-white/5 border-${mode.id === 'hardcore' ? 'red-500/50' : 'focus-cyan/50'}` 
                      : "border-white/5 bg-transparent hover:bg-white/[0.02] hover:border-white/10"
                  )}
                >
                  <input 
                    type="radio" 
                    className="sr-only" 
                    name="ai_protocol"
                    value={mode.id}
                    checked={localProfile.aiProtocol === mode.id}
                    onChange={() => handleUpdate('aiProtocol', mode.id)}
                  />
                  <div className="flex w-full items-start gap-5">
                    <div className="flex items-center h-6 mt-1">
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                        localProfile.aiProtocol === mode.id ? "border-focus-cyan" : "border-white/20"
                      )}>
                        {localProfile.aiProtocol === mode.id && (
                          <div className={cn("w-2.5 h-2.5 rounded-full", mode.id === 'hardcore' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-focus-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)]')}></div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className={cn("font-mono text-sm mb-1 font-bold", localProfile.aiProtocol === mode.id ? (mode.id === 'hardcore' ? 'text-red-500' : 'text-focus-cyan') : "text-white")}>
                        {mode.name} {localProfile.aiProtocol === mode.id && '[Active]'}
                      </span>
                      <span className="text-xs text-zinc-500 leading-relaxed">{mode.desc}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Data Matrix Integrity */}
        <section className="lg:col-span-12 flex flex-col gap-6">
          <div className="bg-onyx-surface border border-white/5 rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
              <div className="p-2 bg-white/5 rounded-lg">
                <Database className="w-5 h-5 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] text-white">Data Matrix Integrity</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Health Indicator */}
              <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Local DB Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-recovery-green shadow-[0_0_8px_rgba(0,255,102,0.8)]"></div>
                    <span className="font-mono text-[10px] text-recovery-green font-bold">OPTIMAL</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between font-mono text-xs text-zinc-500">
                    <span>Sync Latency:</span>
                    <span className="text-white">12ms</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs text-zinc-500">
                    <span>Encrypted Volume:</span>
                    <span className="text-white">1.4GB</span>
                  </div>
                </div>
              </div>

              {/* Privacy Toggles */}
              <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-center gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-mono text-sm text-white mb-1 font-bold">Telemetry Masking</span>
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-widest">Scrub metadata before sync.</span>
                  </div>
                  <button 
                    onClick={() => handleUpdate('telemetryMasking', !localProfile.telemetryMasking)}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      localProfile.telemetryMasking ? "bg-focus-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-black transition-all",
                      localProfile.telemetryMasking ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
                <div className="w-full h-px bg-white/5"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-mono text-sm text-white mb-1 font-bold">Stealth Mode</span>
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-widest">Hide network presence.</span>
                  </div>
                  <button 
                    onClick={() => handleUpdate('stealthMode', !localProfile.stealthMode)}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      localProfile.stealthMode ? "bg-focus-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-black transition-all",
                      localProfile.stealthMode ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
              </div>

              {/* Export Actions */}
              <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Cryptographic Export</span>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-6">Download localized JSON dump of entire neuro-metric history.</p>
                </div>
                <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white flex items-center justify-center gap-3">
                  <Download className="w-4 h-4" />
                  Initiate Export
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
