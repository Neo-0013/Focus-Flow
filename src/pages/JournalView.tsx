import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { encryptContent, decryptContent } from '../utils/crypto';
import { Workspace, JournalEntry, Task, Goal } from '../types';
import { buildFileTree, FileTreeNode as FileNodeType } from '../utils/fileSystem';
import { format } from 'date-fns';
import axios from 'axios';

// Tiptap core
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { common, createLowlight } from 'lowlight';

// Tiptap Table
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

// Tiptap Task List
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

// Custom Components
import { BlueprintCanvas } from '../components/features/BlueprintCanvas';
import { LinkCard } from '../components/features/LinkCardNode';
import { StrictCodeBlock } from '../components/features/tiptap/StrictCodeBlock';
import { MermaidExtension } from '../components/features/tiptap/MermaidExtension';
import { TldrawExtension } from '../components/features/tiptap/TldrawExtension';
import { MathExtension } from '../components/features/tiptap/MathExtension';
import { HtmlArtifactExtension } from '../components/features/tiptap/HtmlArtifactExtension';

const lowlight = createLowlight(common);

interface JournalViewProps {
  workspace: Workspace;
  tasks: Task[];
  toggleTask: (id: string) => void;
  goals: Goal[];
  fetchGoals: () => Promise<void>;
}

