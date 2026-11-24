import { create } from 'zustand';
import {
  AnatomicalStructure,
  VitalsState,
  SurgicalPlanOption,
  SimulationStage,
  ComparisonMode,
  InstrumentState,
  GNNPredictionState,
  AgentDeliberation,
  HemodynamicsState,
  PhysiologyStreamData,
  NeedlePhysicsState,
  PhysicsBenchmarkData,
  ScientificValidationReport,
} from '../types/anatomy';
import {
  fetchStudyScene,
  postIntervention,
  searchSurgicalPlans,
  fetchGNNRisk,
  runMultiAgentDeliberation,
  fetchPhysiologyStream,
  fetchNeedlePhysics,
  fetchPhysicsBenchmarks,
  fetchValidationReport,
} from '../lib/api';

export const DEFAULT_STRUCTURES: AnatomicalStructure[] = [
  {
    id: 'brain_cortex',
    name: 'Cerebral Cortex (Gray Matter)',
    type: 'cortex',
    color: '#818cf8',
    visible: true,
    opacity: 0.35,
    volumeCm3: 580.4,
    riskScore: 0.12,
    bloodSupply: 'ACA / MCA / PCA',
    description: 'Outer folded neural tissue responsible for higher-order cognitive processing and motor planning.',
    coordinates: [0, 15, 20],
  },
  {
    id: 'white_matter',
    name: 'Subcortical White Matter',
    type: 'subcortical',
    color: '#cbd5e1',
    visible: true,
    opacity: 0.25,
    volumeCm3: 450.2,
    riskScore: 0.18,
    bloodSupply: 'Perforating lenticulostriate branches',
    description: 'Myelinated axonal tracts connecting cortical regions with subcortical nuclei and spinal cord.',
    coordinates: [0, 5, 10],
  },
  {
    id: 'ventricles',
    name: 'Ventricular System (CSF)',
    type: 'ventricle',
    color: '#38bdf8',
    visible: true,
    opacity: 0.85,
    volumeCm3: 24.8,
    riskScore: 0.35,
    bloodSupply: 'Choroidal arteries',
    description: 'Fluid-filled interconnected cavities producing and circulating cerebrospinal fluid.',
    coordinates: [0, 0, 5],
  },
  {
    id: 'brainstem',
    name: 'Brainstem & Pons',
    type: 'brainstem',
    color: '#a78bfa',
    visible: true,
    opacity: 0.9,
    volumeCm3: 32.5,
    riskScore: 0.88,
    bloodSupply: 'Basilar & Vertebral arteries',
    description: 'Vital regulatory center for respiration, cardiovascular function, and cranial nerve nuclei. High risk.',
    coordinates: [0, -35, -25],
  },
  {
    id: 'cerebellum',
    name: 'Cerebellum',
    type: 'cerebellum',
    color: '#c084fc',
    visible: true,
    opacity: 0.7,
    volumeCm3: 135.0,
    riskScore: 0.25,
    bloodSupply: 'PICA / AICA / SCA',
    description: 'Coordinates voluntary movement, posture, equilibrium, and fine motor skills.',
    coordinates: [0, -45, -20],
  },
  {
    id: 'mca_artery',
    name: 'Middle Cerebral Artery (MCA)',
    type: 'vascular',
    color: '#ef4444',
    visible: true,
    opacity: 1.0,
    volumeCm3: 5.2,
    riskScore: 0.75,
    bloodSupply: 'Internal Carotid Artery (ICA)',
    description: 'Major arterial trunk perfusing lateral cerebral convexities and eloquent motor cortex.',
    coordinates: [-25, 10, 5],
  },
  {
    id: 'tumor_core',
    name: 'Enhancing Tumor Core (Glioblastoma)',
    type: 'tumor',
    color: '#dc2626',
    visible: true,
    opacity: 0.95,
    volumeCm3: 38.6,
    riskScore: 0.95,
    bloodSupply: 'Neovascular neo-angiogenesis',
    description: 'Hypervascular, contrast-enhancing necrotic malignant core requiring targeted resection.',
    coordinates: [22, 18, 15],
  },
  {
    id: 'peritumoral_edema',
    name: 'Peritumoral Vasogenic Edema',
    type: 'edema',
    color: '#fbbf24',
    visible: true,
    opacity: 0.55,
    volumeCm3: 54.1,
    riskScore: 0.62,
    bloodSupply: 'Disrupted Blood-Brain Barrier (BBB)',
    description: 'Fluid infiltration creating mass effect on adjacent neural tissue and elevated intracranial pressure.',
    coordinates: [26, 22, 18],
  },
];

