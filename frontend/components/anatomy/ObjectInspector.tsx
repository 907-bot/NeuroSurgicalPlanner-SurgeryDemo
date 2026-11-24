'use client';

import React from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import {
  Info,
  AlertTriangle,
  Activity,
  Database,
  GitBranch,
  ShieldCheck,
  Network,
  Users,
} from 'lucide-react';

export const ObjectInspector: React.FC = () => {
  const {
    structures,
    selectedStructureId,
    applyIntervention,
    gnnPrediction,
    toggleDeliberationDrawer,
    runAgentDeliberation,
    activePatient,
  } = useBrainStore();

  const selected = structures.find((s) => s.id === selectedStructureId);

  if (!selected) {
    return (
      <aside className="w-80 h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-[#0b1329]/95 border-l border-slate-800">
        <Info className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
        <p className="text-xs">Click any anatomical structure or tumor in the 3D viewport to inspect clinical metadata.</p>
      </aside>
    );
  }

  const riskScore = selected.riskScore ?? 0.15;
  const riskColor =
    riskScore > 0.6
      ? 'text-red-400 border-red-500/40 bg-red-950/40'
      : riskScore > 0.25
      ? 'text-amber-400 border-amber-500/40 bg-amber-950/40'
      : 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';

  // Connected graph neighbors
  const connectedEdges = (gnnPrediction?.graph_edges || []).filter(
    (e) => e.source === selected.id || e.target === selected.id
  );

  return (
    <aside className="w-80 h-full flex flex-col bg-[#0b1329]/95 border-l border-slate-800/80 backdrop-blur-xl z-20 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Structure Inspector
          </h2>
        </div>
        <span
          className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-700"
          style={{ backgroundColor: selected.color }}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* Name and Type */}
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400">
            {selected.type}
          </span>
          <h3 className="text-sm font-bold text-slate-100">{selected.name}</h3>
        </div>

        {/* GNN Risk Card */}
        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${riskColor}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <div>
              <div className="text-xs font-semibold">Anatomical GNN Risk</div>
              <div className="text-[9px] text-slate-400 font-mono">Heterogeneous GAT + GIN</div>
            </div>
          </div>
          <span className="font-mono text-base font-bold">
            {(riskScore * 100).toFixed(0)}%
          </span>
        </div>

        {/* Clinical Metrics Table */}
        <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
            <span className="text-slate-400">Volume</span>
            <span className="font-mono text-slate-200 font-medium">
              {selected.volumeCm3 ? `${selected.volumeCm3.toFixed(1)} cm³` : 'N/A'}
            </span>
          </div>
          {selected.vertex_count && (
            <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Mesh Complexity</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {selected.vertex_count.toLocaleString()} v / {(selected.face_count ?? 0).toLocaleString()} f
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
            <span className="text-slate-400">Blood Supply</span>
            <span className="font-mono text-slate-200 text-right truncate max-w-[130px]">
              {selected.bloodSupply ?? 'Capillary bed'}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400">Stereotactic Centroid</span>
            <span className="font-mono text-cyan-300 text-[11px]">
              [{selected.coordinates?.map((c) => c.toFixed(0)).join(', ')}] mm
            </span>
          </div>
        </div>

        {/* GNN Graph Neighborhood */}
        {connectedEdges.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>GNN Graph Adjacency ({connectedEdges.length})</span>
            </div>
            <div className="space-y-1">
              {connectedEdges.slice(0, 3).map((edge, i) => {
                const otherNode = edge.source === selected.id ? edge.target : edge.source;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/60 text-[11px] font-mono"
                  >
                    <span className="text-slate-300 truncate max-w-[120px]">{otherNode}</span>
                    <span className="text-slate-500">{edge.distance_mm} mm</span>
                    <span className="text-cyan-400 font-semibold">w={edge.weight}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Pathological Context
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-800/60">
            {selected.description}
          </p>
        </div>

        {/* Interventions & Consultation Action */}
        <div className="pt-1 space-y-2">
          <button
            onClick={() => {
              toggleDeliberationDrawer();
              runAgentDeliberation(activePatient);
            }}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Launch Multi-Agent Consultation</span>
          </button>

          <button
            onClick={() => applyIntervention('remove_tumor_full')}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-800 hover:border-cyan-500/50 transition"
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate do(resect_tumor)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
