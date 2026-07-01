// One-time setup: kicks off the Google OAuth consent flow to obtain a refresh
// token for the business calendar. Visit /api/auth/google-calendar once, sign
// in with the business Gmail account, then copy GOOGLE_REFRESH_TOKEN from the
// server logs (see the callback route).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CALENDAR_SCOPES, getOAuthClient } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const redirectUri = new URL('/api/auth/google-calendar/callback', request.url).toString();
  const oauth2 = getOAuthClient(redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token on every run
    scope: CALENDAR_SCOPES,
  });
  return NextResponse.redirect(url);
}
