'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Catalog, ClosetConfig } from '@/types';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/format';
import ClosetSummary from '@/components/ClosetSummary';

interface Done {
  contact: { name: string; phone: string; email: string; address: string };
  closets: { config: ClosetConfig; totalCents: number }[];
  grandTotalCents: number;
  quoteRef: string;
  emailSent: boolean;
}

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Doe' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 123-4567' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
] as const;

export default function CheckoutForm({ catalog }: { catalog: Catalog }) {
  const { items, totalCents, clear, ready } = useCart();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    referralSource: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-sand bg-cream-50 p-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-2xl text-cream">
            ✓
          </div>
          <h2 className="text-xl font-bold text-ink">Quote requested!</h2>
          <p className="mt-1 text-sm text-muted">
            Reference <span className="font-mono">{done.quoteRef}</span>.{' '}
            {done.emailSent
              ? `We’ve emailed your itemized quote to ${done.contact.email}.`
              : `We’ve recorded your request; a copy will be emailed to ${done.contact.email}.`}
          </p>
        </div>

        {done.closets.map((c, i) => (
          <ClosetSummary
            key={i}
            catalog={catalog}
            config={c.config}
            totalCents={c.totalCents}
            index={i}
          />
        ))}

        <div className="flex items-center justify-between rounded-xl border border-line bg-card p-4">
          <span className="font-semibold text-ink">Grand total</span>
          <span className="text-lg font-bold tabular-nums text-walnut">
            {formatCents(done.grandTotalCents)}
          </span>
        </div>

        <Link
          href="/configure"
          className="block rounded-full bg-brand px-6 py-2.5 text-center text-sm font-semibold text-cream hover:bg-brand-700"
        >
          Design another closet
        </Link>
      </div>
    );
  }

  if (ready && items.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line p-8 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link
          href="/configure"
          className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-cream hover:bg-brand-700"
        >
          Design a closet
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: form,
          items: items.map((it) => ({ config: it.config })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not submit your quote');
      setDone({
        contact: form,
        closets: items.map((it, i) => ({
          config: it.config,
          totalCents: data.closets[i].totalCents,
        })),
        grandTotalCents: data.grandTotalCents,
        quoteRef: data.quoteRef,
        emailSent: data.emailSent,
      });
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your quote');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-ink">{f.label}</label>
            <input
              data-testid={`field-${f.name}`}
              type={f.type}
              required
              placeholder={f.placeholder}
              value={form[f.name]}
              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-ink">
            Delivery address
          </label>
          <textarea
            data-testid="field-address"
            required
            rows={3}
            placeholder="123 Main St, City, State ZIP"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="referral-source"
            className="block text-sm font-medium text-ink"
          >
            How did you hear about us?{' '}
            <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            id="referral-source"
            data-testid="field-referral"
            type="text"
            placeholder="Instagram, a friend, Google…"
            value={form.referralSource}
            onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="text-sm font-semibold text-ink">Order summary</h3>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">
              {items.length} closet{items.length === 1 ? '' : 's'}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {formatCents(totalCents)}
            </span>
          </div>
          <button
            type="submit"
            data-testid="submit-quote"
            disabled={submitting || (ready && items.length === 0)}
            className="mt-4 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-cream transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Request quote'}
          </button>
          <p className="mt-2 text-center text-[11px] text-faint">
            No payment now — you’ll receive an itemized quote by email.
          </p>
        </div>
      </div>
    </form>
  );
}
