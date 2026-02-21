import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Helpers ─────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// ── Clerk JWT Validation ────────────────────────────────────────────────

interface ClerkJWTPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  iss: string;
  exp: number;
  iat: number;
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJWTPayload(token: string): ClerkJWTPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  return payload as ClerkJWTPayload;
}

async function fetchJWKS(issuerUrl: string): Promise<JsonWebKey[]> {
  const url = `${issuerUrl}/.well-known/jwks.json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${url}: ${res.status}`);
  }
  const data = (await res.json()) as { keys: JsonWebKey[] };
  return data.keys;
}

async function verifyClerkJWT(
  token: string,
  issuerUrl: string,
): Promise<ClerkJWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const headerJSON = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(parts[0])),
  );
  const kid = headerJSON.kid;
  const alg = headerJSON.alg;

  if (alg !== "RS256") {
    throw new Error(`Unsupported JWT algorithm: ${alg}`);
  }

  const keys = await fetchJWKS(issuerUrl);
  const matchingKey = keys.find((k: any) => k.kid === kid);
  if (!matchingKey) {
    throw new Error(`No matching JWKS key for kid: ${kid}`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    matchingKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureBytes = base64UrlDecode(parts[2]);
  const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureBytes.buffer as ArrayBuffer,
    dataBytes,
  );

  if (!valid) {
    throw new Error("JWT signature verification failed");
  }

  const payload = decodeJWTPayload(token);

  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error("JWT has expired");
  }

  const normalizedIssuer = issuerUrl.replace(/\/$/, "");
  const payloadIssuer = (payload.iss ?? "").replace(/\/$/, "");
  if (payloadIssuer !== normalizedIssuer) {
    throw new Error(
      `JWT issuer mismatch: expected ${normalizedIssuer}, got ${payloadIssuer}`,
    );
  }

  return payload;
}

// ── Internal functions ──────────────────────────────────────────────────

export const upsertClerkUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, name, avatarUrl }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { email, name, avatarUrl });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      avatarUrl,
      createdAt: Date.now(),
    });
  },
});

export const upsertGitHubUser = internalMutation({
  args: {
    githubId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { githubId, email, name, avatarUrl }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_githubId", (q) => q.eq("githubId", githubId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { email, name, avatarUrl });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      githubId,
      email,
      name,
      avatarUrl,
      createdAt: Date.now(),
    });
  },
});

export const createSession = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const token = randomHex(32);
    const ONE_HOUR = 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + ONE_HOUR,
      createdAt: Date.now(),
    });
    return token;
  },
});

export const validateSession = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    return { userId: session.userId };
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

// ── HTTP Actions ────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Validate a Clerk JWT from the Authorization header and return the user.
 * Used by the provision endpoint when called from the SynergyOS web app.
 */
export async function validateClerkAuth(
  ctx: any,
  request: Request,
): Promise<{ userId: any; error?: undefined } | { error: string; userId?: undefined }> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: "Missing authorization token" };
  }

  const token = auth.slice(7);
  const issuerUrl = process.env.CLERK_ISSUER_URL;

  if (!issuerUrl) {
    return { error: "CLERK_ISSUER_URL not configured" };
  }

  try {
    const payload = await verifyClerkJWT(token, issuerUrl);

    const userId = await ctx.runMutation(internal.auth.upsertClerkUser, {
      clerkId: payload.sub,
      email: payload.email ?? "",
      name: payload.name ?? payload.sub,
      avatarUrl: payload.picture,
    });

    return { userId };
  } catch (err: any) {
    return { error: `Auth failed: ${err.message}` };
  }
}

/**
 * Validate either a Clerk JWT or a legacy session token.
 * Tries Clerk first (if CLERK_ISSUER_URL is set), falls back to session token.
 */
export async function validateAuth(
  ctx: any,
  request: Request,
): Promise<{ userId: any; error?: undefined } | { error: string; userId?: undefined }> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: "Missing authorization token" };
  }

  const token = auth.slice(7);

  // Try Clerk JWT if configured
  const issuerUrl = process.env.CLERK_ISSUER_URL;
  if (issuerUrl) {
    try {
      const payload = await verifyClerkJWT(token, issuerUrl);
      const userId = await ctx.runMutation(internal.auth.upsertClerkUser, {
        clerkId: payload.sub,
        email: payload.email ?? "",
        name: payload.name ?? payload.sub,
        avatarUrl: payload.picture,
      });
      return { userId };
    } catch {
      // Fall through to session token validation
    }
  }

  // Try legacy session token
  const session = await ctx.runQuery(internal.auth.validateSession, { token });
  if (session) {
    return { userId: session.userId };
  }

  return { error: "Invalid or expired token" };
}

export const sessionInfo = httpAction(async (ctx, request) => {
  const result = await validateAuth(ctx, request);
  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const user = await ctx.runQuery(internal.auth.getUserById, {
    userId: result.userId,
  });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  return new Response(
    JSON.stringify({
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        defaultWorkspaceId: user.defaultWorkspaceId,
      },
    }),
    { status: 200, headers: JSON_HEADERS },
  );
});

export { sha256, randomHex };
