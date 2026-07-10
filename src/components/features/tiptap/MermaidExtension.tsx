import React, { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import mermaid from 'mermaid';

if (mermaid && typeof mermaid.initialize === 'function') {
  mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter',
  });
}

const MermaidComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const [content, setContent] = useState(node.attrs.content || '');
  const [svgInfo, setSvgInfo] = useState<{svg: string, bindFunctions?: (el: Element) => void} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!node.attrs.content || node.attrs.content === 'graph TD\n  A[Start] --> B(Success)');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!content.trim()) return;
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg, bindFunctions } = await mermaid.render(id, content);
        if (isMounted) {
          setSvgInfo({ svg, bindFunctions });
          setError(null);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError(err.message || 'Syntax Error');
          setSvgInfo(null);
        }
      }
    };
    renderDiagram();
    return () => { isMounted = false; };
  }, [content]);

  useEffect(() => {
    if (svgInfo?.bindFunctions && containerRef.current) {
      svgInfo.bindFunctions(containerRef.current);
    }
  }, [svgInfo]);

  const handleSave = () => {
    updateAttributes({ content });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="mermaid-wrapper my-6 p-4 bg-black/20 border border-white/5 rounded-xl group relative">
      <div className="flex justify-between items-center mb-2" contentEditable={false}>
        <span className="text-[10px] uppercase font-bold tracking-widest text-focus-cyan">Mermaid Diagram</span>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-zinc-400 transition-colors"
          >
            {isEditing ? 'Preview' : 'Edit Source'}
          </button>
          <button 
            onClick={deleteNode}
            className="text-[10px] bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded text-red-500 transition-colors flex items-center gap-1"
            title="Delete Block"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>
      
      {isEditing ? (
        <textarea
          className="w-full h-40 bg-black/50 text-white p-4 font-mono text-xs rounded border border-white/10 focus:outline-none focus:border-focus-cyan"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="graph TD\n  A-->B"
          onBlur={handleSave}
        />
      ) : (
        <div 
          ref={containerRef}
          className="flex justify-center items-center py-4 overflow-x-auto min-h-[100px]"
          dangerouslySetInnerHTML={{ 
            __html: svgInfo?.svg || `
              <div class="flex flex-col items-center gap-4 py-8 text-zinc-500">
                <div class="flex items-center gap-2 text-error">
                  <span class="material-symbols-outlined text-sm">warning</span>
                  <span class="text-[10px] font-bold uppercase tracking-widest">Syntax Error</span>
                </div>
                <div class="bg-black/40 p-4 rounded-lg border border-white/5 w-full max-w-sm">
                  <p class="text-[9px] font-mono mb-4 text-zinc-400 italic">"Diagrams must start with a type like 'graph TD'"</p>
                  <div class="space-y-2">
                    <p class="text-[10px] text-zinc-300 font-bold">Quick Examples:</p>
                    <code class="block text-[9px] text-focus-cyan bg-white/5 p-2 rounded">graph TD\n  A-->B</code>
                    <code class="block text-[9px] text-focus-cyan bg-white/5 p-2 rounded">sequenceDiagram\n  A->>B: Hello</code>
                  </div>
                </div>
              </div>
            ` 
          }}
        />
      )}
    </NodeViewWrapper>
  );
};

export const MermaidExtension = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: {
        default: 'graph TD\n  A[Start] --> B(Success)',
        renderHTML: attributes => ({ 'data-content': attributes.content }),
        parseHTML: element => element.getAttribute('data-content'),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^```mermaid\s$/,
        type: this.type,
      }),
    ];
  },
});
