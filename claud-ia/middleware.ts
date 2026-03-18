import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken, COOKIE_NAME } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;

  // If AUTH_SECRET is not configured, block access and redirect to login
  // so credentials are always required (never silently bypass auth)
  if (!secret) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token || !(await verifyAuthToken(secret, token))) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    const res = NextResponse.redirect(loginUrl);
    // Clear invalid cookie if present
    if (token) res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/settings/:path*'],
};
