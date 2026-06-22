'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';

// Shared consultation form — used by both /consultation (standalone) and the
// checkout page (flow="checkout", which attaches the cart's closet configs).
type Field = { name: keyof FormState; label: string; type: string; optional?: boolean };
interface FormState {
  firstName: string;
  lastName: string;
  address: string;
  email: string;
  phone: string;
  referral: string;
}

const FIELDS: Field[] = [
  { name: 'firstName', label: 'First Name', type: 'text' },
  { name: 'lastName', label: 'Last Name', type: 'text' },
  { name: 'address', label: 'Address', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'referral', label: 'How did you hear about us?', type: 'text', optional: true },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConsultationForm({ flow }: { flow: 'standalone' | 'checkout' }) {
  const router = useRouter();
  const { items } = useCart();
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    address: '',
    email: '',
    phone: '',
    referral: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function validate(): Partial<Record<keyof FormState, string>> {
    const e: Partial<Record<keyof FormState, string>> = {};
    for (const f of FIELDS) {
      if (!f.optional && !form[f.name].trim()) e[f.name] = `${f.label} is required.`;
    }
    if (!e.email && form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      e.email = 'Please enter a valid email address.';
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: form,
          flow,
          ...(flow === 'checkout' ? { items: items.map((it) => ({ config: it.config })) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not submit your request');
      try {
        sessionStorage.setItem('consultation', JSON.stringify({ contact: form, flow }));
      } catch {
        // ignore storage failures
      }
      router.push('/consultation/confirmed');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not submit your request');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label
            htmlFor={`cf-${f.name}`}
            className="block text-xs font-semibold uppercase tracking-[0.18em] text-sand"
          >
            {f.label}
            {f.optional ? ' (Optional)' : ''}
          </label>
          <input
            id={`cf-${f.name}`}
            data-testid={`cf-${f.name}`}
            type={f.type}
            value={form[f.name]}
            onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
            className="mt-1 w-full border-0 border-b border-brand bg-transparent px-0 py-2 text-sm text-brand placeholder:text-brand/30 focus:border-brand focus:outline-none focus:ring-0"
          />
          {errors[f.name] && (
            <p data-testid={`cf-err-${f.name}`} className="mt-1 text-xs font-normal text-sand">
              {errors[f.name]}
            </p>
          )}
        </div>
      ))}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        data-testid="cf-submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-cream transition hover:bg-walnut disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit'}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12l14 0" />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </svg>
      </button>
    </form>
  );
}
