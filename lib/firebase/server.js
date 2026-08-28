import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyFirebaseIdToken(token) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase project ID is not configured.');

  const { payload } = await jwtVerify(token, GOOGLE_FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256']
  });

  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Firebase token subject.');
  if (typeof payload.auth_time === 'number' && payload.auth_time > Math.floor(Date.now() / 1000) + 60) {
    throw new Error('Invalid Firebase authentication time.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    provider: payload.firebase?.sign_in_provider || null
  };
}
