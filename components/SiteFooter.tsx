import Link from 'next/link';
import Image from 'next/image';

// Footer on a Utility Black background, cream at reduced opacity.
export default function SiteFooter() {
  const link = 'text-cream/70 transition hover:text-cream';
  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <Image
            src="/images/CF_wordmark_light.png"
            alt="The Closet Fitters"
            width={1875}
            height={836}
            className="h-9 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm font-light text-cream/60">
            Custom, made-to-measure closet systems — designed, engineered, and
            built with a precision-led approach.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">
            Explore
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/configure" className={link}>Start Designing</Link></li>
            <li><Link href="/#how" className={link}>How It Works</Link></li>
            <li><Link href="/#serve" className={link}>Who We Serve</Link></li>
            <li><Link href="/about" className={link}>About</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">
            Contact
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-cream/70">
            <li><a href="mailto:Sales@theclosetfitters.com" className={link}>Sales@theclosetfitters.com</a></li>
            <li><a href="tel:+19545893233" className={link}>(954) 589-3233</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto max-w-6xl px-6 py-5 text-xs text-cream/50">
          © 2026 The Closet Fitters. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