export function JournalView({ workspace, fetchGoals }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ '/': true, '/Robotics': true, '/Cybersecurity': true });
  const [vaultPassword, setVaultPassword] = useState('');
  const [userFolders, setUserFolders] = useState<string[]>(['/Robotics', '/Cybersecurity', '/Personal_Sprints']);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState('Begin typing to initiate Architect analysis...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  // HTML Artifact Paste Modal
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [htmlPasteContent, setHtmlPasteContent] = useState('');
  // Table insert state
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });

  // Use a ref to hold editor so callbacks don't need it in their dep array
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // HTML Artifact insert handler
  const handleInsertHtmlArtifact = useCallback((html: string) => {
    const ed = editorRef.current;
    if (!ed || !html.trim()) return;
    ed.chain().focus().insertContent({ type: 'htmlArtifact', attrs: { html } }).run();
    setShowHtmlModal(false);
    setHtmlPasteContent('');
  }, []);

  // Slash-command input interception for /html
  const handleEditorKeyDown = useCallback((_view: any, event: KeyboardEvent) => {
    const ed = editorRef.current;
    if (event.key === 'Enter' && ed) {
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(
        Math.max(0, from - 20), from, ''
      );
      const trimmed = textBefore.trimStart();
      if (trimmed === '/html' || trimmed.endsWith('/html')) {
        const slashPos = from - '/html'.length;
        ed.chain().deleteRange({ from: slashPos, to: from }).run();
        setShowHtmlModal(true);
        event.preventDefault();
        return true;
      }
    }
    return false;
  }, []);

  // Tiptap Editor Instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Image,
      Link.configure({ openOnClick: false }),
      StrictCodeBlock.configure({ lowlight }),
      Highlight.configure({ multicolor: true }),
      LinkCard,
      MermaidExtension,
      TldrawExtension,
      MathExtension,
      HtmlArtifactExtension,
      // Table with column resizing
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      // Task List / Checklist
      TaskList.configure({
        HTMLAttributes: { class: 'task-list' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item' },
      }),
    ],
    content: currentEntry?.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (currentEntry) {
        setCurrentEntry(prev => prev ? { ...prev, content: html } : prev);
        saveEntry(html, currentEntry);
      }
    },
    editorProps: {
      handleKeyDown: handleEditorKeyDown,
      attributes: {
        class: 'prose prose-invert prose-zinc max-w-none font-["Inter"] text-zinc-300 leading-relaxed min-h-[500px] outline-none selection:bg-focus-cyan/30 selection:text-white',
      },
    },
  }, [currentEntry?.id]); 

  // Keep editorRef in sync so our pre-declaration callbacks can use it
  useEffect(() => {
    (editorRef as React.MutableRefObject<typeof editor>).current = editor;
  }, [editor]);

  useEffect(() => {
    fetchHistory();
    fetchFolders();
  }, [workspace]);

  const fetchFolders = async () => {
    try {
      const res = await axios.get(`http://localhost:3002/api/folders?workspace=${workspace}`);
      setUserFolders(res.data);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  };

  const syncFolders = async (newFolders: string[]) => {
    setUserFolders(newFolders);
    try {
      await axios.post(`http://localhost:3002/api/folders`, { workspace, folders: newFolders });
    } catch (err) {
      console.error("Failed to sync folders:", err);
    }
  };

  useEffect(() => {
    if (!currentEntry?.content || currentEntry.content.length < 50) return;
    const timer = setTimeout(() => {
      analyzeDocument(currentEntry.content);
    }, 5000); 
    return () => clearTimeout(timer);
  }, [currentEntry?.content, currentEntry?.id]);

  const analyzeDocument = async (content: string) => {
    setIsAnalyzing(true);
    try {
      const res = await axios.post(`http://localhost:3002/journal/analyze`, { content });
      const { alignment, suggestion } = res.data;
      setAlignmentScore(alignment);
      setAiSuggestion(suggestion);
    } catch (err) { console.error('Analysis failed:', err); }
    finally { setIsAnalyzing(false); }
  };

  const handleAiSummarize = async () => {
    if (!editor || isSummarizing) return;
    
    const { from, to } = editor.state.selection;
    let contentToSummarize = '';
    
    if (from !== to) {
      contentToSummarize = editor.state.doc.textBetween(from, to, ' ');
    } else {
      contentToSummarize = editor.getText();
    }

    if (!contentToSummarize.trim()) return;

    setIsSummarizing(true);
    try {
      const res = await axios.post(`http://localhost:3002/journal/summarize`, { content: contentToSummarize });
      setSummary(res.data.summary);
      setShowSummaryModal(true);
    } catch (err) {
      console.error('Summarization failed:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const stored = localStorage.getItem(`focus_journal_${workspace}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          if (parsed.length > 0 && parsed[0].folder?.startsWith('/') && !parsed[0].folder.startsWith('/Vault')) {
            setCurrentEntry(parsed[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch journal history:", err);
    }
  };

  const fileTree = useMemo(() => buildFileTree(entries, userFolders), [entries, userFolders]);

  const handleSelectFile = async (entry: JournalEntry) => {
    try {
      let content = entry.content;
      if (entry.folder?.startsWith('/Vault') && vaultPassword) {
        content = await decryptContent(entry.content, vaultPassword);
      }
      setCurrentEntry({ ...entry, content });
    } catch (err) {
      console.error('Failed to load entry:', err);
    }
  };

  const saveEntry = async (contentToSave: string, targetEntry: JournalEntry) => {
    if (!targetEntry) return;
    setIsSaving(true);
    try {
      let finalContent = contentToSave;
      const isVault = targetEntry.folder?.startsWith('/Vault');
      if (isVault && vaultPassword) {
        finalContent = await encryptContent(contentToSave, vaultPassword);
      }

      const updatedEntry = { ...targetEntry, content: finalContent };
      setEntries(prev => {
        const newEntries = prev.map(e => e.id === targetEntry.id ? updatedEntry : e);
        if (!prev.find(e => e.id === targetEntry.id)) newEntries.unshift(updatedEntry);
        localStorage.setItem(`focus_journal_${workspace}`, JSON.stringify(newEntries));
        return newEntries;
      });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNestedFile = (e: React.MouseEvent, parentPath: string) => {
    e.stopPropagation();
    const fileName = prompt("Enter new file name:");
    if (!fileName) return;
    
    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      workspaceId: workspace,
      date: format(new Date(), 'yyyy-MM-dd'),
      content: `<h1>${fileName}</h1>`,
      folder: parentPath,
      title: `${fileName}.md`,
      tags: [],
      attachments: []
    };
    
    setEntries(prev => {
      const newEntries = [newEntry, ...prev];
      localStorage.setItem(`focus_journal_${workspace}`, JSON.stringify(newEntries));
      return newEntries;
    });
    setExpandedFolders(prev => ({ ...prev, [parentPath]: true }));
    setCurrentEntry(newEntry);
  };

  const handleCreateNestedFolder = (e: React.MouseEvent, parentPath: string) => {
    e.stopPropagation();
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const newPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
    if (!userFolders.includes(newPath)) {
      const newFolders = [...userFolders, newPath];
      syncFolders(newFolders);
      setExpandedFolders(prev => ({ ...prev, [parentPath]: true, [newPath]: true }));
    }
  };

  const handleDeleteEntry = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this file?')) {
      setEntries(prev => {
        const newEntries = prev.filter(entry => entry.id !== id);
        localStorage.setItem(`focus_journal_${workspace}`, JSON.stringify(newEntries));
        if (currentEntry?.id === id) {
          setCurrentEntry(newEntries.length > 0 ? newEntries[0] : null);
        }
        return newEntries;
      });
    }
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the folder ${folderPath} and all its contents?`)) {
      setEntries(prev => {
        const newEntries = prev.filter(entry => !entry.folder?.startsWith(folderPath));
        localStorage.setItem(`focus_journal_${workspace}`, JSON.stringify(newEntries));
        if (currentEntry && currentEntry.folder?.startsWith(folderPath)) {
          setCurrentEntry(newEntries.length > 0 ? newEntries[0] : null);
        }
        return newEntries;
      });
      syncFolders(userFolders.filter(f => !f.startsWith(folderPath)));
    }
  };

  const handleBlueprintSave = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, `blueprint-${Date.now()}.png`);
    try {
      const res = await axios.post(`http://localhost:3002/journal/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { url } = res.data;
      if (editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    } catch (err) { console.error('Upload failed:', err); }
  };

  const handleInsertLinkCard = () => {
    if (!editor) return;
    const url = prompt("Enter YouTube or External Link URL:");
    if (url) {
      editor.chain().focus().insertContent({ type: 'linkCard', attrs: { url } }).run();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`http://localhost:3002/journal/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { url } = res.data;
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) { console.error('Upload failed:', err); }
  };

  const handleFileDrop = (fileId: string, targetFolderPath: string) => {
    setEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === fileId) {
          return { ...entry, folder: targetFolderPath };
        }
        return entry;
      });
      localStorage.setItem(`focus_journal_${workspace}`, JSON.stringify(updated));
      return updated;
    });
  };

  const renderFileTree = (nodes: FileNodeType[]) => {
    return nodes.map(node => {
      if (node.type === 'folder') {
        const isExpanded = expandedFolders[node.path];
        return (
          <div key={node.path} className="space-y-1">
            <div 
              className="flex items-center justify-between text-xs text-zinc-400 group cursor-pointer p-1 rounded-sm hover:bg-white/5"
              onClick={() => setExpandedFolders(p => ({...p, [node.path]: !isExpanded}))}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-focus-cyan/10');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-focus-cyan/10');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-focus-cyan/10');
                const fileId = e.dataTransfer.getData('fileId');
                if (fileId) handleFileDrop(fileId, node.path);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-sm ${node.name.includes('Cyber') ? 'text-velocity-purple' : 'text-performance-gold'}`} data-icon="folder">
                  {isExpanded ? 'folder_open' : 'folder'}
                </span>
                <span className="uppercase tracking-wider">{node.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => handleCreateNestedFile(e, node.path)} className="text-zinc-600 hover:text-focus-cyan" title="New File">
                  <span className="material-symbols-outlined text-[14px]" data-icon="note_add">note_add</span>
                </button>
                <button onClick={(e) => handleCreateNestedFolder(e, node.path)} className="text-zinc-600 hover:text-focus-cyan" title="New Folder">
                  <span className="material-symbols-outlined text-[14px]" data-icon="create_new_folder">create_new_folder</span>
                </button>
                <button onClick={(e) => handleDeleteFolder(e, node.path)} className="text-zinc-600 hover:text-error" title="Delete Folder">
                  <span className="material-symbols-outlined text-[14px]" data-icon="delete">delete</span>
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="pl-4 space-y-2 mt-2">
                {renderFileTree(node.children)}
              </div>
            )}
          </div>
        );
      }
      
      const isActive = currentEntry?.id === node.id;
      return (
        <div 
          key={node.id}
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.setData('fileId', node.id || '');
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => node.entry && handleSelectFile(node.entry)}
          className={`flex items-center justify-between text-xs py-1.5 px-3 rounded-sm border-r-2 cursor-pointer transition-all group ${isActive ? 'text-focus-cyan bg-focus-cyan/10 border-focus-cyan -mr-6 font-bold' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-sm shrink-0" data-icon="description">description</span>
            <span className="uppercase tracking-wider truncate">{node.name}</span>
          </div>
          <button 
            onClick={(e) => node.entry && handleDeleteEntry(e, node.entry.id)} 
            className={`opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'text-focus-cyan hover:text-error' : 'text-zinc-600 hover:text-error'}`}
            title="Delete File"
          >
            <span className="material-symbols-outlined text-[14px]" data-icon="delete">delete</span>
          </button>
        </div>
      );
    });
  };

  const wordCount = useMemo(() => {
    if (!currentEntry?.content) return 0;
    const text = currentEntry.content.replace(/<[^>]*>?/gm, '');
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, [currentEntry?.content]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full bg-midnight-base text-on-surface font-body-md w-full relative z-10">
      
      {/* Removed Internal TopAppBar */}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex flex-col h-full w-64 hidden lg:flex bg-[#0a0a0a] border-r border-white/5 shrink-0">
          <div className="p-6 overflow-y-auto flex-1">
            <div className="mb-8 px-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Filesystem</p>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => handleCreateNestedFile(e, '/')} className="text-zinc-500 hover:text-focus-cyan" title="New File">
                    <span className="material-symbols-outlined text-sm" data-icon="note_add">note_add</span>
                  </button>
                  <button onClick={(e) => handleCreateNestedFolder(e, '/')} className="text-zinc-500 hover:text-focus-cyan" title="New Folder">
                    <span className="material-symbols-outlined text-sm" data-icon="create_new_folder">create_new_folder</span>
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {renderFileTree(fileTree)}
              </div>
            </div>
          </div>
          
          <div className="mt-auto p-6">
            <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-zinc-500 font-mono-data">SYNC_STATUS</span>
                <span className="text-[9px] text-recovery-green font-mono-data">{isSaving ? 'SYNCING...' : 'UP-TO-DATE'}</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full bg-recovery-green w-full ${isSaving ? 'animate-pulse' : ''}`}></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 flex overflow-hidden h-full editor-container flex-col relative">
          {currentEntry ? (
            <>
              {/* Breadcrumbs */}
              <div className="h-12 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-900/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-mono-data text-zinc-500 uppercase tracking-widest">
                  <span className="hover:text-focus-cyan cursor-pointer">{currentEntry.folder?.replace('/', '')}</span>
                  <span className="material-symbols-outlined text-[10px]" data-icon="chevron_right">chevron_right</span>
                  <span className="text-zinc-800 font-bold">{currentEntry.title}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[9px] text-focus-cyan font-bold bg-focus-cyan/10 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 bg-focus-cyan rounded-full animate-pulse"></span>
                    {isSaving ? 'SAVING' : 'EDITING'}
                  </span>
                </div>
              </div>

              {/* Tiptap Toolbar */}
              {editor && (
                <div className="h-auto min-h-12 border-b border-white/5 flex items-center flex-wrap px-4 gap-0.5 bg-[#0a0a0a] shrink-0 py-1.5">
                  <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">format_bold</span>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">format_italic</span>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('underline') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">format_underlined</span>
                  </button>
                  
                  <div className="w-px h-4 bg-white/10 mx-1"></div>
                  
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded transition-colors ${editor.isActive('heading') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">title</span>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('highlight') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">ink_highlighter</span>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('codeBlock') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined text-[20px]">terminal</span>
                  </button>
                  <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`} title="Bullet List">
                    <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                  </button>
                  
                  <div className="w-px h-4 bg-white/10 mx-1"></div>

                  {/* ── Task Checklist Button ── */}
                  <button
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    className={`p-1.5 rounded transition-colors flex items-center gap-1 ${editor.isActive('taskList') ? 'bg-focus-cyan/20 text-focus-cyan' : 'text-zinc-500 hover:bg-white/5 hover:text-focus-cyan'}`}
                    title="Checklist — check/uncheck items inline"
                  >
                    <span className="material-symbols-outlined text-[20px]">checklist</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Tasks</span>
                  </button>

                  {/* ── Table Button with Grid Picker ── */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTablePicker(v => !v)}
                      className={`p-1.5 rounded transition-colors flex items-center gap-1 ${editor.isActive('table') ? 'bg-performance-gold/20 text-performance-gold' : 'text-zinc-500 hover:bg-white/5 hover:text-performance-gold'}`}
                      title="Insert / Edit Table"
                    >
                      <span className="material-symbols-outlined text-[20px]">table_chart</span>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Table</span>
                    </button>

                    {/* Grid Picker Dropdown */}
                    <AnimatePresence>
                      {showTablePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-2 z-[200] bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-2xl shadow-black/60 min-w-[200px]"
                          onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                        >
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2 text-center">
                            {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols} table` : 'Drag to pick size'}
                          </p>
                          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                            {Array.from({ length: 6 * 8 }, (_, i) => {
                              const r = Math.floor(i / 8) + 1;
                              const c = (i % 8) + 1;
                              const isHighlighted = r <= tableHover.rows && c <= tableHover.cols;
                              return (
                                <div
                                  key={i}
                                  className={`w-5 h-5 rounded-sm border cursor-pointer transition-all ${isHighlighted ? 'bg-performance-gold/50 border-performance-gold' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                  onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                                  onClick={() => {
                                    editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run();
                                    setShowTablePicker(false);
                                    setTableHover({ rows: 0, cols: 0 });
                                  }}
                                />
                              );
                            })}
                          </div>
                          {/* Table context actions (when cursor is inside a table) */}
                          {editor.isActive('table') && (
                            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-1">
                              <button onClick={() => editor.chain().focus().addRowAfter().run()} className="text-[9px] text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 py-1 px-2 rounded transition-colors">+ Row</button>
                              <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-[9px] text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 py-1 px-2 rounded transition-colors">+ Col</button>
                              <button onClick={() => editor.chain().focus().deleteRow().run()} className="text-[9px] text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 py-1 px-2 rounded transition-colors">− Row</button>
                              <button onClick={() => editor.chain().focus().deleteColumn().run()} className="text-[9px] text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 py-1 px-2 rounded transition-colors">− Col</button>
                              <button onClick={() => editor.chain().focus().mergeCells().run()} className="text-[9px] text-performance-gold hover:text-yellow-300 bg-performance-gold/5 hover:bg-performance-gold/10 py-1 px-2 rounded transition-colors">Merge</button>
                              <button onClick={() => editor.chain().focus().splitCell().run()} className="text-[9px] text-performance-gold hover:text-yellow-300 bg-performance-gold/5 hover:bg-performance-gold/10 py-1 px-2 rounded transition-colors">Split</button>
                              <button onClick={() => editor.chain().focus().deleteTable().run()} className="col-span-2 text-[9px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 py-1 px-2 rounded transition-colors">Delete Table</button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="w-px h-4 bg-white/10 mx-1"></div>
                  
                  <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-zinc-500 hover:bg-white/5 hover:text-focus-cyan rounded transition-colors" title="Upload Image">
                    <span className="material-symbols-outlined text-[20px]">image</span>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <button onClick={() => editor.chain().focus().insertContent({ type: 'mermaid' }).run()} className="p-1.5 text-zinc-500 hover:bg-white/5 hover:text-focus-cyan rounded transition-colors" title="Add Mermaid Diagram">
                    <span className="material-symbols-outlined text-[20px]">schema</span>
                  </button>
                  <button onClick={() => editor.chain().focus().insertContent({ type: 'tldraw' }).run()} className="p-1.5 text-zinc-500 hover:bg-white/5 hover:text-focus-cyan rounded transition-colors" title="Engineering Canvas (tldraw)">
                    <span className="material-symbols-outlined text-[20px]">architecture</span>
                  </button>
                  <button onClick={() => editor.chain().focus().insertContent({ type: 'math' }).run()} className="p-1.5 text-zinc-500 hover:bg-white/5 hover:text-focus-cyan rounded transition-colors" title="Robotics Math (KaTeX)">
                    <span className="material-symbols-outlined text-[20px]">functions</span>
                  </button>
                  <button onClick={handleInsertLinkCard} className="p-1.5 text-zinc-500 hover:bg-white/5 hover:text-focus-cyan rounded transition-colors" title="Add Link Card">
                    <span className="material-symbols-outlined text-[20px]">link</span>
                  </button>

                  {/* ── HTML Artifact Button ── */}
                  <button
                    onClick={() => setShowHtmlModal(true)}
                    className="p-1.5 flex items-center gap-1 rounded transition-all text-violet-400 hover:bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40"
                    title="HTML Artifact — paste Claude HTML (or type /html)"
                  >
                    <span className="material-symbols-outlined text-[20px]">web</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">HTML</span>
                  </button>

                  <button 
                    onClick={handleAiSummarize} 
                    disabled={isSummarizing}
                    className={`p-1.5 flex items-center gap-1 rounded transition-all ${isSummarizing ? 'opacity-50' : 'text-velocity-purple hover:bg-velocity-purple/5'}`} 
                    title="AI Summary"
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isSummarizing ? 'animate-spin' : ''}`} data-icon="auto_awesome">auto_awesome</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">AI Summary</span>
                  </button>
                </div>
              )}

              {/* Editor Surface */}
              <div className="flex-1 overflow-y-auto px-12 py-12 bg-[#0f0f11] scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                <div className="max-w-4xl mx-auto p-10 rounded-3xl bg-zinc-900/20 border border-white/5 hover:border-white/10 hover:shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all duration-700 group/surface relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-focus-cyan/5 to-transparent opacity-0 group-hover/surface:opacity-100 transition-opacity duration-1000 pointer-events-none rounded-3xl"></div>
                  <input 
                    type="text"
                    value={currentEntry.title.replace('.md', '')}
                    onChange={(e) => setCurrentEntry({...currentEntry, title: e.target.value + '.md'})}
                    className="text-5xl font-bold font-['Space_Grotesk'] text-white mb-10 w-full bg-transparent border-none outline-none focus:ring-0 p-0 tracking-tight"
                    placeholder="Document Title"
                  />
                  <div className="relative z-10">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </div>
              
              <BlueprintCanvas 
                isOpen={showBlueprint} 
                onClose={() => setShowBlueprint(false)} 
                onSave={handleBlueprintSave} 
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 font-mono text-sm">
              No document selected
            </div>
          )}
        </main>

        {/* Right Sidebar: Document Intelligence */}
        <aside className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col shrink-0 hidden xl:flex">
          <div className="p-6">
            <h3 className="text-[11px] font-['Space_Grotesk'] uppercase tracking-[0.2em] text-zinc-500 mb-6 font-bold">Document Intelligence</h3>
            
            <div className="space-y-4">
              {/* Integrity Status */}
              <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-sm shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-mono-data text-zinc-500 uppercase">Integrity Status</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-recovery-green/10 border border-recovery-green/30 rounded-full" title="Zero-Knowledge Active">
                      <span className="material-symbols-outlined text-[10px] text-recovery-green" data-icon="lock">lock</span>
                    </div>
                    <span className="text-recovery-green material-symbols-outlined text-sm" data-icon="verified">verified</span>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] text-zinc-400 uppercase">Last Edited</p>
                    <p className="text-xs font-bold text-zinc-900">{format(new Date(), 'hh:mm a')}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] text-zinc-400 uppercase">Words</p>
                    <p className="text-xs font-bold text-zinc-900">{wordCount}</p>
                  </div>
                </div>
              </div>

              {/* Strategy Alignment */}
              <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-sm shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-mono-data text-zinc-500 uppercase">Architect Strategy Alignment</p>
                  {isAnalyzing && <span className="w-2 h-2 bg-focus-cyan rounded-full animate-ping"></span>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-focus-cyan h-full transition-all duration-1000" 
                      style={{ width: `${alignmentScore}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-mono-data text-focus-cyan font-bold">{alignmentScore}%</span>
                </div>
                <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">
                  {alignmentScore > 80 ? 'Optimal' : alignmentScore > 50 ? 'Developing' : 'Fragmented'} alignment with <span className="font-bold text-zinc-900">"Project Objective: Alpha"</span>
                </p>
              </div>

              {/* AI Suggestion */}
              <div className="p-4 bg-focus-cyan/5 border border-focus-cyan/20 rounded-sm min-h-[100px] flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-focus-cyan text-sm" data-icon="lightbulb">lightbulb</span>
                  <span className="text-[10px] font-bold text-focus-cyan uppercase tracking-wider">AI Suggestion</span>
                </div>
                <p className="text-[11px] text-zinc-700 leading-relaxed italic">
                  "{aiSuggestion}"
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-white/5 grid grid-cols-3 gap-2">
            <button className="aspect-square flex flex-col items-center justify-center rounded-sm bg-zinc-900/40 border border-white/5 hover:border-focus-cyan hover:text-focus-cyan transition-all group">
              <span className="material-symbols-outlined text-lg" data-icon="monitoring">monitoring</span>
              <span className="text-[8px] font-mono-data uppercase mt-1">Metric</span>
            </button>
            <button className="aspect-square flex flex-col items-center justify-center rounded-sm bg-zinc-900/40 border border-white/5 hover:border-performance-gold hover:text-performance-gold transition-all">
              <span className="material-symbols-outlined text-lg" data-icon="psychology">psychology</span>
              <span className="text-[8px] font-mono-data uppercase mt-1">Synth</span>
            </button>
            <button className="aspect-square flex flex-col items-center justify-center rounded-sm bg-zinc-900/40 border border-white/5 hover:border-velocity-purple hover:text-velocity-purple transition-all">
              <span className="material-symbols-outlined text-lg" data-icon="hub">hub</span>
              <span className="text-[8px] font-mono-data uppercase mt-1">Node</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-panel border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button onClick={() => setShowSummaryModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-velocity-purple/20 flex items-center justify-center border border-velocity-purple/30">
                <span className="material-symbols-outlined text-velocity-purple">auto_awesome</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Architect Summary</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Document Intelligence</p>
              </div>
            </div>
            <div className="prose prose-invert prose-sm">
              <p className="text-zinc-300 leading-relaxed italic border-l-2 border-velocity-purple/30 pl-4 py-1 whitespace-pre-wrap">
                {summary}
              </p>
            </div>
            <button 
              onClick={() => setShowSummaryModal(false)}
              className="w-full mt-8 py-3 bg-velocity-purple text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Acknowledged
            </button>
          </div>
        </div>
      )}

      {/* ── HTML Artifact Paste Modal ── */}
      <AnimatePresence>
        {showHtmlModal && (
          <motion.div
            key="html-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-lg"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowHtmlModal(false); setHtmlPasteContent(''); } }}
          >
            <motion.div
              key="html-modal-panel"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-zinc-950 border border-violet-500/30 rounded-2xl w-full max-w-3xl shadow-2xl shadow-violet-900/20 overflow-hidden flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-900/30 to-fuchsia-900/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <span className="material-symbols-outlined text-white text-[18px]">web</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">HTML Artifact Viewer</h3>
                    <p className="text-[10px] text-violet-300 uppercase tracking-widest font-bold">Paste a Claude HTML file below</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowHtmlModal(false); setHtmlPasteContent(''); }}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Tip bar */}
              <div className="px-6 py-2 bg-violet-500/10 border-b border-violet-500/20 shrink-0">
                <p className="text-[10px] text-violet-300 font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-[13px]">lightbulb</span>
                  Paste the complete <code className="bg-violet-500/20 px-1 rounded">{'<!DOCTYPE html>...'}</code> document from Claude — all JS, CSS, and interactivity will work live.
                  You can also type <code className="bg-violet-500/20 px-1 rounded">/html</code> in the editor and press Enter.
                </p>
              </div>

              {/* Paste Area */}
              <div className="flex-1 overflow-hidden p-4 min-h-[200px]">
                <textarea
                  autoFocus
                  className="w-full h-full min-h-[250px] bg-zinc-900 text-[12px] text-green-300 font-mono p-4 rounded-xl border border-white/10 focus:border-violet-500/60 focus:outline-none resize-none leading-relaxed placeholder:text-zinc-700 transition-colors"
                  value={htmlPasteContent}
                  onChange={(e) => setHtmlPasteContent(e.target.value)}
                  placeholder={"<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body><!-- Paste your Claude HTML here --></body>\n</html>"}
                  spellCheck={false}
                />
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-zinc-950 shrink-0">
                <span className="text-[10px] text-zinc-600 font-mono">
                  {htmlPasteContent.split('\n').length} lines · {htmlPasteContent.length.toLocaleString()} chars
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowHtmlModal(false); setHtmlPasteContent(''); }}
                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleInsertHtmlArtifact(htmlPasteContent)}
                    disabled={!htmlPasteContent.trim()}
                    className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl transition-all shadow-lg shadow-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                    Embed Artifact
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
