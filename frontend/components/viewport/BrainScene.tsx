'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useBrainStore } from '../../stores/useBrainStore';
import { AnatomicalStructure } from '../../types/anatomy';

// Helper to merge buffer geometries for bilateral brain structures
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : 0;
  }

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNorm = new Float32Array(totalVerts * 3);
  const mergedIndices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  let vertIndexOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position.array as Float32Array;
    const norm = g.attributes.normal.array as Float32Array;
    mergedPos.set(pos, vOffset);
    mergedNorm.set(norm, vOffset);

    if (g.index) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i++) {
        mergedIndices[iOffset + i] = idx[i] + vertIndexOffset;
      }
      iOffset += idx.length;
    }

    vOffset += pos.length;
    vertIndexOffset += g.attributes.position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  }
  return merged;
}

// True Bilateral Human Cerebral Cortex with Longitudinal Fissure, Gyri & Sulci
function createAnatomicalBrainCortex(): THREE.BufferGeometry {
  const createHemisphere = (isLeft: boolean): THREE.BufferGeometry => {
    const sign = isLeft ? -1 : 1;
    const geom = new THREE.SphereGeometry(52, 64, 48);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      // Base anatomical proportions (ellipsoid)
      let x = v.x * 0.95;
      let y = v.y * 1.05;
      let z = v.z * 1.25;

      // 1. Flatten medial interhemispheric wall (Longitudinal Fissure)
      if (x * sign < 1.0) {
        x = sign * (1.5 + Math.abs(x) * 0.12);
      } else {
        x = sign * (2.2 + Math.abs(x) * 0.96);
      }

      // 2. Frontal lobe protrusion (Anterior cranial vault)
      if (z > 10) {
        const fProg = (z - 10) / 55;
        y += Math.sin(fProg * Math.PI * 0.5) * 4.0;
        z += fProg * 8.0;
      }

      // 3. Occipital lobe tapering and posterior-inferior slope
      if (z < -15) {
        const oProg = (-z - 15) / 50;
        y -= oProg * 5.0;
        x *= (1.0 - oProg * 0.18);
        z -= oProg * 6.0;
      }

      // 4. Temporal lobe antero-inferior projection
      const tempDist = Math.hypot(y + 16, z - 15);
      if (tempDist < 35 && Math.abs(x) > 18) {
        const tWeight = Math.exp(-Math.pow(tempDist / 25, 2));
        y -= tWeight * 14.0;
        z += tWeight * 9.0;
        x += sign * tWeight * 7.0;
      }

      // 5. Sylvian Fissure (Lateral Sulcus Indentation)
      const sylvianDist = Math.abs(y - 0.22 * z + 6.0);
      if (sylvianDist < 12.0 && Math.abs(x) > 22 && z > -25 && z < 45) {
        const sWeight = Math.exp(-Math.pow(sylvianDist / 7.0, 2));
        x -= sign * sWeight * 6.5;
        y += sWeight * 2.0;
      }

      // 6. Central Sulcus & Parietal Contour
      const centralDist = Math.abs(z - 0.35 * y - 6.0);
      if (centralDist < 8.0 && y > 10) {
        const cWeight = Math.exp(-Math.pow(centralDist / 5.0, 2));
        y -= cWeight * 3.5;
      }

      // 7. Multi-frequency Gyri & Sulci folds (convolutions)
      const medialDist = Math.abs(x);
      const gyriAtten = Math.min(1.0, Math.max(0.15, (medialDist - 3.0) / 12.0));

      const g1 = Math.sin(x * 0.22) * Math.cos(y * 0.22 + z * 0.08) * Math.sin(z * 0.22) * 3.8;
      const g2 = Math.sin(y * 0.42 - x * 0.15) * Math.cos(z * 0.42 + y * 0.1) * 2.1;
      const g3 = Math.cos(x * 0.75 + z * 0.3) * Math.sin(y * 0.75) * 0.9;
      const totalGyri = (g1 + g2 + g3) * gyriAtten;

      // Displace outward along normal/radial
      const len = Math.hypot(x, y, z);
      if (len > 0.001) {
        x += (x / len) * totalGyri;
        y += (y / len) * totalGyri;
        z += (z / len) * totalGyri;
      }

      pos.setXYZ(i, x, y, z);
    }

    geom.computeVertexNormals();
    return geom;
  };

  const left = createHemisphere(true);
  const right = createHemisphere(false);
  return mergeBufferGeometries([left, right]);
}

