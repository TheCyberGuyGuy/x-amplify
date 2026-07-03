# eToro X-Amplify

An internal portal that helps eToro employees connect with each other on X (Twitter).
Sign in with X → see which colleagues you already follow → follow the rest in one click.

## How it works (the important bit)

X's "list who a user follows" endpoint is Enterprise-only (~$42k/mo) in 2026, so we
**don't** read a user's follow graph. Instead:

- An **admin curates a pool** of eToro X handles.
- When an employee signs in, we look up that pool with the **`connection_status`**
  field (`GET /2/users/by`, user-context OAuth). X tells us, per handle, whether the
  employee already follows them.
- "Follow" buttons are **X intent links** (`x.com/intent/follow?screen_name=…`) —
  user-initiated, zero API cost, no platform-manipulation risk.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Auth.js v5 (X OAuth 2.0 PKCE) ·
Prisma + SQLite (local) / Postgres (prod) · TanStack Query · Framer Motion.

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create an X app** (you already have a developer account):
   - OAuth 2.0, type **Web App / Confidential client**.
   - Callback URL: `http://localhost:3000/api/auth/callback/twitter`
   - Scopes: `users.read tweet.read offline.access`
   - Copy the **Client ID** and **Client Secret**.

3. **Configure `.env.local`** (already scaffolded — fill the blanks):
   ```env
   AUTH_TWITTER_ID=your_client_id
   AUTH_TWITTER_SECRET=your_client_secret
   AUTH_SECRET=run `npx auth secret` to generate
   AUTH_URL=http://localhost:3000
   DATABASE_URL="file:./dev.db"
   ADMIN_USERNAMES=your_x_handle   # comma-separated, become ADMIN on first login
   ```

4. **Init the database**
   ```bash
   npx prisma migrate dev
   npm run db:seed   # optional: pre-populate the pilot handle pool
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, sign in with X. If your handle is in
   `ADMIN_USERNAMES`, you'll see the **Admin** link to manage the pool.

## Admin

`/admin` (role-gated): add an X handle → it's resolved + verified against X (profile,
eToro affiliation badge) → appears in the pool. Toggle active / remove.

## Deploy to Vercel

1. Push to GitHub, import into Vercel.
2. Add a **Postgres** database (Vercel Storage) — set `DATABASE_URL`.
3. Change `prisma/schema.prisma` datasource `provider` to `postgresql`, run
   `prisma migrate deploy` (the `build` script runs `prisma generate`).
4. Set env vars: `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `AUTH_SECRET`,
   `AUTH_URL=https://your-app.vercel.app`, `ADMIN_USERNAMES`.
5. Add the production callback URL to your X app:
   `https://your-app.vercel.app/api/auth/callback/twitter`.

## Roadmap

- **Phase 0 (done):** login, follow-status dashboard, admin pool, intent-link follows.
- **Phase 1:** guided "follow the rest" flow + pilot metrics (FollowEvent already tracked).
- **Phase 2:** organic posts feed from pool members with like/comment deep-links.
