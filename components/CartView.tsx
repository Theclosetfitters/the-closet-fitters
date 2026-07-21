'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Catalog, ClosetConfig, WallId } from '@/types';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/format';
import { closetSketchSvg } from '@/lib/sketch';
import {
  finishedHeightLabel,
  restrictedDrawerBayIds,
  wallsForShape,
} from '@/lib/config';

// --- brand tokens (cart redesign) ------------------------------------------
const COSMOS = '#1F333A';
const CREAM = '#EAE0D5';
const TAN = '#C7AC90';
const KABUL = '#5E4F3E';
const OFFWHITE = '#F8F4F0';
const CARD_BORDER = '#E5DDD5';
const MUTED = '#7A6E65';
const CORMORANT = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";

// Position hint per wall, matching the configurator / 3D viewer.
function wallHeading(shape: ClosetConfig['shape'], wall: WallId): string {
  const pos =
    shape === 'u_shaped'
      ? ({ A: 'Back', B: 'Left', C: 'Right' } as const)[wall]
      : shape === 'l_shaped'
        ? ({ A: 'Back', B: 'Side', C: '' } as const)[wall]
        : '';
  return pos ? `Wall ${wall} — ${pos}` : `Wall ${wall}`;
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TAN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
    <path d="M5 12l5 5l10 -10" />
  </svg>
);

const TRUST = [
  'Free design consultation',
  'Made-to-measure craftsmanship',
  'No obligation — no payment today',
];

