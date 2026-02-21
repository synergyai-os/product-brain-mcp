import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { FunctionReference } from "convex/server";
import { Id } from "./_generated/dataModel";
import { sessionInfo, validateAuth } from "./auth";
import { provisionHandler } from "./provision";

const QUERIES: Record<string, FunctionReference<"query", "internal">> = {
  resolveWorkspace: internal.kb.resolveWorkspace,
  "kb.listCollections": internal.kb.listCollections,
  "kb.getCollection": internal.kb.getCollection,
  "kb.listEntries": internal.kb.listEntries,
  "kb.listEntriesByLabel": internal.kb.listEntriesByLabel,
  "kb.getEntry": internal.kb.getEntry,
  "kb.searchEntries": internal.kb.searchEntries,
  "kb.listEntryHistory": internal.kb.listEntryHistory,
  "kb.listEntryRelations": internal.kb.listEntryRelations,
  "kb.listLabels": internal.kb.listLabels,
  "kb.gatherContext": internal.kb.gatherContext,
};

const MUTATIONS: Record<string, FunctionReference<"mutation", "internal">> = {
  "kb.createEntry": internal.kb.createEntry,
  "kb.updateEntry": internal.kb.updateEntry,
  "kb.createEntryRelation": internal.kb.createEntryRelation,
  "kb.createLabel": internal.kb.createLabel,
  "kb.updateLabel": internal.kb.updateLabel,
  "kb.deleteLabel": internal.kb.deleteLabel,
  "kb.applyLabel": internal.kb.applyLabel,
  "kb.removeLabel": internal.kb.removeLabel,
};

const JSON_HEADERS = { "Content-Type": "application/json" };

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Validate an API key and return the associated workspaceId.
 *
 * Supports two modes:
 * 1. Per-user cloud keys (pb_sk_...): looked up by hash in apiKeys table
 * 2. Legacy shared key (process.env.MCP_API_KEY): exact match, no workspace resolution
 */
async function validateApiKey(
  ctx: any,
  bearerToken: string,
): Promise<{ workspaceId: Id<"workspaces"> | null; legacy: boolean } | null> {
  if (bearerToken.startsWith("pb_sk_")) {
    const keyHash = await sha256(bearerToken);
    const result = await ctx.runQuery(internal.provision.validateApiKey, {
      keyHash,
    });
    if (!result) return null;

    ctx.runMutation(internal.provision.touchApiKeyUsage, {
      keyId: result.keyId,
    });

    return { workspaceId: result.workspaceId, legacy: false };
  }

  const envKey = process.env.MCP_API_KEY;
  if (envKey && bearerToken === envKey) {
    return { workspaceId: null, legacy: true };
  }

  return null;
}

// ── MCP Handler ─────────────────────────────────────────────────────────

const mcpHandler = httpAction(async (ctx, request) => {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing API key" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const bearerToken = auth.slice(7);
  const keyResult = await validateApiKey(ctx, bearerToken);
  if (!keyResult) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let body: { fn: string; args?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const { fn, args = {} } = body;
  if (!fn || typeof fn !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid 'fn' field" }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  if (!keyResult.legacy && keyResult.workspaceId && fn === "resolveWorkspace") {
    const workspace = await ctx.runQuery(internal.kb.resolveWorkspaceById, {
      workspaceId: keyResult.workspaceId,
    });
    return new Response(JSON.stringify({ data: workspace }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  try {
    let result: unknown;

    if (fn in QUERIES) {
      result = await ctx.runQuery(QUERIES[fn] as any, args);
    } else if (fn in MUTATIONS) {
      result = await ctx.runMutation(MUTATIONS[fn] as any, args);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown function: ${fn}` }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error: any) {
    const message = error?.message ?? "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});

// ── Key Revocation ──────────────────────────────────────────────────────

const revokeKeyHandler = httpAction(async (ctx, request) => {
  const authResult = await validateAuth(ctx, request);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  let body: { keyId: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!body.keyId) {
    return new Response(JSON.stringify({ error: "Missing keyId" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    await ctx.runMutation(internal.provision.revokeApiKey, {
      keyId: body.keyId as Id<"apiKeys">,
      userId: authResult.userId,
    });

    return new Response(JSON.stringify({ data: { deleted: true } }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
});

// ── List Keys ───────────────────────────────────────────────────────────

const listKeysHandler = httpAction(async (ctx, request) => {
  const authResult = await validateAuth(ctx, request);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const keys = await ctx.runQuery(internal.provision.listApiKeys, {
    userId: authResult.userId,
  });

  return new Response(JSON.stringify({ data: keys }), {
    status: 200,
    headers: CORS_HEADERS,
  });
});

// ── CORS Preflight ──────────────────────────────────────────────────────

const corsHandler = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

// ── Router ──────────────────────────────────────────────────────────────

const http = httpRouter();

// MCP API
http.route({ path: "/api/mcp", method: "POST", handler: mcpHandler });

// Auth
http.route({ path: "/auth/session", method: "GET", handler: sessionInfo });

// Provisioning & Key Management
http.route({ path: "/api/provision", method: "POST", handler: provisionHandler });
http.route({ path: "/api/keys", method: "GET", handler: listKeysHandler });
http.route({ path: "/api/keys/revoke", method: "POST", handler: revokeKeyHandler });

// CORS preflight for cross-origin SynergyOS web app
http.route({ path: "/api/provision", method: "OPTIONS", handler: corsHandler });
http.route({ path: "/api/keys", method: "OPTIONS", handler: corsHandler });
http.route({ path: "/api/keys/revoke", method: "OPTIONS", handler: corsHandler });

export default http;
