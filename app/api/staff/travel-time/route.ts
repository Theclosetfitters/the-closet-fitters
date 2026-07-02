// Staff-only travel-time lookup. Keeps GOOGLE_MAPS_API_KEY server-side; the
// scheduling modal calls this to check gaps between adjacent appointments.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTravelTime } from '@/lib/travel-time';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { origin, destination } = body ?? {};
  if (!origin || !destination) return NextResponse.json(null);

  const travel = await getTravelTime(origin, destination);
  return NextResponse.json(travel); // TravelTime | null
}
