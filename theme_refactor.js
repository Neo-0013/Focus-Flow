import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Backgrounds
    code = code.replace(/bg-\[\#050505\]/g, 'bg-app');
    code = code.replace(/bg-\[\#111\]/g, 'bg-panel');
    code = code.replace(/bg-\[\#1a1a1a\]/g, 'bg-panel-dark');
    code = code.replace(/bg-\[\#0a0a0a\]/g, 'bg-sidebar');
    
    // Accents
    code = code.replace(/bg-blue-600/g, 'bg-accent');
    code = code.replace(/text-blue-500/g, 'text-accent');
    code = code.replace(/text-blue-400/g, 'text-accent');
    code = code.replace(/border-blue-500\/30/g, 'border-accent\/30');
    code = code.replace(/bg-blue-600\/20/g, 'bg-accent\/20');
    code = code.replace(/from-blue-600\/20/g, 'from-accent\/20');
    code = code.replace(/to-blue-600\/5/g, 'to-accent\/5');
    code = code.replace(/bg-blue-500/g, 'bg-accent');
    code = code.replace(/text-blue-600/g, 'text-accent');
    // We leave orange (Streak/Level) alone since it's gameify XP specific
    
    fs.writeFileSync(filePath, code);
  }
});
console.log('Successfully refactored hardcoded tailwind classes to semantic variables!');