// Subcortical White Matter Core
function createAnatomicalWhiteMatter(): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(42, 4);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiply(new THREE.Vector3(0.88, 0.92, 1.15));
    // Soft inner sulcal impression
    const noise = Math.sin(v.x * 0.18) * Math.cos(v.y * 0.18) * 1.5;
    v.addScalar(noise);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

// Bilateral Cerebellar Lobes with Horizontal Folia Striations
function createAnatomicalCerebellum(): THREE.BufferGeometry {
  const createLobe = (isLeft: boolean): THREE.BufferGeometry => {
    const sign = isLeft ? -1 : 1;
    const geom = new THREE.SphereGeometry(21, 32, 24);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let x = v.x * 1.2 + sign * 22;
      let y = v.y * 0.75 - 40;
      let z = v.z * 0.95 - 38;

      const folia = Math.sin(v.y * 1.6) * 1.1;
      x += (v.x / 21) * folia;
      z += (v.z / 21) * folia;

      pos.setXYZ(i, x, y, z);
    }
    geom.computeVertexNormals();
    return geom;
  };

  const left = createLobe(true);
  const right = createLobe(false);
  return mergeBufferGeometries([left, right]);
}

// Brainstem with Anterior Pontine Bulge and Medulla
function createAnatomicalBrainstem(): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(8.0, 5.5, 48, 32, 16);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x;
    let y = v.y - 42;
    let z = v.z - 12;

    if (y > -42 && y < -26 && z > -12) {
      const pProg = Math.sin(((y + 42) / 16) * Math.PI);
      z += pProg * 6.0;
      x *= (1.0 + pProg * 0.35);
    }
    pos.setXYZ(i, x, y, z);
  }
  geom.computeVertexNormals();
  return geom;
}

// Bilateral C-shaped Lateral Ventricles
function createAnatomicalVentricles(): THREE.BufferGeometry {
  const createHorn = (isLeft: boolean): THREE.BufferGeometry => {
    const sign = isLeft ? -1 : 1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sign * 7, 18, 22),     // Frontal horn
      new THREE.Vector3(sign * 14, 22, 5),     // Body
      new THREE.Vector3(sign * 18, 14, -20),   // Atrium
      new THREE.Vector3(sign * 12, 10, -38),   // Occipital horn
      new THREE.Vector3(sign * 24, -12, -8),   // Temporal horn
      new THREE.Vector3(sign * 22, -18, 14),   // Temporal pole tip
    ]);
    return new THREE.TubeGeometry(curve, 48, 4.2, 14, false);
  };
  const left = createHorn(true);
  const right = createHorn(false);
  return mergeBufferGeometries([left, right]);
}

// Middle Cerebral Artery (MCA) Arborization
function createAnatomicalArtery(): THREE.BufferGeometry {
  const m1Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10, -32, 5),
    new THREE.Vector3(-24, -18, 10),
    new THREE.Vector3(-38, -6, 12),
  ]);
  const m1Geom = new THREE.TubeGeometry(m1Curve, 24, 2.8, 10, false);

  const m2SupCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-38, -6, 12),
    new THREE.Vector3(-48, 8, 16),
    new THREE.Vector3(-55, 26, 8),
  ]);
  const m2SupGeom = new THREE.TubeGeometry(m2SupCurve, 24, 2.0, 10, false);

  const m2InfCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-38, -6, 12),
    new THREE.Vector3(-50, -12, 0),
    new THREE.Vector3(-56, -8, -18),
  ]);
  const m2InfGeom = new THREE.TubeGeometry(m2InfCurve, 24, 1.8, 10, false);

  return mergeBufferGeometries([m1Geom, m2SupGeom, m2InfGeom]);
}