export default function CartView({
  catalog,
  updated = false,
}: {
  catalog: Catalog;
  updated?: boolean;
}) {
  const { items, remove, totalCents, ready } = useCart();
  const router = useRouter();

  // Brief "updated" confirmation after returning from an edit. Strip the URL
  // param so a refresh doesn't re-show it, then auto-hide.
  const [showUpdated, setShowUpdated] = useState(updated);
  useEffect(() => {
    if (!updated) return;
    router.replace('/cart', { scroll: false });
    const t = window.setTimeout(() => setShowUpdated(false), 3500);
    return () => window.clearTimeout(t);
  }, [updated, router]);

  // catalog lookups
  const shapeLabel = (id: string) => catalog.shapes.find((s) => s.id === id)?.label ?? id;
  const matLabel = (id: string) => catalog.materials.find((m) => m.id === id)?.label ?? id;
  const colorLabel = (id: string) => catalog.hardware.find((h) => h.id === id)?.label ?? id;
  const styleLabel = (id: string) => catalog.hardwareStyles.find((s) => s.id === id)?.label ?? id;
  const interiorLabel = (id: string) => catalog.interiors.find((i) => i.id === id)?.label ?? id;

  if (!ready) {
    return <p className="mx-auto max-w-5xl px-4 py-10" style={{ color: MUTED }}>Loading your cart…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p style={{ color: MUTED }}>Your cart is empty.</p>
        <Link
          href="/configure"
          className="mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          style={{ background: COSMOS, color: CREAM }}
        >
          Design a closet
        </Link>
      </div>
    );
  }

  const pill = {
    background: '#F0EBE4',
    border: `0.5px solid ${TAN}`,
    borderRadius: 9999,
    padding: '5px 14px',
    fontSize: 13,
    color: KABUL,
  } as const;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* warm gap between the site nav and the cart header */}
      <div style={{ height: 24, background: '#F8F4F0' }} />
      {/* Cosmos header strip */}
      <div
        style={{
          background: COSMOS,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: '2px solid #C7AC90',
          borderRadius: '12px 12px 0 0',
          marginLeft: 16,
          marginRight: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: TAN, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>
            Your Design
          </div>
          <div style={{ fontFamily: CORMORANT, fontSize: 24, color: CREAM, fontWeight: 400, lineHeight: 1.1 }}>
            Ready to bring it to life?
          </div>
        </div>
        <div
          style={{
            background: 'rgba(199,172,144,0.15)',
            border: '0.5px solid rgba(199,172,144,0.4)',
            borderRadius: 9999,
            padding: '4px 13px',
            fontSize: 11,
            color: TAN,
            whiteSpace: 'nowrap',
          }}
        >
          {items.length} closet{items.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* two-column layout */}
      <div
        className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_256px]"
        style={{ gap: 14, padding: 16, alignItems: 'start' }}
      >
        {/* LEFT: cart item cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {showUpdated && (
            <div role="status" style={{ borderRadius: 12, border: `0.5px solid ${CARD_BORDER}`, background: '#fff', padding: '12px 16px', fontSize: 13, color: COSMOS }}>
              Your closet has been updated.
            </div>
          )}

          {items.map((item, i) => {
            const cfg = item.config;
            const nWalls = wallsForShape(cfg.shape).length;
            const nBays = cfg.sections.length;
            const cornerIds = restrictedDrawerBayIds(cfg);
            const diagram = closetSketchSvg(catalog, cfg, { byWall: cfg.shape !== 'straight' });
            const hardware = [
              styleLabel(cfg.hardwareStyleId),
              colorLabel(cfg.hardwareColorId),
              `${colorLabel(cfg.rodColorId)} rod`,
              `Height · ${finishedHeightLabel(catalog, cfg)}`,
            ];

            return (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, border: `0.5px solid ${CARD_BORDER}`, padding: 32 }}>
                {/* item header */}
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 30, color: COSMOS, fontWeight: 500, float: 'right', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    {formatCents(item.totalCents)}
                  </span>
                  <div style={{ fontFamily: CORMORANT, fontSize: 30, color: COSMOS, fontWeight: 400 }}>
                    {cfg.name?.trim() || `Closet ${i + 1}`}
                  </div>
                  <div style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>
                    {shapeLabel(cfg.shape)} · {nWalls} wall{nWalls === 1 ? '' : 's'} · {nBays} bay{nBays === 1 ? '' : 's'} · {finishedHeightLabel(catalog, cfg)} · {matLabel(cfg.materialId)}
                  </div>
                </div>

                {/* hardware pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: cfg.backPanels ? 8 : 18 }}>
                  {hardware.map((h) => (
                    <span key={h} style={pill}>{h}</span>
                  ))}
                </div>
                {cfg.backPanels && (
                  <div style={{ fontSize: 12, color: KABUL, marginBottom: 18 }}>
                    Back Panels — {cfg.sections.length} bay{cfg.sections.length === 1 ? '' : 's'}
                    {cfg.shape === 'l_shaped'
                      ? ' + 1 corner panel (included)'
                      : cfg.shape === 'u_shaped'
                        ? ' + 2 corner panels (included)'
                        : ''}
                  </div>
                )}

                {/* floor plan */}
                <div style={{ fontSize: 12, color: TAN, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Floor Plan
                </div>
                <div
                  className="[&_svg]:h-auto [&_svg]:max-w-full"
                  style={{ background: OFFWHITE, borderRadius: 8, padding: 14, marginBottom: 18 }}
                  // Diagram SVG is generated by our own code from validated data.
                  dangerouslySetInnerHTML={{ __html: diagram }}
                />

                {/* configuration */}
                <div style={{ fontSize: 12, color: TAN, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Configuration
                </div>
                {wallsForShape(cfg.shape).map((w) => {
                  const wallBays = cfg.sections.filter((s) => s.wall === w);
                  if (wallBays.length === 0) return null;
                  const ordered = w === 'B' ? [...wallBays].reverse() : wallBays;
                  return (
                    <div key={w} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${TAN}`, paddingBottom: 5, marginBottom: 12 }}>
                        <span style={{ fontFamily: CORMORANT, fontSize: 18, fontWeight: 600, color: COSMOS, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {wallHeading(cfg.shape, w)}
                        </span>
                        <span style={{ fontSize: 13, color: MUTED }}>
                          {ordered.length} bay{ordered.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                        {ordered.map((s, bi) => (
                          <div key={s.id} style={{ background: OFFWHITE, borderRadius: 6, border: `0.5px solid ${CARD_BORDER}`, padding: '12px 11px' }}>
                            <div style={{ fontSize: 11, color: TAN, marginBottom: 4 }}>
                              Bay {bi + 1}{cornerIds.has(s.id) ? ' · corner' : ''}
                            </div>
                            <div style={{ fontSize: 15, color: COSMOS, fontWeight: 500 }}>
                              {interiorLabel(s.interior)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
                  <Link
                    href={`/configure?edit=${item.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: TAN, background: 'none', border: 'none', padding: 0 }}
                  >
                    <EditIcon /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    style={{ fontSize: 12, color: MUTED, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          <Link
            href="/configure"
            className="self-start rounded-full px-5 py-2 text-center text-sm font-medium"
            style={{ border: `0.5px solid ${CARD_BORDER}`, color: COSMOS, background: '#fff' }}
          >
            + Add another closet
          </Link>
        </div>

        {/* RIGHT: order summary */}
        <div style={{ position: 'sticky', top: 24, background: '#fff', borderRadius: 12, border: `0.5px solid ${CARD_BORDER}`, padding: 18 }}>
          <div style={{ fontSize: 10, color: TAN, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
            Order Summary
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: MUTED }}>Closet {i + 1}</span>
                <span style={{ fontSize: 12, color: COSMOS, fontWeight: 500 }}>{formatCents(item.totalCents)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(199,172,144,0.3)', paddingTop: 14, marginBottom: 16, marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: MUTED }}>Estimated total</span>
              <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 26, color: COSMOS, fontWeight: 500, lineHeight: 1 }}>
                {formatCents(totalCents)}
              </span>
            </div>
            <div style={{ fontSize: 9, color: TAN, textAlign: 'right', marginTop: 2 }}>No payment due today</div>
          </div>

          <Link
            href="/checkout"
            className="block text-center"
            style={{ width: '100%', background: COSMOS, color: CREAM, border: 'none', borderRadius: 9999, padding: 12, fontSize: 13, fontWeight: 500, marginBottom: 12 }}
          >
            Request Consultation
          </Link>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TRUST.map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: MUTED }}>
                <CheckIcon /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
