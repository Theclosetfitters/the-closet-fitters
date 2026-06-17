'use client';

// Live 3D render of a closet configuration.
//
// RULE (CLAUDE.md #4): ClosetViewer is fully CONTROLLED. It derives everything
// it draws from the `config` + `catalog` props and holds NO internal state for
// selections. Parent owns the configuration.
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
} from '@react-three/drei';
import type { Catalog, ClosetConfig } from '@/types';
import { groupQuantityTotal } from '@/lib/config';

interface ClosetViewerProps {
  catalog: Catalog;
  config: ClosetConfig;
}

const T = 0.02; // panel thickness (m) — 20mm board

// --- Finish appearance (physically based) ----------------------------------
interface FinishLook {
  color: string;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}
const FINISHES: Record<string, FinishLook> = {
  'matte-white': { color: '#ecebe6', roughness: 0.92, clearcoat: 0.0, clearcoatRoughness: 0.6 },
  walnut: { color: '#5e3b22', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35 },
  charcoal: { color: '#37373b', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 },
};
// Material shifts the baseline roughness a touch and drives the grain pattern.
const MATERIAL_ROUGHNESS: Record<string, number> = {
  melamine: 0.08,
  plywood: 0.0,
  'solid-oak': -0.06,
};

// --- Procedural grain texture (cached per material) ------------------------
const grainCache = new Map<string, THREE.Texture>();
function getGrainTexture(materialId: string): THREE.Texture {
  const cached = grainCache.get(materialId);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, size, size);

  const lineCount =
    materialId === 'melamine' ? 0 : materialId === 'plywood' ? 70 : 40;
  const sway = materialId === 'solid-oak' ? 26 : 8;

  for (let i = 0; i < lineCount; i++) {
    const x = Math.random() * size;
    const width =
      materialId === 'solid-oak' ? 1 + Math.random() * 3 : 0.5 + Math.random() * 1.5;
    const shade = 150 + Math.random() * 70;
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.2 + Math.random() * 0.3})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 14) {
      ctx.lineTo(x + Math.sin((y / size) * Math.PI * 2) * sway, y);
    }
    ctx.stroke();
  }

  // Fine speckle so even flat melamine catches light subtly.
  const noise = materialId === 'melamine' ? 5000 : 2000;
  for (let i = 0; i < noise; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  grainCache.set(materialId, tex);
  return tex;
}

function selectionId(config: ClosetConfig, groupId: string, fallback: string) {
  const sel = config.selections[groupId];
  return (Array.isArray(sel) ? sel[0] : undefined) ?? fallback;
}

