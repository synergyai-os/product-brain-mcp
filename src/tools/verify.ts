import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery, mcpMutation } from "../client.js";

// ── Types ──────────────────────────────────────────────────────────────

type MappingKind = "file" | "schema" | "conceptual";
type CheckResult = "verified" | "drifted" | "unverifiable";

interface MappingCheck {
  entryId: string;
  entryName: string;
  field: string;
  kind: MappingKind;
  result: CheckResult;
  reason: string;
  currentStatus: string;
}

interface RefCheck {
  entryId: string;
  entryName: string;
  refValue: string;
  found: boolean;
}

// ── Project Root Resolution ────────────────────────────────────────────

function resolveProjectRoot(): string | null {
  const candidates = [
    process.env.WORKSPACE_PATH,
    process.cwd(),
    resolve(process.cwd(), ".."),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    const resolved = resolve(dir);
    if (existsSync(resolve(resolved, "convex/schema.ts"))) return resolved;
  }
  return null;
}

// ── Schema Parser ──────────────────────────────────────────────────────

function parseConvexSchema(schemaPath: string): Map<string, Set<string>> {
  const content = readFileSync(schemaPath, "utf-8");
  const tables = new Map<string, Set<string>>();
  let currentTable: string | null = null;

  for (const line of content.split("\n")) {
    const tableMatch = line.match(/^\t(\w+):\s*defineTable\(/);
    if (tableMatch) {
      currentTable = tableMatch[1];
      tables.set(currentTable, new Set());
      continue;
    }

    if (currentTable && /^\t[}\)]/.test(line) && !/^\t\t/.test(line)) {
      currentTable = null;
      continue;
    }

    if (currentTable) {
      const fieldMatch = line.match(/^\t\t(\w+):\s*v\./);
      if (fieldMatch) tables.get(currentTable)!.add(fieldMatch[1]);
    }
  }

  return tables;
}

// ── Code Mapping Classifiers ───────────────────────────────────────────

function cleanFieldRef(field: string): string {
  return field
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/\s*=\s*.*$/, "")
    .trim();
}

function splitMultiRefs(field: string): string[] {
  if (field.includes(" + ")) return field.split(/\s*\+\s*/);
  return [field];
}

const FILE_EXT_RE = /\.(ts|js|svelte|json|css|md|jsx|tsx|mjs|cjs)(?:\s|$)/i;

function classifyRef(cleaned: string): MappingKind {
  if (cleaned.includes("/") || FILE_EXT_RE.test(cleaned) || /^\.\w+/.test(cleaned)) {
    return "file";
  }
  if (/^\w+\.\w+$/.test(cleaned)) return "schema";
  if (/^\w+\s+table$/i.test(cleaned)) return "schema";
  return "conceptual";
}

// ── Verification Checkers ──────────────────────────────────────────────

function checkFileRef(ref: string, root: string): { result: CheckResult; reason: string } {
  const filePart = ref.split(/\s+/)[0];
  const fullPath = resolve(root, filePart);
  if (existsSync(fullPath)) return { result: "verified", reason: "exists" };
  return { result: "drifted", reason: `not found: ${filePart}` };
}

function checkSchemaRef(
  ref: string,
  schema: Map<string, Set<string>>,
): { result: CheckResult; reason: string } {
  const tableOnlyMatch = ref.match(/^(\w+)\s+table$/i);
  if (tableOnlyMatch) {
    const table = tableOnlyMatch[1];
    if (schema.has(table)) return { result: "verified", reason: `table "${table}" exists` };
    return { result: "drifted", reason: `table "${table}" not found in schema` };
  }

  const dotIdx = ref.indexOf(".");
  if (dotIdx > 0) {
    const table = ref.slice(0, dotIdx);
    const field = ref.slice(dotIdx + 1);
    if (!schema.has(table)) return { result: "drifted", reason: `table "${table}" not found in schema` };
    if (!schema.get(table)!.has(field)) return { result: "drifted", reason: `field "${field}" not found in table "${table}"` };
    return { result: "verified", reason: `${table}.${field} exists` };
  }

  return { result: "unverifiable", reason: "could not parse schema reference" };
}

// ── Trust Report Formatter ─────────────────────────────────────────────

