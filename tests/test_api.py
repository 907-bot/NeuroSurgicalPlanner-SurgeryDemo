"""
tests/test_api.py
Basic tests for the Brain Surgical Planner API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health():
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "brain-surgical-planner"


def test_list_actions():
    """Test list actions endpoint."""
    response = client.get("/actions")
    assert response.status_code == 200
    data = response.json()
    assert "actions" in data
    assert len(data["actions"]) > 0


def test_scm_variables():
    """Test SCM variables endpoint."""
    response = client.get("/scm/variables")
    assert response.status_code == 200
    data = response.json()
    assert "variables" in data
    assert "dag_edges" in data


def test_intervene():
    """Test intervene endpoint."""
    response = client.post(
        "/intervene",
        json={
            "action": "remove_tumor_full",
            "patient_params": {
                "tumor_size": 0.3,
                "blood_flow": 0.7,
                "oxygen_saturation": 0.95,
                "intracranial_pressure": 0.2,
                "edema_volume": 0.2,
                "inflammatory_response": 0.3,
                "mass_effect": 0.25,
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "action" in data
    assert "recovery_gain" in data
    assert "net_utility" in data


def test_counterfactual():
    """Test counterfactual endpoint."""
    response = client.post(
        "/counterfactual",
        json={
            "factual_action": "remove_tumor_full",
            "counterfactual_action": "drain_csf",
            "patient_params": {
                "tumor_size": 0.3,
                "blood_flow": 0.7,
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "was_better" in data
    assert "recovery_delta" in data


def test_search_plans():
    """Test search plans endpoint."""
    response = client.post(
        "/search/plans",
        json={
            "patient_params": {"tumor_size": 0.3},
            "n_simulations": 50,
            "top_k": 3,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "top_plans" in data
    assert len(data["top_plans"]) <= 3


def test_simulation_channels():
    """Test simulation channels endpoint."""
    response = client.get("/simulation/channels")
    assert response.status_code == 200
    data = response.json()
    assert "channels" in data
    assert data["n_channels"] > 0


def test_simulation_vitals():
    """Test simulation vitals endpoint."""
    response = client.post(
        "/simulation/vitals",
        json={
            "vitals": {
                "blood_pressure_systolic": 120,
                "heart_rate": 72,
                "spo2": 98,
                "intracranial_pressure": 15,
                "cerebral_blood_flow": 45,
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "alert_level" in data
    assert "predicted_outcome" in data


def test_knowledge_graph_stats():
    """Test knowledge graph stats endpoint."""
    response = client.get("/knowledge-graph/stats")
    assert response.status_code == 200
    data = response.json()
    assert "n_nodes" in data
    assert "n_edges" in data


def test_knowledge_graph_blood_supply():
    """Test knowledge graph blood supply endpoint."""
    response = client.get("/knowledge-graph/blood-supply/white_matter")
    assert response.status_code == 200
    data = response.json()
    assert "suppliers" in data


def test_create_patient():
    """Test create patient endpoint."""
    # Ensure patient doesn't already exist from previous runs
    client.delete("/patients/TEST001")

    response = client.post(
        "/patients",
        json={
            "patient_id": "TEST001",
            "name": "Test Patient",
            "diagnosis": "Glioblastoma",
            "tumor_type": "glioblastoma",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == "TEST001"


def test_list_patients():
    """Test list patients endpoint."""
    response = client.get("/patients")
    assert response.status_code == 200
    data = response.json()
    assert "patients" in data
    assert "count" in data


def test_get_patient():
    """Test get patient endpoint."""
    # Ensure patient doesn't already exist from previous runs
    client.delete("/patients/TEST002")

    # First create a patient
    client.post(
        "/patients",
        json={"patient_id": "TEST002", "name": "Test Patient 2"}
    )
    
    response = client.get("/patients/TEST002")
    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == "TEST002"


def test_list_studies():
    """Test NeuroVerse API v1 list studies endpoint."""
    response = client.get("/api/v1/studies")
    assert response.status_code == 200
    data = response.json()
    assert "studies" in data
    assert len(data["studies"]) >= 4
    study_ids = [s["study_id"] for s in data["studies"]]
    assert "BRATS001" in study_ids


def test_get_study_scene():
    """Test NeuroVerse API v1 scene manifest endpoint for BRATS001."""
    response = client.get("/api/v1/studies/BRATS001/scene")
    assert response.status_code == 200
    data = response.json()
    assert data["study_id"] == "BRATS001"
    assert data["coordinate_system"] == "RAS"
    assert len(data["structures"]) >= 4
    struct_ids = [s["id"] for s in data["structures"]]
    assert "brain_surface" in struct_ids
    assert "enhancing_tumor" in struct_ids


def test_simulate_biomechanical_deformation():
    """Test biomechanical tissue deformation simulation endpoint."""
    response = client.post(
        "/api/v1/simulations/deform",
        json={
            "study_id": "BRATS001",
            "initial_tumor_volume_cm3": 38.6,
            "resection_percent": 80.0,
            "baseline_icp": 22.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["study_id"] == "BRATS001"
    assert data["resection_percent"] == 80.0
    assert data["resected_volume_cm3"] > 0
    assert data["post_op_icp_mmhg"] < 22.0
    assert data["expected_recovery_score"] > 0.7
    assert data["brain_shift_max_mm"] > 0


def test_get_tissue_properties():
    """Test tissue properties endpoint."""
    response = client.get("/api/v1/simulations/tissues")
    assert response.status_code == 200
    data = response.json()
    assert "cortex" in data
    assert "tumor" in data
    assert data["cortex"]["youngs_modulus_kpa"] > 0


def test_get_study_gnn_risk():
    """Test Anatomical GNN risk inference endpoint."""
    response = client.get("/api/v1/studies/BRATS001/gnn")
    assert response.status_code == 200
    data = response.json()
    assert data["study_id"] == "BRATS001"
    assert "node_risks" in data
    assert "recovery_score" in data
    assert "graph_edges" in data
    assert len(data["node_risks"]) >= 4


def test_run_multi_agent_deliberation():
    """Test Multi-Agent deliberative consultation endpoint."""
    response = client.post(
        "/api/v1/studies/BRATS001/deliberate",
        json={"n_simulations": 25},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["study_id"] == "BRATS001"
    assert "deliberations" in data
    assert len(data["deliberations"]) == 5
    agent_ids = [d["agent_id"] for d in data["deliberations"]]
    assert "anatomy_agent" in agent_ids
    assert "risk_agent" in agent_ids
    assert "causal_agent" in agent_ids
    assert "planner_agent" in agent_ids
    assert "report_agent" in agent_ids
    assert "full_surgical_report" in data
    assert len(data["full_surgical_report"]) > 100


def test_get_physiology_stream():
    """Test SNN vital signs & hemodynamics stream endpoint."""
    response = client.get("/api/v1/physiology/stream?scenario=baseline&duration_sec=10")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "baseline"
    assert "current_vitals" in data
    assert "hemodynamics" in data
    assert "spike_raster" in data
    assert len(data["timeline"]) == 10
    assert "cerebral_perfusion_pressure" in data["hemodynamics"]


def test_needle_insertion_physics():
    """Test needle puncture physics endpoint."""
    response = client.get("/api/v1/physics/needle-insertion?depth_mm=20.0")
    assert response.status_code == 200
    data = response.json()
    assert data["depth_mm"] == 20.0
    assert "insertion_force_n" in data
    assert "phase" in data
    assert len(data["force_curve"]) >= 20


def test_get_sofa_scene():
    """Test SOFA scene graph generation endpoint."""
    response = client.get("/api/v1/physics/sofa-scene/BRATS001")
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "SOFA_SCENE_GRAPH_V2"
    assert "root_node" in data


def test_get_physics_benchmarks():
    """Test physics benchmarks endpoint."""
    response = client.get("/api/v1/physics/benchmarks")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "VALIDATED"
    assert data["correlation_r2"] > 0.95


def test_get_validation_metrics():
    """Test scientific validation suite endpoint."""
    response = client.get("/api/v1/validation/metrics?study_id=BRATS001")
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "SCIENTIFICALLY_VALIDATED"
    assert "segmentation" in data
    assert "gnn_calibration" in data
    assert "causal_sensitivity" in data
    assert "ablation_study" in data
    assert data["segmentation"]["mean_dice_score"] >= 0.85


def test_run_ablation_study():
    """Test component ablation study endpoint."""
    response = client.post("/api/v1/validation/ablation")
    assert response.status_code == 200
    data = response.json()
    assert "configurations" in data
    assert len(data["configurations"]) == 5
    assert "optimal_configuration" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
