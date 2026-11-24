/**
 * frontend/lib/api.ts
 * NeuroVerse AI REST API client for FastAPI backend.
 */

import { SceneManifest, SurgicalPlanOption } from '../types/anatomy';

export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '';
    }
    return 'https://neurosurgicalplanner-surgerydemo.onrender.com';
  }
  return 'https://neurosurgicalplanner-surgerydemo.onrender.com';
};

export const apiUrl = (endpoint: string): string => {
  const base = getApiBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

export async function fetchStudies(): Promise<Array<{ study_id: string; name: string }>> {
  try {
    const res = await fetch(apiUrl('/api/v1/studies'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.studies || [];
  } catch (err) {
    console.warn('Failed to fetch studies from API, using local fallbacks:', err);
    return [
      { study_id: 'BRATS001', name: 'BraTS Patient BRATS001' },
      { study_id: 'BRATS002', name: 'BraTS Patient BRATS002' },
      { study_id: 'BRATS003', name: 'BraTS Patient BRATS003' },
      { study_id: 'BRATS004', name: 'BraTS Patient BRATS004' },
    ];
  }
}

export async function fetchStudyScene(studyId: string): Promise<SceneManifest | null> {
  try {
    const res = await fetch(apiUrl(`/api/v1/studies/${studyId}/scene`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to fetch scene manifest for ${studyId}:`, err);
    return null;
  }
}

export async function postIntervention(action: string, tumorSize = 0.3): Promise<any> {
  try {
    const res = await fetch(apiUrl('/api/v1/intervene'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        patient_params: {
          tumor_size: tumorSize,
          blood_flow: 0.7,
          oxygen_saturation: 0.95,
          intracranial_pressure: 0.25,
          edema_volume: 0.3,
          inflammatory_response: 0.3,
          mass_effect: 0.25,
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Intervention API call failed, falling back to client simulation:', err);
    return null;
  }
}

export async function fetchGNNRisk(studyId: string): Promise<any> {
  try {
    const res = await fetch(apiUrl(`/api/v1/studies/${studyId}/gnn`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to fetch GNN risk for ${studyId}:`, err);
    return null;
  }
}

export async function runMultiAgentDeliberation(studyId: string, nSimulations = 50): Promise<any> {
  try {
    const res = await fetch(apiUrl(`/api/v1/studies/${studyId}/deliberate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n_simulations: nSimulations }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to run multi-agent deliberation for ${studyId}:`, err);
    return null;
  }
}

export async function fetchPhysiologyStream(scenario = 'baseline', duration = 20, resectionPercent = 0.0): Promise<any> {
  try {
    const res = await fetch(
      apiUrl(`/api/v1/physiology/stream?scenario=${scenario}&duration_sec=${duration}&resection_percent=${resectionPercent}`)
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch physiology stream:', err);
    return null;
  }
}

export async function fetchNeedlePhysics(depthMm: number): Promise<any> {
  try {
    const res = await fetch(apiUrl(`/api/v1/physics/needle-insertion?depth_mm=${depthMm}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch needle physics:', err);
    return null;
  }
}

export async function fetchSOFAScene(studyId: string): Promise<any> {
  try {
    const res = await fetch(apiUrl(`/api/v1/physics/sofa-scene/${studyId}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch SOFA scene:', err);
    return null;
  }
}

export async function fetchPhysicsBenchmarks(): Promise<any> {
  try {
    const res = await fetch(apiUrl('/api/v1/physics/benchmarks'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch physics benchmarks:', err);
    return null;
  }
}

export async function fetchValidationReport(studyId = 'BRATS001'): Promise<any> {
  try {
    const res = await fetch(apiUrl(`/api/v1/validation/metrics?study_id=${studyId}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch validation report:', err);
    return null;
  }
}

export async function searchSurgicalPlans(topK = 3): Promise<SurgicalPlanOption[]> {
  try {
    const res = await fetch(apiUrl('/api/v1/simulations/plans'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_params: { tumor_size: 0.35 },
        n_simulations: 100,
        top_k: topK,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.ranked_plans || []).map((p: any, idx: number) => ({
      rank: idx + 1,
      actions: p.actions || [],
      expected_recovery: p.expected_recovery ?? 0.85,
      risk_score: p.risk_score ?? 0.15,
      confidence_interval: p.confidence_interval ?? [0.8, 0.9],
      utility: p.utility ?? 0.7,
    }));
  } catch (err) {
    console.warn('Plan search API call failed:', err);
    return [];
  }
}
