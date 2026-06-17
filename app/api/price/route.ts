// POST /api/price — recompute the itemized price from the catalog + a submitted
// configuration. The price is ALWAYS computed here on the server; the client
// never sends a price. See CLAUDE.md rule #1.
import { NextResponse } from 'next/server';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import type { ClosetConfig } from '@/types';

export async function POST(request: Request) {
  let config: ClosetConfig;
  try {
    config = (await request.json()) as ClosetConfig;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!config?.closetTypeId || !config?.dimensions || !config?.selections) {
    return NextResponse.json(
      { error: 'Missing required configuration fields' },
      { status: 400 }
    );
  }

  try {
    const breakdown = computePrice(catalog, config);
    return NextResponse.json(breakdown);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pricing failed' },
      { status: 400 }
    );
  }
}
