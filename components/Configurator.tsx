'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Catalog, ClosetConfig, SectionConfig, PriceBreakdown } from '@/types';
import { clampWidth, defaultConfig, defaultSection, totalWidthIn } from '@/lib/config';
import { formatCents, formatInches } from '@/lib/format';
import MaterialPicker from '@/components/configurator/MaterialPicker';
import HardwarePicker from '@/components/configurator/HardwarePicker';
import SectionRow from '@/components/configurator/SectionRow';
import PricePanel from '@/components/configurator/PricePanel';
import { useCart } from '@/lib/cart-context';

// R3F must only run in the browser — load the viewer without SSR.
const ClosetViewer = dynamic(() => import('@/components/3d/ClosetViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
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
  const addSection = useCallback(
    () => setConfig((c) => ({ ...c, sections: [...c.sections, defaultSection(catalog)] })),
    [catalog]
  );

  const removeSection = useCallback(
    (id: string) =>
      setConfig((c) =>
        c.sections.length <= 1
          ? c
          : { ...c, sections: c.sections.filter((s) => s.id !== id) }
      ),
    []
  );

  const updateSection = useCallback(
    (id: string, patch: Partial<SectionConfig>) =>
      setConfig((c) => ({
        ...c,
        sections: c.sections.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          // Keep width valid for the (possibly new) interior.
          next.widthIn = clampWidth(catalog, next.interior, next.widthIn);
          return next;
        }),
      })),
    [catalog]
  );

  const setMaterial = useCallback(
    (materialId: string) => setConfig((c) => ({ ...c, materialId })),
    []
  );
  const setHardware = useCallback(
    (hardwareId: string) => setConfig((c) => ({ ...c, hardwareId })),
    []
  );
  const setHeightUpgrade = useCallback(
    (heightUpgrade: boolean) => setConfig((c) => ({ ...c, heightUpgrade })),
    []
  );

  // --- Add to cart --------------------------------------------------------
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
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(340px,420px)]">
      {/* Left: 3D preview */}
      <div
        data-testid="closet-viewer"
        className="order-1 h-[340px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 lg:order-none lg:h-[600px]"
      >
        <ClosetViewer catalog={catalog} config={config} />
      </div>

      {/* Right: controls */}
      <div className="order-2 space-y-6 lg:order-none">
        {/* Material */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-800">Material</h2>
          <MaterialPicker
            materials={catalog.materials}
            selectedId={config.materialId}
            onSelect={setMaterial}
          />
        </section>

        {/* Hardware */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-800">
            Hardware color
          </h2>
          <HardwarePicker
            hardware={catalog.hardware}
            selectedId={config.hardwareId}
            onSelect={setHardware}
          />
        </section>

        {/* Height + depth */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-700">
              Height: {heightLabel}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
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
          <p className="mt-1 text-[11px] text-zinc-400">
            Depth fixed at {formatInches(catalog.constraints.depthIn)} · total
            width {formatInches(totalWidth)}
          </p>
        </section>

        {/* Sections */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Sections</h2>
            <button
              data-testid="add-section"
              type="button"
              onClick={addSection}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              + Add section
            </button>
          </div>
          {config.sections.map((section, i) => (
            <SectionRow
              key={section.id}
              catalog={catalog}
              section={section}
              index={i}
              canRemove={config.sections.length > 1}
              onChange={updateSection}
              onRemove={removeSection}
            />
          ))}
        </section>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

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
