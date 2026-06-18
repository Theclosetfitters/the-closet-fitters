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
  Html,
  useTexture,
} from '@react-three/drei';
import type {
  Catalog,
  ClosetConfig,
  HardwareOption,
  HardwareStyleId,
  MaterialOption,
  SectionConfig,
  WallId,
} from '@/types';
import {
  CORNER_FILLER_IN,
  drawerBlockedSideBayIds,
  wallDisplayLabel,
  wallsForShape,
} from '@/lib/config';

interface ClosetViewerProps {
  catalog: Catalog;
  config: ClosetConfig;
}

const IN = 0.0254; // meters per inch
const T = 0.75 * IN; // 3/4" panel thickness
const DRAWER_H = 10 * IN; // each drawer is 10" tall
const TOE_H = 2 * IN; // 2" toe kick height
const TOE_RECESS = 0.75 * IN; // toe kick set back 3/4"
const TOP_CUBBY = 12 * IN; // fixed shelf sits 12" down from the top

type Orient = 'v' | 'h';

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

// Drawer-front hardware, rendered from simple primitives per selected style.
function Pull({
  styleId,
  cx,
  y,
  zFront,
  width,
  metal,
}: {
  styleId: HardwareStyleId;
  cx: number;
  y: number;
  zFront: number;
  width: number;
  metal: THREE.Material;
}) {
  // All three styles are 6" pulls, capped so they fit narrow drawers.
  const len = Math.min(6 * IN, width * 0.9);

  if (styleId === 'bar_pull') {
    // round cylindrical bar on two round posts
    return (
      <group>
        <mesh
          position={[cx, y, zFront + 0.03]}
          rotation={[0, 0, Math.PI / 2]}
          material={metal}
          castShadow
        >
          <cylinderGeometry args={[0.006, 0.006, len, 16]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[cx + (s * len) / 2, y, zFront + 0.016]}
            rotation={[Math.PI / 2, 0, 0]}
            material={metal}
          >
            <cylinderGeometry args={[0.005, 0.005, 0.028, 12]} />
          </mesh>
        ))}
      </group>
    );
  }

  if (styleId === 'edge_pull') {
    // L-shape on the top edge: flat grip that sticks out + a lip on the face
    const topEdge = y + DRAWER_H / 2;
    return (
      <group>
        <mesh position={[cx, topEdge, zFront + 0.014]} material={metal} castShadow>
          <boxGeometry args={[len, 0.006, 0.032]} />
        </mesh>
        <mesh position={[cx, topEdge - 0.016, zFront + 0.028]} material={metal} castShadow>
          <boxGeometry args={[len, 0.03, 0.006]} />
        </mesh>
      </group>
    );
  }

  // modern_pull: square-profile bar on two solid rectangular block posts
  return (
    <group>
      <mesh position={[cx, y, zFront + 0.03]} material={metal} castShadow>
        <boxGeometry args={[len, 0.011, 0.011]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + (s * len) / 2, y, zFront + 0.016]} material={metal}>
          <boxGeometry args={[0.014, 0.014, 0.028]} />
        </mesh>
      ))}
    </group>
  );
}

