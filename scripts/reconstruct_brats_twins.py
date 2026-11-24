#!/usr/bin/env python3
"""
scripts/reconstruct_brats_twins.py
Reconstruct patient-specific 3D digital twin meshes from real BraTS MRI volumes.

Generates:
- 3D GLB/OBJ meshes for Brain Surface, Necrotic Core, Enhancing Tumor, and Edema.
- Scene manifest JSON matching the NeuroVerse AI API contract.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import nibabel as nib
import numpy as np
from loguru import logger
from rich.console import Console
from rich.panel import Panel
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
import trimesh

console = Console()

PATIENTS = ["BRATS001", "BRATS002", "BRATS003", "BRATS004"]

STRUCTURE_CONFIG = {
  "brain_surface": {
    "name": "Cerebral Cortex (Brain Surface)",
    "type": "cortex",
    "color": "#818cf8",
    "opacity": 0.25,
    "description": "Patient-specific cortical surface extracted from T1 MRI.",
  },
  "necrotic_core": {
    "name": "Necrotic Tumor Core",
    "type": "tumor",
    "color": "#991b1b",
    "opacity": 0.95,
    "description": "Non-enhancing necrotic tumor core.",
  },
  "enhancing_tumor": {
    "name": "Enhancing Tumor (ET)",
    "type": "tumor",
    "color": "#ef4444",
    "opacity": 0.9,
    "description": "Hypervascular actively proliferating tumor region.",
  },
  "peritumoral_edema": {
    "name": "Peritumoral Edema",
    "type": "edema",
    "color": "#fbbf24",
    "opacity": 0.45,
    "description": "Vasogenic edema infiltrating adjacent parenchyma.",
  },
}


def smooth_and_extract_mesh(
    binary_mask: np.ndarray,
    spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0),
    sigma: float = 1.0,
    target_faces: int = 5000,
) -> trimesh.Trimesh | None:
    """Applies Gaussian smoothing, marching cubes, and quadric mesh decimation."""
    if binary_mask.sum() < 30:
        return None

    smoothed = gaussian_filter(binary_mask.astype(np.float32), sigma=sigma)
    try:
        verts, faces, normals, _ = marching_cubes(
            smoothed,
            level=0.5,
            spacing=spacing,
            allow_degenerate=False,
        )
    except Exception as e:
        logger.warning(f"Marching cubes error: {e}")
        return None

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, vertex_normals=normals)

    # Decimate if mesh is too dense for web viewport
    if len(mesh.faces) > target_faces:
        try:
            mesh = mesh.simplify_quadric_decimation(target_faces)
        except Exception:
            pass

    return mesh


def process_patient(patient_id: str, data_root: Path, output_root: Path) -> Dict:
    pdir = data_root / patient_id
    out_dir = output_root / patient_id
    out_dir.mkdir(parents=True, exist_ok=True)

    seg_path = pdir / f"{patient_id}_seg.nii.gz"
    t1_path = pdir / f"{patient_id}_t1.nii.gz"

    if not seg_path.exists() or not t1_path.exists():
        logger.error(f"Missing seg or t1 file for {patient_id}")
        return {}

    console.print(f"Processing [cyan]{patient_id}[/cyan]...")

    seg_img = nib.load(str(seg_path))
    t1_img = nib.load(str(t1_path))

    seg_data = seg_img.get_fdata().astype(np.int32)
    t1_data = t1_img.get_fdata()
    spacing = tuple(float(s) for s in seg_img.header.get_zooms()[:3])

    # 1. Whole brain mask from T1 (nonzero brain voxels)
    brain_mask = t1_data > (np.percentile(t1_data[t1_data > 0], 5) if (t1_data > 0).any() else 0)

    # Masks dictionary
    masks = {
        "brain_surface": brain_mask,
        "necrotic_core": seg_data == 1,
        "peritumoral_edema": seg_data == 2,
        "enhancing_tumor": seg_data == 3,
    }

    # Compute global brain center to center all meshes around (0,0,0) in mm
    brain_mesh_initial = smooth_and_extract_mesh(brain_mask, spacing=spacing, sigma=1.2, target_faces=10000)
    if brain_mesh_initial is None:
        logger.error(f"Could not extract brain surface for {patient_id}")
        return {}

    brain_center = brain_mesh_initial.centroid

    manifest_structures = []

    for struct_id, mask in masks.items():
        if struct_id == "brain_surface":
            mesh = brain_mesh_initial
        else:
            mesh = smooth_and_extract_mesh(
                mask,
                spacing=spacing,
                sigma=0.8 if struct_id != "peritumoral_edema" else 1.2,
                target_faces=4000 if struct_id != "peritumoral_edema" else 6000,
            )

        if mesh is None:
            continue

        # Center mesh coordinates
        mesh.vertices -= brain_center

        # Export GLB and OBJ
        glb_path = out_dir / f"{struct_id}.glb"
        obj_path = out_dir / f"{struct_id}.obj"

        mesh.export(str(glb_path), file_type="glb")
        mesh.export(str(obj_path), file_type="obj")

        vol_cm3 = float(mesh.volume / 1000.0) if mesh.is_volume else float(mask.sum() * np.prod(spacing) / 1000.0)
        centroid = mesh.centroid.tolist()

        cfg = STRUCTURE_CONFIG.get(struct_id, {})
        manifest_structures.append({
            "id": struct_id,
            "name": cfg.get("name", struct_id),
            "type": cfg.get("type", "anatomy"),
            "color": cfg.get("color", "#94a3b8"),
            "opacity": cfg.get("opacity", 0.8),
            "volumeCm3": round(vol_cm3, 2),
            "centroid_mm": [round(c, 1) for c in centroid],
            "asset_url": f"/assets/{patient_id}/{struct_id}.glb",
            "vertex_count": len(mesh.vertices),
            "face_count": len(mesh.faces),
            "description": cfg.get("description", ""),
        })

        console.print(f"  ✔ {struct_id}: {len(mesh.vertices)} verts, {round(vol_cm3, 2)} cm³ → {glb_path.name}")

    # Build Scene Manifest
    manifest = {
        "scene_id": f"scene_{patient_id}",
        "study_id": patient_id,
        "coordinate_system": "RAS",
        "units": "mm",
        "structures": manifest_structures,
        "provenance": {
            "segmentation_model": "BraTS2024-GroundTruth",
            "reconstruction_pipeline": "marching_cubes_v1.0",
            "voxel_spacing": list(spacing),
        },
    }

    manifest_file = out_dir / "scene_manifest.json"
    with open(manifest_file, "w") as f:
        json.dump(manifest, f, indent=2)

    console.print(f"  [green]Saved manifest → {manifest_file}[/green]\n")
    return manifest


def main():
    data_root = Path("data/adapted")
    output_root = Path("outputs/assets")
    output_root.mkdir(parents=True, exist_ok=True)

    console.print(Panel(
        f"[bold cyan]Patient-Specific 3D Digital Twin Reconstruction[/bold cyan]\n"
        f"Input: {data_root} | Output: {output_root}\n"
        f"Target Patients: {', '.join(PATIENTS)}",
        title="🧠 NeuroVerse AI — 3D Reconstruction Pipeline",
    ))

    for pid in PATIENTS:
        process_patient(pid, data_root, output_root)

    console.print("[bold green]✔ All patient digital twin meshes reconstructed and saved![/bold green]")


if __name__ == "__main__":
    main()
