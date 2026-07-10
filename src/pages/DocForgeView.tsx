import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  FileText, Plus, Trash2, Download, Sparkles, ChevronRight, ChevronLeft,
  BookOpen, Briefcase, FlaskConical, ClipboardList, User,
  Settings, X, RefreshCw, Copy, Wand2, AlignLeft,
  Search, Clock, Hash,
  GraduationCap, Scroll
} from 'lucide-react';

import { cn } from '../utils/index';
import { DocForgeToolbar } from '../components/features/DocForgeToolbar';

// ─────────────────────────── Types ──────────────────────────────
interface DocForgeDoc {
  id: string;
  title: string;
  type: DocType;
  content: string;
  settings: DocSettings;
  createdAt: number;
  updatedAt: number;
}

interface DocSettings {
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number;
  lineSpacing: number;
  pageSize: 'a4' | 'letter';
  showHeader: boolean;
  showFooter: boolean;
  headerText: string;
  footerText: string;
  authorName: string;
  subjectLine: string;
  institution: string;
  theme: 'blue' | 'purple' | 'green' | 'red' | 'dark';
}

type DocType = 'assignment' | 'report' | 'cover_letter' | 'resume' | 'lab_report' | 'meeting_notes' | 'blank';

interface AiConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

interface Props {
  aiConfig: AiConfig;
  showToast: (title: string, body: string, type?: string) => void;
}

