"""
src/simulation/physiology_service.py
Service layer for Spiking Neural Network (SNN) intraoperative physiology monitoring,
vital signs time-series simulation, hemodynamics (CPP, MAP), and spike raster extraction.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from loguru import logger

import torch
import torch.nn as nn

from .snn_physiology import (
    PHYSIO_CHANNELS,
    N_CHANNELS,
    NORMAL_RANGES,
    IntraoperativeState,
    RateEncoder,
)

# SNN Checkpoint
SNN_CHECKPOINT = Path("models/snn_physiology_best.pt")


class SurrogateHeaviside(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, alpha=2.0):
        ctx.save_for_backward(x)
        ctx.alpha = alpha
        return (x >= 0.0).float()

    @staticmethod
    def backward(ctx, grad_output):
        x, = ctx.saved_tensors
        alpha = ctx.alpha
        grad = alpha / (2.0 * (1.0 + (3.141592653589793 / 2.0 * alpha * x) ** 2))
        return grad_output * grad, None


def heaviside_atan(x, alpha=2.0):
    return SurrogateHeaviside.apply(x, alpha)


class NativeLIFNode(nn.Module):
    """Native PyTorch Leaky Integrate-and-Fire node supporting Apple Silicon MPS & CPU."""

    def __init__(self, tau: float = 2.0, v_threshold: float = 1.0, v_reset: float = 0.0):
        super().__init__()
        self.tau = tau
        self.decay = 1.0 - (1.0 / tau)
        self.v_threshold = v_threshold
        self.v_reset = v_reset

    def forward(self, x_seq: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        x_seq: (T, Batch, Features)
        Returns: (spikes, membrane_potentials)
        """
        T, B, F = x_seq.shape
        spikes = []
        voltages = []
        v = torch.zeros(B, F, device=x_seq.device, dtype=x_seq.dtype)

        for t in range(T):
            v = self.decay * v + x_seq[t]
            spike = heaviside_atan(v - self.v_threshold)
            v_rec = v.clone()
            v = v * (1.0 - spike) + self.v_reset * spike
            spikes.append(spike)
            voltages.append(v_rec)

        return torch.stack(spikes, dim=0), torch.stack(voltages, dim=0)


