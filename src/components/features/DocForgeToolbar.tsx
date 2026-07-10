import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Code, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Quote, Link, Table,
  Minus, Undo2, Redo2, Highlighter, ChevronDown, CheckSquare
} from 'lucide-react';
import { cn } from '../../utils/index';

interface Props {
  editor: Editor;
}

const HEADING_OPTIONS = [
  { label: 'Paragraph', value: 'paragraph' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
];

export function DocForgeToolbar({ editor }: Props) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const headingRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) setShowHeadingMenu(false);
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setShowLinkInput(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getHeadingLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    return 'Paragraph';
  };

  const applyHeading = (value: string) => {
    setShowHeadingMenu(false);
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value[1]) as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const applyLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}` }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-white/8 bg-[#0d1616] shrink-0 overflow-x-auto">

      {/* Undo / Redo */}
      <ToolBtn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      {/* Heading Dropdown */}
      <div className="relative" ref={headingRef}>
        <button
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/8 hover:text-white transition-all whitespace-nowrap"
        >
          {getHeadingLabel()}
          <ChevronDown className="w-3 h-3 text-white/40" />
        </button>
        {showHeadingMenu && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-[#111a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50">
            {HEADING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => applyHeading(opt.value)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs transition-all hover:bg-white/8",
                  opt.value === 'h1' && "font-black text-base text-white/90",
                  opt.value === 'h2' && "font-bold text-sm text-white/80",
                  opt.value === 'h3' && "font-semibold text-xs text-white/70",
                  opt.value === 'paragraph' && "text-xs text-white/60"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Format Buttons */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline Code"
      >
        <Code className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      {/* Alignment */}
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="Task / Checklist"
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      {/* Insert */}
      <div className="relative" ref={linkRef}>
        <ToolBtn
          onClick={() => { setShowLinkInput(!showLinkInput); setLinkUrl(editor.getAttributes('link').href || ''); }}
          active={editor.isActive('link')}
          title="Insert Link"
        >
          <Link className="w-3.5 h-3.5" />
        </ToolBtn>
        {showLinkInput && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-[#111a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 p-3">
            <p className="text-[10px] text-white/40 mb-2 font-bold uppercase tracking-wider">Insert Link</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyLink()}
                placeholder="https://example.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/40"
              />
              <button
                onClick={applyLink}
                className="px-3 py-1.5 bg-accent/20 border border-accent/30 text-accent text-xs font-bold rounded-lg hover:bg-accent/30 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <ToolBtn onClick={insertTable} title="Insert Table">
        <Table className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <span className="text-[10px] font-mono font-bold">&lt;/&gt;</span>
      </ToolBtn>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ToolBtn({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded-lg transition-all text-sm",
        active
          ? "bg-accent/20 text-accent border border-accent/30"
          : "text-white/45 hover:text-white hover:bg-white/8",
        disabled && "opacity-25 cursor-not-allowed pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-white/8 mx-1 shrink-0" />;
}