export const INITIAL_VITALS: VitalsState = {
  blood_pressure_systolic: 124,
  blood_pressure_diastolic: 78,
  heart_rate: 72,
  spo2: 99,
  intracranial_pressure: 14.5,
  cerebral_blood_flow: 54.0,
  eto2: 34.0,
  etco2: 38.0,
  alert_level: 'NORMAL',
  recovery_score: 0.88,
};

interface BrainStore {
  activePatient: string;
  structures: AnatomicalStructure[];
  selectedStructureId: string | null;
  cameraView: 'iso' | 'axial' | 'sagittal' | 'coronal';
  viewMode: 'inspect' | 'craniotomy' | 'trajectory' | 'resection';
  vitals: VitalsState;
  plans: SurgicalPlanOption[];
  isSimulating: boolean;
  simulationStep: number;
  stage: SimulationStage;
  comparisonMode: ComparisonMode;
  instrument: InstrumentState;
  gnnPrediction: GNNPredictionState | null;
  deliberations: AgentDeliberation[];
  fullSurgicalReport: string;
  isDeliberating: boolean;
  showRiskHeatmap: boolean;
  showGraphEdges: boolean;
  showDeliberationDrawer: boolean;
  hemodynamics: HemodynamicsState;
  physiologyStream: PhysiologyStreamData | null;
  showPhysiologyDrawer: boolean;
  activeScenario: string;
  needlePhysics: NeedlePhysicsState | null;
  physicsBenchmarks: PhysicsBenchmarkData | null;
  showPhysicsModal: boolean;
  validationReport: ScientificValidationReport | null;
  showValidationModal: boolean;
  modelViewMode: 'anatomical' | 'raw_mri';

  // Actions
  setActivePatient: (id: string) => void;
  loadPatient: (id: string) => Promise<void>;
  loadGNNPrediction: (id: string) => Promise<void>;
  runAgentDeliberation: (id: string) => Promise<void>;
  loadPhysiologyStream: (scenario?: string) => Promise<void>;
  loadPhysicsBenchmarks: () => Promise<void>;
  loadValidationReport: () => Promise<void>;
  toggleRiskHeatmap: () => void;
  toggleGraphEdges: () => void;
  toggleDeliberationDrawer: () => void;
  togglePhysiologyDrawer: () => void;
  togglePhysicsModal: () => void;
  toggleValidationModal: () => void;
  toggleModelViewMode: () => void;
  selectStructure: (id: string | null) => void;
  toggleVisibility: (id: string) => void;
  setOpacity: (id: string, opacity: number) => void;
  isolateStructure: (id: string) => void;
  resetAllVisibility: () => void;
  setCameraView: (view: 'iso' | 'axial' | 'sagittal' | 'coronal') => void;
  setViewMode: (mode: 'inspect' | 'craniotomy' | 'trajectory' | 'resection') => void;
  setStage: (stage: SimulationStage) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setInstrumentProgress: (progress: number) => void;
  setInstrumentDepth: (depthMm: number) => void;
  toggleSimulationPlay: () => void;
  setVitals: (vitals: Partial<VitalsState>) => void;
  applyIntervention: (action: string) => Promise<void>;
  resetScene: () => void;
}

