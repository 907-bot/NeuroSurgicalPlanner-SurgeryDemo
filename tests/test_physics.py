"""
tests/test_physics.py
Unit tests for SOFA physics engine, stereotactic needle puncture mechanics,
and neurosurgical reference benchmarks.
"""

import pytest
from src.simulation.sofa_physics import SOFAPhysicsEngine, NeedlePunctureProfile


def test_needle_puncture_phases():
    engine = SOFAPhysicsEngine()

    # Pre-puncture elastic tenting (depth = 2 mm)
    p_pre = engine.simulate_needle_insertion(target_depth_mm=2.0)
    assert p_pre.phase == "ELASTIC_TENTING"
    assert not p_pre.puncture_occurred
    assert p_pre.insertion_force_n < engine.DURAL_PUNCTURE_THRESHOLD_N

    # Post-puncture frictional cutting (depth = 25 mm)
    p_post = engine.simulate_needle_insertion(target_depth_mm=25.0)
    assert p_post.phase == "FRICTIONAL_CUTTING"
    assert p_post.puncture_occurred
    assert p_post.tissue_displacement_mm > 0
    assert len(p_post.force_curve) >= 25


def test_sofa_scene_generation():
    engine = SOFAPhysicsEngine()
    scene = engine.generate_sofa_scene_graph("BRATS001")

    assert scene["format"] == "SOFA_SCENE_GRAPH_V2"
    assert "root_node" in scene
    components = scene["root_node"]["components"]
    assert len(components) >= 3

    comp_names = [c["name"] for c in components]
    assert "Parenchyma_CorotationalFEM" in comp_names
    assert "StereotacticCannula_Instrument" in comp_names

    xml_str = engine.generate_sofa_xml("BRATS001")
    assert "<Node" in xml_str
    assert "TetrahedronFEMForceField" in xml_str


def test_physics_benchmark_validation():
    engine = SOFAPhysicsEngine()
    bench = engine.get_benchmark_comparison()

    assert bench["status"] == "VALIDATED"
    assert bench["correlation_r2"] > 0.95
    assert len(bench["strains"]) == len(bench["reference_stress_kpa"])
    assert bench["mean_error_kpa"] < 0.2
