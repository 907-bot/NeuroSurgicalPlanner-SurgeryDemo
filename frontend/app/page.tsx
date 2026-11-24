'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AnatomyTree } from '../components/anatomy/AnatomyTree';
import { ObjectInspector } from '../components/anatomy/ObjectInspector';
import { VitalsHUD } from '../components/monitors/VitalsHUD';
import { SimulationControls } from '../components/simulation/SimulationControls';
import { MultiAgentConsultation } from '../components/ai/MultiAgentConsultation';
import { PhysiologyDashboard } from '../components/monitors/PhysiologyDashboard';
import { PhysicsInspectorModal } from '../components/simulation/PhysicsInspectorModal';
import { ValidationDashboardModal } from '../components/evaluation/ValidationDashboardModal';
import { useBrainStore } from '../stores/useBrainStore';
import { Brain, Cpu, ShieldCheck, ChevronDown, Activity, Settings, ExternalLink, Layers, Award } from 'lucide-react';

// Dynamically import Three.js canvas to prevent Next.js SSR hydration mismatches
const BrainCanvas = dynamic(
  () => import('../components/viewport/BrainCanvas').then((mod) => mod.BrainCanvas),
  { ssr: false }
);

export default function WorkstationPage() {
  const { activePatient, setActivePatient, loadPatient, togglePhysicsModal, toggleValidationModal } = useBrainStore();

  React.useEffect(() => {
    loadPatient(activePatient);
  }, [activePatient]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] overflow-hidden">
      {/* Top Main Navigation Header */}
      <header className="h-14 bg-[#0b1329] border-b border-slate-800 px-4 flex items-center justify-between z-30 flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-widest text-slate-100 uppercase">
                  NEUROVERSE<span className="text-cyan-400">.AI</span>
                </span>
                <span className="bg-cyan-950/80 text-cyan-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-cyan-800/80">
                  v1.0 RESEARCH
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Unified Neurosurgical Digital Twin & Interactive Simulation
              </span>
            </div>
          </div>

          {/* Active Study / Case Selector */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400 font-medium">Active Case:</span>
            <select
              value={activePatient}
              onChange={(e) => setActivePatient(e.target.value)}
              className="bg-transparent text-cyan-300 font-mono font-semibold focus:outline-none cursor-pointer"
            >
              <option value="BRATS001" className="bg-slate-900 text-slate-200">
                BRATS-001 (Left Temporal Glioblastoma)
              </option>
              <option value="BRATS002" className="bg-slate-900 text-slate-200">
                BRATS-002 (Frontal Convexity Oligodendroglioma)
              </option>
              <option value="BRATS003" className="bg-slate-900 text-slate-200">
                BRATS-003 (Parieto-Occipital High Grade Glioma)
              </option>
              <option value="BRATS004" className="bg-slate-900 text-slate-200">
                BRATS-004 (Right Deep Subcortical Mass)
              </option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* System Badges & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleValidationModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg text-xs font-semibold text-emerald-300 transition shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validation & Ablation</span>
          </button>
          <button
            onClick={togglePhysicsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 rounded-lg text-xs font-semibold text-indigo-300 transition shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>SOFA Physics & FEM</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>ACCEL: Apple M5 (MPS Active)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>FastAPI REST: :8000</span>
          </div>
        </div>
      </header>

      {/* Intraoperative Vitals HUD */}
      <VitalsHUD />

      {/* Center 3-Column Workstation Layout */}
      <main className="flex-1 flex min-h-0 relative">
        {/* Left Anatomy Hierarchy Explorer */}
        <AnatomyTree />

        {/* Central 3D Brain Viewport */}
        <section className="flex-1 relative h-full min-w-0">
          <BrainCanvas />
        </section>

        {/* Right Object & Clinical Inspector */}
        <ObjectInspector />
      </main>

      {/* Bottom Counterfactual Simulation & Action Timeline */}
      <SimulationControls />

      {/* Multi-Agent Consultation Drawer Overlay */}
      <MultiAgentConsultation />

      {/* SNN Physiology & Hemodynamics Monitor Overlay */}
      <PhysiologyDashboard />

      {/* SOFA Physics & FEM Biomechanics Inspector Modal */}
      <PhysicsInspectorModal />

      {/* Scientific Validation & Ablation Dashboard Modal */}
      <ValidationDashboardModal />
    </div>
  );
}
