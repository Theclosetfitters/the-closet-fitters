'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  Catalog,
  ClosetConfig,
  ClosetShape,
  HardwareStyleId,
  PriceBreakdown,
  SectionConfig,
  WallId,
} from '@/types';
import {
  clampWidth,
  defaultConfig,
  defaultSection,
  drawerBlockedSideBayIds,
  totalWidthIn,
  wallDisplayLabel,
  wallsForShape,
} from '@/lib/config';
import { formatCents, formatInches } from '@/lib/format';
import MaterialPicker from '@/components/configurator/MaterialPicker';
import HardwarePicker from '@/components/configurator/HardwarePicker';
import ShapeSelector from '@/components/configurator/ShapeSelector';
import HardwareStylePicker from '@/components/configurator/HardwareStylePicker';
import WallSection from '@/components/configurator/WallSection';
import PricePanel from '@/components/configurator/PricePanel';
import { useCart } from '@/lib/cart-context';

// R3F must only run in the browser — load the viewer without SSR.
const ClosetViewer = dynamic(() => import('@/components/3d/ClosetViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-faint">
      Loading 3D preview…
    </div>
  ),
});

export default function Configurator({ catalog }: { catalog: Catalog }) {
  const [config, setConfig] = useState<ClosetConfig>(() => defaultConfig(catalog));
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [pricing, setPricing] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();

  // --- Live server-side pricing (debounced) -------------------------------
  useEffect(() => {
    const controller = new AbortController();
    setPricing(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch('/api/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Pricing failed');
        setBreakdown((await res.json()) as PriceBreakdown);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Could not update price.');
      } finally {
        setPricing(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [config]);

  // --- Mutators -----------------------------------------------------------
  const updateSection = useCallback(
    (id: string, patch: Partial<SectionConfig>) =>
      setConfig((c) => ({
        ...c,
        sections: c.sections.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          next.widthIn = clampWidth(catalog, next.interior, next.widthIn);
          return next;
        }),
      })),
    [catalog]
  );

  const addBay = useCallback(
    (wall: WallId) =>
      setConfig((c) => ({ ...c, sections: [...c.sections, defaultSection(catalog, wall)] })),
    [catalog]
  );

  const removeBay = useCallback((wall: WallId) => {
    setConfig((c) => {
      const onWall = c.sections.filter((s) => s.wall === wall);
      if (onWall.length <= 1) return c; // min 1 bay per wall
      const lastId = onWall[onWall.length - 1].id;
      return { ...c, sections: c.sections.filter((s) => s.id !== lastId) };
    });
  }, []);

  const setShape = useCallback(
    (shape: ClosetShape) => {
      setConfig((c) => {
        const ws = wallsForShape(shape);
        let sections = c.sections.map((s, i) => ({ ...s, wall: ws[i % ws.length] }));
        // Guarantee at least one bay on every wall of the new shape.
        for (const w of ws) {
          if (!sections.some((s) => s.wall === w)) {
            sections = [...sections, defaultSection(catalog, w)];
          }
        }
        return { ...c, shape, sections };
      });
    },
    [catalog]
  );

  const setMaterial = useCallback((materialId: string) => setConfig((c) => ({ ...c, materialId })), []);
  const setRodColor = useCallback((rodColorId: string) => setConfig((c) => ({ ...c, rodColorId })), []);
  const setHardwareColor = useCallback(
    (hardwareColorId: string) => setConfig((c) => ({ ...c, hardwareColorId })),
    []
  );
  const setHardwareStyle = useCallback(
    (hardwareStyleId: string) =>
      setConfig((c) => ({ ...c, hardwareStyleId: hardwareStyleId as HardwareStyleId })),
    []
  );
  const setHeightUpgrade = useCallback(
    (heightUpgrade: boolean) => setConfig((c) => ({ ...c, heightUpgrade })),
    []
  );

  // Side-wall corner bays that may not be drawers (back-wall corner bay has a
  // drawer bank). One-directional: the back wall (A) drives the restriction.
  const blockedIds = useMemo(() => drawerBlockedSideBayIds(config), [config]);

  // If a conflict gets created (e.g. the back-wall corner bay is switched to
  // drawers while the side-wall corner bay already had them), reset that side
  // bay to the default interior. Idempotent — converges in one pass.
  useEffect(() => {
    if (!config.sections.some((s) => blockedIds.has(s.id) && s.interior === 'drawers')) {
      return;
    }
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) =>
        blockedIds.has(s.id) && s.interior === 'drawers'
          ? { ...s, interior: 'long_hanging', widthIn: clampWidth(catalog, 'long_hanging', s.widthIn) }
          : s
      ),
    }));
  }, [config.sections, blockedIds, catalog]);

  const backWallHasBays = useMemo(
    () => config.sections.some((s) => s.wall === 'A'),
    [config.sections]
  );

  const walls = useMemo(() => wallsForShape(config.shape), [config.shape]);
  const wallSlots = useMemo(
    () =>
      walls.map((w) => ({
        wall: w,
        label: wallDisplayLabel(config.shape, w),
        bays: config.sections
          .map((section, index) => ({ section, index }))
          .filter((b) => b.section.wall === w),
      })),
    [walls, config.shape, config.sections]
  );

  const addToCart = useCallback(() => {
    if (!breakdown) return;
    cart.add(config, breakdown.totalCents);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }, [cart, config, breakdown]);

  const totalWidth = useMemo(() => totalWidthIn(config), [config]);
  const heightLabel = config.heightUpgrade
    ? formatInches(catalog.constraints.upgradedHeightIn)
    : formatInches(catalog.constraints.standardHeightIn);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_minmax(360px,440px)] lg:gap-8">
      {/* Left: sticky 3D viewer (full viewport height on desktop) */}
      <div className="lg:sticky lg:top-16 lg:flex lg:h-[calc(100svh-4rem)] lg:items-center lg:self-start">
        <div
          data-testid="closet-viewer"
          className="h-[340px] w-full overflow-hidden rounded-2xl border border-line bg-cream lg:h-[86%]"
        >
          <ClosetViewer catalog={catalog} config={config} />
        </div>
      </div>

      {/* Right: scrollable editor */}
      <div className="space-y-8 py-6 lg:py-12">
        {/* Shape — chosen first; determines the walls below */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Closet shape</h2>
          <ShapeSelector
            shapes={catalog.shapes}
            selectedId={config.shape}
            onSelect={(id) => setShape(id as ClosetShape)}
          />
          {walls.length > 1 && (
            <p className="mt-1 text-[11px] text-faint">
              Configure each wall’s bays separately below.
            </p>
          )}
        </section>

        {/* One section per wall */}
        {wallSlots.map((w, idx) => (
          <div key={w.wall}>
            {idx > 0 && <hr className="mb-8 border-line" />}
            <WallSection
              catalog={catalog}
              wall={w.wall}
              label={w.label}
              bays={w.bays}
              blockedIds={blockedIds}
              showCornerNote={w.wall !== 'A' && backWallHasBays}
              onAddBay={addBay}
              onRemoveBay={removeBay}
              onChange={updateSection}
            />
          </div>
        ))}

        {/* Global selections */}
        <section className="space-y-6 border-t border-line pt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
            Finishes &amp; Hardware
          </h2>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Material</h3>
            <MaterialPicker
              materials={catalog.materials}
              selectedId={config.materialId}
              onSelect={setMaterial}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Hardware style</h3>
            <HardwareStylePicker
              styles={catalog.hardwareStyles}
              selectedId={config.hardwareStyleId}
              onSelect={setHardwareStyle}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Rod color</h3>
            <HardwarePicker
              hardware={catalog.hardware}
              selectedId={config.rodColorId}
              onSelect={setRodColor}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Hardware color</h3>
            <HardwarePicker
              hardware={catalog.hardware}
              selectedId={config.hardwareColorId}
              onSelect={setHardwareColor}
            />
          </div>
        </section>

        {/* Height (global) */}
        <section className="rounded-xl border border-line bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">Height: {heightLabel}</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                data-testid="height-upgrade"
                type="checkbox"
                checked={config.heightUpgrade}
                onChange={(e) => setHeightUpgrade(e.target.checked)}
                className="accent-brand"
              />
              Raise to 8' (+{formatCents(catalog.pricing.heightUpgradePerFootCents)}/ft)
            </label>
          </div>
          <p className="mt-1 text-[11px] text-faint">
            Depth fixed at {formatInches(catalog.constraints.depthIn)} · total width{' '}
            {formatInches(totalWidth)}
          </p>
        </section>

        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <PricePanel
          breakdown={breakdown}
          loading={pricing}
          onAddToCart={addToCart}
          added={added}
          cartCount={cart.count}
        />
      </div>
    </div>
  );
}
