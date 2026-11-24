'use client';

import React, { useState, useEffect } from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import {
  Activity,
  Heart,
  Wind,
  Gauge,
  ShieldAlert,
  Zap,
  RotateCcw,
  X,
  Play,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Pill,
} from 'lucide-react';

export const PhysiologyDashboard: React.FC = () => {
  const {
    showPhysiologyDrawer,
    togglePhysiologyDrawer,
    physiologyStream,
    loadPhysiologyStream,
    activeScenario,
    vitals,
    hemodynamics,
    applyIntervention,
  } = useBrainStore();

  const [selectedScenario, setSelectedScenario] = useState('baseline');

  useEffect(() => {
    if (showPhysiologyDrawer && !physiologyStream) {
      loadPhysiologyStream('baseline');
    }
  }, [showPhysiologyDrawer, physiologyStream, loadPhysiologyStream]);

  if (!showPhysiologyDrawer) return null;

  const stream = physiologyStream;
  const currentICP = vitals.intracranial_pressure;
  const currentCPP = hemodynamics?.cerebral_perfusion_pressure ?? 71.0;
  const currentMAP = hemodynamics?.mean_arterial_pressure ?? 93.0;

  return (
    <div className="fixed inset-y-0 right-0 w-[560px] bg-[#090f1d]/98 border-l border-slate-800 shadow-2xl backdrop-blur-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-[#0b1329] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">SNN Physiology Engine</h2>
              <span className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                SpikingJelly / MPS
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Surrogate-Gradient LIF Neurons • 8-Channel Hemodynamics
            </span>
          </div>
        </div>

        <button
          onClick={togglePhysiologyDrawer}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scenario Selector & Controls */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" /> Scenario:
        </span>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          {[
            { id: 'baseline', label: 'Baseline' },
            { id: 'icp_crisis', label: 'ICP Crisis' },
            { id: 'hemorrhagic_shock', label: 'Bleed' },
            { id: 'resection_recovery', label: 'Recovery' },
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                setSelectedScenario(sc.id);
                loadPhysiologyStream(sc.id);
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                selectedScenario === sc.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Real-Time Hemodynamic Core Card */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Mean Arterial (MAP)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-mono font-bold text-slate-100">{currentMAP.toFixed(1)}</span>
              <span className="text-[10px] text-slate-500">mmHg</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono mt-1">Normal Range (70-105)</span>
          </div>

          <div
            className={`border rounded-xl p-3 flex flex-col justify-between ${
              currentICP > 20
                ? 'bg-rose-950/50 border-rose-500/60'
                : currentICP > 15
                ? 'bg-amber-950/40 border-amber-500/50'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className="text-[11px] text-slate-400 font-medium">Intracranial (ICP)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={`text-xl font-mono font-bold ${
                  currentICP > 20 ? 'text-rose-400' : currentICP > 15 ? 'text-amber-400' : 'text-cyan-300'
                }`}
              >
                {currentICP.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500">mmHg</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-1">
              {currentICP > 20 ? '⚠ Hypertension' : 'Normal (< 15)'}
            </span>
          </div>

          <div
            className={`border rounded-xl p-3 flex flex-col justify-between ${
              currentCPP < 60 ? 'bg-amber-950/50 border-amber-500/60' : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className="text-[11px] text-slate-400 font-medium">Cerebral Perfusion (CPP)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={`text-xl font-mono font-bold ${
                  currentCPP < 60 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {currentCPP.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500">mmHg</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-1">
              {currentCPP < 60 ? '⚠ Ischemic Risk' : 'Optimal (60-80)'}
            </span>
          </div>
        </div>

        {/* Spiking Neural Network (SNN) Spike Raster Visualization */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200">SNN Hidden Layer Spike Raster</h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-300">
              16 LIF Neurons × {stream?.timeline.length ?? 20} Steps
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Temporal spike occurrences generated by multi-channel Leaky Integrate-and-Fire neurons.
          </p>

          {/* Raster Matrix Visualizer */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1 overflow-x-auto">
            {Array.from({ length: 12 }).map((_, neuronIdx) => (
              <div key={neuronIdx} className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-slate-500 w-6 text-right">
                  N{neuronIdx}
                </span>
                <div className="flex items-center gap-1">
                  {(stream?.spike_raster || []).map((point, timeIdx) => {
                    const hasSpike = point.neuron_spikes && point.neuron_spikes[neuronIdx] > 0.5;
                    return (
                      <div
                        key={timeIdx}
                        className={`w-2.5 h-3 rounded-sm transition ${
                          hasSpike
                            ? 'bg-cyan-400 shadow-sm shadow-cyan-400/80 animate-pulse'
                            : 'bg-slate-900/60'
                        }`}
                        title={`Neuron ${neuronIdx} @ ${timeIdx}s: ${hasSpike ? 'SPIKE' : 'SILENT'}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Firing Rates */}
        {stream?.channel_spike_rates && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">Afferent Physiological Spike Rates</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              {Object.entries(stream.channel_spike_rates).map(([ch, rate]) => (
                <div
                  key={ch}
                  className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/60"
                >
                  <span className="text-slate-400 truncate max-w-[130px]">{ch.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${Math.min(100, (rate as number) * 100)}%` }}
                      />
                    </div>
                    <span className="text-cyan-300 font-bold w-8 text-right">
                      {((rate as number) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Intraoperative Pharmacology Actions */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200">Emergency Pharmacological Interventions</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyIntervention('icp_drain')}
              className="p-2 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition flex flex-col justify-between"
            >
              <div className="text-xs font-semibold text-slate-200">Mannitol 20% (100 mL)</div>
              <span className="text-[10px] text-cyan-400 font-mono mt-1">-4.0 mmHg ICP Osmotic Drain</span>
            </button>

            <button
              onClick={() => applyIntervention('icp_drain')}
              className="p-2 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition flex flex-col justify-between"
            >
              <div className="text-xs font-semibold text-slate-200">Hyperventilation (EtCO2 30)</div>
              <span className="text-[10px] text-amber-400 font-mono mt-1">Vasoconstrictive Decompression</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
