import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

/* ---- small inline (Tabler-style) icons --------------------------------- */
const iconProps = {
  width: 32,
  height: 32,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const IconHome = () => (
  <svg {...iconProps}>
    <path d="M5 12l-2 0 9 -9 9 9 -2 0" />
    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-7" />
    <path d="M9 21v-6a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6" />
  </svg>
);
const IconDesign = () => (
  <svg {...iconProps}>
    <path d="M3 21v-4a4 4 0 1 1 4 4h-4" />
    <path d="M21 3a16 16 0 0 0 -12.8 10.2" />
    <path d="M21 3a16 16 0 0 1 -10.2 12.8" />
    <path d="M10.6 9a9 9 0 0 1 4.4 4.4" />
  </svg>
);
const IconTools = () => (
  <svg {...iconProps}>
    <path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" />
    <path d="M14.5 5.5l4 4" />
    <path d="M12 8l-5 -5l-4 4l5 5" />
    <path d="M7 8l-1.5 1.5" />
  </svg>
);
const IconBuilding = () => (
  <svg {...iconProps}>
    <path d="M3 21h18" />
    <path d="M5 21v-16a1 1 0 0 1 1 -1h8a1 1 0 0 1 1 1v16" />
    <path d="M15 9h3a1 1 0 0 1 1 1v11" />
    <path d="M9 8h2M9 12h2M9 16h2" />
  </svg>
);

const STEPS = [
  { n: '01', title: 'Design', body: 'Plan your closet in 3D and watch a live, itemized price update as you go.' },
  { n: '02', title: 'Engineer', body: 'We translate your design into precise, production-ready plans — measured to perfection.' },
  { n: '03', title: 'Build & Install', body: 'Premium materials, expertly constructed and fitted seamlessly to your space.' },
];

const AUDIENCES = [
  { icon: <IconHome />, title: 'Homeowners', body: 'Storage that elevates everyday living, made to measure for your home.' },
  { icon: <IconDesign />, title: 'Interior Designers', body: 'Custom solutions that realize your vision, down to the last detail.' },
  { icon: <IconTools />, title: 'Contractors', body: 'Reliable, on-schedule production that keeps your projects moving.' },
  { icon: <IconBuilding />, title: 'Developers', body: 'Scalable, made-to-measure storage across units and properties.' },
];

const STATS = [
  { n: 'Instant Quote', label: 'Online, Every Time' },
  { n: '100%', label: 'Made to Measure' },
  { n: '14 Day', label: 'Lead Time' },
];

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.25em]';

export default function Home() {
  return (
    <>
      {/* 2. Hero -------------------------------------------------------- */}
      <section className="bg-brand text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className={`${eyebrow} text-sand`}>Made-to-measure storage</p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-cream sm:text-6xl">
              Closets, fitted to your space.
            </h1>
            <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-cream/70">
              The Closet Fitters designs, engineers, and builds custom closet
              systems — precision-planned, premium materials, seamless execution.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/configure"
                className="rounded-full bg-cream px-8 py-3 text-center text-sm font-semibold text-brand transition hover:bg-cream/90"
              >
                Start Designing
              </Link>
              <Link
                href="#how"
                className="rounded-full border border-cream/60 px-8 py-3 text-center text-sm font-semibold text-cream transition hover:bg-cream hover:text-brand"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Hero image slot — reserved for /images/hero-closet.jpg (added later).
              Replace this div with a Next.js <Image fill object-cover> once the
              photo exists; the 4:3 ratio keeps the layout from shifting. */}
          <div
            data-slot="hero-image"
            aria-hidden
            className="aspect-[4/3] w-full rounded-2xl bg-cream/5"
          />
        </div>
      </section>

      {/* 3. Trust bar -------------------------------------------------- */}
      <section className="bg-walnut text-cream" aria-label="By the numbers">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                {s.n}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-cream/70">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. How It Works ----------------------------------------------- */}
      <section id="how" className="bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className={`${eyebrow} text-walnut`}>The process</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
            From idea to installed, in three steps
          </h2>

          <div className="mt-10 grid gap-[2px] overflow-hidden rounded-xl bg-brand sm:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.n} className="relative border-t-2 border-brand bg-card p-8">
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-5 top-3 font-display text-[50px] font-semibold leading-none text-brand/10"
                >
                  {step.n}
                </span>
                <h3 className="font-display text-2xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Who We Serve ----------------------------------------------- */}
      <section id="serve" className="bg-brand text-cream">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className={`${eyebrow} text-sand`}>Who we serve</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-cream sm:text-5xl">
            Built for how you work
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <article
                key={a.title}
                className="rounded-xl border border-cream/15 bg-cream/[0.03] p-6"
              >
                <div className="text-sand">{a.icon}</div>
                <h3 className="mt-4 font-display text-xl font-semibold text-cream">{a.title}</h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-cream/70">{a.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/about"
              className="inline-block rounded-full border border-cream/60 px-6 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream hover:text-brand"
            >
              Learn more about who we work with
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Gallery ---------------------------------------------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <p className={`${eyebrow} text-walnut`}>Our work</p>
              <h2 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
                Recently fitted
              </h2>
            </div>
            <Link href="/gallery" className="text-sm font-medium text-walnut transition hover:text-ink">
              Full Gallery →
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                role="img"
                aria-label={`Closet project photo ${i} placeholder`}
                className="flex aspect-[4/5] items-center justify-center rounded-xl bg-cream-50 text-xs uppercase tracking-[0.2em] text-faint"
              >
                Photo
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. CTA banner ------------------------------------------------- */}
      <section className="bg-walnut text-cream">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-medium italic text-cream sm:text-5xl">
            Ready to design your dream closet?
          </h2>
          <p className="mt-4 text-lg font-light text-cream/70">
            Plan it in minutes and request a quote — we’ll handle the rest.
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