// Patient-Specific Microlobulated Tumor Morphology
function createAnatomicalTumor(id: string, activePatient: string): THREE.BufferGeometry {
  const PATIENT_TUMORS: Record<string, [number, number, number]> = {
    BRATS001: [-36, -12, 8],     // Left Temporal Glioblastoma
    BRATS002: [32, 26, 36],       // Frontal Convexity
    BRATS003: [-26, 32, -38],     // Parieto-Occipital
    BRATS004: [22, -8, 6],        // Right Deep Subcortical
  };

  const center = PATIENT_TUMORS[activePatient] ?? [-36, -12, 8];
  const isEdema = id.includes('edema');
  const baseRadius = isEdema ? 22 : 14;

  const geom = new THREE.SphereGeometry(baseRadius, 32, 24);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const noise =
      Math.sin(v.x * 0.35) * Math.sin(v.y * 0.35) * (isEdema ? 3.5 : 2.4) +
      Math.cos(v.z * 0.5) * 1.5;
    v.addScalar(noise);
    v.add(new THREE.Vector3(...center));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

// Procedural geometry selector
function useAnatomyGeometry(id: string, activePatient: string) {
  return useMemo(() => {
    switch (id) {
      case 'brain_cortex':
      case 'brain_surface':
        return createAnatomicalBrainCortex();
      case 'white_matter':
        return createAnatomicalWhiteMatter();
      case 'ventricles':
        return createAnatomicalVentricles();
      case 'brainstem':
        return createAnatomicalBrainstem();
      case 'cerebellum':
        return createAnatomicalCerebellum();
      case 'mca_artery':
        return createAnatomicalArtery();
      case 'tumor_core':
      case 'enhancing_tumor':
      case 'necrotic_core':
      case 'peritumoral_edema':
        return createAnatomicalTumor(id, activePatient);
      default:
        return new THREE.SphereGeometry(10, 16, 16);
    }
  }, [id, activePatient]);
}

interface StructureMeshProps {
  structure: AnatomicalStructure;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

// Procedural structure renderer with GNN Risk Heatmap support
const ProceduralStructure: React.FC<StructureMeshProps> = ({ structure, isSelected, onSelect }) => {
  const { showRiskHeatmap, activePatient } = useBrainStore();
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const geometry = useAnatomyGeometry(structure.id, activePatient);

  const effectiveColor = useMemo(() => {
    if (showRiskHeatmap && typeof structure.riskScore === 'number') {
      if (structure.riskScore > 0.6) return '#ef4444'; // high risk red
      if (structure.riskScore > 0.25) return '#f59e0b'; // medium risk amber
      return '#10b981'; // low risk emerald
    }
    return structure.color;
  }, [showRiskHeatmap, structure.riskScore, structure.color]);

  useFrame((state) => {
    if (structure.type === 'tumor' && meshRef.current) {
      const pulse = 1.0 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.02;
      meshRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  if (!structure.visible) return null;

  const isTransparent = structure.opacity < 0.99;
  const emissiveColor = isSelected
    ? '#38bdf8'
    : hovered
    ? '#60a5fa'
    : structure.type === 'tumor'
    ? '#ef4444'
    : '#000000';
  const emissiveIntensity = isSelected ? 0.6 : hovered ? 0.35 : structure.type === 'tumor' ? 0.3 : 0.0;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(structure.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={effectiveColor}
        roughness={structure.type === 'cortex' ? 0.65 : 0.35}
        metalness={0.1}
        transparent={isTransparent}
        opacity={structure.opacity}
        depthWrite={!isTransparent || structure.opacity > 0.5}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Real Patient MRI 3D Digital Twin (GLTF/GLB Asset Renderer)
const GLTFStructure: React.FC<StructureMeshProps & { url: string }> = ({ structure, isSelected, onSelect, url }) => {
  const { showRiskHeatmap } = useBrainStore();
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const effectiveColor = useMemo(() => {
    if (showRiskHeatmap && typeof structure.riskScore === 'number') {
      if (structure.riskScore > 0.6) return '#ef4444';
      if (structure.riskScore > 0.25) return '#f59e0b';
      return '#10b981';
    }
    return structure.color;
  }, [showRiskHeatmap, structure.riskScore, structure.color]);

  // Deep clone geometry & setup standard materials with patient-specific styling
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(effectiveColor),
          roughness: structure.type === 'cortex' ? 0.65 : 0.35,
          metalness: 0.1,
          transparent: structure.opacity < 0.99,
          opacity: structure.opacity,
          side: THREE.DoubleSide,
          depthWrite: structure.opacity > 0.45,
        });
      }
    });
    return clone;
  }, [scene, effectiveColor, structure.opacity, structure.type]);

  // Update emissive on selection/hover/pathology
  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.color = new THREE.Color(effectiveColor);
        mat.transparent = structure.opacity < 0.99;
        mat.opacity = structure.opacity;
        if (isSelected) {
          mat.emissive = new THREE.Color('#38bdf8');
          mat.emissiveIntensity = 0.55;
        } else if (hovered) {
          mat.emissive = new THREE.Color('#60a5fa');
          mat.emissiveIntensity = 0.35;
        } else if (structure.type === 'tumor') {
          mat.emissive = new THREE.Color('#ef4444');
          mat.emissiveIntensity = 0.25;
        } else {
          mat.emissive = new THREE.Color('#000000');
          mat.emissiveIntensity = 0.0;
        }
      }
    });
  }, [clonedScene, effectiveColor, isSelected, hovered, structure.opacity, structure.type]);

  useFrame((state) => {
    if (structure.type === 'tumor' && groupRef.current) {
      const pulse = 1.0 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.015;
      groupRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  if (!structure.visible) return null;

  return (
    <primitive
      ref={groupRef}
      object={clonedScene}
      onClick={(e: any) => {
        e.stopPropagation();
        onSelect(structure.id);
      }}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    />
  );
};

// Error boundary to gracefully fall back to procedural if GLB load fails
class GLTFErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('Failed to load GLTF asset, falling back to procedural:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const StructureMesh: React.FC<StructureMeshProps> = (props) => {
  const { modelViewMode } = useBrainStore();
  if (!props.structure.visible) return null;

  if (modelViewMode === 'raw_mri' && props.structure.asset_url) {
    return (
      <GLTFErrorBoundary fallback={<ProceduralStructure {...props} />}>
        <GLTFStructure {...props} url={props.structure.asset_url} />
      </GLTFErrorBoundary>
    );
  }
  return <ProceduralStructure {...props} />;
};

// 3D Graph Neural Network Connectivity Edges
const GraphEdges3D: React.FC = () => {
  const { gnnPrediction, structures, showGraphEdges } = useBrainStore();

  const edgeObjects = useMemo(() => {
    if (!showGraphEdges || !gnnPrediction?.graph_edges) return [];

    const lines: THREE.Line[] = [];
    for (const edge of gnnPrediction.graph_edges) {
      const s1 = structures.find((s) => s.id === edge.source);
      const s2 = structures.find((s) => s.id === edge.target);
      if (!s1?.coordinates || !s2?.coordinates) continue;

      const p1 = new THREE.Vector3(...s1.coordinates);
      const p2 = new THREE.Vector3(...s2.coordinates);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineDashedMaterial({
        color: edge.weight > 0.6 ? 0xef4444 : 0x06b6d4,
        dashSize: 3.0,
        gapSize: 1.5,
        transparent: true,
        opacity: Math.max(0.3, edge.weight),
      });
      const line = new THREE.Line(geom, mat);
      line.computeLineDistances();
      lines.push(line);
    }
    return lines;
  }, [showGraphEdges, gnnPrediction?.graph_edges, structures]);

  if (!showGraphEdges || edgeObjects.length === 0) return null;

  return (
    <group>
      {edgeObjects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  );
};

// Interactive Stereotactic Guidance & Instruments (Sprint 03)
const SurgicalInstruments: React.FC = () => {
  const { structures, stage, viewMode, instrument } = useBrainStore();

  const tumor = structures.find((s) => s.type === 'tumor') || structures.find((s) => s.id === 'tumor_core');
  const targetPos = useMemo(() => {
    if (tumor && tumor.coordinates) {
      return new THREE.Vector3(...tumor.coordinates);
    }
    return new THREE.Vector3(20, -40, -5);
  }, [tumor]);

  const entryPos = useMemo(() => {
    return targetPos.clone().add(new THREE.Vector3(30, 55, 20));
  }, [targetPos]);

  const totalDist = entryPos.distanceTo(targetPos);
  const currentTipPos = useMemo(() => {
    const fraction = Math.min(1.0, instrument.depthMm / Math.max(1, totalDist));
    return entryPos.clone().lerp(targetPos, fraction);
  }, [entryPos, targetPos, instrument.depthMm, totalDist]);

  const trajectoryPoints = useMemo(() => [entryPos, targetPos], [entryPos, targetPos]);
  const lineGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints(trajectoryPoints), [trajectoryPoints]);
  const lineObj = useMemo(() => {
    const mat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 2.0, gapSize: 1.0 });
    const l = new THREE.Line(lineGeom, mat);
    l.computeLineDistances();
    return l;
  }, [lineGeom]);

  const needleQuaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = targetPos.clone().sub(entryPos).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [entryPos, targetPos]);

  const isNavigationOrResection =
    stage === 'probe_navigation' ||
    stage === 'resection' ||
    viewMode === 'trajectory' ||
    viewMode === 'resection';

  const isCraniotomy = stage === 'craniotomy' || viewMode === 'craniotomy';

  return (
    <group>
      {/* 1. Craniotomy Bone Flap & Sterile Dural Incision Margin */}
      {(isCraniotomy || isNavigationOrResection) && (
        <group position={entryPos}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.0, 5.0, 32]} />
            <meshStandardMaterial color="#06b6d4" side={THREE.DoubleSide} emissive="#0891b2" emissiveIntensity={0.6} />
          </mesh>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[14.0, 15.5, 48]} />
            <meshBasicMaterial color="#38bdf8" wireframe side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>

          <Html position={[0, 8, 0]} center>
            <div className="bg-slate-900/95 border border-cyan-500/60 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap">
              CRANIOTOMY ENTRY (Ø 30 mm)
            </div>
          </Html>
        </group>
      )}

      {/* 2. Stereotactic Needle Cannula & Trajectory Guidance */}
      {isNavigationOrResection && (
        <>
          <primitive object={lineObj} />

          <mesh
            position={entryPos.clone().add(currentTipPos).multiplyScalar(0.5)}
            quaternion={needleQuaternion}
          >
            <cylinderGeometry args={[0.9, 0.9, entryPos.distanceTo(currentTipPos) + 0.1, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
          </mesh>

          <mesh position={currentTipPos}>
            <sphereGeometry args={[1.4, 16, 16]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} />
          </mesh>

          <mesh position={targetPos}>
            <sphereGeometry args={[2.5, 16, 16]} />
            <meshBasicMaterial color="#ef4444" wireframe />
          </mesh>

          <Html position={[targetPos.x, targetPos.y + 6, targetPos.z]} center>
            <div className="bg-slate-950/90 border border-rose-500/70 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap">
              TARGET CENTROID (dist: {entryPos.distanceTo(currentTipPos).toFixed(1)} / {totalDist.toFixed(1)} mm)
            </div>
          </Html>
        </>
      )}

      {/* 3. CUSA Ultrasonic Cavitron Aspirator & Biomechanical Resection Field */}
      {(stage === 'resection' || viewMode === 'resection') && (
        <group position={targetPos}>
          <mesh>
            <sphereGeometry args={[instrument.resectionProgress > 0 ? 12 : 6, 24, 24]} />
            <meshStandardMaterial
              color="#38bdf8"
              transparent
              opacity={0.18}
              wireframe
              side={THREE.DoubleSide}
            />
          </mesh>

          {instrument.resectionProgress > 0 && (
            <mesh>
              <sphereGeometry args={[8 + (instrument.resectionProgress / 100) * 8, 32, 32]} />
              <meshBasicMaterial color="#10b981" wireframe transparent opacity={0.35} />
            </mesh>
          )}

          {instrument.tissueShiftMm > 0 && (
            <Html position={[0, -12, 0]} center>
              <div className="bg-amber-950/90 border border-amber-500/80 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap">
                BRAIN SHIFT: {instrument.tissueShiftMm.toFixed(2)} mm (FEM Adjusted)
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
};

export const BrainScene: React.FC = () => {
  const { structures, selectedStructureId, selectStructure, cameraView, showRiskHeatmap } = useBrainStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    if (cameraView === 'axial') {
      camera.position.set(0, 190, 0);
      camera.up.set(0, 0, -1);
    } else if (cameraView === 'sagittal') {
      camera.position.set(190, 0, 0);
      camera.up.set(0, 1, 0);
    } else if (cameraView === 'coronal') {
      camera.position.set(0, 0, 190);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(140, 110, 140);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [cameraView, camera]);

  const selectedStructure = structures.find((s) => s.id === selectedStructureId);

  return (
    <>
      <color attach="background" args={['#080c14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[100, 140, 100]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-120, 40, -80]} intensity={0.8} color="#93c5fd" />
      <directionalLight position={[0, -100, -120]} intensity={1.2} color="#38bdf8" />
      <pointLight position={[0, 40, 80]} intensity={0.9} color="#e0e7ff" />

      {/* Orientation Reference Grid Floor */}
      <gridHelper args={[260, 52, '#1e293b', '#0f172a']} position={[0, -90, 0]} />

      {/* Brain Structures Group */}
      <group position={[0, 0, 0]}>
        {structures.map((s) => (
          <StructureMesh
            key={s.id}
            structure={s}
            isSelected={selectedStructureId === s.id}
            onSelect={selectStructure}
          />
        ))}

        {/* 3D GNN Graph Adjacency Edges */}
        <GraphEdges3D />

        {/* Selected Structure 3D Callout Badge */}
        {selectedStructure && selectedStructure.coordinates && (
          <Html
            position={[
              selectedStructure.coordinates[0],
              selectedStructure.coordinates[1] + 12,
              selectedStructure.coordinates[2],
            ]}
            center
          >
            <div className="pointer-events-none rounded bg-slate-900/95 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 border border-cyan-500/60 shadow-2xl whitespace-nowrap backdrop-blur flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    showRiskHeatmap && typeof selectedStructure.riskScore === 'number'
                      ? selectedStructure.riskScore > 0.6
                        ? '#ef4444'
                        : selectedStructure.riskScore > 0.25
                        ? '#f59e0b'
                        : '#10b981'
                      : selectedStructure.color,
                }}
              />
              <span>{selectedStructure.name}</span>
              {typeof selectedStructure.riskScore === 'number' && (
                <span className="font-mono text-amber-300 text-[10px]">
                  [GNN Risk: {(selectedStructure.riskScore * 100).toFixed(0)}%]
                </span>
              )}
            </div>
          </Html>
        )}

        {/* Surgical Trajectory, Instruments & Resection Field */}
        <SurgicalInstruments />
      </group>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={30}
        maxDistance={450}
      />
    </>
  );
};
