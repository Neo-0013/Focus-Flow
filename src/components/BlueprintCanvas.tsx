import React, { useState } from 'react';
import { Excalidraw, exportToBlob, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';

interface BlueprintCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

export function BlueprintCanvas({ isOpen, onClose, onSave }: BlueprintCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    if (!elements || !elements.length) {
      onClose();
      return;
    }
    
    const blob = await exportToBlob({
      elements,
      mimeType: "image/png",
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });
    
    onSave(blob);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-midnight-base/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 h-14 bg-black border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-focus-cyan font-bold tracking-widest font-['Space_Grotesk'] text-sm">
          <span className="material-symbols-outlined text-[16px]" data-icon="architecture">architecture</span>
          ARCHITECT BLUEPRINT
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="flex items-center gap-2 px-4 py-1.5 bg-focus-cyan/20 text-focus-cyan text-[10px] font-bold uppercase tracking-widest hover:bg-focus-cyan/30 transition-all rounded-sm border border-focus-cyan/30"
          >
            <span className="material-symbols-outlined text-sm" data-icon="save">save</span>
            Render & Save
          </button>
        </div>
      </div>
      <div className="flex-1 w-full relative bg-[#f9fbfb] overflow-hidden">
        <div className="absolute inset-0">
          <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} UIOptions={{ canvasActions: { loadScene: false, export: false, saveAsImage: false }}}>
            <MainMenu>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
            <WelcomeScreen>
              <WelcomeScreen.Hints.MenuHint />
              <WelcomeScreen.Hints.ToolbarHint />
            </WelcomeScreen>
          </Excalidraw>
        </div>
      </div>
    </div>
  );
}
