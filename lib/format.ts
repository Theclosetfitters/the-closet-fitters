// Display helpers.

/** Format an integer number of cents as a localized currency string. */
export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  in_production: 'In production',
  ready: 'Ready',
  completed: 'Completed',
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
