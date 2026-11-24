'use client';

import React from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import { Eye, EyeOff, Layers, Crosshair, Sliders } from 'lucide-react';

export const AnatomyTree: React.FC = () => {
  const {
    structures,
    selectedStructureId,
    selectStructure,
    toggleVisibility,
    setOpacity,
    isolateStructure,
  } = useBrainStore();

  const grouped = {
    cortex: structures.filter((s) => s.type === 'cortex' || s.type === 'subcortical'),
    deep: structures.filter((s) => s.type === 'ventricle' || s.type === 'brainstem' || s.type === 'cerebellum'),
    vascular: structures.filter((s) => s.type === 'vascular'),
    lesion: structures.filter((s) => s.type === 'tumor' || s.type === 'edema'),
  };

  const renderGroup = (title: string, items: typeof structures) => (
    <div className="mb-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-slate-600 font-mono text-[10px]">{items.length} structures</span>
      </div>
      <div className="space-y-1.5">
        {items.map((s) => {
          const isSelected = selectedStructureId === s.id;

          return (
            <div
              key={s.id}
              onClick={() => selectStructure(s.id)}
              className={`group flex flex-col p-2 rounded-lg border transition cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500/50 shadow-md'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span
                    className={`text-xs font-medium truncate ${
                      isSelected ? 'text-cyan-300 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    {s.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isolateStructure(s.id);
                    }}
                    title="Isolate Structure"
                    className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(s.id);
                    }}
                    title={s.visible ? 'Hide Layer' : 'Show Layer'}
                    className={`p-1 rounded transition ${
                      s.visible
                        ? 'text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Opacity slider */}
              {s.visible && (
                <div
                  className="mt-2 pt-1 border-t border-slate-800/60 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500 font-mono w-10">
                    {Math.round(s.opacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={s.opacity}
                    onChange={(e) => setOpacity(s.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-80 h-full flex flex-col bg-[#0b1329]/95 border-r border-slate-800/80 backdrop-blur-xl z-20">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Anatomy Explorer
          </h2>
        </div>
        <span className="text-[10px] font-mono bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/60">
          BraTS Twin
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {renderGroup('Lesion & Edema', grouped.lesion)}
        {renderGroup('Vascular Tree', grouped.vascular)}
        {renderGroup('Cortical Mantle', grouped.cortex)}
        {renderGroup('Deep Brain Nuclei & CSF', grouped.deep)}
      </div>
    </aside>
  );
};