class SpikingPhysiologyNet(nn.Module):
    """Deep Spiking Neural Network for spatiotemporal vital signs prediction."""

    def __init__(self, in_channels: int = 8, hidden_dim: int = 64, tau: float = 2.0):
        super().__init__()
        self.fc1 = nn.Linear(in_channels, hidden_dim)
        self.lif1 = NativeLIFNode(tau=tau)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim // 2)
        self.lif2 = NativeLIFNode(tau=tau)
        self.fc_out = nn.Linear(hidden_dim // 2, 1)

    def forward(self, x_seq: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        x_seq shape: (T, Batch, N_CHANNELS)
        Returns:
            out: (Batch, 1) predicted recovery score
            s1: (T, Batch, hidden_dim) layer 1 spikes
            s2: (T, Batch, hidden_dim // 2) layer 2 spikes
        """
        T, B, _ = x_seq.shape
        h1 = self.fc1(x_seq.reshape(T * B, -1)).reshape(T, B, -1)
        s1, _ = self.lif1(h1)
        h2 = self.fc2(s1.reshape(T * B, -1)).reshape(T, B, -1)
        s2, _ = self.lif2(h2)
        out = self.fc_out(s2.reshape(T * B, -1)).reshape(T, B, -1)

        return out.mean(dim=0), s1, s2


class PhysiologyService:
    """Service layer for intraoperative SNN vital signs prediction and time-series generation."""

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
        self.model = SpikingPhysiologyNet(in_channels=N_CHANNELS, hidden_dim=64)
        self.encoder = RateEncoder(max_rate=100.0, dt=0.01)

        ckpt = Path(checkpoint_path) if checkpoint_path else SNN_CHECKPOINT
        if ckpt.exists():
            try:
                state_dict = torch.load(ckpt, map_location=self.device)
                self.model.load_state_dict(state_dict, strict=False)
                logger.info(f"Physiology SNN loaded checkpoint from {ckpt}")
            except Exception as e:
                logger.warning(f"Could not load SNN checkpoint: {e}")

        self.model.to(self.device)
        self.model.eval()

    def normalize_vitals(self, vitals: Dict[str, float]) -> np.ndarray:
        """Normalizes raw vitals dict to 8-channel array in [0, 1]."""
        arr = np.zeros(N_CHANNELS, dtype=np.float32)
        for i, ch in enumerate(PHYSIO_CHANNELS):
            val = vitals.get(ch, 0.0)
            lo, hi = NORMAL_RANGES[ch]
            arr[i] = float(np.clip((val - lo) / (hi - lo), 0.0, 1.0))
        return arr

    def compute_hemodynamics(self, vitals: Dict[str, float]) -> Dict[str, float]:
        """Calculates Mean Arterial Pressure (MAP) and Cerebral Perfusion Pressure (CPP)."""
        sys_bp = vitals.get("blood_pressure_systolic", 120.0)
        dia_bp = vitals.get("blood_pressure_diastolic", 80.0)
        icp = vitals.get("intracranial_pressure", 12.0)

        # MAP = (2 * DBP + SBP) / 3
        map_val = (2.0 * dia_bp + sys_bp) / 3.0
        # CPP = MAP - ICP (Normal clinical target: 60 - 80 mmHg)
        cpp_val = map_val - icp

        return {
            "mean_arterial_pressure": round(map_val, 1),
            "cerebral_perfusion_pressure": round(cpp_val, 1),
            "cpp_status": "NORMAL" if cpp_val >= 60.0 else "ISCHEMIC_RISK" if cpp_val >= 50.0 else "CRITICAL",
        }

    def generate_scenario_stream(
        self,
        scenario: str = "baseline",
        duration_sec: int = 30,
        resection_percent: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Generates a synchronized time-series of intraoperative vitals with SNN spike trains.
        Scenarios: 'baseline', 'icp_crisis', 'hemorrhagic_shock', 'resection_recovery'.
        """
        np.random.seed(42)
        timeline = []
        raw_seq = []

        base_bp_sys = 122.0
        base_bp_dia = 78.0
        base_hr = 72.0
        base_spo2 = 99.0
        base_icp = max(9.5, 22.0 - (resection_percent / 100.0) * 11.5)
        base_cbf = min(62.0, 45.0 + (resection_percent / 100.0) * 15.0)
        base_eto2 = 36.0
        base_etco2 = 38.0

        for t in range(duration_sec):
            noise = np.random.normal(0, 0.4, N_CHANNELS)

            if scenario == "icp_crisis" and t > duration_sec // 3:
                # Cushing's Triad: Hypertension + Bradycardia + Rising ICP
                base_icp += 0.4
                base_bp_sys += 0.5
                base_bp_dia += 0.3
                base_hr -= 0.3
                base_cbf -= 0.5
            elif scenario == "hemorrhagic_shock" and t > duration_sec // 3:
                base_bp_sys -= 0.8
                base_bp_dia -= 0.5
                base_hr += 0.8
                base_cbf -= 0.6
            elif scenario == "resection_recovery":
                # Gradual decompression
                base_icp = max(9.8, base_icp - 0.15)
                base_cbf = min(65.0, base_cbf + 0.15)

            vitals = {
                "blood_pressure_systolic": float(base_bp_sys + noise[0]),
                "blood_pressure_diastolic": float(base_bp_dia + noise[1]),
                "heart_rate": float(base_hr + noise[2]),
                "spo2": float(np.clip(base_spo2 + noise[3] * 0.2, 75.0, 100.0)),
                "intracranial_pressure": float(max(0.0, base_icp + noise[4] * 0.3)),
                "cerebral_blood_flow": float(base_cbf + noise[5] * 0.5),
                "eto2": float(base_eto2 + noise[6] * 0.2),
                "etco2": float(base_etco2 + noise[7] * 0.2),
            }

            hemo = self.compute_hemodynamics(vitals)
            point = {
                "time_sec": t,
                "vitals": {k: round(v, 1) for k, v in vitals.items()},
                "hemodynamics": hemo,
            }
            timeline.append(point)
            raw_seq.append(self.normalize_vitals(vitals))

        # Run through SNN model
        x_tensor = torch.tensor(np.array(raw_seq), dtype=torch.float32).unsqueeze(1).to(self.device)
        with torch.no_grad():
            pred_recovery, s1, s2 = self.model(x_tensor)

        recovery_val = float(np.clip(pred_recovery.item(), 0.05, 0.98))
        # Spikes raster for first 16 hidden neurons over time
        s1_np = s1.squeeze(1).cpu().numpy()  # (T, 64)
        spike_raster = [
            {"time_sec": t, "neuron_spikes": s1_np[t, :16].tolist()}
            for t in range(duration_sec)
        ]

        # Calculate average channel firing rate
        channel_spike_rates = {
            ch: round(float(np.mean(raw_seq, axis=0)[i]), 3)
            for i, ch in enumerate(PHYSIO_CHANNELS)
        }

        current_vitals = timeline[-1]["vitals"]
        current_hemo = timeline[-1]["hemodynamics"]
        alerts = []
        if current_vitals["intracranial_pressure"] > 20.0:
            alerts.append("CRITICAL: Severe Intracranial Hypertension (ICP > 20 mmHg)")
        if current_hemo["cerebral_perfusion_pressure"] < 60.0:
            alerts.append("WARNING: Inadequate Cerebral Perfusion Pressure (CPP < 60 mmHg)")
        if current_vitals["spo2"] < 92.0:
            alerts.append("CRITICAL: Systemic Arterial Desaturation (SpO2 < 92%)")

        alert_level = "CRITICAL" if any("CRITICAL" in a for a in alerts) else "WARNING" if alerts else "NORMAL"

        return {
            "scenario": scenario,
            "duration_sec": duration_sec,
            "current_vitals": current_vitals,
            "hemodynamics": current_hemo,
            "predicted_recovery_score": round(recovery_val, 3),
            "alert_level": alert_level,
            "active_alerts": alerts,
            "channel_spike_rates": channel_spike_rates,
            "spike_raster": spike_raster,
            "timeline": timeline,
        }
