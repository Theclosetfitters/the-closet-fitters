'use client';

// Live 3D render of a closet configuration.
//
// RULE (CLAUDE.md #4): ClosetViewer is fully CONTROLLED. It derives everything
// it draws from the `config` + `catalog` props and holds NO internal state.
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  useTexture,
} from '@react-three/drei';
import type {
  Catalog,
  ClosetConfig,
  HardwareOption,
  MaterialOption,
  SectionConfig,
} from '@/types';

interface ClosetViewerProps {
  catalog: Catalog;
  config: ClosetConfig;
}

const IN = 0.0254; // meters per inch
const T = 0.75 * IN; // 3/4" panel thickness
const DRAWER_H = 10 * IN; // each drawer is 10" tall

type Orient = 'v' | 'h';

// Build a PBR material from a real swatch texture, oriented so the grain runs
// along the panel ('v' = vertical components, 'h' = horizontal — rotated 90°).
// Mirrored tiling hides the tile seams.
function makeMat(base: THREE.Texture, orient: Orient, material: MaterialOption) {
  const t = base.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  if (orient === 'h') {
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
  }
  t.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    map: t,
    roughness: material.texture === 'woven' ? 0.85 : 0.6,
    clearcoat:
      material.texture === 'solid' ? 0.5 : material.texture === 'wood' ? 0.2 : 0.05,
    clearcoatRoughness: 0.4,
    metalness: 0,
    envMapIntensity: 0.85,
  });
}

