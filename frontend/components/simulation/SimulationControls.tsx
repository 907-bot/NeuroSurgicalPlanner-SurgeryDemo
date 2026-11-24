'use client';

import React, { useEffect } from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import {
  Play,
  Pause,
  RotateCcw,
  Award,
  ChevronRight,
  Zap,
  Split,
  Eye,
  Sliders,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { SimulationStage, ComparisonMode } from '../../types/anatomy';

const STAGES: { id: SimulationStage; label: string; desc: string }[] = [
  { id: 'pre_op', label: '1. Pre-Op Diagnosis', desc: 'Volumetric MRI Segmentation & GNN Risk' },
  { id: 'craniotomy', label: '2. Craniotomy', desc: 'Skull Flap & Dural Window Boundary' },
  { id: 'probe_navigation', label: '3. Trajectory Nav', desc: 'Stereotactic Cannula Guidance' },
  { id: 'resection', label: '4. Resection Sim', desc: 'CUSA Cavitation & Brain Shift' },
  { id: 'post_op', label: '5. Post-Op Outcome', desc: 'Before vs After Cavity & Recovery' },
];

export const SimulationControls: React.FC = () => {
  const {
    stage,
    setStage,
    comparisonMode,
    setComparisonMode,
    instrument,
    setInstrumentProgress,
    setInstrumentDepth,
    isSimulating,
    toggleSimulationPlay,
    plans,
    applyIntervention,
    resetScene,
    needlePhysics,
    togglePhysicsModal,
  } = useBrainStore();

  const [activeTab, setActiveTab] = React.useState<'stages' | 'plans' | 'causal'>('stages');

  // Automated simulation timeline playback
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      if (stage === 'pre_op') {
        setStage('craniotomy');
      } else if (stage === 'craniotomy') {
        setStage('probe_navigation');
        setInstrumentDepth(15);
      } else if (stage === 'probe_navigation') {
        if (instrument.depthMm < 50) {
          setInstrumentDepth(instrument.depthMm + 10);
        } else {
          setStage('resection');
        }
      } else if (stage === 'resection') {
        if (instrument.resectionProgress < 100) {
          setInstrumentProgress(Math.min(100, instrument.resectionProgress + 15));
        } else {
          setStage('post_op');
          toggleSimulationPlay();
        }
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [
    isSimulating,
    stage,
    instrument.depthMm,
    instrument.resectionProgress,
    setStage,
    setInstrumentDepth,
    setInstrumentProgress,
    toggleSimulationPlay,
  ]);

  return (
    <div className="h-48 bg-[#0b1329]/95 border-t border-slate-800 backdrop-blur-xl px-4 py-2.5 flex flex-col justify-between z-20">
      {/* Top Procedural Stepper Timeline */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulationPlay}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              isSimulating
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/40'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'Pause Sim' : 'Auto Play Sim'}</span>
          </button>

          <button
            onClick={resetScene}
            title="Reset Procedure"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stage Stepper Buttons */}
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, idx) => {
            const isActive = stage === s.id;
            const isPassed = STAGES.findIndex((st) => st.id === stage) > idx;

            return (
              <button
                key={s.id}
                onClick={() => setStage(s.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                    : isPassed
                    ? 'bg-slate-900 text-cyan-300 border border-cyan-800/50'
                    : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {isPassed && <CheckCircle className="w-3 h-3 text-cyan-400" />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab & Comparison Mode Switchers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('stages')}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === 'stages' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Instruments
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === 'plans' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ranked Plans
            </button>
            <button
              onClick={() => setActiveTab('causal')}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === 'causal' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Causal Do
            </button>
          </div>

          <button
            onClick={() => setComparisonMode(comparisonMode === 'single' ? 'split' : 'single')}
            className={`p-1.5 rounded text-xs border transition flex items-center gap-1 ${
              comparisonMode === 'split'
                ? 'bg-rose-950/80 border-rose-500/80 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Split Before/After Comparison"
          >
            <Split className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">{comparisonMode === 'split' ? 'Split View' : 'Single'}</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 flex gap-4 pt-2 min-h-0 overflow-hidden">
        {activeTab === 'stages' && (
          <div className="flex-1 flex items-center justify-between gap-6 px-2">
            {/* Trajectory Depth Slider */}
            <div className="flex-1 bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Cannula Penetration Depth
                </span>
                <div className="flex items-center gap-2">
                  {needlePhysics && (
                    <button
                      onClick={togglePhysicsModal}
                      title="Click to open SOFA Physics Inspector"
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 transition"
                    >
                      {needlePhysics.total_force_n.toFixed(3)} N ({needlePhysics.phase.replace('_', ' ')})
                    </button>
                  )}
                  <span className="font-mono text-cyan-400 text-[11px]">
                    {instrument.depthMm.toFixed(1)} mm / 52.0 mm
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="52"
                step="1"
                value={instrument.depthMm}
                onChange={(e) => setInstrumentDepth(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>Skull Cortex (0 mm)</span>
                <span>Subcortical Tracts</span>
                <span>Tumor Centroid (52 mm)</span>
              </div>
            </div>

            {/* Ultrasonic Resection Slider */}
            <div className="flex-1 bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" /> CUSA Resection Debulking
                </span>
                <span className="font-mono text-rose-400 text-[11px]">
                  {instrument.resectionProgress.toFixed(0)}% Complete
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={instrument.resectionProgress}
                onChange={(e) => setInstrumentProgress(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>Intact Margin</span>
                <span>Core Cavitation</span>
                <span>Gross Total Resection</span>
              </div>
            </div>

            {/* Biomechanical Brain Shift Monitor */}
            <div className="w-56 bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-amber-400" /> Biomechanical Shift
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-bold text-amber-400">
                  {instrument.tissueShiftMm.toFixed(2)} mm
                </span>
                <span className="text-[10px] font-mono text-slate-500">FEM Gravity Model</span>
              </div>
              <span className="text-[9px] text-slate-400">
                Parenchymal sag adjusted dynamically in Three.js coordinates.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="flex-1 grid grid-cols-3 gap-3 overflow-y-auto">
            {plans.map((p) => (
              <div
                key={p.rank}
                onClick={() => applyIntervention('remove_tumor_full')}
                className={`p-2 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                  p.rank === 1
                    ? 'bg-cyan-950/30 border-cyan-500/40 hover:border-cyan-400'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-300">
                      Plan #{p.rank} {p.rank === 1 && '★ Optimal'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      +{(p.utility * 100).toFixed(0)}% Net Utility
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 space-y-0.5">
                    {p.actions.map((act, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <ChevronRight className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{act}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Rec: {(p.expected_recovery * 100).toFixed(0)}%</span>
                  <span className="text-rose-400">Risk: {(p.risk_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'causal' && (
          <div className="flex-1 flex items-center gap-3">
            <button
              onClick={() => applyIntervention('remove_tumor_full')}
              className="flex-1 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                <span>do(resect_tumor)</span>
                <span className="text-emerald-400 font-mono text-[11px]">+22% Recovery</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Surgically excises malignant mass and attenuates vasogenic mass effect.
              </p>
            </button>

            <button
              onClick={() => applyIntervention('icp_drain')}
              className="flex-1 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                <span>do(drain_ventricles)</span>
                <span className="text-cyan-400 font-mono text-[11px]">-5.5 mmHg ICP</span>
              </div>
              <p className="text-[10px] text-slate-400">
                External ventricular drain (EVD) for immediate cranial decompression.
              </p>
            </button>

            <button
              onClick={() => applyIntervention('arterial_clamp')}
              className="flex-1 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                <span>do(mca_clamp)</span>
                <span className="text-amber-400 font-mono text-[11px]">Hemostasis Control</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Temporary microvascular clip to prevent intraoperative hemorrhage.
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