// --- Per-section interior --------------------------------------------------
function Interior({
  section,
  cx,
  wM,
  D,
  bottomY,
  topY,
  matH,
  rodMetal,
  pullMetal,
  hardwareStyleId,
}: {
  section: SectionConfig;
  cx: number;
  wM: number;
  D: number;
  bottomY: number;
  topY: number;
  matH: THREE.Material;
  rodMetal: THREE.Material;
  pullMetal: THREE.Material;
  hardwareStyleId: HardwareStyleId;
}) {
  const uw = wM - 1.6 * T;
  const sd = D - 1.6 * T;
  const rodLen = uw * 0.94;
  const zFront = D / 2 - 0.02;
  const rh = topY - bottomY;

  const shelf = (key: string, y: number, rot?: [number, number, number]) => (
    <Panel key={key} size={[uw, T, sd]} position={[cx, y, 0]} rotation={rot} material={matH} />
  );

  switch (section.interior) {
    case 'long_hanging':
      return <Rod cx={cx} y={topY - 0.05} length={rodLen} metal={rodMetal} />;

    case 'double_hanging': {
      const midY = bottomY + rh * 0.5;
      return (
        <group>
          <Rod cx={cx} y={topY - 0.05} length={rodLen} metal={rodMetal} />
          {shelf('ms', midY)}
          <Rod cx={cx} y={midY - 0.07} length={rodLen} metal={rodMetal} />
        </group>
      );
    }

    case 'shoe_shelves': {
      // 6 angled shelves: a fixed shelf in the center (3rd from the bottom)
      // with 2 adjustable below it and 3 adjustable above it, evenly spaced.
      const n = 6;
      return (
        <group>
          {Array.from({ length: n }, (_, i) =>
            shelf(`shoe-${i}`, bottomY + (rh * (i + 1)) / (n + 1), [-0.3, 0, 0])
          )}
        </group>
      );
    }

    case 'adjustable_shelves': {
      // 4 shelves: a fixed shelf in the center (2nd from the bottom) with
      // 1 adjustable below it and 2 adjustable above it, evenly spaced.
      const n = 4;
      return (
        <group>
          {Array.from({ length: n }, (_, i) =>
            shelf(`adj-${i}`, bottomY + (rh * (i + 1)) / (n + 1))
          )}
        </group>
      );
    }

    case 'drawers': {
      const drawers = Array.from({ length: 4 }, (_, k) => {
        const y = bottomY + DRAWER_H * (k + 0.5);
        return (
          <group key={`dr-${k}`}>
            <Panel size={[uw, DRAWER_H - 0.01, 0.02]} position={[cx, y, zFront]} material={matH} />
            <Pull
              styleId={hardwareStyleId}
              cx={cx}
              y={y}
              zFront={zFront}
              width={uw}
              metal={pullMetal}
            />
          </group>
        );
      });
      const counterY = bottomY + 4 * DRAWER_H + T / 2;
      const shelves = Array.from({ length: 2 }, (_, i) =>
        shelf(`drsh-${i}`, counterY + ((topY - counterY) * (i + 1)) / 3)
      );
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

interface RunMaterials {
  matV: THREE.Material;
  matH: THREE.Material;
  rodMetal: THREE.Material;
  pullMetal: THREE.Material;
  hardwareStyleId: HardwareStyleId;
}

// One straight run of bays, centered at the local origin (length along X).
function WallRun({
  sections,
  H,
  D,
  mats,
  blockedIds,
}: {
  sections: SectionConfig[];
  H: number;
  D: number;
  mats: RunMaterials;
  /** Side-wall corner bay ids that must not render drawers. */
  blockedIds: Set<string>;
}) {
  const { matV, matH, rodMetal, pullMetal, hardwareStyleId } = mats;
  const widths = sections.map((s) => s.widthIn * IN);
  const W = widths.reduce((a, b) => a + b, 0);
  if (W <= 0) return null;

  let cursor = -W / 2;
  const secs = sections.map((s, i) => {
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

  const bottomY = TOE_H + T;
  const fixedShelfY = H - TOP_CUBBY;
  const topY = fixedShelfY - T / 2;

  return (
    <group>
      <Panel size={[W, T, D]} position={[0, H - T / 2, 0]} material={matH} />
      <Panel size={[W, T, D]} position={[0, TOE_H + T / 2, 0]} material={matH} />
      {boundaries.map((b, i) => (
        <Panel key={`part-${i}`} size={[T, H, D]} position={[b, H / 2, 0]} material={matV} />
      ))}
      {secs.map(({ s, cx, wM }) => {
        const uw = wM - 1.6 * T;
        // A blocked side-wall corner bay can't have drawers — render the
        // default interior instead so the viewer matches the editor.
        const eff: SectionConfig =
          blockedIds.has(s.id) && s.interior === 'drawers'
            ? { ...s, interior: 'long_hanging' }
            : s;
        return (
          <group key={`bay-${s.id}`}>
            <Panel
              size={[uw, TOE_H, T]}
              position={[cx, TOE_H / 2, D / 2 - TOE_RECESS - T / 2]}
              material={matH}
            />
            <Panel size={[uw, T, D - 1.6 * T]} position={[cx, fixedShelfY, 0]} material={matH} />
            {s.hasBack && (
              <Panel
                size={[wM - T, H - TOE_H - T, T]}
                position={[cx, TOE_H + (H - TOE_H) / 2, -D / 2 + T / 2]}
                material={matV}
              />
            )}
            <Interior
              section={eff}
              cx={cx}
              wM={wM}
              D={D}
              bottomY={bottomY}
              topY={topY}
              matH={matH}
              rodMetal={rodMetal}
              pullMetal={pullMetal}
              hardwareStyleId={hardwareStyleId}
            />
          </group>
        );
      })}
    </group>
  );
}

// --- Wall layout (straight / L / U) ----------------------------------------
interface WallPlacement {
  wall: WallId;
  sections: SectionConfig[];
  position: [number, number, number];
  rotationY: number;
}

function planWalls(config: ClosetConfig, D: number): WallPlacement[] {
  const walls = wallsForShape(config.shape);
  const byWall = (w: WallId) => config.sections.filter((s) => s.wall === w);
  const widthM = (w: WallId) =>
    byWall(w).reduce((a, s) => a + s.widthIn * IN, 0);

  if (config.shape === 'l_shaped') {
    const Wb = widthM('B');
    return [
      { wall: 'A', sections: byWall('A'), position: [0, 0, 0], rotationY: 0 },
      { wall: 'B', sections: byWall('B'), position: [-widthM('A') / 2 - D / 2, 0, Wb / 2 + D / 2], rotationY: Math.PI / 2 },
    ];
  }
  if (config.shape === 'u_shaped') {
    const Wb = widthM('B');
    const Wc = widthM('C');
    const half = widthM('A') / 2 + D / 2;
    return [
      { wall: 'A', sections: byWall('A'), position: [0, 0, 0], rotationY: 0 },
      { wall: 'B', sections: byWall('B'), position: [-half, 0, Wb / 2 + D / 2], rotationY: Math.PI / 2 },
      { wall: 'C', sections: byWall('C'), position: [half, 0, Wc / 2 + D / 2], rotationY: -Math.PI / 2 },
    ];
  }
  return walls.map((w) => ({
    wall: w,
    sections: byWall(w),
    position: [0, 0, 0] as [number, number, number],
    rotationY: 0,
  }));
}

/** Rough footprint center + span for camera framing. */
function footprint(placements: WallPlacement[], D: number) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of placements) {
    const runW = p.sections.reduce((a, s) => a + s.widthIn * IN, 0);
    if (runW <= 0) continue;
    const alongX = Math.abs(Math.cos(p.rotationY)) > 0.5;
    const ex = alongX ? runW / 2 : D / 2;
    const ez = alongX ? D / 2 : runW / 2;
    minX = Math.min(minX, p.position[0] - ex);
    maxX = Math.max(maxX, p.position[0] + ex);
    minZ = Math.min(minZ, p.position[2] - ez);
    maxZ = Math.max(maxZ, p.position[2] + ez);
  }
  if (!isFinite(minX)) return { center: [0, 0] as [number, number], span: 1 };
  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2] as [number, number],
    span: Math.max(maxX - minX, maxZ - minZ),
  };
}

function ClosetModel({ catalog, config }: ClosetViewerProps) {
  const material =
    catalog.materials.find((m) => m.id === config.materialId) ?? catalog.materials[0];
  const rodColor =
    catalog.hardware.find((h) => h.id === config.rodColorId) ?? catalog.hardware[0];
  const pullColor =
    catalog.hardware.find((h) => h.id === config.hardwareColorId) ?? catalog.hardware[0];

  const urls = useMemo(
    () => catalog.materials.map((m) => `/textures/${m.id}.jpg`),
    [catalog]
  );
  const loaded = useTexture(urls);
  const baseTex =
    loaded[catalog.materials.findIndex((m) => m.id === material.id)] ?? loaded[0];

  const matV = useMemo(() => makeMat(baseTex, 'v', material), [baseTex, material]);
  const matH = useMemo(() => makeMat(baseTex, 'h', material), [baseTex, material]);
  const rodMetal = useMemo(() => buildMetal(rodColor), [rodColor]);
  const pullMetal = useMemo(() => buildMetal(pullColor), [pullColor]);
  useEffect(
    () => () => {
      matV.map?.dispose();
      matV.dispose();
      matH.map?.dispose();
      matH.dispose();
      rodMetal.dispose();
      pullMetal.dispose();
    },
    [matV, matH, rodMetal, pullMetal]
  );

  const H =
    (config.heightUpgrade
      ? catalog.constraints.upgradedHeightIn
      : catalog.constraints.standardHeightIn) * IN;
  const D = catalog.constraints.depthIn * IN;

  const placements = useMemo(() => planWalls(config, D), [config, D]);
  const { center } = useMemo(() => footprint(placements, D), [placements, D]);
  const blockedIds = useMemo(() => drawerBlockedSideBayIds(config), [config]);
  const mats: RunMaterials = {
    matV,
    matH,
    rodMetal,
    pullMetal,
    hardwareStyleId: config.hardwareStyleId,
  };

  // 8.5" structural filler panels at each back-wall corner (L/U). They sit in
  // the corner void at the ends of Wall A, so the side walls don't move and the
  // wall labels stay put. Same material as the rest of the closet.
  const fillerPanels = useMemo(() => {
    if (config.shape !== 'l_shaped' && config.shape !== 'u_shaped') return [];
    const widthA = config.sections
      .filter((s) => s.wall === 'A')
      .reduce((a, s) => a + s.widthIn * IN, 0);
    if (widthA <= 0) return [];
    const fw = CORNER_FILLER_IN * IN;
    const panels: { key: string; x: number }[] = [
      { key: 'filler-left', x: -widthA / 2 - fw / 2 },
    ];
    if (config.shape === 'u_shaped') {
      panels.push({ key: 'filler-right', x: widthA / 2 + fw / 2 });
    }
    return panels.map((pl) => (
      <Panel
        key={pl.key}
        size={[fw, H, D]}
        position={[pl.x, H / 2, 0]}
        material={matV}
      />
    ));
  }, [config.shape, config.sections, H, D, matV]);

  return (
    <group position={[-center[0], 0, -center[1]]}>
      {fillerPanels}
      {placements.map((p) =>
        p.sections.length === 0 ? null : (
          <group key={p.wall} position={p.position} rotation={[0, p.rotationY, 0]}>
            <WallRun sections={p.sections} H={H} D={D} mats={mats} blockedIds={blockedIds} />
            <Html
              position={[0, H + 0.16, 0]}
              center
              zIndexRange={[10, 0]}
              wrapperClass="closet-wall-label"
            >
              <div
                style={{
                  padding: '2px 10px',
                  borderRadius: 999,
                  background: '#1f333a',
                  color: '#eae0d5',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {wallDisplayLabel(config.shape, p.wall)}
              </div>
            </Html>
          </group>
        )
      )}
    </group>
  );
}

export default function ClosetViewer({ catalog, config }: ClosetViewerProps) {
  const H =
    (config.heightUpgrade
      ? catalog.constraints.upgradedHeightIn
      : catalog.constraints.standardHeightIn) * IN;
  const D = catalog.constraints.depthIn * IN;
  const { span } = footprint(planWalls(config, D), D);
  const reach = Math.max(span, H);
  const dist = reach * 1.25 + 1.4;

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [dist * 0.55, H * 0.6 + 0.6, dist], fov: 42 }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      className="h-full w-full"
    >
      <color attach="background" args={['#efe7d9']} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.1, 30]} />
      </directionalLight>
      <directionalLight position={[-5, 3, -2]} intensity={0.4} />

      <Suspense fallback={null}>
        <ClosetModel catalog={catalog} config={config} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#e4d8c5" roughness={0.85} metalness={0.05} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={Math.max(6, reach * 2)} blur={2.4} far={5} />

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
        maxDistance={16}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </Canvas>
  );
}
