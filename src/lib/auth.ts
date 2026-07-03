import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function adminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((u) => u.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
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
    async jwt({ token, user, profile }) {
      // On initial sign-in, capture the X handle + assign role, persist to DB.
      if (user && profile) {
        // Twitter v2 profile: { data: { id, name, username, profile_image_url } }
        const data = (profile as { data?: Record<string, string> }).data ?? {};
        const username = data.username ?? null;
        const xUserId = data.id ?? null;
        const role = username && adminUsernames().includes(username.toLowerCase())
          ? "ADMIN"
          : "EMPLOYEE";

        if (user.id) {
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
