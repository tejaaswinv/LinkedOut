# LinkedOut

**LinkedOut** is a pseudonymous workplace-intelligence network: users can publicly share professional context such as employer, title and location while keeping their real name, phone number, login email and verification evidence private.

## Current architecture

- **Next.js 15 + React 19** — web app and server API routes
- **Firebase Authentication** — email/password, Google sign-in and login-email verification
- **Supabase Postgres** — companies, internal identities, pseudonymous profiles, employment verification, reviews, votes, moderation and company summaries
- **Supabase Storage** — private employment-evidence bucket
- **Supabase Edge Functions** — deterministic moderation and aggregate summary generation
- **Firebase UID -> internal UUID bridge** — Firebase identifiers are never used as public profile IDs

Firebase handles authentication only. Private Supabase writes run through Next.js server routes after the Firebase ID token is verified against Google's Firebase signing keys.

## 1. Install

Use Node 22 LTS:

```bash
nvm use 22
npm install
```

## 2. Environment variables

Copy the template:

```bash
cp .env.example .env.local
```

The Supabase public URL and publishable key are already filled in for the LinkedOut project.

You still need to add `SUPABASE_SERVICE_ROLE_KEY` locally. Get it from your Supabase project dashboard and **do not send or commit it**.

## 3. Create the Firebase app

In Firebase Console:

1. Create/select a project named `LinkedOut`.
2. Go to **Authentication -> Sign-in method**.
3. Enable **Email/Password**.
4. Enable **Google** if you want the Google button.
5. Go to **Project settings -> General -> Your apps -> Web app**.
6. Copy the Firebase web config into the `NEXT_PUBLIC_FIREBASE_*` fields in `.env.local`.
7. Under **Authentication -> Settings -> Authorized domains**, make sure `localhost` is allowed for local development. Add your production domain later.

No Firebase service-account/private key is required by this implementation. The Next.js server verifies Firebase ID tokens using Google's public signing keys.

## 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Authentication flow

### Email/password

1. User chooses a public pseudonym.
2. Firebase creates the private login account.
3. LinkedOut maps the Firebase UID to a random internal Postgres UUID.
4. LinkedOut creates the pseudonymous profile in Supabase.
5. Firebase emails an account-verification link.
6. Posting reviews, voting and employment verification require the login email to be verified.

### Google

Google creates the private login account. LinkedOut creates a random public pseudonym such as `@user_ab12cd...`; the user can change it on the profile page. The person's Google name/email is not published.

## Employment verification

- **Current employee:** work-email OTP against a recognized company domain.
- **Current/former employee:** private PDF/image proof uploaded to the non-public Supabase bucket and reviewed by an admin.
- Public reviews only get `Verified Employee` when a verified employment record exists for that company.

For local OTP testing, `.env.example` currently uses:

```env
VERIFICATION_DEV_BYPASS=true
```

The code is displayed only in local/dev mode. Before deployment, set this to `false` and configure Resend.

## Database

Migrations live in `supabase/migrations/`.

- `0001_linkedout.sql` — core schema
- `0002_public_views_and_submit_review.sql` — public read views and original Supabase-auth RPC
- `0003_harden_public_access.sql` — security hardening
- `0004_firebase_auth_bridge.sql` — Firebase identity bridge and private-table ownership migration
- `0005_disable_supabase_auth_rpc.sql` — retires the old Supabase-auth review RPC
- `0006_minimize_identity_data.sql` — removes the unnecessary login-email hash from Postgres

The live Supabase project already has migrations `0004_firebase_auth_bridge`, `0005_disable_supabase_auth_rpc`, and `0006_minimize_identity_data` applied.

## Security model

- Firebase login email remains in Firebase Auth and is not copied into LinkedOut's Postgres database.
- Public reviews never expose internal user IDs or Firebase UIDs.
- Employment evidence is private and accessed only through admin server routes.
- Public company/review reads use restricted Supabase views/RLS.
- Authenticated private writes require a valid Firebase ID token and the Supabase service role on the server.
- The moderation Edge Function is service-role-only.

## AI summaries and moderation

The existing deterministic moderation removes emails, phone numbers and URLs and rejects explicit violent threats. `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` can be configured for richer moderation/company summaries.

For production, add rate limiting, abuse detection, appeals, audit retention/deletion rules and jurisdiction-specific privacy/defamation review.
