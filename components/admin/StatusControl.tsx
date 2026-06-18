'use client';

import { updateOrderStatusAction } from '@/app/admin/actions';
import { formatStatus } from '@/lib/format';
import type { OrderStatus } from '@/types';

const STATUSES: OrderStatus[] = [
  'received',
  'in_production',
  'ready',
  'completed',
];

export default function StatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  return (
    <form action={updateOrderStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-lg border border-line px-2 py-1.5 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {formatStatus(s)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:opacity-90"
      >
        Update
      </button>
    </form>
  );
}
