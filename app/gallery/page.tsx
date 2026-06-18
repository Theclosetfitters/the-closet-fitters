import type { Metadata } from 'next';
import Link from 'next/link';
import GalleryTabs from '@/components/GalleryTabs';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Browse The Closet Fitters’ work by closet type — fully custom walk-in and reach-in closets configured, built, and delivered to spec.',
};

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.25em]';

export default function GalleryPage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <p className={`${eyebrow} text-sand`}>Our Work</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-cream sm:text-5xl">
            Every Closet, Built to Fit
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-light text-cream/70">
            Browse our work by closet type. Each project is fully custom —
            configured, built, and delivered to spec.
          </p>
        </div>
      </section>

      {/* Tabs + masonry grid */}
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <GalleryTabs />
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-walnut text-cream">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-medium italic text-cream sm:text-5xl">
            Ready to design yours?
          </h2>
          <p className="mt-4 text-lg font-light text-cream/70">
            Configure your custom closet online and get an instant quote — no
            sales call needed.
          </p>
          <Link
            href="/configure"
            className="mt-8 inline-block rounded-full bg-cream px-8 py-3 text-sm font-semibold text-brand transition hover:bg-cream/90"
          >
            Start Designing
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
