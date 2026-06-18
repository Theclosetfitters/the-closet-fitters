'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

/*
 * Swapping in real photos:
 *   Drop correctly-named files into these folders and the placeholders are
 *   replaced automatically (each slot loads its photo and the Cream placeholder
 *   only shows until the file exists):
 *     Walk-In  -> /public/images/gallery/walk-in/walk-in-01.jpg, walk-in-02.jpg, ...
 *     Reach-In -> /public/images/gallery/reach-in/reach-in-01.jpg, reach-in-02.jpg, ...
 *   To show photos at their TRUE aspect ratio instead of filling the fixed slot
 *   height, replace the <Image fill className="object-cover"> below with
 *   <Image width={1200} height={900} className="w-full h-auto" /> and drop the
 *   `style={{ height }}` on the wrapper.
 */

interface Slot {
  n: number;
  height: number;
  src: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const WALK_IN: Slot[] = [320, 440, 280, 380, 470, 300, 420, 360, 480].map((height, i) => ({
  n: i + 1,
  height,
  src: `/images/gallery/walk-in/walk-in-${pad(i + 1)}.jpg`,
  label: `Walk-In — Photo ${i + 1}`,
}));

const REACH_IN: Slot[] = [360, 280, 440, 320, 400, 300].map((height, i) => ({
  n: i + 1,
  height,
  src: `/images/gallery/reach-in/reach-in-${pad(i + 1)}.jpg`,
  label: `Reach-In — Photo ${i + 1}`,
}));

const CATEGORIES = [
  { id: 'walk-in', label: 'Walk-In Closets', slots: WALK_IN },
  { id: 'reach-in', label: 'Reach-In Closets', slots: REACH_IN },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

// One masonry tile: a Cream placeholder with a Tan label, with the real photo
// loaded on top (falls back to the placeholder until the file exists).
function Tile({ slot, onOpen }: { slot: Slot; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg ring-1 ring-line/60"
    >
      <div className="relative w-full bg-cream" style={{ height: slot.height }}>
        {!failed && (
          <Image
            src={slot.src}
            alt={slot.label}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium uppercase tracking-wide text-sand">
              {slot.label}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function LightboxImage({ slot }: { slot: Slot }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex h-[85vh] w-[90vw] items-center justify-center">
      {!failed ? (
        <Image
          src={slot.src}
          alt={slot.label}
          fill
          sizes="90vw"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-[60vh] w-full max-w-3xl items-center justify-center rounded-lg bg-cream">
          <span className="text-sm font-medium uppercase tracking-wide text-sand">
            {slot.label}
          </span>
        </div>
      )}
    </div>
  );
}

export default function GalleryTabs() {
  const [active, setActive] = useState<CategoryId>('walk-in');
  const [open, setOpen] = useState<number | null>(null);

  const slots = CATEGORIES.find((c) => c.id === active)!.slots;
  const isOpen = open !== null;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: number) =>
      setOpen((o) => (o === null ? o : (o + dir + slots.length) % slots.length)),
    [slots.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close, step]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex justify-center gap-3" role="tablist" aria-label="Closet type">
        {CATEGORIES.map((c) => {
          const on = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(c.id)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                on
                  ? 'bg-brand text-cream'
                  : 'border border-brand text-brand hover:bg-brand/5'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Masonry (CSS columns) */}
      <div className="mx-auto mt-10 max-w-5xl columns-1 [column-gap:12px] sm:columns-2 lg:columns-3">
        {slots.map((slot, i) => (
          <Tile key={`${active}-${slot.n}`} slot={slot} onOpen={() => setOpen(i)} />
        ))}
      </div>

      {/* Lightbox — portaled to <body> so it covers the whole screen incl. nav */}
      {isOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image viewer"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 text-3xl leading-none text-cream hover:opacity-80"
          >
            ×
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous image"
            className="absolute left-4 text-4xl leading-none text-cream hover:opacity-80"
          >
            ‹
          </button>
          {/* stop propagation so clicking the image doesn't close */}
          <div onClick={(e) => e.stopPropagation()}>
            <LightboxImage slot={slots[open]} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next image"
            className="absolute right-4 text-4xl leading-none text-cream hover:opacity-80"
          >
            ›
          </button>
        </div>,
          document.body
        )}
    </div>
  );
}
