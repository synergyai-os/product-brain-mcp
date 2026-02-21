import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery, getWorkspaceId, getAuditLog, type AuditEntry } from "../client.js";

type CallCategory = "read" | "search" | "write" | "label" | "meta";

const CALL_CATEGORIES: Record<string, CallCategory> = {
  "kb.getEntry": "read",
  "kb.listEntries": "read",
  "kb.listEntryHistory": "read",
  "kb.listEntryRelations": "read",
  "kb.listEntriesByLabel": "read",
  "kb.searchEntries": "search",
  "kb.createEntry": "write",
  "kb.updateEntry": "write",
  "kb.createEntryRelation": "write",
  "kb.applyLabel": "label",
  "kb.removeLabel": "label",
  "kb.createLabel": "label",
  "kb.updateLabel": "label",
  "kb.deleteLabel": "label",
  "kb.listCollections": "meta",
  "kb.getCollection": "meta",
  "kb.listLabels": "meta",
  "resolveWorkspace": "meta",
};

function categorize(fn: string): CallCategory {
  return CALL_CATEGORIES[fn] ?? "meta";
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function buildSessionSummary(log: readonly AuditEntry[]): string {
  if (log.length === 0) return "";

  const byCategory = new Map<CallCategory, Map<string, number>>();
  let errorCount = 0;
  let writeCreates = 0;
  let writeUpdates = 0;

  for (const entry of log) {
    const cat = categorize(entry.fn);
    if (!byCategory.has(cat)) byCategory.set(cat, new Map());
    const fnCounts = byCategory.get(cat)!;
    fnCounts.set(entry.fn, (fnCounts.get(entry.fn) ?? 0) + 1);

    if (entry.status === "error") errorCount++;
    if (entry.fn === "kb.createEntry" && entry.status === "ok") writeCreates++;
    if (entry.fn === "kb.updateEntry" && entry.status === "ok") writeUpdates++;
  }

  const firstTs = new Date(log[0].ts).getTime();
  const lastTs = new Date(log[log.length - 1].ts).getTime();
  const duration = formatDuration(lastTs - firstTs);

  const lines: string[] = [`# Session Summary (${duration})\n`];

  const categoryLabels: [CallCategory, string][] = [
    ["read", "Reads"],
    ["search", "Searches"],
    ["write", "Writes"],
    ["label", "Labels"],
    ["meta", "Meta"],
  ];

  for (const [cat, label] of categoryLabels) {
    const fnCounts = byCategory.get(cat);
    if (!fnCounts || fnCounts.size === 0) continue;
    const total = [...fnCounts.values()].reduce((a, b) => a + b, 0);
    const detail = [...fnCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([fn, count]) => `${fn.replace("kb.", "")} x${count}`)
      .join(", ");
    lines.push(`- **${label}:** ${total} call${total === 1 ? "" : "s"} (${detail})`);
  }

  lines.push(`- **Errors:** ${errorCount}`);

  if (writeCreates > 0 || writeUpdates > 0) {
    lines.push("");
    lines.push("## Knowledge Contribution");
    if (writeCreates > 0) lines.push(`- ${writeCreates} entr${writeCreates === 1 ? "y" : "ies"} created`);
    if (writeUpdates > 0) lines.push(`- ${writeUpdates} entr${writeUpdates === 1 ? "y" : "ies"} updated`);
  }

  return lines.join("\n");
}

export function registerHealthTools(server: McpServer) {

  server.registerTool(
    "health",
    {
      title: "Health Check",
      description:
        "Verify that ProductBrain is running and can reach its backend. " +
        "Returns workspace status, collection count, entry count, and latency. " +
        "Use this to confirm connectivity before doing real work.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const start = Date.now();
      const errors: string[] = [];

      let workspaceId: string | undefined;
      try {
        workspaceId = await getWorkspaceId();
      } catch (e: any) {
        errors.push(`Workspace resolution failed: ${e.message}`);
      }

      let collections: any[] = [];
      try {
        collections = await mcpQuery<any[]>("kb.listCollections");
      } catch (e: any) {
        errors.push(`Collection fetch failed: ${e.message}`);
      }

      let totalEntries = 0;
      if (collections.length > 0) {
        try {
          const entries = await mcpQuery<any[]>("kb.listEntries", {});
          totalEntries = entries.length;
        } catch (e: any) {
          errors.push(`Entry count failed: ${e.message}`);
        }
      }

      const durationMs = Date.now() - start;
      const healthy = errors.length === 0;

      const lines = [
        `# ${healthy ? "Healthy" : "Degraded"}`,
        "",
        `**Workspace:** ${workspaceId ?? "unresolved"}`,
        `**Collections:** ${collections.length}`,
        `**Entries:** ${totalEntries}`,
        `**Latency:** ${durationMs}ms`,
      ];

      if (errors.length > 0) {
        lines.push("", "## Errors");
        for (const err of errors) {
          lines.push(`- ${err}`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "mcp-audit",
    {
      title: "Session Audit Log",
      description:
        "Show a session summary (reads, writes, searches, contributions) and the last N backend calls. " +
        "Useful for debugging, tracing tool behavior, and seeing what you contributed to the knowledge base.",
      inputSchema: {
        limit: z.number().min(1).max(50).default(20).describe("How many recent calls to show (max 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      const log = getAuditLog();
      const recent = log.slice(-limit);

      if (recent.length === 0) {
        return { content: [{ type: "text" as const, text: "No calls recorded yet this session." }] };
      }

      const summary = buildSessionSummary(log);

      const logLines = [`# Audit Log (last ${recent.length} of ${log.length} total)\n`];
      for (const entry of recent) {
        const icon = entry.status === "ok" ? "\u2713" : "\u2717";
        const errPart = entry.error ? ` \u2014 ${entry.error}` : "";
        logLines.push(`${icon} \`${entry.fn}\` ${entry.durationMs}ms ${entry.status}${errPart}`);
      }

      return {
        content: [{ type: "text" as const, text: `${summary}\n\n---\n\n${logLines.join("\n")}` }],
      };
    }
  );
}
