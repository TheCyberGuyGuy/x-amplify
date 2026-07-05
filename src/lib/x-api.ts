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

export type LatestTweet = { id: string; createdAt: string | null };

/**
 * Latest *original* post (no replies/retweets) for a given X user id.
 * Returns null if the account has no qualifying posts.
 *
 * Cost note: pool members are third parties, so this bills as a standard
 * read (~$0.005/post), deduplicated per resource within a 24h UTC window.
 * Callers MUST cache the result (see the tweetsCheckedAt TTL) rather than
 * calling this per page view.
 */
export async function fetchLatestTweet(
  xUserId: string,
  token: string
): Promise<LatestTweet | null> {
  const params = new URLSearchParams({
    max_results: "5", // 5 is the endpoint minimum
    exclude: "replies,retweets",
    "tweet.fields": "created_at",
  });
  const res = await xFetch(`/users/${xUserId}/tweets?${params}`, token);
  if (res.status === 429) {
    throw new XApiError(429, "X rate limit reached. Try again in a few minutes.");
  }
  if (!res.ok) {
    throw new XApiError(res.status, `X timeline lookup failed (${res.status}).`);
  }
  const json = (await res.json()) as {
    data?: { id: string; created_at?: string }[];
  };
  const newest = json.data?.[0]; // endpoint returns reverse-chronological
  if (!newest) return null;
  return { id: newest.id, createdAt: newest.created_at ?? null };
}

/**
 * App-only bearer token for endpoints that need no user context
 * (search/recent). Static token from the X developer portal.
 */
export function getAppBearerToken(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new XApiError(500, "X_BEARER_TOKEN is not configured.");
  }
  return token;
}

export type DiscoveredPost = {
  tweetId: string;
  authorId: string;
  authorUsername: string; // lowercase
  text: string;
  createdAt: string;
};

export type SearchResult = {
  posts: DiscoveredPost[];
  requestCount: number;
};

// search/recent query hard limit on Basic tier.
const SEARCH_QUERY_MAX = 512;
const SEARCH_SUFFIX = " -is:retweet -is:reply";
// Safety valve: never page past this many requests per chunk in one poll.
const SEARCH_MAX_PAGES = 3;

/** Greedily pack `from:` terms into as few <=512-char queries as possible. */
export function buildSearchQueries(usernames: string[]): string[] {
  const queries: string[] = [];
  let terms: string[] = [];
  let len = 0;
  for (const raw of usernames) {
    const term = `from:${raw.trim().replace(/^@/, "")}`;
    // "(" + terms joined by " OR " + ")" + suffix
    const projected = len + (terms.length ? 4 : 0) + term.length;
    if (terms.length && projected + 2 + SEARCH_SUFFIX.length > SEARCH_QUERY_MAX) {
      queries.push(`(${terms.join(" OR ")})${SEARCH_SUFFIX}`);
      terms = [];
      len = 0;
    }
    len += (terms.length ? 4 : 0) + term.length;
    terms.push(term);
  }
  if (terms.length) queries.push(`(${terms.join(" OR ")})${SEARCH_SUFFIX}`);
  return queries;
}

/**
 * All original posts (no retweets/replies; quotes included) by the given
 * usernames since `startTime`, via batched search/recent (app-only auth).
 *
 * Cost note: this is THE cost-control primitive. One request covers ~30
 * handles, and an empty result reads zero posts — so cost scales with posts
 * actually published, not with polling frequency or pool size. Callers must
 * still enforce the monthly read budget (see /api/cron/poll).
 */
export async function searchRecentPosts(
  usernames: string[],
  startTime: Date,
  token: string
): Promise<SearchResult> {
  const posts: DiscoveredPost[] = [];
  let requestCount = 0;

  for (const query of buildSearchQueries(usernames)) {
    let nextToken: string | undefined;
    for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
      const params = new URLSearchParams({
        query,
        start_time: startTime.toISOString(),
        max_results: "100",
        "tweet.fields": "created_at,author_id,text",
        expansions: "author_id",
        "user.fields": "username",
      });
      if (nextToken) params.set("next_token", nextToken);

      const res = await xFetch(`/tweets/search/recent?${params}`, token);
      requestCount++;
      if (res.status === 429) {
        // Rate limited: return what we have; the next poll's overlap window
        // re-covers this period, so nothing is lost.
        return { posts, requestCount };
      }
      if (!res.ok) {
        throw new XApiError(res.status, `X search failed (${res.status}).`);
      }
      const json = (await res.json()) as {
        data?: { id: string; author_id: string; text: string; created_at?: string }[];
        includes?: { users?: { id: string; username: string }[] };
        meta?: { next_token?: string };
      };

      const userById = new Map(
        (json.includes?.users ?? []).map((u) => [u.id, u.username.toLowerCase()])
      );
      for (const t of json.data ?? []) {
        posts.push({
          tweetId: t.id,
          authorId: t.author_id,
          authorUsername: userById.get(t.author_id) ?? "",
          text: t.text,
          createdAt: t.created_at ?? new Date().toISOString(),
        });
      }

      nextToken = json.meta?.next_token;
      if (!nextToken) break;
    }
  }
  return { posts, requestCount };
}

/** X user ids are numeric strings; anything else (e.g. a stray cuid) is invalid. */
export function isValidXUserId(id: string | null | undefined): id is string {
  return !!id && /^\d+$/.test(id);
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
