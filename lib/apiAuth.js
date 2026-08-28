import { headers } from 'next/headers';
import { createAdminClient } from './supabase/admin';
import { verifyFirebaseIdToken } from './firebase/server';

function fallbackUsername(userId) {
  return `@user_${userId.replace(/-/g, '').slice(0, 10)}`;
}

export async function requireUser() {
  const headerStore = await headers();
  const authorization = headerStore.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Sign in required.', status: 401 };

  let firebase;
  try {
    firebase = await verifyFirebaseIdToken(match[1]);
  } catch {
    return { error: 'Your sign-in session is invalid or expired. Please sign in again.', status: 401 };
  }

  const admin = createAdminClient();
  if (!admin) return { error: 'Supabase service role is not configured.', status: 503 };

  let { data: appUser, error } = await admin
    .from('app_users')
    .select('id,firebase_uid,email_verified,created_at')
    .eq('firebase_uid', firebase.uid)
    .maybeSingle();

  if (error) return { error: error.message, status: 500 };

  if (!appUser) {
    const inserted = await admin
      .from('app_users')
      .insert({
        firebase_uid: firebase.uid,
        email_verified: firebase.emailVerified
      })
      .select('id,firebase_uid,email_verified,created_at')
      .single();
    if (inserted.error) {
      // Another concurrent request may have created it first.
      const retry = await admin
        .from('app_users')
        .select('id,firebase_uid,email_verified,created_at')
        .eq('firebase_uid', firebase.uid)
        .maybeSingle();
      if (retry.error || !retry.data) return { error: inserted.error.message, status: 500 };
      appUser = retry.data;
    } else {
      appUser = inserted.data;
    }
  } else if (appUser.email_verified !== firebase.emailVerified) {
    await admin.from('app_users').update({
      email_verified: firebase.emailVerified
    }).eq('id', appUser.id);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,identity_verified_at')
    .eq('id', appUser.id)
    .maybeSingle();
  if (profileError) return { error: profileError.message, status: 500 };
  if (!profile) {
    const created = await admin.from('profiles').insert({
      id: appUser.id,
      username: fallbackUsername(appUser.id),
      identity_verified_at: firebase.emailVerified ? new Date().toISOString() : null
    });
    if (created.error && created.error.code !== '23505') return { error: created.error.message, status: 500 };
  } else if (firebase.emailVerified && !profile.identity_verified_at) {
    await admin.from('profiles').update({ identity_verified_at: new Date().toISOString() }).eq('id', appUser.id);
  }

  return {
    user: {
      id: appUser.id,
      firebase_uid: firebase.uid,
      email: firebase.email,
      emailVerified: firebase.emailVerified,
      email_confirmed_at: firebase.emailVerified ? new Date().toISOString() : null
    },
    supabase: admin,
    admin
  };
}

export async function requireVerifiedUser() {
  const auth = await requireUser();
  if (auth.error) return auth;
  if (!auth.user.emailVerified) return { error: 'Verify your private login email before contributing.', status: 403 };
  return auth;
}
