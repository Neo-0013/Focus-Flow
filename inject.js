const fs = require('fs');
let code = fs.readFileSync('e:/Focus-Flow/onyx-focus/src/views/RoadmapView.tsx', 'utf8');

// Regex to capture the exact end of the Action Hub list correctly regardless of whitespace length
const searchStr = `                        </div>\\r?\\n                     )}\\r?\\n                  </div>\\r?\\n               </div>\\r?\\n             )}`;

const regex = new RegExp(searchStr);

const replacement = `                        </div>
                     )}
                  </div>

                  {/* Today's Focus Queue (Drag and Drop Dropzone) */}
                  <div className="border-t border-white/10 bg-black/40 flex flex-col max-h-[45%] min-h-[180px] shrink-0">
                     <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-accent/10 to-transparent">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/20">
                              <Zap className="w-4 h-4 text-accent" />
                           </div>
                           <h4 className="font-bold text-sm tracking-tight">Today's Queue</h4>
                        </div>
                        <span className="text-xs font-black bg-white/10 px-2 py-0.5 rounded-full">{queuedTasks.length}</span>
                     </div>
                     
                     <div 
                        className={cn("flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative transition-all", queuedTasks.length === 0 ? "items-center justify-center border-2 border-dashed border-white/5 m-4 rounded-[20px]" : "")}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/5', 'border-accent/50'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('bg-white/5', 'border-accent/50'); }}
                        onDrop={(e) => {
                           e.preventDefault();
                           e.currentTarget.classList.remove('bg-white/5', 'border-accent/50');
                           try {
                             const data = e.dataTransfer.getData('roadmapItem');
                             if (data) {
                                const parsedItem = JSON.parse(data);
                                if (!queuedTasks.some(q => q.id === parsedItem.id)) {
                                   setQueuedTasks(prev => [...prev, parsedItem]);
                                }
                             }
                           } catch(err) {}
                        }}
                     >
                        {queuedTasks.length === 0 && (
                           <div className="flex flex-col items-center gap-2 opacity-30 pointer-events-none">
                              <Upload className="w-6 h-6" />
                              <p className="text-xs text-center font-bold">Drag tasks here or use<br/>the Highlight Extractor.</p>
                           </div>
                        )}
                        {queuedTasks.map(q => (
                           <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={q.id} className="p-3 bg-white/5 rounded-xl flex items-start gap-3 border border-white/5 group transition-colors hover:bg-white/10">
                              <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", q.color || 'bg-accent')} />
                              <div className="flex-1">
                                 <h5 className="text-xs font-bold leading-tight line-clamp-2">{q.title}</h5>
                              </div>
                              <button onClick={() => setQueuedTasks(prev => prev.filter(t => t.id !== q.id))} className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Trash2 className="w-3 h-3" />
                              </button>
                           </motion.div>
                        ))}
                     </div>
                     
                     {queuedTasks.length > 0 && (
                        <div className="p-4 border-t border-white/5 bg-black/20">
                           <button onClick={() => {
                              queuedTasks.forEach(q => onAddTask(q));
                              setQueuedTasks([]);
                           }} className="w-full py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2">
                              Commit {queuedTasks.length} to Board <ChevronRight className="w-4 h-4" />
                           </button>
                        </div>
                     )}
                  </div>
               </div>
             )}`;

if(regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('e:/Focus-Flow/onyx-focus/src/views/RoadmapView.tsx', code);
    console.log("Successfully injected Action Hub Drag Dropzone.");
} else {
    console.log("Failed to find exact insertion target with regex.");
}
