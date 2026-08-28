import { NextResponse } from 'next/server';

// Firebase Auth is handled in the browser and authenticated API calls carry a
// Firebase ID token in the Authorization header. Route handlers verify that
// token server-side before touching private Supabase data.
export function middleware(request) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
