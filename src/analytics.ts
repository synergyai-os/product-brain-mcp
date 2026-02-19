/**
 * PostHog server-side analytics for MCP tool usage.
 *
 * Captures mcp_tool_called and mcp_session_started events so we can track
 * per-workspace, per-developer MCP adoption in the same PostHog project
 * as the frontend.
 *
 * Gracefully no-ops when POSTHOG_MCP_KEY is not set (local dev).
 */

import { userInfo } from "node:os";
import { PostHog } from "posthog-node";

let client: PostHog | null = null;
let distinctId = "anonymous";

const POSTHOG_HOST = "https://eu.i.posthog.com";

export function initAnalytics(): void {
  const apiKey = process.env.POSTHOG_MCP_KEY;
  if (!apiKey) {
    process.stderr.write("[MCP-ANALYTICS] POSTHOG_MCP_KEY not set — tracking disabled\n");
    return;
  }

  client = new PostHog(apiKey, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 5000,
  });
  distinctId = process.env.MCP_USER_ID || fallbackDistinctId();

  process.stderr.write(
    `[MCP-ANALYTICS] Initialized — host=${POSTHOG_HOST} distinctId=${distinctId}\n`,
  );
}

function fallbackDistinctId(): string {
  try {
    return userInfo().username;
  } catch {
    return `os-${process.pid}`;
  }
}

export function trackSessionStarted(
  workspaceSlug: string,
  workspaceId: string,
  serverVersion: string,
): void {
  if (!client) return;
  client.capture({
    distinctId,
    event: "mcp_session_started",
    properties: {
      workspace_slug: workspaceSlug,
      workspace_id: workspaceId,
      server_version: serverVersion,
      source: "mcp-server",
      $groups: { workspace: workspaceId },
    },
  });
}

export function trackToolCall(
  fn: string,
  status: "ok" | "error",
  durationMs: number,
  workspaceId: string,
  errorMsg?: string,
): void {
  const properties: Record<string, unknown> = {
    tool: fn,
    status,
    duration_ms: durationMs,
    workspace_slug: process.env.WORKSPACE_SLUG ?? "unknown",
    source: "mcp-server",
    $groups: { workspace: workspaceId },
  };
  if (errorMsg) properties.error = errorMsg;

  if (!client) return;
  client.capture({
    distinctId,
    event: "mcp_tool_called",
    properties,
  });
}

export async function shutdownAnalytics(): Promise<void> {
  await client?.shutdown();
}
