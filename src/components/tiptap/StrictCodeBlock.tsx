import React from 'react';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';

const StrictCodeBlockComponent = ({ node, updateAttributes, extension }: any) => (
  <NodeViewWrapper className="code-block-wrapper relative group my-4 rounded-xl overflow-hidden bg-[#1e1e1e] text-white shadow-xl font-mono">
    <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5" contentEditable={false}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
      </div>
      <select
        className="text-[10px] uppercase tracking-widest font-bold bg-transparent text-zinc-400 focus:outline-none cursor-pointer hover:text-white transition-colors"
        defaultValue={node.attrs.language || 'null'}
        onChange={event => updateAttributes({ language: event.target.value })}
      >
        <option value="null" className="bg-black text-white">AUTO</option>
        <option value="css" className="bg-black text-white">CSS</option>
        <option value="html" className="bg-black text-white">HTML</option>
        <option value="javascript" className="bg-black text-white">JS</option>
        <option value="python" className="bg-black text-white">PYTHON</option>
        <option value="typescript" className="bg-black text-white">TS</option>
        <option value="cpp" className="bg-black text-white">C++</option>
        <option value="json" className="bg-black text-white">JSON</option>
        <option value="bash" className="bg-black text-white">BASH</option>
      </select>
    </div>
    <pre className="p-4 overflow-x-auto text-sm leading-relaxed m-0 bg-transparent">
      <NodeViewContent as="code" />
    </pre>
  </NodeViewWrapper>
);

export const StrictCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StrictCodeBlockComponent);
  },
});
