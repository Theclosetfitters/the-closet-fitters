'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  Catalog,
  ClosetConfig,
  Dimensions,
  PriceBreakdown,
} from '@/types';
import { defaultConfig } from '@/lib/config';
import ClosetTypePicker from '@/components/configurator/ClosetTypePicker';
import DimensionControls from '@/components/configurator/DimensionControls';
import OptionGroupControl from '@/components/configurator/OptionGroupControl';
import PricePanel from '@/components/configurator/PricePanel';

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
  const [config, setConfig] = useState<ClosetConfig>(() =>
    defaultConfig(catalog, catalog.closetTypes[0].id)
  );
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [pricing, setPricing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closetType = useMemo(
    () =>
      catalog.closetTypes.find((t) => t.id === config.closetTypeId) ??
      catalog.closetTypes[0],
    [catalog, config.closetTypeId]
  );

  const groupById = useMemo(
    () => new Map(catalog.optionGroups.map((g) => [g.id, g])),
    [catalog]
  );

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
        if ((err as Error).name !== 'AbortError') {
          setError('Could not update price.');
        }
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
  const selectClosetType = useCallback(
    (id: string) => setConfig(defaultConfig(catalog, id)),
    [catalog]
  );

  const setDimension = useCallback(
    (key: keyof Dimensions, value: number) =>
      setConfig((c) => ({ ...c, dimensions: { ...c.dimensions, [key]: value } })),
    []
  );

  const setSingle = useCallback(
    (groupId: string, optionId: string) =>
      setConfig((c) => ({
        ...c,
        selections: { ...c.selections, [groupId]: [optionId] },
      })),
    []
  );

  const toggleMulti = useCallback(
    (groupId: string, optionId: string) =>
      setConfig((c) => {
        const current = (c.selections[groupId] as string[]) ?? [];
        const next = current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId];
        return { ...c, selections: { ...c.selections, [groupId]: next } };
      }),
    []
  );

  const setQuantity = useCallback(
    (groupId: string, optionId: string, qty: number) =>
      setConfig((c) => {
        const current = { ...((c.selections[groupId] as Record<string, number>) ?? {}) };
        if (qty <= 0) delete current[optionId];
        else current[optionId] = qty;
        return { ...c, selections: { ...c.selections, [groupId]: current } };
      }),
    []
  );

  // --- Checkout -----------------------------------------------------------
  const checkout = useCallback(async () => {
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setCheckingOut(false);
    }
  }, [config]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
      {/* Left: 3D preview */}
      <div className="order-1 h-[320px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 lg:order-none lg:h-[560px]">
        <ClosetViewer catalog={catalog} config={config} />
      </div>

      {/* Right: controls */}
      <div className="order-2 space-y-6 lg:order-none">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-800">
            Closet type
          </h2>
          <ClosetTypePicker
            closetTypes={catalog.closetTypes}
            selectedId={config.closetTypeId}
            onSelect={selectClosetType}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-800">
            Dimensions
          </h2>
          <DimensionControls
            closetType={closetType}
            dimensions={config.dimensions}
            onChange={setDimension}
          />
        </section>

        {closetType.optionGroupIds.map((groupId) => {
          const group = groupById.get(groupId);
          if (!group) return null;
          return (
            <OptionGroupControl
              key={groupId}
              group={group}
              selection={config.selections[groupId]}
              onSetSingle={setSingle}
              onToggleMulti={toggleMulti}
              onSetQuantity={setQuantity}
            />
          );
        })}

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

        <PricePanel
          breakdown={breakdown}
          loading={pricing}
          onCheckout={checkout}
          checkingOut={checkingOut}
        />
      </div>
    </div>
  );
}
