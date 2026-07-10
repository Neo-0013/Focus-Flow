import React, { Component, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm font-mono overflow-auto whitespace-pre-wrap">
          Error rendering markdown: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <ErrorBoundary>
      <div className={cn('markdown-body', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
          h1: ({ node, ...props }: any) => <h1 className="text-2xl font-black text-white mt-6 mb-4" {...props} />,
          h2: ({ node, ...props }: any) => (
            <h2 className="text-xl font-bold mt-5 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400" {...props} />
          ),
          h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold text-white/90 mt-4 mb-2" {...props} />,
          h4: ({ node, ...props }: any) => <h4 className="text-base font-semibold text-white/80 mt-3 mb-2" {...props} />,
          p: ({ node, ...props }: any) => <p className="text-sm leading-relaxed mb-4 text-white/85" {...props} />,
          strong: ({ node, ...props }: any) => <strong className="font-bold text-white" {...props} />,
          ul: ({ node, ...props }: any) => <ul className="list-disc space-y-2 mb-4 ml-6" {...props} />,
          ol: ({ node, ...props }: any) => <ol className="list-decimal space-y-2 mb-4 ml-6 text-sm text-white/85" {...props} />,
          li: ({ node, className, children, ...props }: any) => (
            <li className={cn("text-sm text-white/85", className)} {...props}>
              {children}
            </li>
          ),
          hr: ({ node, ...props }: any) => <hr className="border-t border-white/10 my-6" {...props} />,
          blockquote: ({ node, ...props }: any) => (
            <blockquote className="border-l-2 border-indigo-500/50 pl-4 py-1 my-4 italic text-white/60 bg-white/5 rounded-r-lg" {...props} />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            
            if (isInline) {
              return (
                <code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <div className="my-4 rounded-xl overflow-hidden border border-white/10 bg-black/50">
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest flex justify-between items-center">
                  <span>{match ? match[1] : 'Code'}</span>
                </div>
                <pre className="p-4 overflow-x-auto text-[13px] font-mono text-white/80">
                  <code className={className} {...props}>{children}</code>
                </pre>
              </div>
            );
          },
          pre: ({ node, children, ...props }: any) => {
            return <>{children}</>;
          },
          a: ({ node, ...props }: any) => <a className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />
        }}
      >
        {content || ''}
      </ReactMarkdown>
      </div>
    </ErrorBoundary>
  );
}
