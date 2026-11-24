'use client';

import React, { useState } from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import {
  Brain,
  ShieldAlert,
  Zap,
  Compass,
  Award,
  Loader2,
  RefreshCw,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const AVATAR_MAP: Record<string, React.ReactNode> = {
  brain: <Brain className="w-4 h-4 text-cyan-400" />,
  shield: <ShieldAlert className="w-4 h-4 text-amber-400" />,
  zap: <Zap className="w-4 h-4 text-emerald-400" />,
  compass: <Compass className="w-4 h-4 text-indigo-400" />,
  award: <Award className="w-4 h-4 text-rose-400" />,
};

export const MultiAgentConsultation: React.FC = () => {
  const {
    activePatient,
    deliberations,
    fullSurgicalReport,
    isDeliberating,
    showDeliberationDrawer,
    toggleDeliberationDrawer,
    runAgentDeliberation,
  } = useBrainStore();

  const [activeTab, setActiveTab] = useState<'deliberation' | 'report'>('deliberation');

  if (!showDeliberationDrawer) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-[#090f1d]/98 border-l border-slate-800 shadow-2xl backdrop-blur-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#0b1329]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-900/40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">Multi-Agent Consultation</h2>
              <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Consensus
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Study: {activePatient} • 5 Specialized Agents
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => runAgentDeliberation(activePatient)}
            disabled={isDeliberating}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
            title="Re-run Multi-Agent Deliberation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDeliberating ? 'animate-spin' : ''}`} />
            <span>{isDeliberating ? 'Deliberating...' : 'Re-Run'}</span>
          </button>

          <button
            onClick={toggleDeliberationDrawer}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveTab('deliberation')}
          className={`px-3 py-1 rounded font-medium transition ${
            activeTab === 'deliberation'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Specialist Deliberation ({deliberations.length})
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-3 py-1 rounded font-medium transition flex items-center gap-1.5 ${
            activeTab === 'report'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Clinical Consensus Report
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
        {isDeliberating ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-200">
              Multi-Agent Consultation in Progress...
            </div>
            <p className="text-xs text-slate-400 max-w-xs">
              Neuro-Anatomist, GNN Risk Evaluator, and Do-Calculus Strategist are deliberating sequential surgical pathways.
            </p>
          </div>
        ) : activeTab === 'deliberation' ? (
          deliberations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Brain className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">No Deliberations Loaded</div>
              <p className="text-xs text-slate-500 max-w-xs">
                Click below to launch real-time multi-agent consensus deliberation for case {activePatient}.
              </p>
              <button
                onClick={() => runAgentDeliberation(activePatient)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-900/50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Start Deliberation Panel
              </button>
            </div>
          ) : (
            deliberations.map((d, idx) => (
              <div
                key={idx}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-lg hover:border-slate-700 transition"
              >
                {/* Agent Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                      {AVATAR_MAP[d.avatar] || <Brain className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{d.name}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{d.role}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      d.status === 'CONSENSUS_REACHED'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>

                {/* Agent Message */}
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  {d.message}
                </p>

                {/* Key Metrics Pill Badges */}
                {d.key_metrics && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(d.key_metrics).map(([key, val]) => (
                      <span
                        key={key}
                        className="bg-slate-800/80 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1"
                      >
                        <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold text-cyan-300">
                          {typeof val === 'number' ? val.toFixed(2) : String(val)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text">
            {fullSurgicalReport || 'No clinical report generated yet. Run deliberation first.'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#0b1329] flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Research Simulation Prototype • Clinical Decision Support</span>
        </span>
      </div>
    </div>
  );
};