// ─────────────────────────── Templates ──────────────────────────────
const TEMPLATES: { type: DocType; label: string; icon: React.FC<any>; color: string; gradient: string; description: string; content: string }[] = [
  {
    type: 'assignment',
    label: 'Assignment',
    icon: GraduationCap,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-blue-600/10',
    description: 'Academic assignment with questions & answers',
    content: `<h1>Assignment Title</h1>
<p><strong>Student Name:</strong> [Your Name]</p>
<p><strong>Subject:</strong> [Subject Name]</p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p><strong>Instructor:</strong> [Instructor Name]</p>
<hr/>
<h2>Question 1</h2>
<p>[Write your question here]</p>
<h3>Answer</h3>
<p>[Write your answer here. Be thorough and detailed in your explanation, providing evidence and examples where appropriate.]</p>
<h2>Question 2</h2>
<p>[Write your question here]</p>
<h3>Answer</h3>
<p>[Write your answer here.]</p>
<h2>Conclusion</h2>
<p>[Summarize your findings and key takeaways from this assignment.]</p>
<h2>References</h2>
<ul><li>[Author, A. (Year). <em>Title of work</em>. Publisher.]</li></ul>`
  },
  {
    type: 'report',
    label: 'Academic Report',
    icon: BookOpen,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-purple-600/10',
    description: 'Full academic report with abstract & references',
    content: `<h1>Report Title</h1>
<p><strong>Author:</strong> [Your Name] &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<hr/>
<h2>Abstract</h2>
<p>[Provide a concise summary of your report in 150–250 words. Include the purpose, methods, key findings, and conclusions.]</p>
<h2>1. Introduction</h2>
<p>[Introduce the topic, state the problem or research question, and outline the scope and objectives of this report.]</p>
<h2>2. Literature Review</h2>
<p>[Review relevant existing research and literature. Discuss how your work builds upon or differs from prior studies.]</p>
<h2>3. Methodology</h2>
<p>[Describe your research methods, data collection techniques, and analytical approaches.]</p>
<h2>4. Results & Discussion</h2>
<p>[Present your findings with supporting data, charts, and analysis. Interpret what the results mean.]</p>
<h2>5. Conclusion</h2>
<p>[Summarize the key findings, their implications, and suggest areas for future research.]</p>
<h2>References</h2>
<ul>
<li>[Author, A. A., & Author, B. B. (Year). <em>Title of article</em>. <em>Title of Journal, volume</em>(issue), pages.]</li>
<li>[Author, C. (Year). <em>Title of book</em>. Publisher.]</li>
</ul>`
  },
  {
    type: 'cover_letter',
    label: 'Cover Letter',
    icon: Briefcase,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    description: 'Professional job application cover letter',
    content: `<p>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p>[Hiring Manager's Name]<br/>[Company Name]<br/>[Company Address]</p>
<p>Dear [Hiring Manager's Name],</p>
<p>I am writing to express my enthusiastic interest in the <strong>[Position Title]</strong> role at <strong>[Company Name]</strong>. With my background in [Your Field] and [X years] of experience in [Key Skill Area], I am confident that I can make a meaningful contribution to your team.</p>
<p>In my previous role at [Previous Company], I [describe a key achievement with measurable impact, e.g., "led a cross-functional team that increased client retention by 25%"]. This experience honed my abilities in [Skill 1], [Skill 2], and [Skill 3] — all of which align directly with your requirements for this position.</p>
<p>What particularly draws me to [Company Name] is [something specific about the company — mission, culture, product, etc.]. I am eager to bring my expertise in [relevant area] to help [Company Name] achieve [a specific goal related to the role or company].</p>
<p>I would welcome the opportunity to discuss how my experience and vision align with your team's needs. Please find my resume attached for your review.</p>
<p>Thank you sincerely for your time and consideration.</p>
<p>Warm regards,<br/><strong>[Your Full Name]</strong><br/>[Your Email] | [Your Phone]<br/>[LinkedIn / Portfolio URL]</p>`
  },
  {
    type: 'resume',
    label: 'Resume / CV',
    icon: User,
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-amber-600/10',
    description: 'Professional resume with all key sections',
    content: `<h1>[Your Full Name]</h1>
<p>[Email Address] &nbsp;|&nbsp; [Phone Number] &nbsp;|&nbsp; [City, Country] &nbsp;|&nbsp; [LinkedIn] &nbsp;|&nbsp; [GitHub/Portfolio]</p>
<hr/>
<h2>Professional Summary</h2>
<p>[Write 2–3 sentences describing your experience, key skills, and career objective. Tailor this to the specific role you're applying for.]</p>
<h2>Experience</h2>
<h3>[Job Title] — [Company Name]</h3>
<p><em>[Start Date] – [End Date or Present]</em> &nbsp;|&nbsp; [Location]</p>
<ul>
<li>[Accomplished X as measured by Y by doing Z]</li>
<li>[Led a team of N people to achieve ...]</li>
<li>[Implemented/Designed/Built ...]</li>
</ul>
<h3>[Previous Job Title] — [Company Name]</h3>
<p><em>[Start Date] – [End Date]</em> &nbsp;|&nbsp; [Location]</p>
<ul>
<li>[Key achievement]</li>
<li>[Key achievement]</li>
</ul>
<h2>Education</h2>
<h3>[Degree Name] — [University/Institution]</h3>
<p><em>[Year of Graduation]</em> &nbsp;|&nbsp; [GPA if notable]</p>
<h2>Skills</h2>
<p><strong>Technical:</strong> [Skill 1, Skill 2, Skill 3, Skill 4]</p>
<p><strong>Tools:</strong> [Tool 1, Tool 2, Tool 3]</p>
<p><strong>Languages:</strong> [Programming Language 1, Language 2]</p>
<h2>Certifications</h2>
<ul>
<li>[Certification Name] — [Issuing Organization] ([Year])</li>
</ul>
<h2>Projects</h2>
<h3>[Project Name]</h3>
<p>[Brief description of the project, your role, technologies used, and impact.]</p>`
  },
  {
    type: 'lab_report',
    label: 'Lab Report',
    icon: FlaskConical,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    description: 'Scientific lab report with all sections',
    content: `<h1>Laboratory Report: [Experiment Title]</h1>
<p><strong>Student:</strong> [Name] &nbsp;|&nbsp; <strong>Lab Partner:</strong> [Name]</p>
<p><strong>Course:</strong> [Course Code] &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<hr/>
<h2>Objective</h2>
<p>[State the aim of the experiment clearly. What are you trying to determine, prove, or demonstrate?]</p>
<h2>Hypothesis</h2>
<p>[State your prediction about the outcome of the experiment and the scientific reasoning behind it.]</p>
<h2>Materials & Equipment</h2>
<ul>
<li>[Item 1 — quantity/specification]</li>
<li>[Item 2 — quantity/specification]</li>
<li>[Item 3 — quantity/specification]</li>
</ul>
<h2>Procedure / Methodology</h2>
<ol>
<li>[Step 1]</li>
<li>[Step 2]</li>
<li>[Step 3]</li>
</ol>
<h2>Observations & Data</h2>
<p>[Record your raw observations and measurements here. Include data tables where appropriate.]</p>
<h2>Results & Analysis</h2>
<p>[Analyze your data. Perform calculations. Discuss trends and patterns observed.]</p>
<h2>Discussion</h2>
<p>[Interpret your results. Did they support your hypothesis? Discuss sources of error and how to improve the experiment.]</p>
<h2>Conclusion</h2>
<p>[Summarize what was learned. State whether the hypothesis was supported or refuted, and what implications this has.]</p>
<h2>References</h2>
<ul><li>[Citation 1]</li></ul>`
  },
  {
    type: 'meeting_notes',
    label: 'Meeting Notes',
    icon: ClipboardList,
    color: 'text-rose-400',
    gradient: 'from-rose-500/20 to-rose-600/10',
    description: 'Structured meeting minutes & action points',
    content: `<h1>Meeting Notes</h1>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p><strong>Time:</strong> [Start Time] – [End Time]</p>
<p><strong>Location / Platform:</strong> [Room / Zoom / Teams]</p>
<p><strong>Facilitator:</strong> [Name]</p>
<hr/>
<h2>Attendees</h2>
<ul>
<li>[Name] — [Role]</li>
<li>[Name] — [Role]</li>
<li>[Name] — [Role]</li>
</ul>
<h2>Agenda</h2>
<ol>
<li>[Agenda Item 1]</li>
<li>[Agenda Item 2]</li>
<li>[Agenda Item 3]</li>
</ol>
<h2>Discussion Notes</h2>
<h3>1. [Agenda Item 1]</h3>
<p>[Summary of discussion, decisions made, and any concerns raised.]</p>
<h3>2. [Agenda Item 2]</h3>
<p>[Summary of discussion.]</p>
<h2>Action Items</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false">[Action] — Owner: [Name] — Due: [Date]</li>
<li data-type="taskItem" data-checked="false">[Action] — Owner: [Name] — Due: [Date]</li>
</ul>
<h2>Next Meeting</h2>
<p><strong>Date:</strong> [Next meeting date and time]</p>
<p><strong>Agenda Preview:</strong> [Topics to cover]</p>`
  },
  {
    type: 'blank',
    label: 'Blank Document',
    icon: FileText,
    color: 'text-white/60',
    gradient: 'from-white/10 to-white/5',
    description: 'Start from scratch — totally free form',
    content: `<p></p>`
  }
];

