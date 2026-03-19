import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import axios from 'axios';
import { Workspace } from '../types';

interface JournalViewProps {
  workspace: Workspace;
}

export function JournalView({ workspace }: JournalViewProps) {
  const [content, setContent] = useState('');
  const [entryId, setEntryId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const date = format(new Date(), 'yyyy-MM-dd');
        const res = await axios.get(`http://localhost:3002/journal?workspace=${workspace}&date=${date}`);
        setContent(res.data.content || '');
        setEntryId(res.data.id);
      } catch (err) {}
    };
    fetchToday();
  }, [workspace]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await axios.post('http://localhost:3002/journal', {
          id: entryId,
          workspaceId: workspace,
          date: format(new Date(), 'yyyy-MM-dd'),
          content: val
        });
        setIsSaving(false);
      } catch (err) {}
    }, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3"><BookOpen className="w-8 h-8 text-accent" /> Daily Journal</h1>
          <p className="text-white/40 mt-2 font-medium">Reflect on your day in the {workspace} workspace.</p>
        </div>
        <div className="text-sm font-bold text-white/20 uppercase tracking-widest">
          {isSaving ? 'Saving...' : 'Saved'}
        </div>
      </div>
      <div className="flex-1 bg-panel border border-white/5 rounded-3xl p-8 shadow-2xl relative">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="What's on your mind today? Write down meeting notes, thoughts, or daily reflections..."
          className="w-full h-full bg-transparent resize-none outline-none text-lg text-white/80 placeholder:text-white/20 leading-relaxed font-serif"
        />
      </div>
    </motion.div>
  );
}
