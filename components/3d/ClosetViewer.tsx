'use client';

// Live 3D render of a closet configuration.
//
// RULE (CLAUDE.md #4): ClosetViewer is fully CONTROLLED. It derives everything
// it draws from the `config` + `catalog` props and holds NO internal state for
// selections. Parent owns the configuration.
import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import type { Catalog, ClosetConfig } from '@/types';
import { groupQuantityTotal } from '@/lib/config';

interface ClosetViewerProps {
  catalog: Catalog;
  config: ClosetConfig;
}

const FINISH_COLORS: Record<string, string> = {
  'matte-white': '#efece6',
  walnut: '#5b3a21',
  charcoal: '#3a3a3c',
};

const MATERIAL_COLORS: Record<string, string> = {
  melamine: '#d9d4cb',
  plywood: '#cBa16b',
  'solid-oak': '#b5854b',
};

/** Pick the carcass color from the finish, falling back to the material. */
function useClosetColor(config: ClosetConfig): string {
  const finish = (config.selections['finish'] as string[] | undefined)?.[0];
  const material = (config.selections['material'] as string[] | undefined)?.[0];
  if (finish && FINISH_COLORS[finish]) return FINISH_COLORS[finish];
  if (material && MATERIAL_COLORS[material]) return MATERIAL_COLORS[material];
  return '#cbb89a';
}

function ClosetModel({ catalog, config }: ClosetViewerProps) {
  void catalog; // catalog reserved for future per-option geometry
  const color = useClosetColor(config);

  // Convert cm -> m for the scene.
  const w = config.dimensions.width / 100;
  const h = config.dimensions.height / 100;
  const d = config.dimensions.depth / 100;

  const t = 0.03; // panel thickness in meters
  const inner = useMemo(() => ({ w: w - 2 * t, d: d - 2 * t }), [w, d]);

  const shelfCount = groupQuantityTotal(config, 'shelves');
  const drawerCount = groupQuantityTotal(config, 'drawers');
  const rodCount = groupQuantityTotal(config, 'hanging-rods');
  const shoeCount = groupQuantityTotal(config, 'shoe-racks');

  // The closet sits on the ground: floor at y=0, top at y=h.
  const panelMat = <meshStandardMaterial color={color} roughness={0.7} />;

  // Distribute shelves across the upper-middle region.
  const shelves = Array.from({ length: shelfCount }, (_, i) => {
    const y = h * (0.35 + (0.5 * (i + 1)) / (shelfCount + 1));
    return (
      <mesh key={`shelf-${i}`} position={[0, y, 0]} castShadow>
        <boxGeometry args={[inner.w, t, inner.d]} />
        {panelMat}
      </mesh>
    );
  });

  // Stack drawers from the bottom up on the left half.
  const drawerH = 0.22;
  const drawers = Array.from({ length: drawerCount }, (_, i) => {
    const y = t + drawerH / 2 + i * (drawerH + 0.01);
    if (y > h - drawerH) return null;
    return (
      <mesh
        key={`drawer-${i}`}
        position={[-inner.w / 4, y, d / 2 - t]}
        castShadow
      >
        <boxGeometry args={[inner.w / 2 - 0.02, drawerH, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    );
  });

  // Hanging rods near the top on the right half.
  const rods = Array.from({ length: rodCount }, (_, i) => {
    const y = h - 0.15 - i * 0.5;
    if (y < h * 0.3) return null;
    return (
      <mesh
        key={`rod-${i}`}
        position={[inner.w / 4, y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.012, 0.012, inner.w / 2 - 0.04, 16]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.3} />
      </mesh>
    );
  });

  // Angled shoe shelves along the bottom.
  const shoes = Array.from({ length: shoeCount }, (_, i) => {
    const y = t + 0.05 + i * 0.16;
    if (y > h * 0.4) return null;
    return (
      <mesh
        key={`shoe-${i}`}
        position={[inner.w / 4, y, 0]}
        rotation={[-0.35, 0, 0]}
        castShadow
      >
        <boxGeometry args={[inner.w / 2 - 0.04, t, inner.d * 0.7]} />
        {panelMat}
      </mesh>
    );
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Back panel */}
      <mesh position={[0, h / 2, -d / 2 + t / 2]} receiveShadow>
        <boxGeometry args={[w, h, t]} />
        {panelMat}
      </mesh>
      {/* Left side */}
      <mesh position={[-w / 2 + t / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[t, h, d]} />
        {panelMat}
      </mesh>
      {/* Right side */}
      <mesh position={[w / 2 - t / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[t, h, d]} />
        {panelMat}
      </mesh>
      {/* Top */}
      <mesh position={[0, h - t / 2, 0]} castShadow>
        <boxGeometry args={[w, t, d]} />
        {panelMat}
      </mesh>
      {/* Bottom */}
      <mesh position={[0, t / 2, 0]} receiveShadow>
        <boxGeometry args={[w, t, d]} />
        {panelMat}
      </mesh>
      {shelves}
      {drawers}
      {rods}
      {shoes}
    </group>
  );
}

export default function ClosetViewer({ catalog, config }: ClosetViewerProps) {
  const h = config.dimensions.height / 100;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.6, h * 0.7 + 0.6, 3.2], fov: 45 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#f4f4f5']} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Suspense fallback={null}>
        <ClosetModel catalog={catalog} config={config} />
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
        <Environment preset="apartment" />
      </Suspense>
      <OrbitControls
        target={[0, h / 2, 0]}
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
}
