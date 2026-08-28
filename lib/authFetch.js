'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';

async function currentUser() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  return await new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user || null);
    }, () => {
      stop();
      resolve(null);
    });
  });
}

export async function authFetch(input, init = {}) {
  const user = await currentUser();
  const headers = new Headers(init.headers || {});
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return fetch(input, { ...init, headers });
}

export async function requireFirebaseUser() {
  return currentUser();
}
