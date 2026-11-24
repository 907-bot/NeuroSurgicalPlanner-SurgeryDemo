'use client';

import React from 'react';
import { useBrainStore } from '../../stores/useBrainStore';
import { Activity, Heart, Wind, Gauge, Sparkles, LineChart } from 'lucide-react';

export const VitalsHUD: React.FC = () => {
  const { vitals, hemodynamics, togglePhysiologyDrawer } = useBrainStore();

  const isWarning = vitals.alert_level === 'WARNING';
  const isCritical = vitals.alert_level === 'CRITICAL';

  const cpp = hemodynamics?.cerebral_perfusion_pressure ?? (vitals.blood_pressure_diastolic + (vitals.blood_pressure_systolic - vitals.blood_pressure_diastolic) / 3 - vitals.intracranial_pressure);

  return (
    <div className="flex items-center gap-3 bg-[#0f172a]/95 backdrop-blur-md px-4 py-2 border-b border-slate-800 text-xs">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
        <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
        <span className="font-bold text-slate-200 tracking-wider">INTRAOP SNN VITALS</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
            isCritical
              ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
              : isWarning
              ? 'bg-amber-950 text-amber-400 border border-amber-800'
              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
          }`}
        >
          {vitals.alert_level}
        </span>
      </div>

      {/* Blood Pressure */}
      <div className="flex items-center gap-1.5 px-2">
        <Gauge className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">BP:</span>
        <span className="font-mono font-bold text-slate-100">
          {Math.round(vitals.blood_pressure_systolic)}/{Math.round(vitals.blood_pressure_diastolic)}
        </span>
        <span className="text-[10px] text-slate-500">mmHg</span>
      </div>

      {/* Heart Rate */}
      <div className="flex items-center gap-1.5 px-2">
        <Heart className="w-3.5 h-3.5 text-rose-400" />
        <span className="text-slate-400">HR:</span>
        <span className="font-mono font-bold text-slate-100">{Math.round(vitals.heart_rate)}</span>
        <span className="text-[10px] text-slate-500">bpm</span>
      </div>

      {/* SpO2 */}
      <div className="flex items-center gap-1.5 px-2">
        <Wind className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-slate-400">SpO2:</span>
        <span className="font-mono font-bold text-slate-100">{Math.round(vitals.spo2)}%</span>
      </div>

      {/* Intracranial Pressure (ICP) */}
      <div className="flex items-center gap-1.5 px-2">
        <span className="text-slate-400">ICP:</span>
        <span
          className={`font-mono font-bold ${
            vitals.intracranial_pressure > 20
              ? 'text-red-400 animate-bounce'
              : vitals.intracranial_pressure > 15
              ? 'text-amber-400'
              : 'text-cyan-300'
          }`}
        >
          {vitals.intracranial_pressure.toFixed(1)}
        </span>
        <span className="text-[10px] text-slate-500">mmHg</span>
      </div>

      {/* Cerebral Perfusion Pressure (CPP) */}
      <div className="flex items-center gap-1.5 px-2 border-l border-slate-800/80">
        <span className="text-slate-400">CPP:</span>
        <span
          className={`font-mono font-bold ${
            cpp < 50
              ? 'text-red-400 font-extrabold'
              : cpp < 60
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`}
        >
          {cpp.toFixed(1)}
        </span>
        <span className="text-[10px] text-slate-500">mmHg</span>
      </div>

      {/* Cerebral Blood Flow (CBF) */}
      <div className="flex items-center gap-1.5 px-2">
        <span className="text-slate-400">CBF:</span>
        <span className="font-mono font-bold text-slate-100">{vitals.cerebral_blood_flow.toFixed(1)}</span>
        <span className="text-[10px] text-slate-500">mL/100g</span>
      </div>

      {/* SNN Hemodynamics Dashboard Trigger */}
      <div className="ml-auto flex items-center gap-3 pl-3 border-l border-slate-800">
        <button
          onClick={togglePhysiologyDrawer}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition text-[11px] font-semibold"
        >
          <LineChart className="w-3.5 h-3.5 text-cyan-400" />
          <span>SNN Spike Monitor</span>
        </button>

        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Recovery:</span>
          <span className="font-mono font-bold text-cyan-300">
            {(vitals.recovery_score * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
