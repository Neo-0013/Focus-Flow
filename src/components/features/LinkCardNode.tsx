import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import ReactPlayer from 'react-player';

const LinkCardComponent = ({ node }: any) => {
  const url = node.attrs.url;
  
  const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'));

  return (
    <NodeViewWrapper className="my-6" contentEditable={false}>
      {isYouTube ? (
        <div className="rounded-sm overflow-hidden border border-zinc-200 bg-black aspect-video max-w-2xl mx-auto shadow-sm">
          {/* @ts-ignore */}
          <ReactPlayer url={url} width="100%" height="100%" controls />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col border border-zinc-200 bg-zinc-50 rounded-sm overflow-hidden group hover:border-focus-cyan transition-colors max-w-md no-underline">
          <div className="p-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-zinc-200 rounded flex items-center justify-center shrink-0 group-hover:bg-focus-cyan/10 transition-colors">
              <span className="material-symbols-outlined text-zinc-500 group-hover:text-focus-cyan" data-icon="link">link</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-zinc-900 truncate m-0">{url}</h4>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-mono m-0">External Resource</p>
            </div>
          </div>
        </a>
      )}
    </NodeViewWrapper>
  );
};

export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="linkCard"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linkCard' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardComponent);
  },
});
