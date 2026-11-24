export type StructureType =
  | 'cortex'
  | 'subcortical'
  | 'ventricle'
  | 'brainstem'
  | 'cerebellum'
  | 'vascular'
  | 'tumor'
  | 'edema';

export interface AnatomicalStructure {
  id: string;
  name: string;
  type: StructureType;
  color: string;
  visible: boolean;
  opacity: number;
  volumeCm3?: number;
  riskScore?: number;
  bloodSupply?: string;
  description?: string;
  coordinates?: [number, number, number];
  asset_url?: string;
  vertex_count?: number;
  face_count?: number;
}

export type SimulationStage =
  | 'pre_op'
  | 'craniotomy'
  | 'probe_navigation'
  | 'resection'
  | 'post_op';

export type ComparisonMode = 'single' | 'split' | 'overlay';

export interface InstrumentState {
  type: 'cannula' | 'cusa' | 'coagulator' | 'none';
  tipPosition: [number, number, number];
  depthMm: number;
  targetDistanceMm: number;
  angleDeg: number;
  activePower: number; // 0 - 100%
  resectionProgress: number; // 0 - 100%
  tissueShiftMm: number; // biomechanical brain shift displacement
}

export interface SceneManifest {
  scene_id: string;
  study_id: string;
  coordinate_system: 'RAS';
  units: 'mm';
  structures: AnatomicalStructure[];
  provenance: {
    segmentation_model: string;
    segmentation_id: string;
    reconstruction_version: string;
  };
}

export interface VitalsState {
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  heart_rate: number;
  spo2: number;
  intracranial_pressure: number;
  cerebral_blood_flow: number;
  eto2: number;
  etco2: number;
  alert_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
  recovery_score: number;
}

export interface SurgicalPlanOption {
  rank: number;
  actions: string[];
  expected_recovery: number;
  risk_score: number;
  confidence_interval: [number, number];
  utility: number;
}

export interface GNNGraphEdge {
  source: string;
  target: string;
  distance_mm: number;
  weight: number;
  type: string;
}

export interface GNNPredictionState {
  study_id: string;
  blood_loss_ml: number;
  nerve_damage_prob: number;
  recovery_score: number;
  mortality_risk: number;
  icu_days_estimate: number;
  node_risks: Record<string, number>;
  confidence: number;
  num_nodes?: number;
  num_edges?: number;
  graph_edges?: GNNGraphEdge[];
}

export interface AgentDeliberation {
  agent_id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'PENDING' | 'APPROVED' | 'CONSENSUS_REACHED' | 'WARNING';
  message: string;
  key_metrics?: Record<string, any>;
}

export interface HemodynamicsState {
  mean_arterial_pressure: number;
  cerebral_perfusion_pressure: number;
  cpp_status: 'NORMAL' | 'ISCHEMIC_RISK' | 'CRITICAL';
}

export interface SpikeRasterPoint {
  time_sec: number;
  neuron_spikes: number[];
}

export interface PhysiologyStreamData {
  scenario: string;
  duration_sec: number;
  current_vitals: VitalsState;
  hemodynamics: HemodynamicsState;
  predicted_recovery_score: number;
  alert_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
  active_alerts: string[];
  channel_spike_rates: Record<string, number>;
  spike_raster: SpikeRasterPoint[];
  timeline: Array<{
    time_sec: number;
    vitals: Record<string, number>;
    hemodynamics: HemodynamicsState;
  }>;
}

export interface NeedlePhysicsState {
  depth_mm: number;
  total_force_n: number;
  phase: 'ELASTIC_TENTING' | 'BREAKTHROUGH' | 'FRICTIONAL_CUTTING';
  puncture_occurred: boolean;
  tenting_displacement_mm: number;
  cutting_force_n: number;
  friction_force_n: number;
  youngs_modulus_kpa: number;
  poissons_ratio: number;
}

export interface BenchmarkComparison {
  depth_mm: number;
  simulated_force_n: number;
  experimental_mean_n: number;
  error_margin_n: number;
}

export interface PhysicsBenchmarkData {
  citation: string;
  tissue_type: string;
  r_squared: number;
  rmse: number;
  status: string;
  data_points: BenchmarkComparison[];
}

export interface SegmentationRegionMetric {
  region_name: string;
  dice_score: number;
  hd95_mm: number;
  assd_mm: number;
  relative_volume_diff_pct: number;
  status: string;
}

export interface ReliabilityBin {
  bin_index: number;
  bin_center: number;
  confidence: number;
  accuracy: number;
  sample_count: number;
  gap: number;
}

export interface RosenbaumBound {
  gamma: number;
  p_value_upper_bound: number;
  statistically_significant: boolean;
}

export interface AblationConfigResult {
  configuration: string;
  description: string;
  recovery_accuracy: number;
  risk_prediction_error: number;
  vital_stability_score: number;
  inference_latency_ms: number;
  clinical_utility_index: number;
}

export interface ScientificValidationReport {
  study_id: string;
  overall_status: string;
  segmentation: {
    study_id: string;
    mean_dice_score: number;
    mean_hd95_mm: number;
    target_threshold_met: boolean;
    regions: SegmentationRegionMetric[];
  };
  gnn_calibration: {
    brier_score: number;
    expected_calibration_error: number;
    max_calibration_error: number;
    roc_auc: number;
    is_well_calibrated: boolean;
    reliability_bins: ReliabilityBin[];
  };
  causal_sensitivity: {
    baseline_average_treatment_effect: number;
    e_value_confounding_bound: number;
    perturbation_stability_std: number;
    critical_gamma_threshold: number;
    rosenbaum_bounds: RosenbaumBound[];
    status: string;
  };
  physics_validation: {
    citation: string;
    r_squared: number;
    rmse_kpa: number;
    max_residual_kpa: number;
    n_points: number;
    status: string;
  };
  ablation_study: {
    configurations: AblationConfigResult[];
    optimal_configuration: string;
    key_finding: string;
  };
}