function buildMetal(hardware: HardwareOption) {
  const isBlack = hardware.id === 'black';
  return new THREE.MeshStandardMaterial({
    color: hardware.colorHex,
    metalness: isBlack ? 0.4 : 0.95,
    roughness: isBlack ? 0.5 : 0.3,
    envMapIntensity: 1,
  });
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
      radius={0.004}
      smoothness={2}
      position={position}
      rotation={rotation}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

function Rod({
  cx,
  y,
  length,
  metal,
}: {
  cx: number;
  y: number;
  length: number;
  metal: THREE.Material;
}) {
  return (
    <mesh position={[cx, y, 0]} rotation={[0, 0, Math.PI / 2]} material={metal} castShadow>
      <cylinderGeometry args={[0.013, 0.013, length, 18]} />
    </mesh>
  );
}

// --- Per-section interior --------------------------------------------------
function Interior({
  section,
  cx,
  wM,
  H,
  D,
  matH,
  metal,
}: {
  section: SectionConfig;
  cx: number;
  wM: number;
  H: number;
  D: number;
  matH: THREE.Material;
  metal: THREE.Material;
}) {
  const uw = wM - 1.6 * T; // usable interior width
  const sd = D - 1.6 * T; // shelf depth
  const rodLen = uw * 0.94;
  const zFront = D / 2 - 0.02;

  const shelf = (key: string, y: number, rot?: [number, number, number]) => (
    <Panel key={key} size={[uw, T, sd]} position={[cx, y, 0]} rotation={rot} material={matH} />
  );

  switch (section.interior) {
    case 'long_hanging':
      return (
        <group>
          {shelf('ls', H - 0.34)}
          <Rod cx={cx} y={H - 0.42} length={rodLen} metal={metal} />
        </group>
      );

    case 'double_hanging':
      return (
        <group>
          {shelf('ts', H - 0.34)}
          <Rod cx={cx} y={H - 0.42} length={rodLen} metal={metal} />
          {shelf('ms', H * 0.5)}
          <Rod cx={cx} y={H * 0.5 - 0.08} length={rodLen} metal={metal} />
        </group>
      );

    case 'shoe_shelves': {
      const n = Math.max(3, Math.floor((H - 0.2) / 0.2));
      return (
        <group>
          {Array.from({ length: n }, (_, i) => {
            const y = 0.16 + ((H - 0.3) * (i + 1)) / (n + 1);
            return shelf(`shoe-${i}`, y, [-0.3, 0, 0]);
          })}
        </group>
      );
    }

    case 'adjustable_shelves': {
      const n = 5;
      return (
        <group>
          {Array.from({ length: n }, (_, i) => {
            const y = H * 0.14 + ((H * 0.78) * i) / (n - 1);
            return shelf(`adj-${i}`, y);
          })}
        </group>
      );
    }

    case 'drawers': {
      const bottomY = T;
      const drawers = Array.from({ length: 4 }, (_, k) => {
        const y = bottomY + DRAWER_H * (k + 0.5);
        return (
          <group key={`dr-${k}`}>
            <Panel
              size={[uw, DRAWER_H - 0.01, 0.02]}
              position={[cx, y, zFront]}
              material={matH}
            />
            <mesh
              position={[cx, y, zFront + 0.02]}
              rotation={[0, 0, Math.PI / 2]}
              material={metal}
              castShadow
            >
              <cylinderGeometry args={[0.007, 0.007, uw * 0.34, 12]} />
            </mesh>
          </group>
        );
      });
      const counterY = bottomY + 4 * DRAWER_H + T / 2;
      const aboveTop = H - T;
      const shelves = Array.from({ length: 2 }, (_, i) => {
        const y = counterY + ((aboveTop - counterY) * (i + 1)) / 3;
        return shelf(`drsh-${i}`, y);
      });
      return (
        <group>
          {drawers}
          {shelf('counter', counterY)}
          {shelves}
        </group>
      );
    }

    default:
      return null;
  }
}

function ClosetModel({ catalog, config }: ClosetViewerProps) {
  const material =
    catalog.materials.find((m) => m.id === config.materialId) ?? catalog.materials[0];
  const hardware =
    catalog.hardware.find((h) => h.id === config.hardwareId) ?? catalog.hardware[0];

  // Load the real swatch images (suspends until ready inside <Suspense>).
  const urls = useMemo(
    () => catalog.materials.map((m) => `/textures/${m.id}.jpg`),
    [catalog]
  );
  const loaded = useTexture(urls);
  const baseTex =
    loaded[catalog.materials.findIndex((m) => m.id === material.id)] ?? loaded[0];

  const matV = useMemo(() => makeMat(baseTex, 'v', material), [baseTex, material]);
  const matH = useMemo(() => makeMat(baseTex, 'h', material), [baseTex, material]);
  const metal = useMemo(() => buildMetal(hardware), [hardware]);
  useEffect(
    () => () => {
      matV.map?.dispose();
      matV.dispose();
      matH.map?.dispose();
      matH.dispose();
      metal.dispose();
    },
    [matV, matH, metal]
  );

  const layout = useMemo(() => {
    const heightIn = config.heightUpgrade
      ? catalog.constraints.upgradedHeightIn
      : catalog.constraints.standardHeightIn;
    const H = heightIn * IN;
    const D = catalog.constraints.depthIn * IN;
    const widths = config.sections.map((s) => s.widthIn * IN);
    const W = widths.reduce((a, b) => a + b, 0);
    let cursor = -W / 2;
    const secs = config.sections.map((s, i) => {
      const wM = widths[i];
      const cx = cursor + wM / 2;
      cursor += wM;
      return { s, cx, wM };
    });
    const boundaries: number[] = [-W / 2];
    let bx = -W / 2;
    for (const wM of widths) {
      bx += wM;
      boundaries.push(bx);
    }
    return { H, D, W, secs, boundaries };
  }, [config, catalog]);

  const { H, D, W, secs, boundaries } = layout;

  return (
    <group position={[0, 0, 0]}>
      {/* Top + bottom (horizontal grain) */}
      <Panel size={[W, T, D]} position={[0, H - T / 2, 0]} material={matH} />
      <Panel size={[W, T, D]} position={[0, T / 2, 0]} material={matH} />

      {/* Vertical partitions incl. the two ends (vertical grain) */}
      {boundaries.map((bx, i) => (
        <Panel key={`part-${i}`} size={[T, H, D]} position={[bx, H / 2, 0]} material={matV} />
      ))}

      {/* Optional back panels (per section) */}
      {secs.map(
        ({ s, cx, wM }) =>
          s.hasBack && (
            <Panel
              key={`back-${s.id}`}
              size={[wM - T, H - T, T]}
              position={[cx, H / 2, -D / 2 + T / 2]}
              material={matV}
            />
          )
      )}

      {/* Interiors */}
      {secs.map(({ s, cx, wM }) => (
        <Interior
          key={`int-${s.id}`}
          section={s}
          cx={cx}
          wM={wM}
          H={H}
          D={D}
          matH={matH}
          metal={metal}
        />
      ))}
    </group>
  );
}

export default function ClosetViewer({ catalog, config }: ClosetViewerProps) {
  const heightIn = config.heightUpgrade
    ? catalog.constraints.upgradedHeightIn
    : catalog.constraints.standardHeightIn;
  const H = heightIn * IN;
  const W = config.sections.reduce((a, s) => a + s.widthIn, 0) * IN;
  const span = Math.max(W, H);
  const dist = span * 1.3 + 1.2;

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [dist * 0.55, H * 0.6 + 0.5, dist], fov: 42 }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      className="h-full w-full"
    >
      <color attach="background" args={['#eef0f2']} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 25]} />
      </directionalLight>
      <directionalLight position={[-5, 3, -2]} intensity={0.4} />

      <Suspense fallback={null}>
        <ClosetModel catalog={catalog} config={config} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#e6e7ea" roughness={0.85} metalness={0.05} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={Math.max(6, W * 2)} blur={2.4} far={5} />

        <Environment resolution={256}>
          <Lightformer intensity={2.2} position={[0, 5, -3]} scale={[14, 6, 1]} />
          <Lightformer intensity={1.1} position={[-6, 2, 1]} scale={[6, 6, 1]} />
          <Lightformer intensity={1.1} position={[6, 2, 1]} scale={[6, 6, 1]} />
          <Lightformer intensity={0.8} position={[0, 3, 5]} scale={[10, 4, 1]} />
        </Environment>
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, H / 2, 0]}
        enablePan={false}
        minDistance={1.5}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </Canvas>
  );
}
