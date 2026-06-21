// Display helpers. Units are imperial (inches/feet); money is USD.

/** Format cents as USD, rounded UP to the nearest whole dollar (ceiling) and
 * shown without cents — e.g. 12401 -> "$125". Display-only: pricing
 * calculations and stored values stay at full precision. */
export function formatCents(cents: number, currency = 'usd'): string {
  const dollars = Math.ceil(cents / 100);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

/** Snap a measurement (inches) to the nearest 1/8". */
export function roundToEighth(inches: number): number {
  return Math.round(inches * 8) / 8;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/**
 * Format inches as feet + fractional inches, e.g. 17.5 -> `1' 5 1/2"`,
 * 84.625 -> `7' 0 5/8"`, 6 -> `6"`. Snaps to 1/8".
 */
export function formatInches(totalInches: number): string {
  const eighths = Math.round(totalInches * 8);
  const feet = Math.floor(eighths / 96);
  const rem = eighths - feet * 96;
  const wholeIn = Math.floor(rem / 8);
  const fracEighths = rem - wholeIn * 8;

  let frac = '';
  if (fracEighths > 0) {
    const g = gcd(fracEighths, 8);
    frac = `${fracEighths / g}/${8 / g}`;
  }

  if (feet > 0) {
    // Always show the whole-inch number (even 0) when feet are present.
    const inchPart = frac ? `${wholeIn} ${frac}` : `${wholeIn}`;
    return `${feet}' ${inchPart}"`;
  }
  if (wholeIn > 0) return frac ? `${wholeIn} ${frac}"` : `${wholeIn}"`;
  return frac ? `${frac}"` : `0"`;
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
