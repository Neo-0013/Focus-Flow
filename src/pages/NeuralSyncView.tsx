import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { MemoryStick, Waves, Blend, Link, Lock, Globe } from 'lucide-react';
import { NeuralSector } from '../types';
import { cn } from '../utils/index';

const API_BASE = 'http://localhost:3002';
const socket: Socket = io(API_BASE);

const ICONS: Record<string, any> = {
  'memory': MemoryStick,
  'waves': Waves,
  'blur_on': Blend
};

interface NeuralSyncProps {
  showToast: (title: string, body: string, type?: string) => void;
}

export function NeuralSyncView({ showToast }: NeuralSyncProps) {
  const [sectors, setSectors] = useState<NeuralSector[]>([]);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(432);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [totalNodes, setTotalNodes] = useState(0);

  useEffect(() => {
    fetchSectors();

    socket.on('neuralSectorsUpdated', (updatedSectors: NeuralSector[]) => {
      setSectors(updatedSectors);
      setTotalNodes(updatedSectors.reduce((acc, s) => acc + s.activeNodes, 0) + 1000); // Base nodes for simulation
    });

    socket.on('neuralPulse', (data: { frequency: number }) => {
      setFrequency(data.frequency);
    });

    return () => {
      socket.off('neuralSectorsUpdated');
      socket.off('neuralPulse');
      if (activeSector) {
        axios.post(`${API_BASE}/neural/leave`, { sectorId: activeSector }).catch(console.error);
      }
    };
  }, [activeSector]);

  const fetchSectors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/neural/sectors`);
      setSectors(res.data);
      setTotalNodes(res.data.reduce((acc: number, s: NeuralSector) => acc + s.activeNodes, 0) + 1042);
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinSector = async (sectorId: string) => {
    if (activeSector === sectorId) return;
    
    try {
      if (activeSector) {
        await axios.post(`${API_BASE}/neural/leave`, { sectorId: activeSector });
      }
      
      await axios.post(`${API_BASE}/neural/join`, { sectorId });
      setActiveSector(sectorId);
      showToast('Neural Link Established', `Successfully connected to sector.`, 'success');
    } catch (err) {
      showToast('Connection Failed', 'Could not establish neural link.', 'error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col xl:flex-row gap-6 min-h-full max-w-[1600px] mx-auto pb-24 relative">
      {/* Radial glow background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-focus-cyan/5 via-transparent to-transparent opacity-50 z-0"></div>
      
      {/* Left Column: Virtual Rooms & Global Pulse */}
      <div className="flex-1 flex flex-col gap-8 z-10">
        <header className="flex flex-col gap-1">
          <h2 className="text-4xl font-bold font-['Space_Grotesk'] text-white tracking-tight">Neural Sync</h2>
          <p className="text-white/60 font-['Inter']">P2P Deep Work Environment</p>
        </header>

        {/* Focus Libraries Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold font-['Space_Grotesk'] uppercase tracking-widest text-white/40">Active Sectors</h3>
            <span className="font-mono text-sm text-focus-cyan flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-focus-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-focus-cyan"></span>
              </span>
              {totalNodes.toLocaleString()} Nodes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {sectors.map(sector => {
              const Icon = ICONS[sector.icon] || MemoryStick;
              const isActive = activeSector === sector.id;
              
              return (
                <div 
                  key={sector.id}
                  className={cn(
                    "backdrop-blur-xl p-5 rounded-xl transition-all group relative overflow-hidden flex flex-col justify-between min-h-[160px]",
                    isActive 
                      ? "bg-focus-cyan/5 border-2 border-focus-cyan shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]" 
                      : "bg-black/40 border border-white/10 hover:border-focus-cyan/50"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={cn("text-xl font-bold font-['Space_Grotesk'] transition-colors", isActive ? "text-focus-cyan" : "text-white group-hover:text-focus-cyan")}>
                        {sector.name}
                      </h4>
                      <p className="text-sm text-white/50 mt-1">{sector.description}</p>
                    </div>
                    <Icon className={cn("w-5 h-5 transition-opacity", isActive ? "text-focus-cyan" : "text-white/30 group-hover:opacity-100 opacity-50")} />
                  </div>
                  
                  <div className="flex flex-col gap-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 items-center">
                        {[...Array(Math.min(5, sector.activeNodes))].map((_, i) => (
                          <div key={i} className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,240,255,0.8)]", isActive ? "bg-focus-cyan" : "bg-focus-cyan/50")}></div>
                        ))}
                        {[...Array(Math.max(0, 5 - sector.activeNodes))].map((_, i) => (
                          <div key={`e-${i}`} className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                        ))}
                        <span className="font-mono text-[10px] text-white/40 ml-2">{sector.activeNodes} ACTIVE</span>
                      </div>
                      <span className={cn("font-mono font-bold", isActive ? "text-focus-cyan" : "text-white/50")}>{sector.baseTime}:00</span>
                    </div>
                    <button 
                      onClick={() => handleJoinSector(sector.id)}
                      className={cn(
                        "w-full py-2.5 border rounded text-center text-[10px] font-bold font-['Space_Grotesk'] tracking-widest transition-colors uppercase",
                        isActive 
                          ? "bg-focus-cyan text-black border-focus-cyan" 
                          : "border-white/10 text-white hover:bg-white/5"
                      )}
                    >
                      {isActive ? 'SECTOR ACTIVE' : 'ENTER SECTOR'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Pulse Visualizer */}
        <div className="mt-auto h-48 bg-black/50 border border-white/5 rounded-2xl relative overflow-hidden flex flex-col justify-between p-5 group backdrop-blur-xl">
          <div className="flex justify-between items-center z-10 relative">
            <div className="text-xs font-bold font-['Space_Grotesk'] text-white/40 flex items-center gap-2 uppercase tracking-widest">
              <Globe className="w-4 h-4 text-focus-cyan" />
              Global Neural Pulse
            </div>
            <div className="font-mono text-focus-cyan bg-focus-cyan/10 px-3 py-1 rounded border border-focus-cyan/20 text-xs font-bold">
              FREQ: {frequency} Hz
            </div>
          </div>
          
          {/* Abstract Wave SVG (simulated visualizer) */}
          <div className="absolute inset-0 flex items-end opacity-60 group-hover:opacity-100 transition-opacity duration-1000">
            <svg className="w-full h-32" preserveAspectRatio="none" viewBox="0 0 1000 100">
              <path d="M0,100 C150,80 300,100 450,40 C600,-20 750,80 1000,20 L1000,100 Z" fill="url(#cyan-gradient)" opacity="0.4"></path>
              <path d={`M0,100 C200,90 350,60 500,${60 + (frequency%10)} C650,60 800,20 1000,50 L1000,100 Z`} fill="none" stroke="#00F0FF" strokeWidth="1.5" style={{filter: 'drop-shadow(0 0 4px #00F0FF)'}}></path>
              <path d="M0,100 C250,70 400,90 550,50 C700,10 850,60 1000,30 L1000,100 Z" fill="none" opacity="0.5" stroke="#7000FF" strokeWidth="1"></path>
              <defs>
                <linearGradient id="cyan-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.3"></stop>
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Right Column: Accountability Node */}
      <aside className="w-full xl:w-96 flex flex-col gap-6 shrink-0 z-10">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col h-full relative overflow-hidden">
          {/* Glassmorphism subtle inner glow */}
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] pointer-events-none"></div>
          
          <h3 className="text-xs font-bold font-['Space_Grotesk'] text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
            <Link className="w-4 h-4" />
            Accountability Node
          </h3>
          
          {/* Partner Status */}
          <div className="flex items-center gap-5 mb-10 relative z-10">
            <div className="w-16 h-16 rounded-xl bg-white/5 border-2 border-focus-cyan/50 overflow-hidden relative shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <img 
                alt="Partner" 
                className="w-full h-full object-cover mix-blend-luminosity opacity-80" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCR0LsSCEyp2dhbNIolVTXKaLNs_0qWwRDAXgiVH__40Msv4rEmAxE56lkP60feM_DApGHOTzVJA8bZOMYt_aijbNow7_tZT53-SDTe9Gywn-zDbuA1D5HbObmpQZefJrNgySEH_hfeNK8ePKjAnAwMs1kyygfAw0w3ByNbF-3RVycVHeXpSjEFjq0FraYwuLf4TB9TYhUvtYHEFqGfz7tnTOyORkZZsjJAsZWTzxZKuLBt-Dp9HAn_768VFaoA3_1ueOVKY3QxU1E"
              />
              <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] border-2 border-black"></div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-lg font-bold text-white tracking-tight">Operator_09</h4>
                <span className={cn(
                  "font-mono text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest",
                  isLockedIn ? "text-focus-cyan bg-focus-cyan/10 border-focus-cyan/30" : "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                )}>
                  {isLockedIn ? 'SYNCED' : 'LOCKED'}
                </span>
              </div>
              <p className="font-mono text-xs text-white/50">Deep Work Mode</p>
            </div>
          </div>
          
          {/* Telemetry */}
          <div className="grid grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden mb-8 shadow-inner border border-white/5">
            <div className="bg-black/60 p-5 flex flex-col gap-2">
              <span className="text-[9px] font-bold font-['Space_Grotesk'] uppercase tracking-widest text-white/40">SESSION T-MINUS</span>
              <span className="text-3xl font-bold font-['Space_Grotesk'] text-focus-cyan">28:45</span>
            </div>
            <div className="bg-black/60 p-5 flex flex-col gap-2">
              <span className="text-[9px] font-bold font-['Space_Grotesk'] uppercase tracking-widest text-white/40">SYNC QUALITY</span>
              <span className="text-3xl font-bold font-['Space_Grotesk'] text-white">
                98.4<span className="text-lg text-white/40">%</span>
              </span>
            </div>
            <div className="bg-black/60 p-5 flex flex-col gap-3 col-span-2 border-t border-white/5">
              <span className="text-[9px] font-bold font-['Space_Grotesk'] uppercase tracking-widest text-white/40 flex justify-between">
                <span>COGNITIVE LOAD TARGET</span>
                <span className="text-focus-cyan">HIGH</span>
              </span>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                <div className="h-full bg-focus-cyan w-3/4 shadow-[0_0_10px_rgba(0,240,255,0.8)]"></div>
              </div>
            </div>
          </div>
          
          {/* Action Button */}
          <div className="mt-auto pt-4 relative z-10">
            <button 
              onClick={() => {
                setIsLockedIn(!isLockedIn);
                showToast('Telemetry Update', isLockedIn ? 'Neural sync decoupled.' : 'Lock-in initiated. Sync active.', 'info');
              }}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-xs font-['Space_Grotesk'] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 group active:scale-[0.98] border",
                isLockedIn 
                  ? "bg-focus-cyan text-black border-focus-cyan shadow-[0_0_20px_rgba(0,240,255,0.3)]" 
                  : "bg-transparent border-focus-cyan/50 text-focus-cyan hover:bg-focus-cyan/10 shadow-[inset_0_0_15px_rgba(0,240,255,0.05)] hover:shadow-[0_0_25px_rgba(0,240,255,0.2)]"
              )}
            >
              <Lock className={cn("w-4 h-4", isLockedIn ? "" : "group-hover:animate-pulse")} />
              {isLockedIn ? 'ABORT SYNC' : 'INITIATE LOCK-IN'}
            </button>
          </div>
        </div>
      </aside>
    </motion.div>
  );
}