function formatTrustReport(
  collection: string,
  entryCount: number,
  mappings: MappingCheck[],
  refs: RefCheck[],
  fixes: string[],
  mode: string,
  schemaTableCount: number,
  projectRoot: string,
): string {
  const verified = mappings.filter((c) => c.result === "verified").length;
  const drifted = mappings.filter((c) => c.result === "drifted").length;
  const unverifiable = mappings.filter((c) => c.result === "unverifiable").length;

  const refsValid = refs.filter((c) => c.found).length;
  const refsBroken = refs.filter((c) => !c.found).length;

  const totalChecks = mappings.length + refs.length;
  const totalPassed = verified + refsValid;
  const trustScore = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 100;

  const lines: string[] = [
    `# Trust Report: ${collection} (${entryCount} entries scanned)`,
    "",
  ];

  if (mappings.length > 0) {
    lines.push(
      "## Code Mapping Verification",
      `- ${mappings.length} mappings checked`,
      `- ${verified} verified (${Math.round((verified / mappings.length) * 100)}%)`,
      `- ${drifted} drifted (file/schema not found)`,
      `- ${unverifiable} unverifiable (conceptual — skipped)`,
      "",
    );
  }

  if (drifted > 0) {
    lines.push("### Drifted Mappings");
    for (const mc of mappings.filter((c) => c.result === "drifted")) {
      lines.push(`- **${mc.entryId}** (${mc.entryName}): \`${mc.field}\` — ${mc.reason}`);
    }
    lines.push("");
  }

  if (unverifiable > 0) {
    lines.push("### Unverifiable (Conceptual)");
    for (const mc of mappings.filter((c) => c.result === "unverifiable")) {
      lines.push(`- **${mc.entryId}** (${mc.entryName}): \`${mc.field}\``);
    }
    lines.push("");
  }

  if (refs.length > 0) {
    lines.push(
      "## Cross-Reference Verification",
      `- ${refs.length} references checked`,
      `- ${refsValid} valid (${refs.length > 0 ? Math.round((refsValid / refs.length) * 100) : 0}%)`,
      `- ${refsBroken} broken`,
      "",
    );
  }

  if (refsBroken > 0) {
    lines.push("### Broken References");
    for (const rc of refs.filter((c) => !c.found)) {
      lines.push(`- **${rc.entryId}** (${rc.entryName}): relatedRules \`${rc.refValue}\` — entry not found`);
    }
    lines.push("");
  }

  lines.push(`## Trust Score: ${trustScore}% (${totalPassed} of ${totalChecks} checks passed)`);

  if (mode === "fix" && fixes.length > 0) {
    lines.push(
      "",
      "## Applied Fixes",
      `Updated codeMapping status from \`aligned\` → \`drifted\` on ${fixes.length} entr${fixes.length === 1 ? "y" : "ies"}:`,
    );
    for (const eid of fixes) lines.push(`- ${eid}`);
  } else if (mode === "report" && drifted > 0) {
    const fixable = mappings.filter((c) => c.result === "drifted" && c.currentStatus === "aligned").length;
    if (fixable > 0) {
      lines.push("", `_${fixable} mapping(s) marked "aligned" but actually drifted. Run with mode="fix" to update._`);
    }
  }

  lines.push("", "---", `_Schema: ${schemaTableCount} tables parsed from convex/schema.ts. Project root: ${projectRoot}_`);

  return lines.join("\n");
}

// ── Tool Registration ──────────────────────────────────────────────────

