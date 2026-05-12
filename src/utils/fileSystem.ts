import { JournalEntry } from '../types';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: FileTreeNode[];
  entry?: JournalEntry;
}

/**
 * Builds a hierarchical tree from a list of journal entries and explicit folder paths.
 */
export const buildFileTree = (entries: JournalEntry[], userFolders: string[]): FileTreeNode[] => {
  const root: FileTreeNode = { id: 'root', name: 'Root', path: '/', type: 'folder', children: [] };
  
  // 1. Add folders to the tree
  const allFolders = [...new Set(['/', ...userFolders, ...entries.map(e => e.folder || '/')])];
  
  allFolders.forEach(folderPath => {
    if (folderPath === '/') return;
    
    const parts = folderPath.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';
    
    parts.forEach(part => {
      currentPath += `/${part}`;
      let node = current.children.find(c => c.type === 'folder' && c.name === part);
      
      if (!node) {
        node = {
          id: `folder-${currentPath}`,
          name: part,
          path: currentPath,
          type: 'folder',
          children: []
        };
        current.children.push(node);
      }
      current = node;
    });
  });
  
  // 2. Add files to their respective folders
  entries.forEach(entry => {
    const folderPath = entry.folder || '/';
    const parts = folderPath.split('/').filter(Boolean);
    let current = root;
    
    parts.forEach(part => {
      const node = current.children.find(c => c.type === 'folder' && c.name === part);
      if (node) current = node;
    });
    
    current.children.push({
      id: entry.id,
      name: entry.title || 'Untitled',
      path: `${folderPath === '/' ? '' : folderPath}/${entry.title}`,
      type: 'file',
      children: [],
      entry
    });
  });
  
  // Sort children (folders first, then alphabetically)
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => sortNodes(n.children));
  };
  
  sortNodes(root.children);
  return root.children;
};