// ─────────────────────────── Default Settings ──────────────────────────────
const DEFAULT_SETTINGS: DocSettings = {
  fontFamily: 'serif',
  fontSize: 12,
  lineSpacing: 1.8,
  pageSize: 'a4',
  showHeader: true,
  showFooter: true,
  headerText: '',
  footerText: '',
  authorName: '',
  subjectLine: '',
  institution: '',
  theme: 'blue',
};

const DOCFORGE_API = 'http://localhost:3001';

const THEME_OPTIONS: { value: DocSettings['theme']; label: string; color: string }[] = [
  { value: 'blue',   label: 'Ocean Blue',    color: '#1565C0' },
  { value: 'purple', label: 'Royal Purple',  color: '#7B1FA2' },
  { value: 'green',  label: 'Forest Green',  color: '#2E7D32' },
  { value: 'red',    label: 'Crimson Red',   color: '#C62828' },
  { value: 'dark',   label: 'Midnight Dark', color: '#0F3460' },
];

const FONT_FAMILIES = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

// ─────────────────────────── Storage ──────────────────────────────
const STORAGE_KEY = 'docforge_docs';

function loadDocs(): DocForgeDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDocs(docs: DocForgeDoc[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function generateId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────── AI Helper ──────────────────────────────
async function callAi(prompt: string, config: AiConfig): Promise<string> {
  if (!config.apiKey) throw new Error('No API key configured');
  
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelId.trim() || 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are an expert academic and professional writing assistant. Write clear, well-structured, authoritative content. Output only the requested content — no preamble, no explanations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });
  
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API Error (${res.status}): ${errText || res.statusText}`);
  }
  
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

// ─────────────────────────── Word Count ──────────────────────────────
function getStats(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  const chars = text.length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, chars, minutes };
}

// ════════════════════════════ MAIN COMPONENT ════════════════════════════
export function DocForgeView({ aiConfig, showToast }: Props) {
  const [docs, setDocs] = useState<DocForgeDoc[]>(loadDocs);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showDocList, setShowDocList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiMode, setAiMode] = useState<'write' | 'improve' | 'citation'>('write');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'xlsx' | 'md'>('pdf');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Ping Python service health on mount
  useEffect(() => {
    fetch(`${DOCFORGE_API}/health`)
      .then(r => r.ok ? setServiceOnline(true) : setServiceOnline(false))
      .catch(() => setServiceOnline(false));
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeDoc = docs.find(d => d.id === activeDocId) || null;

  // ── TipTap Editor ──────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Start writing your document…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: activeDoc?.content || '',
    onUpdate: ({ editor }) => {
      setIsSaved(false);
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        const html = editor.getHTML();
        setDocs(prev => {
          const updated = prev.map(d =>
            d.id === activeDocId ? { ...d, content: html, updatedAt: Date.now() } : d
          );
          saveDocs(updated);
          return updated;
        });
        setIsSaved(true);
      }, 800);
    },
    editorProps: {
      attributes: {
        class: 'docforge-prose focus:outline-none min-h-[600px]',
      },
    },
  });

  // Sync editor content when activeDoc changes
  useEffect(() => {
    if (editor && activeDoc && editor.getHTML() !== activeDoc.content) {
      editor.commands.setContent(activeDoc.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  // ── Actions ────────────────────────────────────────────────────
  const createDoc = useCallback((template: typeof TEMPLATES[0]) => {
    const now = Date.now();
    const doc: DocForgeDoc = {
      id: generateId(),
      title: template.label === 'Blank Document' ? 'Untitled Document' : `New ${template.label}`,
      type: template.type,
      content: template.content,
      settings: { ...DEFAULT_SETTINGS },
      createdAt: now,
      updatedAt: now,
    };
    const updated = [doc, ...docs];
    setDocs(updated);
    saveDocs(updated);
    setActiveDocId(doc.id);
    setShowTemplates(false);
    editor?.commands.setContent(template.content);
    showToast('📄 Document Created', `Started a new ${template.label}`, 'success');
  }, [docs, editor, showToast]);

  const deleteDoc = useCallback((id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    saveDocs(updated);
    if (activeDocId === id) {
      setActiveDocId(updated[0]?.id || null);
      if (updated[0]) editor?.commands.setContent(updated[0].content);
      else { editor?.commands.setContent(''); setShowTemplates(true); }
    }
    showToast('Deleted', 'Document removed', 'info');
  }, [docs, activeDocId, editor, showToast]);

  const renameDoc = useCallback((id: string, title: string) => {
    const updated = docs.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d);
    setDocs(updated);
    saveDocs(updated);
  }, [docs]);

  const updateSettings = useCallback((patch: Partial<DocSettings>) => {
    if (!activeDocId) return;
    setDocs(prev => {
      const updated = prev.map(d =>
        d.id === activeDocId ? { ...d, settings: { ...d.settings, ...patch }, updatedAt: Date.now() } : d
      );
      saveDocs(updated);
      return updated;
    });
  }, [activeDocId]);

  const duplicateDoc = useCallback((doc: DocForgeDoc) => {
    const now = Date.now();
    const dup: DocForgeDoc = { ...doc, id: generateId(), title: `${doc.title} (Copy)`, createdAt: now, updatedAt: now };
    const updated = [dup, ...docs];
    setDocs(updated);
    saveDocs(updated);
    showToast('Duplicated', `Copy of "${doc.title}" created`, 'success');
  }, [docs, showToast]);

  // ── Python DocForge Export ────────────────────────────────────
  const exportDocument = useCallback(async (format: 'pdf' | 'docx' | 'xlsx') => {
    if (!activeDoc || !editor) return;
    if (serviceOnline === false) {
      showToast('🐍 Python Service Offline', 'Run: cd docforge_service && uvicorn main:app --port 3001', 'error');
      return;
    }

    setExportLoading(true);
    setShowExportMenu(false);

    const settings = activeDoc.settings;
    const payload = {
      type:         activeDoc.type,
      title:        activeDoc.title,
      author:       settings.authorName || '',
      subject:      settings.subjectLine || '',
      institution:  settings.institution || '',
      date:         new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      theme:        settings.theme || 'blue',
      html_content: editor.getHTML(),
      font_size:    settings.fontSize || 11,
      line_spacing: settings.lineSpacing || 1.6,
      page_size:    settings.pageSize === 'letter' ? 'LETTER' : 'A4',
      show_cover:   true,
      show_header:  settings.showHeader,
      show_footer:  settings.showFooter,
      header_text:  settings.headerText || activeDoc.title,
      footer_text:  settings.footerText || settings.authorName || '',
    };

    try {
      const res = await fetch(`${DOCFORGE_API}/generate/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Generation failed');
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${activeDoc.title.replace(/[^\w\s-]/g, '').trim()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const formatLabels = { pdf: 'PDF', docx: 'Word Document', xlsx: 'Excel Spreadsheet' };
      showToast(`✅ Exported`, `${activeDoc.title} saved as ${formatLabels[format]}`, 'success');
    } catch (err: any) {
      showToast('❌ Export Failed', err.message || 'Could not connect to DocForge engine', 'error');
    } finally {
      setExportLoading(false);
    }
  }, [activeDoc, editor, serviceOnline, showToast]);

  // ── Markdown Export (pure frontend, no Python needed) ──────────
  const exportAsMarkdown = useCallback(() => {
    if (!activeDoc || !editor) return;
    const html = editor.getHTML();

    const md = html
      // Block-level: headings
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      // Horizontal rule
      .replace(/<hr\s*\/?>/gi, '\n---\n\n')
      // Blockquote
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, inner) =>
        inner.trim().split('\n').map((l: string) => '> ' + l.trim()).join('\n') + '\n\n'
      )
      // Lists — ordered
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, inner) => {
        let i = 1;
        return inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_: string, c: string) => `${i++}. ${c.trim()}\n`) + '\n';
      })
      // Lists — unordered (including task lists)
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, inner) =>
        inner.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gis, (_: string, c: string) => `- [x] ${c.trim()}\n`)
             .replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gis, (_: string, c: string) => `- [ ] ${c.trim()}\n`)
             .replace(/<li[^>]*>(.*?)<\/li>/gis, (_: string, c: string) => `- ${c.trim()}\n`) + '\n'
      )
      // Inline: bold, italic, underline, strikethrough, code
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__')
      .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      // Links
      .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      // Pre/code blocks
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
      // Paragraphs
      .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
      // Line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Add frontmatter header
    const frontmatter = [
      '---',
      `title: "${activeDoc.title}"`,
      activeDoc.settings.authorName ? `author: "${activeDoc.settings.authorName}"` : '',
      `date: "${new Date().toISOString().split('T')[0]}"`,
      `type: ${activeDoc.type}`,
      '---',
      '',
    ].filter(Boolean).join('\n');

    const finalMd = frontmatter + '\n' + md;
    const blob = new Blob([finalMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/[^\w\s-]/g, '').trim()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast('✅ Markdown Exported', `${activeDoc.title}.md downloaded`, 'success');
  }, [activeDoc, editor, showToast]);

  // ── AI Actions ──────────────────────────────────────────────────
  const runAi = useCallback(async () => {
    if (!aiPrompt.trim()) { showToast('⚠️ Empty Prompt', 'Please enter what you want to generate', 'error'); return; }
    if (!aiConfig.apiKey) { showToast('🔑 No API Key', 'Configure your AI API key in Settings', 'error'); return; }
    if (!editor) { showToast('⚠️ Editor not ready', 'Open a document first', 'error'); return; }

    setAiLoading(true);
    try {
      let prompt = '';
      const docType = activeDoc ? activeDoc.type.replace('_', ' ') : 'document';
      if (aiMode === 'write') {
        const currentHtml = editor.getHTML();
        prompt = `You are an AI document generator. 
User request: "${aiPrompt}"
Document Type: ${docType}

Here is the current document HTML:
\`\`\`html
${currentHtml}
\`\`\`

Task:
1. If the HTML contains template placeholders (e.g., [Your Name], [Insert text], headings), replace them with highly professional, comprehensive content based on the user's request.
2. If the document is mostly empty, generate a complete, well-structured ${docType} from scratch.
3. Maintain all existing HTML formatting (h1, h2, ul, li, p, strong, etc.).
4. Return ONLY valid HTML. Do not wrap it in markdown blocks. No explanations.`;
      } else if (aiMode === 'improve') {
        const sel = editor?.state.selection;
        const selectedText = sel && !sel.empty
          ? editor?.state.doc.textBetween(sel.from, sel.to, ' ')
          : aiPrompt;
        prompt = `Improve and enhance the following text from a ${docType}. Make it more professional, clear, and well-written. Return only the improved version: "${selectedText}"`;
      } else {
        prompt = `Generate 5 relevant academic references in APA format for a ${docType} about: "${aiPrompt}". Format as a numbered list with complete citation details.`;
      }
      const result = await callAi(prompt, aiConfig);

      // Clean up markdown code blocks if the AI accidentally includes them
      const cleanResult = result.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

      if (aiMode === 'write') {
        // Replace the entire template with the filled-out version
        editor.commands.setContent(cleanResult);
        showToast('✨ Document Generated', 'Template filled automatically!', 'success');
      } else {
        // Insert or replace at cursor for improve/citation
        editor.commands.insertContent(`<p>${cleanResult.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`);
        showToast('✨ Inserted', 'AI content added to document.', 'success');
      }
      
      setAiPrompt('');

    } catch (err: any) {
      showToast('AI Error', err.message || 'Something went wrong', 'error');
    }
    setAiLoading(false);
  }, [aiPrompt, aiMode, aiConfig, activeDoc, editor, showToast]);

  const insertAiResult = useCallback(() => {
    if (!editor || !aiResult) return;
    editor.commands.insertContent(`<p>${aiResult.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`);
    setAiResult('');
    showToast('✅ Inserted', 'Content added to document', 'success');
  }, [editor, aiResult, showToast]);

  // ── Stats ──────────────────────────────────────────────────────
  const stats = editor ? getStats(editor.getHTML()) : { words: 0, chars: 0, minutes: 0 };
  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Settings panel ──────────────────────────────────────────────
  const settings = activeDoc?.settings || DEFAULT_SETTINGS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full gap-0 -m-4 md:-m-8 overflow-hidden"
    >

      {/* ══════════ LEFT: Document List ══════════ */}
      <AnimatePresence>
        {showDocList && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 flex flex-col border-r border-white/5 bg-panel-dark overflow-hidden"
            style={{ width: 260 }}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center border border-violet-500/20">
                    <Scroll className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <span className="text-sm font-bold text-white/90">DocForge</span>
                </div>
                <button
                  onClick={() => { setShowTemplates(true); setActiveDocId(null); }}
                  className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors"
                  title="New Document"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/8 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            {/* Doc List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-12 text-white/20 text-xs">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No documents yet</p>
                  <p>Click + to create one</p>
                </div>
              ) : (
                filteredDocs.map(doc => {
                  const template = TEMPLATES.find(t => t.type === doc.type)!;
                  const Icon = template?.icon || FileText;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setActiveDocId(doc.id);
                        setShowTemplates(false);
                        editor?.commands.setContent(doc.content);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all group flex items-start gap-2.5",
                        activeDocId === doc.id
                          ? "bg-white/10 border border-white/10"
                          : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", template?.color || 'text-white/40')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/90 truncate">{doc.title}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteDoc(doc.id); }}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-white/5">
              <p className="text-[10px] text-white/25 text-center">{docs.length} document{docs.length !== 1 ? 's' : ''} saved locally</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ══════════ CENTER: Editor ══════════ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0c1414]">

        {/* Editor Topbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 bg-panel-dark/60 backdrop-blur shrink-0">
          <button
            onClick={() => setShowDocList(!showDocList)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
            title="Toggle document list"
          >
            {showDocList ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex-1">
            {activeDoc ? (
              <input
                value={activeDoc.title}
                onChange={e => renameDoc(activeDoc.id, e.target.value)}
                className="bg-transparent text-sm font-bold text-white/90 focus:outline-none w-full placeholder:text-white/20"
                placeholder="Document Title"
              />
            ) : (
              <span className="text-sm font-bold text-white/40">DocForge — Document Generator</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Save indicator */}
            {activeDoc && (
              <span className={cn("text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-md transition-colors", isSaved ? "text-emerald-400/60" : "text-amber-400/80")}>
                {isSaved ? '● Saved' : '◌ Saving…'}
              </span>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-all", showSettings ? "bg-white/10 text-white" : "text-white/30 hover:text-white hover:bg-white/8")}
              title="Document Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {activeDoc && (
              <button
                onClick={() => duplicateDoc(activeDoc)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
                title="Duplicate document"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Service status dot */}
            {serviceOnline !== null && (
              <span
                title={serviceOnline ? 'Python DocForge engine online' : 'Python engine offline — run uvicorn'}
                className={cn(
                  'w-2 h-2 rounded-full border transition-colors',
                  serviceOnline ? 'bg-emerald-400 border-emerald-300' : 'bg-rose-500 border-rose-400'
                )}
              />
            )}

            {/* Export dropdown */}
            {activeDoc && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
                >
                  {exportLoading
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {exportLoading ? 'Generating…' : 'Export'}
                  {!exportLoading && <span className="opacity-60">▾</span>}
                </button>

                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-1.5 w-56 bg-[#111a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50">
                    <div className="px-3 py-2 border-b border-white/6">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Export Format</p>
                    </div>
                    {[
                      { format: 'pdf'  as const, label: 'PDF Document',      icon: '📄', desc: 'ReportLab — cover page + headers' },
                      { format: 'docx' as const, label: 'Word Document',     icon: '📝', desc: 'Editable in Microsoft Word' },
                      { format: 'xlsx' as const, label: 'Excel Spreadsheet', icon: '📊', desc: 'Structured data with styling' },
                    ].map(opt => (
                      <button
                        key={opt.format}
                        onClick={() => exportDocument(opt.format)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-white/6 transition-colors text-left"
                      >
                        <span className="text-base mt-0.5">{opt.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-white/90">{opt.label}</p>
                          <p className="text-[10px] text-white/35">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                    {/* Markdown — offline, no Python needed */}
                    <div className="border-t border-white/6">
                      <button
                        onClick={() => exportAsMarkdown()}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-emerald-500/10 transition-colors text-left group"
                      >
                        <span className="text-base mt-0.5">🔖</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-emerald-400">Markdown (.md)</p>
                          <p className="text-[10px] text-white/35">Offline · No service needed</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-all", showAiPanel ? "bg-violet-500/20 text-violet-400" : "text-white/30 hover:text-white hover:bg-white/8")}
              title="Toggle AI Panel"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <AnimatePresence>
          {showSettings && activeDoc && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/5 bg-panel-dark/40 overflow-hidden shrink-0"
            >
              <div className="flex items-center gap-6 px-4 py-3 text-xs flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Font</span>
                  <select
                    value={settings.fontFamily}
                    onChange={e => updateSettings({ fontFamily: e.target.value as any })}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none"
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans-serif</option>
                    <option value="mono">Monospace</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Size</span>
                  <select
                    value={settings.fontSize}
                    onChange={e => updateSettings({ fontSize: +e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none"
                  >
                    {[10, 11, 12, 13, 14, 16].map(s => <option key={s} value={s}>{s}pt</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Spacing</span>
                  <select
                    value={settings.lineSpacing}
                    onChange={e => updateSettings({ lineSpacing: +e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none"
                  >
                    <option value={1.5}>1.5</option>
                    <option value={1.8}>1.8</option>
                    <option value={2.0}>Double</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Page</span>
                  <select
                    value={settings.pageSize}
                    onChange={e => updateSettings({ pageSize: e.target.value as any })}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none"
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={settings.showHeader} onChange={e => updateSettings({ showHeader: e.target.checked })} className="accent-accent" />
                    <span className="text-white/60">Header</span>
                  </label>
                  {settings.showHeader && (
                    <input
                      value={settings.headerText}
                      onChange={e => updateSettings({ headerText: e.target.value })}
                      placeholder="Header text…"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none w-40"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={settings.showFooter} onChange={e => updateSettings({ showFooter: e.target.checked })} className="accent-accent" />
                    <span className="text-white/60">Footer</span>
                  </label>
                  {settings.showFooter && (
                    <input
                      value={settings.footerText}
                      onChange={e => updateSettings({ footerText: e.target.value })}
                      placeholder="Footer text…"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none w-40"
                    />
                  )}
                </div>

                {/* Theme picker */}
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Theme</span>
                  <div className="flex items-center gap-1">
                    {THEME_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => updateSettings({ theme: t.value })}
                        title={t.label}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 transition-all",
                          settings.theme === t.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                        )}
                        style={{ background: t.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Author / Subject / Institution */}
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Author</span>
                  <input
                    value={settings.authorName}
                    onChange={e => updateSettings({ authorName: e.target.value })}
                    placeholder="Your name…"
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none w-32"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Subject</span>
                  <input
                    value={settings.subjectLine}
                    onChange={e => updateSettings({ subjectLine: e.target.value })}
                    placeholder="Subject / Course…"
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-medium">Institution</span>
                  <input
                    value={settings.institution}
                    onChange={e => updateSettings({ institution: e.target.value })}
                    placeholder="School / Org…"
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs focus:outline-none w-36"
                  />
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        {editor && activeDoc && (
          <DocForgeToolbar editor={editor} />
        )}

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#0c1414' }}>
          {showTemplates ? (
            /* ── Template Gallery ── */
            <div className="max-w-4xl mx-auto p-8">
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 mb-4">
                  <Scroll className="w-8 h-8 text-violet-400" />
                </div>
                <h1 className="text-3xl font-black text-white mb-2">DocForge</h1>
                <p className="text-white/40 text-sm max-w-md mx-auto">
                  Create perfect documents in seconds. Choose a template to get started, or start from a blank canvas.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {TEMPLATES.map(template => {
                  const Icon = template.icon;
                  return (
                    <motion.button
                      key={template.type}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => createDoc(template)}
                      className={cn(
                        "relative p-5 rounded-2xl border border-white/8 bg-gradient-to-br text-left transition-all group overflow-hidden hover:border-white/20",
                        template.gradient
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/3 group-hover:to-transparent transition-all" />
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white/5 border border-white/8")}>
                        <Icon className={cn("w-5 h-5", template.color)} />
                      </div>
                      <h3 className="text-sm font-bold text-white/90 mb-1">{template.label}</h3>
                      <p className="text-[11px] text-white/40 leading-snug">{template.description}</p>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-white/30 group-hover:text-white/60 transition-colors uppercase tracking-wider">
                        <span>Start writing</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {docs.length > 0 && (
                <div className="mt-10 text-center">
                  <p className="text-white/20 text-xs mb-3">Or continue with a recent document</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {docs.slice(0, 5).map(doc => {
                      const tmpl = TEMPLATES.find(t => t.type === doc.type);
                      const Icon = tmpl?.icon || FileText;
                      return (
                        <button
                          key={doc.id}
                          onClick={() => { setActiveDocId(doc.id); setShowTemplates(false); editor?.commands.setContent(doc.content); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all text-xs text-white/60 hover:text-white"
                        >
                          <Icon className={cn("w-3.5 h-3.5", tmpl?.color || 'text-white/40')} />
                          {doc.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Paper Editor ── */
            <div className="py-8 px-4 flex justify-center">
              <div
                className="docforge-paper w-full shadow-2xl shadow-black/60"
                style={{
                  maxWidth: settings.pageSize === 'a4' ? '794px' : '816px',
                  minHeight: '1123px',
                  background: '#ffffff',
                  borderRadius: '4px',
                  padding: '72px 80px',
                  fontFamily: FONT_FAMILIES[settings.fontFamily],
                  fontSize: `${settings.fontSize}pt`,
                  lineHeight: settings.lineSpacing,
                  color: '#1a1a1a',
                }}
              >
                {/* Header */}
                {settings.showHeader && (
                  <div className="text-center text-[9pt] text-gray-400 border-b border-gray-200 pb-3 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {settings.headerText || (activeDoc?.title)}
                  </div>
                )}

                <EditorContent editor={editor} />

                {/* Footer */}
                {settings.showFooter && (
                  <div className="text-center text-[9pt] text-gray-400 border-t border-gray-200 pt-3 mt-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {settings.footerText || `${activeDoc?.title} · ${new Date().toLocaleDateString()}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {activeDoc && (
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-panel-dark/60 text-[10px] text-white/25 shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{stats.words} words</span>
              <span className="flex items-center gap-1"><AlignLeft className="w-3 h-3" />{stats.chars} chars</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{stats.minutes} min read</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="capitalize">{settings.pageSize.toUpperCase()}</span>
              <span className="capitalize">{settings.fontFamily}</span>
              <span>Last saved: {new Date(activeDoc.updatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ RIGHT: AI Panel ══════════ */}
      <AnimatePresence>
        {showAiPanel && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 flex flex-col border-l border-white/5 bg-panel-dark overflow-hidden"
            style={{ width: 300 }}
          >
            {/* AI Panel Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <span className="text-sm font-bold text-white/90">AI Assistant</span>
                </div>
                <button onClick={() => setShowAiPanel(false)} className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white rounded-lg hover:bg-white/8 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {!aiConfig.apiKey && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400/80">
                  ⚠️ Configure your AI API key in <strong>Settings</strong> to enable AI writing assistance.
                </div>
              )}
            </div>

            {/* AI Mode Tabs */}
            <div className="p-3 border-b border-white/5">
              <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                {([
                  { id: 'write', label: 'Write', icon: Wand2 },
                  { id: 'improve', label: 'Improve', icon: RefreshCw },
                  { id: 'citation', label: 'Cite', icon: BookOpen },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAiMode(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                      aiMode === tab.id ? "bg-violet-500/30 text-violet-300 border border-violet-500/30" : "text-white/30 hover:text-white"
                    )}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Input */}
            <div className="p-3 border-b border-white/5 space-y-2">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAi(); }}
                placeholder={
                  aiMode === 'write' ? 'What do you want to write? (Ctrl+Enter to run)' :
                  aiMode === 'improve' ? 'Paste text to improve, or select text in editor…' :
                  'Topic for citations/references…'
                }
                rows={4}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none"
              />
              <button
                onClick={runAi}
                disabled={aiLoading || !aiConfig.apiKey}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all",
                  aiLoading || !aiConfig.apiKey
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-900/30"
                )}
              >
                {aiLoading ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Generate</>
                )}
              </button>
            </div>

            {/* Quick Prompts (always visible since we auto-insert now) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="space-y-3">
                {/* Quick prompts */}
                <p className="text-[10px] text-white/25 font-bold uppercase tracking-wider">Quick Prompts</p>
                {(aiMode === 'write' ? [
                  'Write an introduction paragraph',
                  'Write a strong conclusion',
                  'Explain the main concept',
                  'Write an executive summary',
                  'Generate 5 key points',
                ] : aiMode === 'improve' ? [
                  'Make it more formal and academic',
                  'Make it more concise',
                  'Improve grammar and flow',
                  'Make it more persuasive',
                ] : [
                  'Generate APA references',
                  'Find recent research sources',
                  'Get 5 textbook citations',
                ]).map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => setAiPrompt(prompt)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/3 border border-white/6 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/8 hover:border-white/12 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="p-3 border-t border-white/5">
              <p className="text-[10px] text-white/20 leading-relaxed">
                💡 Select text in the editor first, then use <strong className="text-white/30">Improve</strong> to enhance it in-context.
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