export function registerVerifyTools(server: McpServer) {
  server.registerTool(
    "verify",
    {
      title: "Verify Knowledge Base",
      description:
        "Verify knowledge entries against the actual codebase. Checks glossary code mappings " +
        "(do referenced files and schema fields still exist?) and validates cross-references " +
        "(do relatedRules point to real entries?). Produces a trust report with a trust score. " +
        "Use mode='fix' to auto-update drifted codeMapping statuses.",
      inputSchema: {
        collection: z.string().default("glossary")
          .describe("Collection slug to verify (default: glossary)"),
        mode: z.enum(["report", "fix"]).default("report")
          .describe("'report' = read-only trust report. 'fix' = also update drifted codeMapping statuses."),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ collection, mode }) => {
      const projectRoot = resolveProjectRoot();
      if (!projectRoot) {
        return {
          content: [{
            type: "text" as const,
            text: "# Verification Failed\n\n" +
              "Cannot find project root (looked for `convex/schema.ts` in cwd and parent directory).\n\n" +
              "Set `WORKSPACE_PATH` in `.env.mcp` to the absolute path of the ProductBrain project root.",
          }],
        };
      }

      const schema = parseConvexSchema(resolve(projectRoot, "convex/schema.ts"));

      await server.sendLoggingMessage({
        level: "info",
        data: `Verifying "${collection}" against ${schema.size} schema tables at ${projectRoot}`,
        logger: "product-os",
      });

      const scopedEntries = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: collection });

      if (scopedEntries.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No entries found in \`${collection}\`. Nothing to verify.` }],
        };
      }

      // Build cross-reference lookup: fetch all entries to check relatedRules
      let allEntryIds: Set<string>;
      try {
        const allEntries = await mcpQuery<any[]>("kb.listEntries", {});
        allEntryIds = new Set(allEntries.map((e: any) => e.entryId).filter(Boolean));
      } catch {
        allEntryIds = new Set(scopedEntries.map((e: any) => e.entryId).filter(Boolean));
      }

      const mappingChecks: MappingCheck[] = [];
      const refChecks: RefCheck[] = [];

      for (const entry of scopedEntries) {
        const eid = entry.entryId ?? entry.name;
        const ename = entry.name;

        // ── Code mapping verification ──
        const codeMappings: any[] = entry.data?.codeMapping ?? [];
        for (const cm of codeMappings) {
          const rawField: string = cm.field ?? "";
          for (const rawRef of splitMultiRefs(rawField)) {
            const cleaned = cleanFieldRef(rawRef);
            if (!cleaned) continue;

            const kind = classifyRef(cleaned);
            let result: CheckResult;
            let reason: string;

            if (kind === "file") {
              ({ result, reason } = checkFileRef(cleaned, projectRoot));
            } else if (kind === "schema") {
              ({ result, reason } = checkSchemaRef(cleaned, schema));
            } else {
              result = "unverifiable";
              reason = "conceptual reference";
            }

            mappingChecks.push({
              entryId: eid, entryName: ename, field: rawRef.trim(),
              kind, result, reason, currentStatus: cm.status ?? "unknown",
            });
          }
        }

        // ── Cross-reference verification (relatedRules only) ──
        const MAX_CROSS_REFS = 50;
        const relatedRules: string[] = entry.data?.relatedRules ?? [];
        for (const ruleId of relatedRules) {
          if (refChecks.length >= MAX_CROSS_REFS) break;
          refChecks.push({
            entryId: eid, entryName: ename, refValue: ruleId,
            found: allEntryIds.has(ruleId),
          });
        }
      }

      // ── Fix mode: update aligned → drifted ──
      const fixes: string[] = [];
      if (mode === "fix") {
        const driftedByEntry = new Map<string, Set<string>>();
        for (const mc of mappingChecks) {
          if (mc.result === "drifted" && mc.currentStatus === "aligned") {
            if (!driftedByEntry.has(mc.entryId)) driftedByEntry.set(mc.entryId, new Set());
            driftedByEntry.get(mc.entryId)!.add(mc.field);
          }
        }

        for (const [eid, driftedFields] of driftedByEntry) {
          const entry = scopedEntries.find((e: any) => (e.entryId ?? e.name) === eid);
          if (!entry?.entryId) continue;

          const updated = (entry.data?.codeMapping ?? []).map((cm: any) =>
            cm.status === "aligned" && driftedFields.has(cm.field)
              ? { ...cm, status: "drifted" }
              : cm,
          );

          await mcpMutation("kb.updateEntry", {
            entryId: entry.entryId,
            data: { codeMapping: updated },
          });
          fixes.push(entry.entryId);
        }
      }

      const report = formatTrustReport(
        collection, scopedEntries.length,
        mappingChecks, refChecks, fixes, mode,
        schema.size, projectRoot,
      );

      return { content: [{ type: "text" as const, text: report }] };
    },
  );
}
