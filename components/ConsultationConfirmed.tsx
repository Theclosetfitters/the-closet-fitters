'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stored {
  contact: {
    firstName: string;
    lastName: string;
    address: string;
    email: string;
    phone: string;
  };
  flow: 'standalone' | 'checkout';
}

export default function ConsultationConfirmed({ source }: { source?: string }) {
  const [data, setData] = useState<Stored | null>(null);

  // Hide the Start Designing prompt only for the cart flow (they already
  // designed a closet). Any other / missing value defaults to showing it.
  const showStartDesigning = source !== 'cart';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('consultation');
      if (raw) setData(JSON.parse(raw) as Stored);
    } catch {
      // ignore
    }
  }, []);

  const c = data?.contact;
  const isCheckout = data?.flow === 'checkout';
  const summary: [string, string | undefined][] = [
    ['First Name', c?.firstName],
    ['Last Name', c?.lastName],
    ['Address', c?.address],
    ['Email', c?.email],
    ['Phone', c?.phone],
  ];

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-brand sm:text-5xl">
        Congrats! Your request is sent.
      </h1>
      <p className="mt-4 text-base text-brand/70">
        We will contact you soon to schedule a meeting.
      </p>
      {isCheckout && (
        <p className="mt-2 text-base text-brand/70">
          You will receive an email with your itemized closet quote shortly.
        </p>
      )}

      {c && (
        <dl className="mt-8 space-y-4">
          {summary.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-sand">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm text-brand">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {showStartDesigning && (
        <>
          <p className="mt-10 text-sm text-brand">
            In the meantime, start designing your custom closet.
          </p>
          <Link
            href="/configure"
            className="mt-3 inline-block rounded-full border border-brand px-6 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand hover:text-cream"
          >
            Start Designing →
          </Link>
        </>
      )}
    </div>
  );
}
