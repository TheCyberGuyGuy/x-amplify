import { prisma } from "@/lib/prisma";

const X_API = "https://api.twitter.com/2";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

// Fields we request on user lookups. `connection_status` needs user-context auth.
const USER_FIELDS =
  "connection_status,profile_image_url,name,username,description,verified,verified_type,affiliation";

export type XUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  verified_type?: string;
  connection_status?: string[];
  affiliation?: {
    badge_url?: string;
    description?: string;
    url?: string;
    user_id?: string;
  };
};

export class XApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Returns a valid access token for a user, refreshing it if expired.
 * Pass force=true to refresh regardless (used to recover from a 401).
 */
export async function getAccessTokenForUser(
  userId: string,
  force = false
): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "twitter" },
  });
  if (!account?.access_token) {
    throw new XApiError(401, "No X account linked. Please sign in again.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;
  // Refresh a minute before actual expiry (unless forced).
  if (!force && expiresAt && expiresAt - 60 > now) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    if (force) {
      throw new XApiError(401, "Session expired. Please sign in with X again.");
    }
    // No refresh token but token may still be valid; try it.
    return account.access_token;
  }

  const clientId = process.env.AUTH_TWITTER_ID!;
  const clientSecret = process.env.AUTH_TWITTER_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    throw new XApiError(401, "Session expired. Please sign in with X again.");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? account.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
  });
  return data.access_token;
}

async function xFetch(path: string, token: string): Promise<Response> {
  return fetch(`${X_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

/** Batch lookup up to 100 usernames with connection_status (user-context). */
export async function lookupUsersByUsernames(
  usernames: string[],
  token: string
): Promise<XUser[]> {
  const out: XUser[] = [];
  for (let i = 0; i < usernames.length; i += 100) {
    const batch = usernames.slice(i, i + 100);
    const params = new URLSearchParams({
      usernames: batch.join(","),
      "user.fields": USER_FIELDS,
    });
    const res = await xFetch(`/users/by?${params}`, token);
    if (res.status === 429) {
      throw new XApiError(429, "X rate limit reached. Try again in a few minutes.");
    }
    if (!res.ok) {
      throw new XApiError(res.status, `X lookup failed (${res.status}).`);
    }
    const json = (await res.json()) as { data?: XUser[] };
    if (json.data) out.push(...json.data);
  }
  return out;
}

/** Resolve a single handle (for admin add). */
export async function lookupUserByUsername(
  username: string,
  token: string
): Promise<XUser | null> {
  const params = new URLSearchParams({ "user.fields": USER_FIELDS });
  const clean = username.trim().replace(/^@/, "");
  const res = await xFetch(`/users/by/username/${clean}?${params}`, token);
  if (res.status === 429) {
    throw new XApiError(429, "X rate limit reached. Try again shortly.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new XApiError(res.status, `X lookup failed (${res.status}).`);
  const json = (await res.json()) as { data?: XUser };
  return json.data ?? null;
}

/** True if the authed user already follows this handle. */
export function isFollowing(u: XUser): boolean {
  return (u.connection_status ?? []).includes("following");
}

/** Heuristic: does this account carry an eToro affiliation/verified-org badge? */
export function isEtoroAffiliated(u: XUser): boolean {
  const aff = u.affiliation;
  if (!aff) return false;
  const hay = `${aff.description ?? ""} ${aff.url ?? ""}`.toLowerCase();
  return hay.includes("etoro");
}
