import { requireVerifiedUser } from './apiAuth';

export async function requireAdmin() {
  const auth = await requireVerifiedUser();
  if (auth.error) return auth;
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !auth.user.email || !allowed.includes(auth.user.email.toLowerCase())) {
    return { error: 'Admin access required.', status: 403 };
  }
  return auth;
}