// --- Reusable rounded panel ------------------------------------------------
function Panel({
  size,
  position,
  rotation,
  material,
}: {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  material: THREE.Material;
}) {
  return (
    <RoundedBox
      args={size}
      radius={0.005}
      smoothness={3}
      position={position}
      rotation={rotation}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

function ClosetModel({ catalog, config }: ClosetViewerProps) {
  void catalog; // catalog reserved for future per-option geometry

  const w = config.dimensions.width / 100;
  const h = config.dimensions.height / 100;
  const d = config.dimensions.depth / 100;

  const materialId = selectionId(config, 'material', 'melamine');
  const finishId = selectionId(config, 'finish', 'matte-white');

  // One shared PBR material for all carcass/wood parts (rebuilt only when the
  // material or finish changes — not on every dimension tweak).
  const woodMat = useMemo(() => {
    const look = FINISHES[finishId] ?? FINISHES['matte-white'];
    const grain = getGrainTexture(materialId);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(look.color),
      roughness: Math.min(1, look.roughness + (MATERIAL_ROUGHNESS[materialId] ?? 0)),
      metalness: 0,
      clearcoat: look.clearcoat,
      clearcoatRoughness: look.clearcoatRoughness,
      roughnessMap: grain,
      bumpMap: grain,
      bumpScale: materialId === 'melamine' ? 0.0015 : 0.004,
      envMapIntensity: 0.8,
    });
    return mat;
  }, [materialId, finishId]);

  useEffect(() => () => woodMat.dispose(), [woodMat]);

  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c2c6cc',
        metalness: 0.95,
        roughness: 0.25,
        envMapIntensity: 1,
      }),
    []
  );
  useEffect(() => () => metalMat.dispose(), [metalMat]);

  const counts = {
    shelves: groupQuantityTotal(config, 'shelves'),
    drawers: groupQuantityTotal(config, 'drawers'),
    rods: groupQuantityTotal(config, 'hanging-rods'),
    shoes: groupQuantityTotal(config, 'shoe-racks'),
  };

  // Interior bays: left for shelves+drawers, right for hanging+shoes.
  const bayW = w / 2 - 1.5 * T; // usable width of one bay
  const leftX = -w / 4;
  const rightX = w / 4;
  const innerD = d - 2 * T;

  // Shelves — left bay, upper region.
  const shelves = Array.from({ length: counts.shelves }, (_, i) => {
    const y = h * 0.42 + (h * 0.5 * (i + 1)) / (counts.shelves + 1);
    if (y > h - 2 * T) return null;
    return (
      <Panel
        key={`shelf-${i}`}
        size={[bayW, T, innerD]}
        position={[leftX, y, 0]}
        material={woodMat}
      />
    );
  });

  // Drawers — left bay, stacked from the bottom, with a metal pull.
  const drawerH = 0.2;
  const drawers = Array.from({ length: counts.drawers }, (_, i) => {
    const y = T + 0.02 + drawerH / 2 + i * (drawerH + 0.012);
    if (y + drawerH / 2 > h * 0.42) return null;
    return (
      <group key={`drawer-${i}`}>
        <Panel
          size={[bayW, drawerH, 0.02]}
          position={[leftX, y, d / 2 - 0.02]}
          material={woodMat}
        />
        <mesh
          position={[leftX, y, d / 2 + 0.005]}
          rotation={[0, 0, Math.PI / 2]}
          material={metalMat}
          castShadow
        >
          <cylinderGeometry args={[0.008, 0.008, bayW * 0.4, 12]} />
        </mesh>
      </group>
    );
  });

  // Hanging rods — right bay, near the top, with end supports.
  const rodLen = bayW - 0.04;
  const rods = Array.from({ length: counts.rods }, (_, i) => {
    const y = h - 0.16 - i * 0.5;
    if (y < h * 0.42) return null;
    return (
      <group key={`rod-${i}`}>
        <mesh
          position={[rightX, y, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={metalMat}
          castShadow
        >
          <cylinderGeometry args={[0.013, 0.013, rodLen, 20]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[rightX + (s * rodLen) / 2, y + 0.03, 0]}
            material={metalMat}
          >
            <boxGeometry args={[0.02, 0.06, 0.02]} />
          </mesh>
        ))}
      </group>
    );
  });

  // Shoe racks — right bay, angled shelves along the bottom.
  const shoes = Array.from({ length: counts.shoes }, (_, i) => {
    const y = T + 0.07 + i * 0.17;
    if (y > h * 0.42) return null;
    return (
      <Panel
        key={`shoe-${i}`}
        size={[bayW, T, innerD * 0.66]}
        position={[rightX, y, -0.02]}
        rotation={[-0.32, 0, 0]}
        material={woodMat}
      />
    );
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Carcass */}
      <Panel size={[w, h, T]} position={[0, h / 2, -d / 2 + T / 2]} material={woodMat} />
      <Panel size={[T, h, d]} position={[-w / 2 + T / 2, h / 2, 0]} material={woodMat} />
      <Panel size={[T, h, d]} position={[w / 2 - T / 2, h / 2, 0]} material={woodMat} />
      <Panel size={[w, T, d]} position={[0, h - T / 2, 0]} material={woodMat} />
      <Panel size={[w, T, d]} position={[0, T / 2, 0]} material={woodMat} />
      {/* Center divider between the two bays */}
      <Panel size={[T, h - 2 * T, innerD]} position={[0, h / 2, T / 2]} material={woodMat} />
      {shelves}
      {drawers}
      {rods}
      {shoes}
    </group>
  );
}

export default function ClosetViewer({ catalog, config }: ClosetViewerProps) {
  const h = config.dimensions.height / 100;
  const w = config.dimensions.width / 100;
  const dist = Math.max(w, h) * 1.6 + 1.2;

  return (
    <Canvas
      shadows
      // On-demand rendering: draws on interaction/prop change, idles otherwise.
      // Saves GPU and lets the canvas be captured for screenshots/sharing.
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [dist * 0.8, h * 0.62 + 0.6, dist], fov: 42 }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      className="h-full w-full"
    >
      <color attach="background" args={['#eef0f2']} />
      <fog attach="fog" args={['#eef0f2', dist + 4, dist + 14]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-4, 4, 4, -4, 0.1, 20]} />
      </directionalLight>
      <directionalLight position={[-5, 3, -2]} intensity={0.4} />

      <Suspense fallback={null}>
        <ClosetModel catalog={catalog} config={config} />

        {/* Matte showroom floor + soft contact shadow for grounding. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#e6e7ea" roughness={0.85} metalness={0.05} />
        </mesh>

        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.5}
          scale={14}
          blur={2.4}
          far={5}
        />

        {/* Studio environment for reflections — no network HDR needed. */}
        <Environment resolution={256}>
          <Lightformer intensity={2.2} position={[0, 5, -3]} scale={[12, 6, 1]} />
          <Lightformer intensity={1.1} position={[-6, 2, 1]} scale={[5, 6, 1]} />
          <Lightformer intensity={1.1} position={[6, 2, 1]} scale={[5, 6, 1]} />
          <Lightformer intensity={0.8} position={[0, 3, 4]} scale={[8, 4, 1]} />
        </Environment>
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, h / 2, 0]}
        enablePan={false}
        minDistance={1.8}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </Canvas>
  );
}
