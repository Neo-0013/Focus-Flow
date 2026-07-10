import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

/* ─────────────────────────────────────────────
   HTML Artifact React Component
───────────────────────────────────────────── */
const HtmlArtifactComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(480);
  const [sourceCode, setSourceCode] = useState(node.attrs.html || '');
  const [liveHtml, setLiveHtml] = useState(node.attrs.html || '');

  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep in sync when node attr changes
  useEffect(() => {
    setSourceCode(node.attrs.html || '');
    setLiveHtml(node.attrs.html || '');
  }, [node.attrs.html]);

  /* ── Drag-to-Resize ── */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: panelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientY - dragRef.current.startY;
      setPanelHeight(Math.max(200, Math.min(1200, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelHeight]);

  /* ── Apply source edits → live preview ── */
  const applySource = () => {
    setLiveHtml(sourceCode);
    updateAttributes({ html: sourceCode });
  };

  /* ── Fullscreen overlay ── */
  const fullscreenClass = isFullscreen
    ? 'fixed inset-4 z-[9999] rounded-2xl shadow-2xl overflow-hidden flex flex-col'
    : 'relative rounded-2xl overflow-hidden';

  const isEmpty = !liveHtml || liveHtml.trim().length === 0;

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className={`html-artifact-wrapper my-6 border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm group ${fullscreenClass}`}
        style={isFullscreen ? {} : { minHeight: 64 }}
      >
        {/* ── Header Bar ── */}
        <div
          contentEditable={false}
          className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-zinc-900/60 shrink-0"
        >
          {/* Left: icon + title */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[13px] text-white">web</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
              HTML Artifact
            </span>
            <span className="text-[9px] font-mono text-zinc-600 hidden sm:block">
              {liveHtml.length > 0 ? `${(liveHtml.length / 1024).toFixed(1)} KB` : 'empty'}
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1" contentEditable={false}>
            {/* Preview / Source toggle */}
            <div className="flex rounded-md overflow-hidden border border-white/10 text-[10px] font-bold uppercase">
              <button
                onClick={() => setMode('preview')}
                className={`px-2.5 py-1 transition-colors ${
                  mode === 'preview'
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setMode('source')}
                className={`px-2.5 py-1 transition-colors ${
                  mode === 'source'
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Source
              </button>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>

            {/* Delete */}
            <button
              onClick={deleteNode}
              className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Delete Artifact"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div
          className="relative overflow-hidden"
          style={isFullscreen ? { flex: 1 } : { height: panelHeight }}
        >
          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600">
              <span className="material-symbols-outlined text-4xl">web_asset</span>
              <p className="text-xs font-mono">No HTML content — switch to Source and paste your code</p>
            </div>
          ) : mode === 'preview' ? (
            /* Live iframe */
            <iframe
              srcDoc={liveHtml}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              className="w-full h-full border-0 bg-white"
              title="HTML Artifact Preview"
            />
          ) : (
            /* Source editor */
            <div className="relative h-full flex flex-col">
              <textarea
                className="flex-1 w-full h-full bg-zinc-950 text-[12px] text-green-300 font-mono p-4 resize-none border-0 outline-none leading-relaxed"
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                placeholder="Paste your HTML from Claude here..."
                spellCheck={false}
              />
              <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-900 border-t border-white/10">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {sourceCode.split('\n').length} lines · {sourceCode.length} chars
                </span>
                <button
                  onClick={applySource}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                  Run Preview
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Drag-to-Resize Handle (only when not fullscreen) ── */}
        {!isFullscreen && (
          <div
            contentEditable={false}
            onMouseDown={onMouseDown}
            className="h-2 cursor-row-resize bg-transparent hover:bg-violet-500/30 transition-colors flex items-center justify-center group/resize shrink-0"
            title="Drag to resize"
          >
            <div className="w-12 h-0.5 bg-zinc-700 group-hover/resize:bg-violet-400 rounded-full transition-colors" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

/* ─────────────────────────────────────────────
   TipTap Node Definition
───────────────────────────────────────────── */
export const HtmlArtifactExtension = Node.create({
  name: 'htmlArtifact',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      html: {
        default: '',
        renderHTML: (attrs) => ({ 'data-html': encodeURIComponent(attrs.html || '') }),
        parseHTML: (el) => decodeURIComponent(el.getAttribute('data-html') || ''),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="html-artifact"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'html-artifact' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlArtifactComponent);
  },
});
