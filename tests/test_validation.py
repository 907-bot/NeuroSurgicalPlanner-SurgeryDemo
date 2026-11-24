"""
tests/test_validation.py
Unit tests for the scientific validation and ablation suite.
"""

import pytest
from src.evaluation.validation_suite import (
    ScientificValidationSuite,
    get_validation_suite,
)


def test_segmentation_validation():
    suite = get_validation_suite()
    res = suite.evaluate_segmentation("BRATS001")
    assert "mean_dice_score" in res
    assert res["mean_dice_score"] >= 0.85
    assert len(res["regions"]) == 3
    for reg in res["regions"]:
        assert reg["dice_score"] > 0.80
        assert reg["hd95_mm"] < 6.0


def test_gnn_calibration_metrics():
    suite = get_validation_suite()
    res = suite.evaluate_gnn_calibration()
    assert 0.0 <= res["brier_score"] <= 0.35
    assert 0.0 <= res["expected_calibration_error"] <= 0.15
    assert 0.70 <= res["roc_auc"] <= 1.0
    assert len(res["reliability_bins"]) > 0


def test_causal_sensitivity_bounds():
    suite = get_validation_suite()
    res = suite.evaluate_causal_sensitivity()
    assert res["baseline_average_treatment_effect"] > 0.3
    assert res["e_value_confounding_bound"] > 1.5
    assert len(res["rosenbaum_bounds"]) > 0
    assert res["status"] == "CAUSALLY_ROBUST"


def test_physics_residuals_validation():
    suite = get_validation_suite()
    res = suite.evaluate_physics_fit()
    assert res["r_squared"] >= 0.95
    assert res["rmse_kpa"] < 0.20
    assert res["n_points"] == 10
    assert res["status"] == "BENCHMARK_VALIDATED"


def test_ablation_experiments():
    suite = get_validation_suite()
    res = suite.run_ablation_experiments()
    assert len(res["configurations"]) == 5
    full_cfg = res["configurations"][0]
    assert full_cfg["configuration"] == "Full NEUROVERSE AI (Proposed)"
    assert full_cfg["clinical_utility_index"] > 0.90
    assert "optimal_configuration" in res


def test_full_validation_suite_run():
    suite = get_validation_suite()
    report = suite.run_full_suite("BRATS002")
    assert report["overall_status"] == "SCIENTIFICALLY_VALIDATED"
    assert "segmentation" in report
    assert "gnn_calibration" in report
    assert "causal_sensitivity" in report
    assert "physics_validation" in report
    assert "ablation_study" in report
