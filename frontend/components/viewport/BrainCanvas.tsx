'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BrainScene } from './BrainScene';
import {
  Loader2,
  RotateCcw,
  Compass,
  Flame,
  Network,
  Users,
  Brain,
} from 'lucide-react';
import { useBrainStore } from '../../stores/useBrainStore';

export const BrainCanvas: React.FC = () => {
  const {
    cameraView,
    setCameraView,
    viewMode,
    setViewMode,
    resetAllVisibility,
    showRiskHeatmap,
    toggleRiskHeatmap,
    showGraphEdges,
    toggleGraphEdges,
    toggleDeliberationDrawer,
    activePatient,
    runAgentDeliberation,
    deliberations,
    modelViewMode,
    toggleModelViewMode,
  } = useBrainStore();

  return (
    <div className="relative w-full h-full bg-[#080c14] select-none overflow-hidden">
      {/* Top Floating Viewport Control Bar */}
      <div className="absolute top-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* View Presets & Mesh Mode */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-xl pointer-events-auto">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> View:
          </span>
          <button
            onClick={() => setCameraView('iso')}
            className={`px-2 py-1 text-xs rounded font-medium transition ${
              cameraView === 'iso' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            3D Iso
          </button>
          <button
            onClick={() => setCameraView('axial')}
            className={`px-2 py-1 text-xs rounded font-medium transition ${
              cameraView === 'axial' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Axial
          </button>
          <button
            onClick={() => setCameraView('sagittal')}
            className={`px-2 py-1 text-xs rounded font-medium transition ${
              cameraView === 'sagittal' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Sagittal
          </button>
          <button
            onClick={() => setCameraView('coronal')}
            className={`px-2 py-1 text-xs rounded font-medium transition ${
              cameraView === 'coronal' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Coronal
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          <button
            onClick={toggleModelViewMode}
            className={`px-2 py-1 text-xs rounded font-medium transition flex items-center gap-1.5 ${
              modelViewMode === 'anatomical'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 text-cyan-300 border border-cyan-800/60'
            }`}
            title="Switch between Anatomical 3D Digital Twin and Raw MRI Mesh"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>{modelViewMode === 'anatomical' ? '3D Anatomical Twin' : 'Raw MRI Mesh'}</span>
          </button>
        </div>

        {/* Mode Selector & AI Overlays */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-xl pointer-events-auto">
          {/* Procedural Views */}
          <button
            onClick={() => setViewMode('inspect')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition ${
              viewMode === 'inspect' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Inspect
          </button>
          <button
            onClick={() => setViewMode('trajectory')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition ${
              viewMode === 'trajectory' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Surgical Probe
          </button>
          <button
            onClick={() => setViewMode('resection')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition ${
              viewMode === 'resection' ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Resection Sim
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* GNN Heatmap Toggle */}
          <button
            onClick={toggleRiskHeatmap}
            title="Toggle GNN Risk Heatmap"
            className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
              showRiskHeatmap
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-900/40'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>GNN Risk</span>
          </button>

          {/* 3D Neural Graph Edges Toggle */}
          <button
            onClick={toggleGraphEdges}
            title="Toggle 3D Anatomical Knowledge Graph Edges"
            className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
              showGraphEdges
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-900/40'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>

          {/* Multi-Agent Consultation Drawer Button */}
          <button
            onClick={() => {
              toggleDeliberationDrawer();
              if (deliberations.length === 0) {
                runAgentDeliberation(activePatient);
              }
            }}
            title="Open Multi-Agent Consultation Panel"
            className="px-2.5 py-1 text-xs rounded font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-cyan-900/40 transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Consultation Panel</span>
          </button>

          <button
            onClick={resetAllVisibility}
            title="Reset All Layers"
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Orientation & Coordinate System Indicator */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none text-[11px] text-slate-500 font-mono flex flex-col gap-0.5 bg-slate-950/70 p-2 rounded border border-slate-900">
        <div>COORDINATES: <span className="text-cyan-400">RAS (Right-Anterior-Superior)</span></div>
        <div>INTELLIGENCE: <span className="text-slate-300">Anatomical GNN + Causal SCM</span></div>
        <div>SCALE: <span className="text-slate-300">1 unit = 1.0 mm (Isotropic)</span></div>
      </div>

      {/* R3F Canvas */}
      <Canvas
        camera={{ position: [140, 110, 140], fov: 42, near: 0.5, far: 2000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Suspense
          fallback={
            <Html center>
              <div className="flex items-center gap-2 text-cyan-400 text-sm bg-slate-900/90 px-4 py-2 rounded-lg border border-slate-800 shadow-2xl">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading Patient Digital Twin & Neural Graph...</span>
              </div>
            </Html>
          }
        >
          <BrainScene />
        </Suspense>
      </Canvas>
    </div>
  );
};
