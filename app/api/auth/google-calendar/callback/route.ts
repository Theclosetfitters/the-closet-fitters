// OAuth callback — exchanges the authorization code for tokens and logs the
// refresh token so it can be copied into GOOGLE_REFRESH_TOKEN (.env.local +
// Vercel). One-time setup.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOAuthClient } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }
  const redirectUri = new URL('/api/auth/google-calendar/callback', request.url).toString();
  const oauth2 = getOAuthClient(redirectUri);

  try {
    const { tokens } = await oauth2.getToken(code);
    console.log('\n=================== GOOGLE_REFRESH_TOKEN ===================');
    console.log(tokens.refresh_token ?? '(no refresh_token returned — revoke access and retry)');
    console.log('============================================================\n');

    const ok = Boolean(tokens.refresh_token);
    return new NextResponse(
      ok
        ? 'Success! A refresh token was printed to the server logs. Copy it into ' +
            'GOOGLE_REFRESH_TOKEN (.env.local and Vercel), then redeploy. You can close this tab.'
        : 'No refresh token was returned. Remove this app from your Google Account ' +
            'permissions (myaccount.google.com/permissions) and try again.',
      { status: 200, headers: { 'content-type': 'text/plain' } }
    );
  } catch (err) {
    console.error('Google OAuth token exchange failed:', err);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 });
  }
}
