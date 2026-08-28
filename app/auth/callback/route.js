import { NextResponse } from 'next/server';

// Supabase Auth is no longer used. Keep this route only so old local links fail gracefully.
export async function GET(request) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', 'LinkedOut now uses Firebase Authentication. Please sign in again.');
  return NextResponse.redirect(url);
}
