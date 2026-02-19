import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery } from "../client.js";

export function registerPrompts(server: McpServer) {
  server.prompt(
    "review-against-rules",
    "Review code or a design decision against all business rules for a given domain. Fetches the rules and asks you to do a structured compliance review.",
    { domain: z.string().describe("Business rule domain (e.g. 'Identity & Access', 'Governance & Decision-Making')") },
    async ({ domain }) => {
      const entries = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: "business-rules" });
      const rules = entries.filter((e) => e.data?.domain === domain);

      if (rules.length === 0) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `No business rules found for domain "${domain}". Use the list-entries tool with collection "business-rules" to see available domains.`,
              },
            },
          ],
        };
      }

      const rulesText = rules
        .map(
          (r) =>
            `### ${r.entryId ?? ""}: ${r.name}\n` +
            `Status: ${r.status} | Severity: ${r.data?.severity ?? "unknown"}\n` +
            `Description: ${r.data?.description ?? ""}\n` +
            `Data Impact: ${r.data?.dataImpact ?? ""}\n` +
            `Platforms: ${(r.data?.platforms ?? []).join(", ")}\n` +
            (r.data?.conflictWith ? `CONFLICT: ${r.data.conflictWith.rule} — ${r.data.conflictWith.nature}\n` : "")
        )
        .join("\n---\n\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Review the current code or design against the following business rules for the "${domain}" domain.\n\n` +
                `For each rule, assess:\n` +
                `1. Is the current implementation compliant?\n` +
                `2. Are there potential violations or edge cases?\n` +
                `3. What specific changes would be needed for compliance?\n\n` +
                `Business Rules:\n\n${rulesText}\n\n` +
                `Provide a structured review with a compliance status for each rule (COMPLIANT / AT RISK / VIOLATION / NOT APPLICABLE).`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "name-check",
    "Check variable names, field names, or API names against the glossary for terminology alignment. Flags drift from canonical terms.",
    { names: z.string().describe("Comma-separated list of names to check (e.g. 'vendor_id, compliance_level, formulator_type')") },
    async ({ names }) => {
      const terms = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: "glossary" });

      const glossaryContext = terms
        .map(
          (t) =>
            `${t.name} (${t.entryId ?? ""}) [${t.status}]: ${t.data?.canonical ?? ""}` +
            (t.data?.confusedWith?.length > 0 ? ` — Often confused with: ${t.data.confusedWith.join(", ")}` : "") +
            (t.data?.codeMapping?.length > 0
              ? `\n  Code mappings: ${t.data.codeMapping.map((m: any) => `${m.platform}:${m.field}`).join(", ")}`
              : "")
        )
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Check the following names against the glossary for terminology alignment:\n\n` +
                `Names to check: ${names}\n\n` +
                `Glossary (canonical terms):\n${glossaryContext}\n\n` +
                `For each name:\n` +
                `1. Does it match a canonical term? If so, which one?\n` +
                `2. Is there terminology drift? (e.g. using "vendor" instead of "supplier", "compliance" instead of "conformance")\n` +
                `3. Suggest the canonical alternative if drift is detected.\n` +
                `4. Flag any names that don't have a corresponding glossary term (might need one).\n\n` +
                `Format as a table: Name | Status | Canonical Form | Action Needed`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "draft-decision-record",
    "Draft a structured decision record from a description of what was decided. Includes context from recent decisions and relevant rules.",
    { context: z.string().describe("Description of the decision (e.g. 'We decided to use MRSL v3.1 as the conformance baseline because...')") },
    async ({ context }) => {
      const recentDecisions = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: "decisions" });
      const sorted = [...recentDecisions]
        .sort((a, b) => ((b.data?.date ?? "") > (a.data?.date ?? "") ? 1 : -1))
        .slice(0, 5);

      const recentContext = sorted.length > 0
        ? sorted.map((d) => `- [${d.status}] ${d.name} (${d.data?.date ?? "no date"})`).join("\n")
        : "No previous decisions recorded.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Draft a structured decision record from the following context:\n\n` +
                `"${context}"\n\n` +
                `Recent decisions for reference:\n${recentContext}\n\n` +
                `Structure the decision record with:\n` +
                `1. **Title**: Concise decision statement\n` +
                `2. **Decided by**: Who made or approved this decision\n` +
                `3. **Date**: When it was decided\n` +
                `4. **Status**: decided / proposed / revisited\n` +
                `5. **Rationale**: Why this decision was made, including trade-offs considered\n` +
                `6. **Alternatives considered**: What else was on the table\n` +
                `7. **Related rules or tensions**: Any business rules or tensions this connects to\n\n` +
                `After drafting, I can log it using the create-entry tool with collection "decisions".`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "draft-rule-from-context",
    "Draft a new business rule from an observation or discovery made while coding. Fetches existing rules for the domain to ensure consistency.",
    {
      observation: z.string().describe("What you observed or discovered (e.g. 'Suppliers can have multiple org types in Gateway')"),
      domain: z.string().describe("Which domain this rule belongs to (e.g. 'Governance & Decision-Making')"),
    },
    async ({ observation, domain }) => {
      const allRules = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: "business-rules" });
      const existingRules = allRules.filter((r) => r.data?.domain === domain);

      const existingContext =
        existingRules.length > 0
          ? existingRules.map((r) => `${r.entryId ?? ""}: ${r.name} [${r.status}] — ${r.data?.description ?? ""}`).join("\n")
          : "No existing rules for this domain.";

      const highestRuleNum = allRules
        .map((r) => parseInt((r.entryId ?? "").replace(/^[A-Z]+-/, ""), 10))
        .filter((n) => !isNaN(n))
        .sort((a, b) => b - a)[0] || 0;
      const nextRuleId = `SOS-${String(highestRuleNum + 1).padStart(3, "0")}`;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Draft a business rule based on this observation:\n\n` +
                `"${observation}"\n\n` +
                `Domain: ${domain}\n` +
                `Suggested rule ID: ${nextRuleId}\n\n` +
                `Existing rules in this domain:\n${existingContext}\n\n` +
                `Draft the rule with these fields:\n` +
                `1. **entryId**: ${nextRuleId}\n` +
                `2. **name**: Concise rule title\n` +
                `3. **data.description**: What the rule states\n` +
                `4. **data.rationale**: Why this rule matters\n` +
                `5. **data.dataImpact**: How this affects data models, APIs, or storage\n` +
                `6. **data.severity**: high / medium / low\n` +
                `7. **data.platforms**: Which platforms are affected\n` +
                `8. **data.relatedRules**: Any related existing rules\n\n` +
                `Make sure the rule is consistent with existing rules and doesn't contradict them. ` +
                `After drafting, I can create it using the create-entry tool with collection "business-rules".`,
            },
          },
        ],
      };
    }
  );
}
