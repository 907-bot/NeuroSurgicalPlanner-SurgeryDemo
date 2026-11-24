"""
tests/test_biomechanics.py
Unit tests for the biomechanical tissue deformation & Monro-Kellie elastance simulation.
"""

import numpy as np
import pytest
from src.simulation.biomechanics import (
    BrainShiftFEMSimulator,
    TissueProperties,
    TISSUE_LIBRARY,
    ResectionOutcome,
)


def test_tissue_library_properties():
    assert "cortex" in TISSUE_LIBRARY
    assert "white_matter" in TISSUE_LIBRARY
    assert "tumor" in TISSUE_LIBRARY
    assert "edema" in TISSUE_LIBRARY

    cortex = TISSUE_LIBRARY["cortex"]
    assert cortex.youngs_modulus_kpa > 0
    assert cortex.shear_modulus_kpa > 0
    assert cortex.bulk_modulus_kpa > 0

    tumor = TISSUE_LIBRARY["tumor"]
    # High-grade glioma should be stiffer than parenchyma in the constitutive model
    assert tumor.youngs_modulus_kpa > cortex.youngs_modulus_kpa


def test_brain_shift_deformation_field():
    sim = BrainShiftFEMSimulator(craniotomy_radius_mm=25.0)

    # 100 test vertices inside cranial vault
    np.random.seed(42)
    vertices = np.random.uniform(-40, 40, size=(100, 3)).astype(np.float32)
    entry_point = np.array([25.0, 30.0, 15.0], dtype=np.float32)

    shift_field = sim.calculate_brain_shift_field(
        vertices=vertices,
        entry_point=entry_point,
        resection_fraction=0.8,
        csf_drainage_fraction=0.7,
    )

    assert shift_field.shape == (100, 3)
    # Deformation displacements should be non-zero and physically bounded (< 10 mm)
    magnitudes = np.linalg.norm(shift_field, axis=1)
    assert np.all(magnitudes >= 0.0)
    assert np.all(magnitudes <= 10.0)
    assert np.max(magnitudes) > 0.5


def test_resection_dynamics_monro_kellie():
    sim = BrainShiftFEMSimulator()

    # Pre-op baseline: 0% resection
    baseline = sim.simulate_resection_dynamics(
        study_id="BRATS001",
        initial_tumor_volume_cm3=35.0,
        resection_percent=0.0,
        baseline_icp=22.0,
    )

    assert baseline.resected_volume_cm3 == 0.0
    assert baseline.residual_volume_cm3 == 35.0
    assert baseline.post_op_icp_mmhg == pytest.approx(22.0, abs=0.2)

    # Gross total resection: 100% resection
    total_resection = sim.simulate_resection_dynamics(
        study_id="BRATS001",
        initial_tumor_volume_cm3=35.0,
        resection_percent=100.0,
        baseline_icp=22.0,
    )

    assert total_resection.resected_volume_cm3 == 35.0
    assert total_resection.residual_volume_cm3 == 0.0
    # ICP must decrease significantly due to volume reduction (Monro-Kellie doctrine)
    assert total_resection.post_op_icp_mmhg < baseline.post_op_icp_mmhg
    # Recovery score should increase
    assert total_resection.expected_recovery_score > baseline.expected_recovery_score
    # Brain shift max should be bounded
    assert 2.0 <= total_resection.brain_shift_max_mm <= 5.0