const INITIAL_INSTRUMENT: InstrumentState = {
  type: 'cannula',
  tipPosition: [0, 0, 0],
  depthMm: 0,
  targetDistanceMm: 52.0,
  angleDeg: 18.5,
  activePower: 0,
  resectionProgress: 0,
  tissueShiftMm: 0,
};

export const useBrainStore = create<BrainStore>((set, get) => ({
  activePatient: 'BRATS001',
  structures: DEFAULT_STRUCTURES,
  selectedStructureId: 'tumor_core',
  cameraView: 'iso',
  viewMode: 'inspect',
  vitals: INITIAL_VITALS,
  stage: 'pre_op',
  comparisonMode: 'single',
  instrument: INITIAL_INSTRUMENT,
  gnnPrediction: null,
  deliberations: [],
  fullSurgicalReport: '',
  isDeliberating: false,
  showRiskHeatmap: false,
  showGraphEdges: false,
  showDeliberationDrawer: false,
  hemodynamics: {
    mean_arterial_pressure: 93.3,
    cerebral_perfusion_pressure: 71.3,
    cpp_status: 'NORMAL',
  },
  physiologyStream: null,
  showPhysiologyDrawer: false,
  activeScenario: 'baseline',
  needlePhysics: null,
  physicsBenchmarks: null,
  showPhysicsModal: false,
  validationReport: null,
  showValidationModal: false,
  modelViewMode: 'anatomical',
  plans: [
    {
      rank: 1,
      actions: ['Craniotomy', 'Subpial Dissection', 'Microscopic Resection', 'ICP Monitor'],
      expected_recovery: 0.89,
      risk_score: 0.18,
      confidence_interval: [0.84, 0.94],
      utility: 0.71,
    },
    {
      rank: 2,
      actions: ['Stereotactic Biopsy', 'Laser Interstitial Thermal Therapy (LITT)'],
      expected_recovery: 0.76,
      risk_score: 0.12,
      confidence_interval: [0.71, 0.81],
      utility: 0.64,
    },
    {
      rank: 3,
      actions: ['Partial Debulking', 'Dural Decompression'],
      expected_recovery: 0.65,
      risk_score: 0.28,
      confidence_interval: [0.58, 0.72],
      utility: 0.37,
    },
  ],
  isSimulating: false,
  simulationStep: 0,

  setActivePatient: (activePatient) => {
    get().loadPatient(activePatient);
  },

  loadPatient: async (id: string) => {
    set({ activePatient: id });
    try {
      const manifest = await fetchStudyScene(id);
      if (manifest && manifest.structures && manifest.structures.length > 0) {
        const mappedStructures: AnatomicalStructure[] = manifest.structures.map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          color: s.color,
          visible: true,
          opacity: s.opacity ?? 0.8,
          volumeCm3: s.volumeCm3,
          coordinates: s.centroid_mm,
          riskScore: s.type === 'tumor' ? 0.95 : s.type === 'edema' ? 0.6 : 0.15,
          bloodSupply: s.type === 'tumor' ? 'Neo-angiogenesis' : 'Cerebral vasculature',
          description: s.description || `${s.name} reconstructed from patient ${id}`,
          asset_url: s.asset_url,
          vertex_count: s.vertex_count,
          face_count: s.face_count,
        }));
        set({
          structures: mappedStructures,
          selectedStructureId: mappedStructures.find((s) => s.type === 'tumor')?.id || mappedStructures[0]?.id || null,
        });
      }
      const plans = await searchSurgicalPlans(3);
      if (plans && plans.length > 0) {
        set({ plans });
      }
      // Trigger live GNN prediction for study
      get().loadGNNPrediction(id);
      // Trigger SNN physiology stream
      get().loadPhysiologyStream('baseline');
      // Trigger SOFA physics benchmarks
      get().loadPhysicsBenchmarks();
      fetchNeedlePhysics(0).then((data) => set({ needlePhysics: data })).catch(() => {});
      // Trigger scientific validation report
      get().loadValidationReport();
    } catch (e) {
      console.warn('Error loading patient scene:', e);
    }
  },

  loadGNNPrediction: async (id: string) => {
    try {
      const gnn = await fetchGNNRisk(id);
      if (gnn && gnn.node_risks) {
        set((state) => ({
          gnnPrediction: gnn,
          // Update anatomical structure risks from live GNN
          structures: state.structures.map((s) => ({
            ...s,
            riskScore: gnn.node_risks[s.id] ?? s.riskScore,
          })),
        }));
      }
    } catch (e) {
      console.warn('Error fetching GNN prediction:', e);
    }
  },

  runAgentDeliberation: async (id: string) => {
    set({ isDeliberating: true, showDeliberationDrawer: true });
    try {
      const result = await runMultiAgentDeliberation(id, 40);
      if (result) {
        set({
          deliberations: result.deliberations || [],
          fullSurgicalReport: result.full_surgical_report || '',
          gnnPrediction: result.gnn_prediction || get().gnnPrediction,
        });
      }
    } catch (e) {
      console.warn('Error running agent deliberation:', e);
    } finally {
      set({ isDeliberating: false });
    }
  },

  toggleRiskHeatmap: () => set((s) => ({ showRiskHeatmap: !s.showRiskHeatmap })),
  toggleGraphEdges: () => set((s) => ({ showGraphEdges: !s.showGraphEdges })),
  toggleDeliberationDrawer: () => set((s) => ({ showDeliberationDrawer: !s.showDeliberationDrawer })),
  togglePhysiologyDrawer: () => set((s) => ({ showPhysiologyDrawer: !s.showPhysiologyDrawer })),

  loadPhysiologyStream: async (scenario = 'baseline') => {
    try {
      const { instrument } = get();
      const stream = await fetchPhysiologyStream(scenario, 25, instrument.resectionProgress);
      if (stream) {
        set((state) => ({
          physiologyStream: stream,
          activeScenario: scenario,
          vitals: {
            ...state.vitals,
            ...stream.current_vitals,
            alert_level: stream.alert_level,
            recovery_score: stream.predicted_recovery_score,
          },
          hemodynamics: stream.hemodynamics || state.hemodynamics,
        }));
      }
    } catch (e) {
      console.warn('Error loading physiology stream:', e);
    }
  },

  setStage: (stage: SimulationStage) => {
    set({ stage });
    if (stage === 'craniotomy') {
      set({ viewMode: 'craniotomy' });
    } else if (stage === 'probe_navigation') {
      set({ viewMode: 'trajectory' });
    } else if (stage === 'resection') {
      set({ viewMode: 'resection' });
    } else if (stage === 'post_op') {
      set({ comparisonMode: 'split' });
    }
  },

  setComparisonMode: (comparisonMode: ComparisonMode) => set({ comparisonMode }),

  setInstrumentProgress: (resectionProgress: number) => {
    const shift = Math.min(3.8, (resectionProgress / 100) * 3.5);
    const postIcp = Math.max(10.2, 21.0 - (resectionProgress / 100) * 10.5);
    const postRecovery = Math.min(0.93, 0.48 + (resectionProgress / 100) * 0.44);

    set((state) => ({
      instrument: {
        ...state.instrument,
        resectionProgress,
        tissueShiftMm: shift,
        activePower: resectionProgress > 0 && resectionProgress < 100 ? 75 : 0,
      },
      vitals: {
        ...state.vitals,
        intracranial_pressure: Number(postIcp.toFixed(1)),
        recovery_score: Number(postRecovery.toFixed(2)),
        alert_level: postIcp > 16 ? 'WARNING' : 'NORMAL',
      },
      structures: state.structures.map((s) => {
        if (s.type === 'tumor') {
          return {
            ...s,
            opacity: Math.max(0.1, (1 - resectionProgress / 100) * 0.95),
          };
        }
        return s;
      }),
    }));
  },

  setInstrumentDepth: (depthMm: number) => {
    set((state) => {
      const targetDist = Math.max(0, 52.0 - depthMm);
      return {
        instrument: {
          ...state.instrument,
          depthMm,
          targetDistanceMm: Number(targetDist.toFixed(1)),
        },
      };
    });

    // Real-time needle insertion physics calculation from SOFA physics engine
    fetchNeedlePhysics(depthMm)
      .then((data) => {
        set({ needlePhysics: data });
      })
      .catch((e) => console.warn('Needle physics error:', e));
  },

  togglePhysicsModal: () => {
    set((state) => ({ showPhysicsModal: !state.showPhysicsModal }));
  },

  loadPhysicsBenchmarks: async () => {
    try {
      const data = await fetchPhysicsBenchmarks();
      set({ physicsBenchmarks: data });
    } catch (e) {
      console.warn('Physics benchmark error:', e);
    }
  },

  toggleValidationModal: () => {
    set((state) => ({ showValidationModal: !state.showValidationModal }));
  },

  toggleModelViewMode: () => {
    set((state) => ({
      modelViewMode: state.modelViewMode === 'anatomical' ? 'raw_mri' : 'anatomical',
    }));
  },

  loadValidationReport: async () => {
    try {
      const patient = get().activePatient;
      const data = await fetchValidationReport(patient);
      if (data) {
        set({ validationReport: data });
      }
    } catch (e) {
      console.warn('Validation report error:', e);
    }
  },

  toggleSimulationPlay: () => {
    set((state) => ({ isSimulating: !state.isSimulating }));
  },

  selectStructure: (selectedStructureId) => set({ selectedStructureId }),

  toggleVisibility: (id) =>
    set((state) => ({
      structures: state.structures.map((s) =>
        s.id === id ? { ...s, visible: !s.visible } : s
      ),
    })),

  setOpacity: (id, opacity) =>
    set((state) => ({
      structures: state.structures.map((s) =>
        s.id === id ? { ...s, opacity } : s
      ),
    })),

  isolateStructure: (id) =>
    set((state) => ({
      structures: state.structures.map((s) => ({
        ...s,
        visible: s.id === id,
      })),
      selectedStructureId: id,
    })),

  resetAllVisibility: () =>
    set((state) => ({
      structures: state.structures.map((s) => ({
        ...s,
        visible: true,
        opacity: DEFAULT_STRUCTURES.find((d) => d.id === s.id)?.opacity ?? 0.8,
      })),
    })),

  setCameraView: (cameraView) => set({ cameraView }),
  setViewMode: (viewMode) => set({ viewMode }),
  setVitals: (vitals) => set((state) => ({ vitals: { ...state.vitals, ...vitals } })),

  applyIntervention: async (action: string) => {
    // Optimistic UI update
    set((state) => {
      let updated = [...state.structures];
      if (action.includes('tumor') || action.includes('resection')) {
        updated = updated.map((s) => (s.type === 'tumor' ? { ...s, opacity: 0.15 } : s));
      }
      return { structures: updated };
    });

    // Call live FastAPI Causal Do-Calculus engine
    try {
      const res = await postIntervention(action);
      if (res && res.intervention_result) {
        const rec = res.intervention_result.post_intervention_recovery;
        const risk = res.intervention_result.risk_increase;
        set((state) => ({
          vitals: {
            ...state.vitals,
            recovery_score: typeof rec === 'number' ? rec : state.vitals.recovery_score,
            intracranial_pressure: action === 'icp_drain' ? 8.5 : state.vitals.intracranial_pressure,
            alert_level: risk > 0.3 ? 'WARNING' : 'NORMAL',
          },
        }));
      }
    } catch (e) {
      console.warn('Intervention error:', e);
    }
  },

  resetScene: () =>
    set({
      structures: DEFAULT_STRUCTURES,
      vitals: INITIAL_VITALS,
      selectedStructureId: 'tumor_core',
    }),
}));
