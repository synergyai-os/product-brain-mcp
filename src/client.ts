/**
 * MCP client — communicates with the Convex HTTP Action gateway.
 *
 * Required env vars:
 *   CONVEX_SITE_URL  — base URL of the Convex deployment (*.convex.site, NOT *.convex.cloud)
 *                      e.g. https://trustworthy-kangaroo-277.convex.site
 *   MCP_API_KEY      — secret key matching MCP_API_KEY set in the Convex dashboard env vars
 *   WORKSPACE_SLUG   — slug of the workspace to operate on
 *
 * All calls go through POST /api/mcp on the Convex site URL.
 * The HTTP Action validates the API key before dispatching to internal Convex functions.
 * workspaceId is resolved once at startup and injected into every call automatically.
 */

import { trackToolCall } from "./analytics.js";

let cachedWorkspaceId: string | null = null;

export interface AuditEntry {
  ts: string;
  fn: string;
  workspace: string;
  status: 'ok' | 'error';
  durationMs: number;
  error?: string;
}

const AUDIT_BUFFER_SIZE = 50;
const auditBuffer: AuditEntry[] = [];

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable is required`);
  return value;
}

function audit(fn: string, status: 'ok' | 'error', durationMs: number, errorMsg?: string): void {
  const ts = new Date().toISOString();
  const workspace = cachedWorkspaceId ?? 'unresolved';

  const entry: AuditEntry = { ts, fn, workspace, status, durationMs };
  if (errorMsg) entry.error = errorMsg;
  auditBuffer.push(entry);
  if (auditBuffer.length > AUDIT_BUFFER_SIZE) auditBuffer.shift();

  trackToolCall(fn, status, durationMs, workspace, errorMsg);

  const base = `[MCP-AUDIT] ${ts} fn=${fn} workspace=${workspace} status=${status} duration=${durationMs}ms`;
  if (status === 'error' && errorMsg) {
    process.stderr.write(`${base} error=${JSON.stringify(errorMsg)}\n`);
  } else {
    process.stderr.write(`${base}\n`);
  }
}

/** Returns a snapshot of the audit ring buffer (most recent last). */
export function getAuditLog(): readonly AuditEntry[] {
  return auditBuffer;
}

/**
 * Low-level call to the HTTP Action gateway. Does NOT inject workspaceId.
 * Use mcpQuery / mcpMutation for workspace-scoped calls.
 */
export async function mcpCall<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const siteUrl = getEnv('CONVEX_SITE_URL').replace(/\/$/, '');
  const apiKey = getEnv('MCP_API_KEY');

  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(`${siteUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ fn, args }),
    });
  } catch (err: any) {
    audit(fn, 'error', Date.now() - start, err.message);
    throw new Error(`MCP call "${fn}" network error: ${err.message}`);
  }

  const json = await res.json() as { data?: T; error?: string };

  if (!res.ok || json.error) {
    audit(fn, 'error', Date.now() - start, json.error);
    throw new Error(`MCP call "${fn}" failed (${res.status}): ${json.error ?? 'unknown error'}`);
  }

  audit(fn, 'ok', Date.now() - start);
  return json.data as T;
}

/** Resolve and cache the workspace ID from WORKSPACE_SLUG. */
export async function getWorkspaceId(): Promise<string> {
  if (cachedWorkspaceId) return cachedWorkspaceId;

  const slug = getEnv('WORKSPACE_SLUG');
  const workspace = await mcpCall<{ _id: string; name: string; slug: string } | null>(
    'resolveWorkspace',
    { slug },
  );

  if (!workspace) {
    throw new Error(`Workspace with slug "${slug}" not found`);
  }

  cachedWorkspaceId = workspace._id;
  return cachedWorkspaceId;
}

/** Call a query scoped to the current workspace. */
export async function mcpQuery<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const workspaceId = await getWorkspaceId();
  return mcpCall<T>(fn, { ...args, workspaceId });
}

/** Call a mutation scoped to the current workspace. */
export async function mcpMutation<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const workspaceId = await getWorkspaceId();
  return mcpCall<T>(fn, { ...args, workspaceId });
}
