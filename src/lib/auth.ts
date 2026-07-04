import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { highestRole } from "@/lib/roles";

function parseUsernames(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((u) => u.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

// Role bootstrapped from env: SUPER_ADMIN wins over ADMIN.
function envRoleFor(username: string | null): "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE" {
  if (!username) return "EMPLOYEE";
  const u = username.toLowerCase();
  if (parseUsernames(process.env.SUPER_ADMIN_USERNAMES).includes(u)) return "SUPER_ADMIN";
  if (parseUsernames(process.env.ADMIN_USERNAMES).includes(u)) return "ADMIN";
  return "EMPLOYEE";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions keep auth stateless while the adapter still persists
  // User + Account rows (incl. access/refresh tokens) for X API calls.
  session: { strategy: "jwt" },
  providers: [
    Twitter({
      // X OAuth 2.0 (PKCE). Specify the full authorization URL — overriding only
      // `params` drops the provider default and yields "Invalid URL".
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: { scope: "users.read tweet.read offline.access" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Auth.js only stores tokens on the FIRST account link, so on every
      // subsequent login we refresh the stored access/refresh tokens ourselves —
      // otherwise they go stale and X lookups start failing with 401.
      if (account) {
        await prisma.account.updateMany({
          where: {
            provider: "twitter",
            providerAccountId: account.providerAccountId,
          },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at as number | undefined,
          },
        });
      }

      // On initial sign-in, capture the X handle + assign role, persist to DB.
      if (user && profile) {
        // Twitter v2 profile: { data: { id, name, username, profile_image_url } }
        const data = (profile as { data?: Record<string, string> }).data ?? {};
        const username = data.username ?? null;
        const xUserId = data.id ?? null;

        // Env can only elevate; runtime promotions (e.g. a super admin making
        // someone an admin) are preserved across logins.
        let role: string = envRoleFor(username);
        if (user.id) {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          });
          role = highestRole(role, existing?.role ?? "EMPLOYEE");
          await prisma.user.update({
            where: { id: user.id },
            data: { username, xUserId, role },
          });
        }

        // Self-registration: every employee who logs in is added to the
        // followable pool so colleagues can follow them too. Live profile +
        // eToro badge are refreshed on each dashboard lookup.
        if (username && xUserId) {
          await prisma.poolHandle.upsert({
            where: { username: username.toLowerCase() },
            create: {
              username: username.toLowerCase(),
              xUserId,
              displayName: data.name ?? null,
              profileImage: data.profile_image_url ?? null,
              addedById: user.id,
            },
            update: {
              xUserId,
              displayName: data.name ?? undefined,
              profileImage: data.profile_image_url ?? undefined,
            },
          });
        }

        token.uid = user.id;
        token.username = username;
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.username = (token.username as string) ?? null;
        session.user.role = (token.role as string) ?? "EMPLOYEE";
      }
      return session;
    },
  },
});
