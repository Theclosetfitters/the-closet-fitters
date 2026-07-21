'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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
  cornerGapCount,
  defaultConfig,
  defaultSection,
  finishedHeightLabel,
  normalizeConfig,
  parseRoomDimension,
  restrictedDrawerBayIds,
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

export default function Configurator({
  catalog,
  editId,
}: {
  catalog: Catalog;
  editId?: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<ClosetConfig>(() => defaultConfig(catalog));
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [pricing, setPricing] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const cart = useCart();

  // --- Edit mode: seed the config from the cart item exactly once -----------
  const [editLoaded, setEditLoaded] = useState(false);
  const editItem =
    editId && cart.ready ? cart.items.find((i) => i.id === editId) : undefined;
  const isEditing = Boolean(editId) && Boolean(editItem);
  // True until the saved config has been applied — keeps the default closet
  // (and its price) from flashing before the customer's saved one loads.
  const loadingEdit = Boolean(editId) && !editLoaded;

  useEffect(() => {
    if (!editId || editLoaded || !cart.ready) return;
    const item = cart.items.find((i) => i.id === editId);
    if (item) setConfig(normalizeConfig(catalog, item.config));
    setEditLoaded(true);
  }, [editId, editLoaded, cart.ready, cart.items, catalog]);

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

  // Room WIDTH constrains ONLY the back wall (Wall A) + the 8.5" corner gaps
  // (L=1, U=2). Side walls (B/C) are constrained by room LENGTH, not width.
  // Exact decimals, no rounding.
  const backWallWidth = config.sections
    .filter((s) => s.wall === 'A')
    .reduce((a, s) => a + s.widthIn, 0);
  const totalClosetWidth = backWallWidth + cornerGapCount(config.shape) * 8.5;
  const roomWidthSet = typeof config.roomWidth === 'number';
  const widthExceeded = roomWidthSet && totalClosetWidth > (config.roomWidth as number);
  // Room-height block: a room under 8' (96") can't take the raise-to-8' option.
  const heightBlocked = typeof config.roomHeight === 'number' && config.roomHeight < 96;
  const sideWallLen = (wall: WallId) =>
    config.sections.filter((s) => s.wall === wall).reduce((a, s) => a + s.widthIn, 0);

  // Room errors only appear when an add/resize is blocked, and auto-dismiss.
  const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashError = useCallback((msg: string) => {
    setRoomError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setRoomError(null), 4000);
  }, []);
  const clearError = useCallback(() => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setRoomError(null);
  }, []);

  // --- Mutators -----------------------------------------------------------
  const updateSection = useCallback(
    (id: string, patch: Partial<SectionConfig>) => {
      // Constraint check ONLY on an actual width change (inline editor / slider).
      if (patch.widthIn !== undefined) {
        const cur = config.sections.find((s) => s.id === id);
        const wall = cur?.wall ?? 'A';
        const nextW = clampWidth(catalog, cur?.interior ?? 'long_hanging', patch.widthIn);
        // Back-wall bay → check room WIDTH (Wall A + corner gaps only).
        if (wall === 'A' && typeof config.roomWidth === 'number') {
          const total =
            config.sections
              .filter((s) => s.wall === 'A')
              .reduce((a, s) => a + (s.id === id ? nextW : s.widthIn), 0) +
            cornerGapCount(config.shape) * 8.5;
          console.log('[constraint] totalWidth:', total, 'roomWidth:', config.roomWidth);
          if (total > config.roomWidth) {
            flashError(
              `This exceeds your room width of ${config.roomWidthDisplay ?? ''}. Remove a bay or reduce bay widths to fit.`
            );
            return; // reject — revert to previous width
          }
        }
        // Side-wall bay → check room LENGTH.
        if ((wall === 'B' || wall === 'C') && typeof config.roomLength === 'number') {
          const total = config.sections
            .filter((s) => s.wall === wall)
            .reduce((a, s) => a + (s.id === id ? nextW : s.widthIn), 0);
          if (total > config.roomLength) {
            flashError(`The side wall exceeds your room length of ${config.roomLengthDisplay ?? ''}.`);
            return;
          }
        }
      }
      clearError();
      setConfig((c) => ({
        ...c,
        sections: c.sections.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          next.widthIn = clampWidth(catalog, next.interior, next.widthIn);
          return next;
        }),
      }));
    },
    [catalog, config, flashError, clearError]
  );

  const addBay = useCallback(
    (wall: WallId) => {
      const defW = defaultSection(catalog, wall).widthIn;
      // Adding a back-wall bay → check room WIDTH (Wall A + corner gaps only).
      if (wall === 'A' && typeof config.roomWidth === 'number') {
        const total = backWallWidth + cornerGapCount(config.shape) * 8.5 + defW;
        console.log('[constraint] totalWidth:', total, 'roomWidth:', config.roomWidth);
        if (total > config.roomWidth) {
          flashError(
            `This exceeds your room width of ${config.roomWidthDisplay ?? ''}. Remove a bay or reduce bay widths to fit.`
          );
          return;
        }
      }
      // Adding a side-wall bay (L/U) → check room LENGTH.
      if ((wall === 'B' || wall === 'C') && typeof config.roomLength === 'number') {
        if (sideWallLen(wall) + defW > config.roomLength) {
          flashError(`The side wall exceeds your room length of ${config.roomLengthDisplay ?? ''}.`);
          return;
        }
      }
      clearError();
      setConfig((c) => ({ ...c, sections: [...c.sections, defaultSection(catalog, wall)] }));
    },
    [catalog, config, sideWallLen, backWallWidth, flashError, clearError]
  );

  const setName = useCallback((name: string) => setConfig((c) => ({ ...c, name })), []);
  // Typing room dimensions is silent — never blocks or errors, just updates the
  // stored values (and, via derived state, the informational usage bar).
  const setRoom = useCallback(
    (field: 'Width' | 'Length' | 'Height', typed: string) => {
      const parsed = parseRoomDimension(typed); // exact decimal; null = no constraint
      clearError();
      setConfig((c) => {
        const next = { ...c };
        if (field === 'Width') {
          next.roomWidthDisplay = typed;
          next.roomWidth = parsed ?? undefined;
        } else if (field === 'Length') {
          next.roomLengthDisplay = typed;
          next.roomLength = parsed ?? undefined;
        } else {
          next.roomHeightDisplay = typed;
          next.roomHeight = parsed ?? undefined;
        }
        return next;
      });
    },
    [clearError]
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
    (heightUpgrade: boolean) => {
      if (heightUpgrade && heightBlocked) return; // room too short for the 8' raise
      setConfig((c) => ({ ...c, heightUpgrade }));
    },
    [heightBlocked]
  );

  // If the room height rules out the 8' raise, force the option back off.
  useEffect(() => {
    if (heightBlocked && config.heightUpgrade) setConfig((c) => ({ ...c, heightUpgrade: false }));
  }, [heightBlocked, config.heightUpgrade]);
  const setBackPanels = useCallback(
    (backPanels: boolean) => setConfig((c) => ({ ...c, backPanels })),
    []
  );

  // Side-wall corner bay never allows drawers — the back wall would block it
  // opening. Mirrored layout: Wall B corner = last bay, Wall C corner = first
  // bay (see restrictedDrawerBayIds). Re-derived from config, so it tracks the
  // corner bay as bay counts change.
  const blockedIds = useMemo(() => restrictedDrawerBayIds(config), [config]);

  // TEMP diagnostic — confirms the correct corner bay is identified as bays are
  // added/removed. Remove once the fix is confirmed working.
  useEffect(() => {
    (['B', 'C'] as const).forEach((wall) => {
      const wallBays = config.sections.filter((s) => s.wall === wall);
      if (wallBays.length === 0) return;
      const corner = wallBays.find((s) => blockedIds.has(s.id));
      console.log(
        `[drawer-restriction] Wall ${wall}: ${wallBays.length} bay(s); ` +
          `restricted corner bay id=${corner?.id ?? 'none'} ` +
          `(position ${corner ? wallBays.indexOf(corner) : -1} of ${wallBays.length}); ` +
          `hasDrawers=${corner?.interior === 'drawers'}`
      );
    });
  }, [config.sections, blockedIds]);

  // If a restricted corner bay ever holds drawers (e.g. it just became the
  // corner bay, or a stale config), reset it to the default interior.
  // Idempotent — converges in one pass.
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

  const withName = useCallback(
    (c: ClosetConfig): ClosetConfig => ({
      ...c,
      name: c.name?.trim() ? c.name.trim() : `Closet ${cart.count + 1}`,
    }),
    [cart.count]
  );

  const addToCart = useCallback(() => {
    if (!breakdown) return;
    cart.add(withName(config), breakdown.totalCents);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }, [cart, config, breakdown, withName]);

  // Edit mode: replace the existing item in place, then return to the cart.
  const updateCloset = useCallback(() => {
    if (!breakdown || !editId) return;
    cart.update(editId, withName(config), breakdown.totalCents);
    router.push('/cart?updated=1');
  }, [cart, config, breakdown, editId, router, withName]);

  const totalWidth = useMemo(() => totalWidthIn(config), [config]);
  const heightLabel = finishedHeightLabel(catalog, config);
  const upgradedHeightLabel = finishedHeightLabel(catalog, { ...config, heightUpgrade: true });

  // Room name/dimension display helpers.
  const defaultName = `Closet ${cart.count + 1}`;
  const roomInvalid = (typed?: string) => Boolean(typed) && parseRoomDimension(typed ?? '') === null;
  const usagePct = roomWidthSet
    ? Math.min(100, (totalClosetWidth / (config.roomWidth as number)) * 100)
    : 0;
  // The banner reflects ONLY an actively-blocked action (auto-dismissing). It is
  // never shown merely because the current config exceeds the room — the usage
  // bar below conveys that, informationally.
  const bannerMsg = roomError;

  const roomLabelStyle: CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-inter), Inter, sans-serif',
    fontSize: 10,
    color: '#C7AC90',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 4,
  };
  const roomInputStyle = (bad: boolean): CSSProperties => ({
    width: '100%',
    fontFamily: 'var(--font-inter), Inter, sans-serif',
    fontSize: 14,
    color: '#1F333A',
    border: `1px solid ${bad ? '#EF4444' : '#E5DDD5'}`,
    borderRadius: 8,
    padding: '10px 12px',
    outline: 'none',
    boxSizing: 'border-box',
  });

  if (loadingEdit) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-faint">
        Loading your saved closet…
      </div>
    );
  }

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
        {/* Closet name + room dimensions */}
        <section className="space-y-4">
          <div>
            <label htmlFor="closet-name" style={roomLabelStyle}>
              Closet Name
            </label>
            <input
              id="closet-name"
              data-testid="closet-name"
              value={config.name ?? ''}
              placeholder={defaultName}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!config.name || !config.name.trim()) setName(defaultName);
              }}
              style={{
                width: '100%',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: 22,
                color: '#1F333A',
                border: 'none',
                borderBottom: '1.5px solid #C7AC90',
                background: 'transparent',
                padding: '8px 0',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {(['Width', 'Length', 'Height'] as const).map((field) => {
              const display =
                field === 'Width'
                  ? config.roomWidthDisplay
                  : field === 'Length'
                    ? config.roomLengthDisplay
                    : config.roomHeightDisplay;
              return (
                <div key={field} style={{ flex: 1 }}>
                  <label style={roomLabelStyle}>Room {field}</label>
                  <input
                    data-testid={`room-${field.toLowerCase()}`}
                    type="text"
                    value={display ?? ''}
                    placeholder={field === 'Height' ? "8' 0\"" : "12' 0\""}
                    onChange={(e) => setRoom(field, e.target.value)}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#C7AC90')}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = roomInvalid(display) ? '#EF4444' : '#E5DDD5')
                    }
                    style={roomInputStyle(roomInvalid(display))}
                  />
                </div>
              );
            })}
          </div>

          {roomWidthSet && (
            <div>
              <div style={{ fontSize: 11, color: '#7A6E65', marginBottom: 4 }}>
                Using {formatInches(totalClosetWidth)} of {config.roomWidthDisplay} available
              </div>
              <div style={{ background: '#F0EBE4', height: 4, borderRadius: 9999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 9999,
                    width: `${usagePct}%`,
                    background: widthExceeded ? '#EF4444' : '#C7AC90',
                  }}
                />
              </div>
            </div>
          )}

          {bannerMsg && (
            <div
              data-testid="room-error"
              style={{
                background: '#FEE2E2',
                border: '1px solid #EF4444',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#991B1B',
              }}
            >
              {bannerMsg}
            </div>
          )}
        </section>

        {isEditing && (
          <div className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-cream">
            Editing your saved closet — make your changes and click Update Closet
            to save.
          </div>
        )}

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

        {/* Material — placed directly below the closet type */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Material</h2>
          <MaterialPicker
            materials={catalog.materials}
            selectedId={config.materialId}
            onSelect={setMaterial}
          />
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

        {/* Back panels (global) — all-or-nothing, paired directly above height */}
        <section className="rounded-xl border border-brand/30 bg-cream p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              data-testid="back-panels"
              type="checkbox"
              checked={config.backPanels}
              onChange={(e) => setBackPanels(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-brand"
            />
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">
                Add Back Panels{' '}
                <span className="font-normal text-muted">
                  (+{formatCents(catalog.pricing.backPerSectionCents)}/bay)
                </span>
              </span>
              <span className="mt-1 block text-xs text-sand">
                Closes in the rear of every bay
                {config.shape === 'l_shaped'
                  ? ', plus 1 corner panel (included)'
                  : config.shape === 'u_shaped'
                    ? ', plus 2 corner panels (included)'
                    : ''}
              </span>
            </span>
          </label>
        </section>

        {/* Height (global) — highlighted upgrade option */}
        <section className="rounded-xl border border-brand/30 bg-cream p-4">
          <label
            className={`flex items-start gap-3 ${heightBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            title={
              heightBlocked
                ? `Your room height of ${config.roomHeightDisplay ?? ''} does not allow raising to 8'. Standard height will be used.`
                : undefined
            }
          >
            <input
              data-testid="height-upgrade"
              type="checkbox"
              checked={config.heightUpgrade}
              disabled={heightBlocked}
              onChange={(e) => setHeightUpgrade(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-brand"
            />
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">
                Raise height to {upgradedHeightLabel}{' '}
                <span className="font-normal text-muted">
                  (+{formatCents(catalog.pricing.heightUpgradePerFootCents)}/ft)
                </span>
              </span>
              <span className="mt-1 block text-xs text-sand">
                Increases total closet height to 96.75&quot; including top cap
              </span>
            </span>
          </label>
          <p className="mt-2 text-[11px] text-faint">
            Current total height: {heightLabel} · depth{' '}
            {formatInches(catalog.constraints.depthIn)} · total width{' '}
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
          editMode={isEditing}
          onUpdate={updateCloset}
        />
      </div>
    </div>
  );
}
