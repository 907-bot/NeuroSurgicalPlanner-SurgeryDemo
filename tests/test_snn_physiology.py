"""
tests/test_snn_physiology.py
Unit tests for SNN intraoperative physiology simulation, vital signs time-series,
hemodynamics (CPP, MAP), and spike raster generation.
"""

import numpy as np
import pytest
import torch
from src.simulation.physiology_service import PhysiologyService, NativeLIFNode, SpikingPhysiologyNet


def test_hemodynamics_calculation():
    srv = PhysiologyService()

    # Normal baseline: BP 120/80, ICP 10
    vitals = {
        "blood_pressure_systolic": 120.0,
        "blood_pressure_diastolic": 80.0,
        "intracranial_pressure": 10.0,
    }
    hemo = srv.compute_hemodynamics(vitals)
    # MAP = (2*80 + 120)/3 = 280/3 = 93.3
    assert hemo["mean_arterial_pressure"] == pytest.approx(93.3, abs=0.2)
    # CPP = MAP - ICP = 93.3 - 10 = 83.3
    assert hemo["cerebral_perfusion_pressure"] == pytest.approx(83.3, abs=0.2)
    assert hemo["cpp_status"] == "NORMAL"

    # Ischemic risk: BP 90/60, ICP 22
    vitals_critical = {
        "blood_pressure_systolic": 90.0,
        "blood_pressure_diastolic": 60.0,
        "intracranial_pressure": 22.0,
    }
    hemo_critical = srv.compute_hemodynamics(vitals_critical)
    # MAP = (120 + 90)/3 = 70.0
    # CPP = 70 - 22 = 48.0
    assert hemo_critical["cerebral_perfusion_pressure"] == pytest.approx(48.0, abs=0.2)
    assert hemo_critical["cpp_status"] == "CRITICAL"


def test_native_lif_forward():
    lif = NativeLIFNode(tau=2.0, v_threshold=1.0)
    # Input tensor shape: (T=10, B=2, F=8)
    x = torch.ones(10, 2, 8) * 0.8
    spikes, voltages = lif(x)

    assert spikes.shape == (10, 2, 8)
    assert voltages.shape == (10, 2, 8)
    # Spikes should be binary 0.0 or 1.0
    assert torch.all((spikes == 0.0) | (spikes == 1.0))


def test_snn_scenario_generation():
    srv = PhysiologyService()

    res = srv.generate_scenario_stream("baseline", duration_sec=15)
    assert res["scenario"] == "baseline"
    assert len(res["timeline"]) == 15
    assert len(res["spike_raster"]) == 15
    assert "current_vitals" in res
    assert "hemodynamics" in res
    assert "channel_spike_rates" in res
    assert 0.0 <= res["predicted_recovery_score"] <= 1.0

    # Resection recovery scenario with 90% debulking
    res_recovered = srv.generate_scenario_stream("resection_recovery", duration_sec=15, resection_percent=90.0)
    # ICP should be lower when resected
    assert res_recovered["current_vitals"]["intracranial_pressure"] < 15.0
