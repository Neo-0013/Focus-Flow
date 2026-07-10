import React, { useState, useMemo, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Tldraw, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';

// Error Boundary for Tldraw
class TldrawErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl">error</span>
          <div className="text-center">
            <p className="font-bold">Drawing Engine Failure</p>
            <p className="text-xs opacity-70 mt-1">{this.state.error?.message || 'Unknown Error'}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold"
          >
            RELOAD FRAMEWORK
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TldrawComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(node.attrs.snapshot || null);

  // Memoize initial data to prevent infinite loops
  const initialData = useMemo(() => {
    try {
      return typeof node.attrs.document === 'string' 
        ? JSON.parse(node.attrs.document) 
        : node.attrs.document || {};
    } catch (e) {
      console.error("Failed to parse tldraw document:", e);
      return {};
    }
  }, []);

  const handleSave = (editor: any) => {
    const document = editor.getSnapshot();
    updateAttributes({ 
      document: JSON.stringify(document),
      // We could also generate an SVG snapshot here for the preview
    });
  };

  return (
    <NodeViewWrapper className="tldraw-wrapper my-8 relative group border border-white/5 rounded-2xl overflow-hidden bg-black/20">
      {/* Header Overlay */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" contentEditable={false}>
        {!isEditing && (
          <>
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-focus-cyan/80 text-black text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg hover:bg-focus-cyan transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              OPEN CANVAS
            </button>
            <button 
              onClick={deleteNode}
              className="bg-red-500/80 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg hover:bg-red-500 transition-all flex items-center gap-1"
              title="Delete Drawing"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </>
        )}
      </div>

      {isEditing ? (
        <div className="h-[600px] w-full relative bg-[#121212] z-50" contentEditable={false}>
          <TldrawErrorBoundary>
            <Tldraw 
              persistenceKey={node.attrs.id || "tldraw-temp"}
              onMount={(editor) => {
                if (initialData && Object.keys(initialData).length > 0) {
                  editor.loadSnapshot(initialData);
                }
                
                // Add save listener
                const handleUpdate = () => {
                  const snapshot = editor.getSnapshot();
                  updateAttributes({ document: JSON.stringify(snapshot) });
                };
                
                editor.on('change', handleUpdate);
              }}
            />
          </TldrawErrorBoundary>
          
          <div className="absolute bottom-6 right-6 z-[100] flex gap-3">
             <button 
              onClick={() => setIsEditing(false)}
              className="bg-zinc-800 text-white text-[10px] font-bold px-5 py-2 rounded-full shadow-2xl hover:bg-zinc-700 transition-all border border-white/10"
            >
              CLOSE & SYNC
            </button>
          </div>
        </div>
      ) : (
        <div className="h-[300px] w-full flex flex-col items-center justify-center gap-4 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all cursor-pointer" onClick={() => setIsEditing(true)}>
          <div className="w-12 h-12 rounded-2xl bg-focus-cyan/10 flex items-center justify-center border border-focus-cyan/20">
            <span className="material-symbols-outlined text-focus-cyan">draw</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-300">Engineering Schematic</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Click to view or edit architectural sketch</p>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const TldrawExtension = Node.create({
  name: 'tldraw',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: {
        default: `tldraw-${Math.random().toString(36).substr(2, 9)}`,
      },
      document: { 
        default: '{}',
        renderHTML: attributes => ({ 'data-document': attributes.document }),
        parseHTML: element => element.getAttribute('data-document'),
      },
      snapshot: {
        default: null,
        renderHTML: attributes => ({ 'data-snapshot': attributes.snapshot }),
        parseHTML: element => element.getAttribute('data-snapshot'),
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-document]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tldraw' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TldrawComponent);
  },
});
