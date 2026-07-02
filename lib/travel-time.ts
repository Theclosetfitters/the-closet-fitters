// Driving travel time between two addresses via the Google Maps Distance Matrix
// API. SERVER-ONLY — reads GOOGLE_MAPS_API_KEY. Never import from a Client
// Component (call it through /api/staff/travel-time instead).

export type TravelTime = {
  durationMinutes: number; // driving time in minutes (with live traffic)
  durationText: string; // e.g. "23 mins"
  distance: string; // e.g. "12.3 mi"
};

export async function getTravelTime(
  originAddress: string,
  destinationAddress: string
): Promise<TravelTime | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !originAddress || !destinationAddress) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', originAddress);
    url.searchParams.set('destinations', destinationAddress);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now'); // current traffic conditions
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status, data.error_message ?? '');
      return null;
    }
    const el = data.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') {
      console.error('Distance Matrix element error:', el?.status ?? 'no element');
      return null;
    }
    // duration_in_traffic is present because departure_time=now.
    const duration = el.duration_in_traffic ?? el.duration;
    if (!duration?.value && duration?.value !== 0) return null;
    return {
      durationMinutes: Math.round(duration.value / 60),
      durationText: duration.text,
      distance: el.distance?.text ?? '',
    };
  } catch (err) {
    console.error('getTravelTime failed:', err);
    return null;
  }
}
