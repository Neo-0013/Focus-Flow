import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Clock } from 'lucide-react';
import { cn } from '../../utils';

interface HistoryDrawerProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: { id: string; timestamp: string; data: T }[];
  onSelect: (data: T) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  renderPreview: (data: T) => React.ReactNode;
}

export function HistoryDrawer<T>({ isOpen, onClose, title, entries, onSelect, onDelete, onClearAll, renderPreview }: HistoryDrawerProps<T>) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-[320px] bg-[#111111] border-l border-white/10 z-[101] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-white">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold">{title} History</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {entries.length === 0 ? (
                <div className="text-center py-10 text-white/40 text-sm flex flex-col items-center gap-3">
                  <Clock className="w-8 h-8 opacity-20" />
                  <p>No history yet for this subject.</p>
                </div>
              ) : (
                entries.map(entry => {
                  const date = new Date(entry.timestamp);
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="group relative bg-white/[0.04] border border-white/5 hover:border-indigo-500/30 rounded-xl p-3 cursor-pointer transition-all hover:bg-white/[0.06]"
                      onClick={() => onSelect(entry.data)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-white/40 font-mono">
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 rounded transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs text-white/70 line-clamp-3">
                        {renderPreview(entry.data)}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {entries.length > 0 && (
              <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                <button
                  onClick={onClearAll}
                  className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors"
                >
                  Clear All History
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
