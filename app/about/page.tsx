import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'About',
  description:
    'The Closet Fitters blends thoughtful design, precision engineering, and reliable production to deliver premium, made-to-measure storage.',
};

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.25em]';

const VALUES = [
  { title: 'Precision', body: 'Every cut planned to the eighth-inch, engineered before it’s built.' },
  { title: 'Speed', body: 'Reliable production that keeps your project on schedule.' },
  { title: 'Transparency', body: 'Clear, itemized quotes — no surprises, ever.' },
  { title: 'Value', body: 'Premium materials and craftsmanship, fairly priced.' },
];

export default function AboutPage() {
  return (
    <>
      {/* 1. About hero ------------------------------------------------- */}
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-24">
          <p className={`${eyebrow} text-sand`}>Our story</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] text-cream sm:text-5xl">
            Technical expertise.
            <br />
            Refined design.
            <br />
            Storage that lasts.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light text-cream/70">
            We blend thoughtful design, precision engineering, and reliable
            production into storage that elevates everyday living.
          </p>
        </div>
      </section>

      {/* 2. Story ------------------------------------------------------ */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
          <div>
            <p className={`${eyebrow} text-walnut`}>Who we are</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
              Design-led, made to measure
            </h2>
            <p className="mt-6 font-light leading-relaxed text-muted">
              The Closet Fitters grew from technical expertise into a refined,
              design-led practice. We combine functional planning, premium
              materials, and seamless execution to deliver storage solutions that
              feel effortless.
            </p>
            <p className="mt-4 font-light leading-relaxed text-muted">
              Our partnership model blends thoughtful design, technical precision,
              and dependable production — so homeowners, designers, and trade
              partners can focus on the vision while we handle the details.
            </p>
            <Link
              href="/configure"
              className="mt-8 inline-block rounded-full bg-brand px-8 py-3 text-sm font-semibold text-cream transition hover:bg-brand-700"
            >
              Start Designing
            </Link>
          </div>

          <div
            role="img"
            aria-label="Workshop photo placeholder"
            className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-cream-50 text-xs uppercase tracking-[0.2em] text-faint"
          >
            Photo
          </div>
        </div>
      </section>

      {/* 3. Values grid ------------------------------------------------ */}
      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className={`${eyebrow} text-walnut`}>What we value</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
            Principles we build on
          </h2>

          <div className="mt-10 grid gap-[2px] overflow-hidden rounded-xl bg-brand sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <article key={v.title} className="bg-card p-8">
                <h3 className="font-display text-2xl font-semibold text-ink">{v.title}</h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-muted">{v.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. About CTA -------------------------------------------------- */}
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-semibold text-cream sm:text-5xl">
            Let’s build your space
          </h2>
          <p className="mt-4 text-lg font-light text-cream/70">
            Plan your closet in minutes and request an itemized quote.
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
