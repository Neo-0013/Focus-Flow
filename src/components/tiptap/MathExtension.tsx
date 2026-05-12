import React, { useState, useEffect, useRef } from 'react';
import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const MathComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [latex, setLatex] = useState(node.attrs.latex || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (containerRef.current && !isEditing) {
      try {
        katex.render(latex || '\\text{Enter Formula}', containerRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        console.error("KaTeX render error:", e);
      }
    }
  }, [latex, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    updateAttributes({ latex });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
  };

  return (
    <NodeViewWrapper className="math-block-wrapper my-6 relative group">
      <div className="absolute -top-3 left-4 px-2 bg-black text-[10px] text-zinc-500 font-mono z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        ARCHITECTURE_EQUATION
      </div>
      
      <div 
        className={`min-h-[60px] p-6 rounded-xl border transition-all ${
          isEditing 
            ? 'bg-zinc-900 border-focus-cyan shadow-[0_0_20px_rgba(0,255,242,0.1)]' 
            : 'bg-zinc-900/30 border-white/5 hover:border-white/10'
        }`}
        onClick={() => !isEditing && setIsEditing(true)}
      >
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <textarea
              ref={inputRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter LaTeX formula (e.g. F = ma)"
              className="w-full bg-transparent text-focus-cyan font-mono text-sm outline-none resize-none min-h-[40px]"
              rows={2}
            />
            <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
              <span>CTRL + ENTER TO SYNC</span>
              <span className="text-focus-cyan/50">KATEX_ENGINE_ACTIVE</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
             <div ref={containerRef} className="text-zinc-100 text-lg" />
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button 
          onClick={deleteNode}
          className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-all"
          title="Remove Equation"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export const MathExtension = Node.create({
  name: 'math',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        renderHTML: attributes => ({ 'data-latex': attributes.latex }),
        parseHTML: element => element.getAttribute('data-latex'),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-latex]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$\s$/,
        type: this.type,
      }),
    ];
  },
});
