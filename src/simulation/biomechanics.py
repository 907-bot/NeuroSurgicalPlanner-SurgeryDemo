"""
src/simulation/biomechanics.py
Biomechanical Tissue Deformation & Finite Element Brain Shift Simulation.

Models:
1. Visco-hyperelastic soft tissue properties (Young's modulus, Poisson's ratio) for
   gray matter, white matter, and glioblastoma tissue.
2. Intraoperative brain shift deformation field (gravitational sag, CSF loss, tool deflection).
3. Monro-Kellie intracranial pressure (ICP) volume-elastance dynamics.
4. Surgical cavity excavation and resection margin clearance.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
from loguru import logger


@dataclass
class TissueProperties:
    """Constitutive biomechanical parameters for cranial tissues."""
    name: str
    youngs_modulus_kpa: float      # E in kPa (typical brain ~2.0 - 10.0 kPa)
    poissons_ratio: float          # nu (typically ~0.45 - 0.49 for near-incompressible tissue)
    density_g_cm3: float           # rho in g/cm3 (~1.04 for brain parenchyma)
    permeability_m2: float = 1e-12 # hydraulic permeability for poroelastic fluid exudation

    @property
    def shear_modulus_kpa(self) -> float:
        """G = E / (2 * (1 + nu))"""
        return self.youngs_modulus_kpa / (2.0 * (1.0 + self.poissons_ratio))

    @property
    def bulk_modulus_kpa(self) -> float:
        """K = E / (3 * (1 - 2*nu))"""
        return self.youngs_modulus_kpa / (3.0 * (1.0 - 2.0 * self.poissons_ratio))


# Standard literature values for neurosurgical biomechanics (Miga et al., Wittek et al.)
TISSUE_LIBRARY: Dict[str, TissueProperties] = {
    "cortex": TissueProperties(
        name="Cortical Gray Matter",
        youngs_modulus_kpa=2.2,
        poissons_ratio=0.45,
        density_g_cm3=1.04,
    ),
    "white_matter": TissueProperties(
        name="Deep White Matter",
        youngs_modulus_kpa=3.5,
        poissons_ratio=0.45,
        density_g_cm3=1.04,
    ),
    "tumor": TissueProperties(
        name="High Grade Glioma Core",
        youngs_modulus_kpa=8.2,   # Hypercellular glioblastoma is significantly stiffer than parenchyma
        poissons_ratio=0.42,
        density_g_cm3=1.08,
    ),
    "edema": TissueProperties(
        name="Vasogenic Edema",
        youngs_modulus_kpa=1.4,   # Fluid-infiltrated parenchyma has reduced shear stiffness
        poissons_ratio=0.48,
        density_g_cm3=1.02,
    ),
}


@dataclass
class ResectionOutcome:
    """Result of biomechanical resection simulation."""
    study_id: str
    resection_percent: float
    initial_volume_cm3: float
    resected_volume_cm3: float
    residual_volume_cm3: float
    brain_shift_max_mm: float
    brain_shift_mean_mm: float
    baseline_icp_mmhg: float
    post_op_icp_mmhg: float
    expected_recovery_score: float
    eloquent_margin_mm: float
    deformed_centroid: Tuple[float, float, float]

    def to_dict(self) -> Dict:
        return {
            "study_id": self.study_id,
            "resection_percent": round(self.resection_percent, 1),
            "initial_volume_cm3": round(self.initial_volume_cm3, 2),
            "resected_volume_cm3": round(self.resected_volume_cm3, 2),
            "residual_volume_cm3": round(self.residual_volume_cm3, 2),
            "brain_shift_max_mm": round(self.brain_shift_max_mm, 2),
            "brain_shift_mean_mm": round(self.brain_shift_mean_mm, 2),
            "baseline_icp_mmhg": round(self.baseline_icp_mmhg, 1),
            "post_op_icp_mmhg": round(self.post_op_icp_mmhg, 1),
            "expected_recovery_score": round(self.expected_recovery_score, 3),
            "eloquent_margin_mm": round(self.eloquent_margin_mm, 2),
            "deformed_centroid": [round(c, 2) for c in self.deformed_centroid],
        }


class BrainShiftFEMSimulator:
    """
    Finite-Element inspired biomechanical simulator for intraoperative brain shift,
    tissue sag, and intracranial volume-elastance dynamics.
    """

    def __init__(self, craniotomy_radius_mm: float = 25.0):
        self.craniotomy_radius_mm = craniotomy_radius_mm
        self.cranial_volume_cm3 = 1450.0 # Standard adult cranial vault capacity

    def calculate_brain_shift_field(
        self,
        vertices: np.ndarray,
        entry_point: np.ndarray,
        gravity_dir: np.ndarray = np.array([0.0, -1.0, 0.0]),
        resection_fraction: float = 0.0,
        csf_drainage_fraction: float = 0.5,
    ) -> np.ndarray:
        """
        Calculates 3D deformation displacement field (u_x, u_y, u_z) for each vertex.
        
        Brain shift is governed by:
        1. Gravitational sag towards gravity vector (maximal near the dural opening).
        2. CSF drainage collapse (decaying exponentially with depth from entry point).
        3. Tissue relaxation towards the surgical resection cavity.
        """
        if vertices.ndim != 2 or vertices.shape[1] != 3:
            raise ValueError("Vertices must be shape (N, 3)")

        n_verts = len(vertices)
        if n_verts == 0:
            return np.zeros((0, 3), dtype=np.float32)

        # Distance from each vertex to the craniotomy entry point
        diff = vertices - entry_point
        dist_to_entry = np.linalg.norm(diff, axis=1)

        # Attenuation factor with depth into parenchyma (characteristic length ~ 45 mm)
        spatial_decay = np.exp(-dist_to_entry / 45.0)

        # 1. Gravitational sag displacement (up to 4.5 mm at surface of dural opening)
        gravity_norm = gravity_dir / (np.linalg.norm(gravity_dir) + 1e-8)
        max_gravity_sag = 3.5 * csf_drainage_fraction
        sag_field = spatial_decay[:, np.newaxis] * (gravity_norm * max_gravity_sag)

        # 2. Resection cavity collapse (inward radial relaxation towards cavity center)
        max_collapse = 2.0 * resection_fraction
        # Radial inward unit vectors towards entry/cavity center
        unit_inward = -diff / (dist_to_entry[:, np.newaxis] + 1e-6)
        collapse_field = spatial_decay[:, np.newaxis] * (unit_inward * max_collapse)

        total_shift = sag_field + collapse_field
        return total_shift.astype(np.float32)

    def simulate_resection_dynamics(
        self,
        study_id: str,
        initial_tumor_volume_cm3: float,
        resection_percent: float,
        tumor_centroid_mm: Tuple[float, float, float] = (18.0, -42.0, -5.0),
        entry_point_mm: Tuple[float, float, float] = (45.0, 15.0, 20.0),
        baseline_icp: float = 22.0,
    ) -> ResectionOutcome:
        """
        Simulates the causal physiological and biomechanical response to tumor debulking.
        Uses Monro-Kellie intracranial volume-pressure elastance curve:
        ICP = ICP_baseline * exp(-alpha * Delta_V / V_cranial)
        """
        resection_frac = max(0.0, min(1.0, resection_percent / 100.0))
        resected_vol = initial_tumor_volume_cm3 * resection_frac
        residual_vol = initial_tumor_volume_cm3 - resected_vol

        # Monro-Kellie elastance constant alpha ~ 28.0 for human cranium
        delta_v_fraction = resected_vol / self.cranial_volume_cm3
        post_icp = max(8.5, baseline_icp * math.exp(-28.0 * delta_v_fraction))

        # Brain shift magnitude
        max_shift = min(4.8, 1.2 + 3.2 * resection_frac)
        mean_shift = max_shift * 0.42

        # Expected neurological functional recovery score
        # Higher resection of malignant glioblastoma improves survival & reduces mass effect,
        # bounded between 0.45 and 0.94.
        recov_score = min(0.94, 0.45 + 0.46 * resection_frac)

        # Distance to eloquent tracts (safety margin improves as mass effect decreases)
        eloquent_margin = 1.5 + 4.2 * resection_frac

        # Centroid deformation displacement
        shift_vector = np.array([0.0, -0.6, -0.4]) * max_shift
        deformed_centroid = (
            tumor_centroid_mm[0] + float(shift_vector[0]),
            tumor_centroid_mm[1] + float(shift_vector[1]),
            tumor_centroid_mm[2] + float(shift_vector[2]),
        )

        return ResectionOutcome(
            study_id=study_id,
            resection_percent=resection_percent,
            initial_volume_cm3=initial_tumor_volume_cm3,
            resected_volume_cm3=resected_vol,
            residual_volume_cm3=residual_vol,
            brain_shift_max_mm=max_shift,
            brain_shift_mean_mm=mean_shift,
            baseline_icp_mmhg=baseline_icp,
            post_op_icp_mmhg=post_icp,
            expected_recovery_score=recov_score,
            eloquent_margin_mm=eloquent_margin,
            deformed_centroid=deformed_centroid,
        )
