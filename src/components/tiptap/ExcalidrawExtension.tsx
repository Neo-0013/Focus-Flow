import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

// Lazy load Excalidraw to prevent SSR/React 19 initialization crashes
const Excalidraw = React.lazy(() => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })));
const exportToSvg = async (props: any) => {
  const { exportToSvg: pkgExport } = await import('@excalidraw/excalidraw');
  return pkgExport(props);
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-3xl">terminal</span>
          <p className="text-red-500 font-bold text-xs uppercase tracking-widest">Drawing Engine Error</p>
          <p className="text-[10px] text-zinc-500 font-mono bg-black/40 p-3 rounded-lg max-w-sm overflow-auto">
            {this.state.error?.message || 'Unknown initialization error'}
          </p>
          <button onClick={() => window.location.reload()} className="mt-2 text-[9px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-all">Reload Framework</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ExcalidrawComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [elements, setElements] = useState(node.attrs.elements || []);
  const [appState, setAppState] = useState(node.attrs.appState || {});
  const [svgPreview, setSvgPreview] = useState(node.attrs.svgPreview || '');

  // Stabilize initialData to prevent infinite re-render loops
  const initialData = React.useMemo(() => ({ 
    elements: Array.isArray(node.attrs.elements) ? node.attrs.elements : [], 
    appState: { ...(node.attrs.appState || {}), collaborators: new Map() } 
  }), []);

  const handleSave = async () => {
    try {
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, exportWithDarkMode: true },
        files: null,
      });
      const svgString = new XMLSerializer().serializeToString(svg);
      
      updateAttributes({ 
        elements, 
        appState,
        svgPreview: svgString 
      });
      setSvgPreview(svgString);
      setIsEditing(false);
    } catch (err) {
      console.error('Excalidraw export error:', err);
    }
  };

  return (
    <NodeViewWrapper className="excalidraw-wrapper my-8 relative group border border-white/5 rounded-2xl overflow-hidden bg-black/20">
      <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" contentEditable={false}>
        {!isEditing && (
          <>
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-focus-cyan text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg hover:bg-white transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              EDIT DRAWING
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
          <ErrorBoundary>
            <React.Suspense fallback={
              <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black/40 text-zinc-500 font-mono">
                <div className="w-8 h-8 border-2 border-focus-cyan/30 border-t-focus-cyan rounded-full animate-spin"></div>
                <span className="text-[10px] uppercase tracking-widest">Waking Drawing Engine...</span>
              </div>
            }>
              <Excalidraw 
                initialData={initialData}
                onChange={(els: any, state: any) => {
                  const { collaborators, ...essentialState } = state;
                  setElements(els);
                  setAppState(essentialState);
                }}
                theme="dark"
              />
            </React.Suspense>
          </ErrorBoundary>
          <div className="absolute bottom-6 right-6 z-[100] flex gap-3">
             <button 
              onClick={() => setIsEditing(false)}
              className="bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="bg-recovery-green text-black px-6 py-2 rounded-xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              SAVE DRAWING
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[250px] p-8 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setIsEditing(true)}>
          {svgPreview ? (
            <div 
              className="w-full h-full max-w-full overflow-hidden flex justify-center"
              dangerouslySetInnerHTML={{ __html: svgPreview }}
            />
          ) : (
            <div className="text-zinc-500 text-sm flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-3xl">architecture</span>
              </div>
              <span className="font-bold tracking-widest uppercase text-[10px]">Initialize Drawing Engine</span>
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const ExcalidrawExtension = Node.create({
  name: 'excalidraw',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      elements: { 
        default: [],
        renderHTML: attributes => ({ 'data-elements': JSON.stringify(attributes.elements) }),
        parseHTML: element => JSON.parse(element.getAttribute('data-elements') || '[]'),
      },
      appState: { 
        default: {},
        renderHTML: attributes => ({ 'data-appstate': JSON.stringify(attributes.appState) }),
        parseHTML: element => JSON.parse(element.getAttribute('data-appstate') || '{}'),
      },
      svgPreview: { 
        default: '',
        renderHTML: attributes => ({ 'data-svg': attributes.svgPreview }),
        parseHTML: element => element.getAttribute('data-svg'),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="excalidraw"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'excalidraw' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawComponent);
  },
});
