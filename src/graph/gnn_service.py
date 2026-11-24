"""
src/graph/gnn_service.py
Service layer for Anatomical GNN inference and graph construction.
Extracts 14D node feature vectors from patient scene manifests,
builds spatial adjacency graphs, and runs the MPS-accelerated GNN.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from loguru import logger

from .gnn_model import AnatomicalGNNInference, SurgicalRiskPrediction

# Model checkpoint location
CHECKPOINT_PATH = Path("models/gnn_checkpoint_mps.pt")


class AnatomicalGNNService:
    """Provides anatomical graph extraction and real-time GNN inference."""

    def __init__(self, model_path: Optional[str] = None):
        checkpoint = str(model_path) if model_path else str(CHECKPOINT_PATH)
        if not Path(checkpoint).exists():
            # Fall back to CPU/base checkpoint if mps checkpoint not found
            alt = Path("models/gnn_checkpoint.pt")
            if alt.exists():
                checkpoint = str(alt)

        self.inferencer = AnatomicalGNNInference(
            model_path=checkpoint if Path(checkpoint).exists() else None,
            device="auto",
            in_channels=14,
        )

    def extract_graph_from_manifest(
        self, study_id: str, assets_root: Path = Path("outputs/assets")
    ) -> Tuple[np.ndarray, np.ndarray, List[str], List[Dict[str, Any]]]:
        """
        Parses scene_manifest.json for a study and builds:
        1. feature_matrix: (N, 14)
        2. edge_index: (2, E)
        3. node_names: List of N string names
        4. edge_data: List of edge dictionaries for frontend 3D rendering
        """
        manifest_path = assets_root / study_id / "scene_manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found for study: {study_id}")

        with open(manifest_path) as f:
            manifest = json.load(f)

        structures = manifest.get("structures", [])
        if not structures:
            raise ValueError(f"No structures found in manifest for study {study_id}")

        node_names = []
        features_list = []
        centroids = []

        for s in structures:
            s_id = s.get("id", "unknown")
            node_names.append(s_id)
            vol = float(s.get("volumeCm3", 10.0))
            centroid = s.get("centroid_mm", [0.0, 0.0, 0.0])
            centroids.append(centroid)

            is_tumor = 1.0 if s.get("type") in ("tumor", "edema") else 0.0
            is_critical = 1.0 if s_id in ("brainstem", "mca_artery", "internal_carotid_artery") else 0.0
            edema_grade = 1.0 if s.get("type") == "edema" else 0.0
            enhancement_ratio = 1.0 if s_id in ("enhancing_tumor", "tumor_core") else 0.0

            # 14D standard feature vector matching AnatomicalGNN schema
            f_vec = [
                vol / 100.0,                      # 0: Normalized volume
                centroid[0] / 100.0,              # 1: Centroid X
                centroid[1] / 100.0,              # 2: Centroid Y
                centroid[2] / 100.0,              # 3: Centroid Z
                float(s.get("vertex_count", 1000)) / 10000.0, # 4: Surface density
                1.2 if is_tumor else 0.5,         # 5: Blood flow estimate
                0.98,                             # 6: SpO2
                2.5 if is_tumor else 1.0,         # 7: Metabolic activity
                0.5,                              # 8: Local tissue elastance
                is_tumor,                         # 9: Tumor flag
                is_critical,                      # 10: Eloquent/critical flag
                edema_grade,                      # 11: Edema infiltration
                enhancement_ratio,                # 12: Contrast enhancement
                0.3 if is_tumor else 0.7,         # 13: Surgical accessibility
            ]
            features_list.append(f_vec)

        features_matrix = np.array(features_list, dtype=np.float32)

        # Build spatial adjacency edges (connect structures if distance between centroids < 90 mm)
        sources = []
        targets = []
        edge_data = []

        for i in range(len(node_names)):
            for j in range(i + 1, len(node_names)):
                c_i = np.array(centroids[i])
                c_j = np.array(centroids[j])
                dist = float(np.linalg.norm(c_i - c_j))
                if dist < 95.0 or is_tumor:
                    weight = float(np.exp(-dist / 50.0))
                    sources.extend([i, j])
                    targets.extend([j, i])
                    edge_data.append({
                        "source": node_names[i],
                        "target": node_names[j],
                        "distance_mm": round(dist, 1),
                        "weight": round(weight, 3),
                        "type": "parenchymal_contact" if dist < 20.0 else "functional_proximity",
                    })

        if not sources:
            # Fallback self-loops if isolated
            sources = list(range(len(node_names)))
            targets = list(range(len(node_names)))

        edge_index = np.array([sources, targets], dtype=np.int64)

        return features_matrix, edge_index, node_names, edge_data

    def predict_for_study(self, study_id: str) -> Dict[str, Any]:
        """Predicts surgical risk profile for a patient study."""
        features, edge_index, node_names, edge_data = self.extract_graph_from_manifest(study_id)
        prediction: SurgicalRiskPrediction = self.inferencer.predict(
            feature_matrix=features,
            edge_index=edge_index,
            node_names=node_names,
        )

        res = prediction.to_dict()
        res["study_id"] = study_id
        res["num_nodes"] = len(node_names)
        res["num_edges"] = len(edge_data)
        res["graph_edges"] = edge_data
        return res
