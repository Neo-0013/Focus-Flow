import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    optimizeDeps: {
      include: [
        'react', 'react-dom', 'motion/react', 'lucide-react', 'axios', 
        'socket.io-client', 'canvas-confetti', 'recharts', 'react-quill',
        '@uiw/react-codemirror', '@uiw/codemirror-theme-vscode',
        '@codemirror/lang-javascript', '@codemirror/lang-python',
        'mermaid', 'tldraw', 'katex'
      ]
    },
  };
});
