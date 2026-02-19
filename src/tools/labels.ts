import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery, mcpMutation } from "../client.js";

export function registerLabelTools(server: McpServer) {

  server.registerTool(
    "list-labels",
    {
      title: "Browse Labels",
      description:
        "List all workspace labels with their groups and hierarchy. " +
        "Labels can be applied to any entry across any collection for cross-domain filtering. " +
        "Similar to labels in Linear or GitHub.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const labels = await mcpQuery<any[]>("kb.listLabels");

      if (labels.length === 0) {
        return { content: [{ type: "text" as const, text: "No labels defined in this workspace yet." }] };
      }

      const groups = labels.filter((l) => l.isGroup);
      const ungrouped = labels.filter((l) => !l.isGroup && !l.parentId);
      const children = (parentId: string) => labels.filter((l) => l.parentId === parentId);

      const lines: string[] = ["# Workspace Labels"];

      for (const group of groups) {
        lines.push(`\n## ${group.name}`);
        if (group.description) lines.push(`_${group.description}_`);
        for (const child of children(group._id)) {
          const color = child.color ? ` ${child.color}` : "";
          lines.push(`  - \`${child.slug}\` ${child.name}${color}`);
        }
      }

      if (ungrouped.length > 0) {
        lines.push("\n## Ungrouped");
        for (const label of ungrouped) {
          const color = label.color ? ` ${label.color}` : "";
          lines.push(`- \`${label.slug}\` ${label.name}${color}${label.description ? ` — _${label.description}_` : ""}`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  server.registerTool(
    "manage-labels",
    {
      title: "Manage Labels",
      description:
        "Create, update, or delete a workspace label. Labels support hierarchy (groups with children). " +
        "Use list-labels first to see what exists.",
      inputSchema: {
        action: z.enum(["create", "update", "delete"]).describe("What to do"),
        slug: z.string().describe("Label slug (machine name), e.g. 'p1-critical', 'needs-review'"),
        name: z.string().optional().describe("Display name (required for create)"),
        color: z.string().optional().describe("Hex color, e.g. '#ef4444'"),
        description: z.string().optional().describe("What this label means"),
        parentSlug: z.string().optional().describe("Parent group slug for label hierarchy"),
        isGroup: z.boolean().optional().describe("True if this is a group container, not a taggable label"),
        order: z.number().optional().describe("Sort order within its group"),
      },
    },
    async ({ action, slug, name, color, description, parentSlug, isGroup, order }) => {
      if (action === "create") {
        if (!name) {
          return { content: [{ type: "text" as const, text: "Cannot create a label without a name." }] };
        }

        let parentId: string | undefined;
        if (parentSlug) {
          const labels = await mcpQuery<any[]>("kb.listLabels");
          const parent = labels.find((l: any) => l.slug === parentSlug);
          if (!parent) {
            return { content: [{ type: "text" as const, text: `Parent label \`${parentSlug}\` not found. Use list-labels to see available groups.` }] };
          }
          parentId = parent._id;
        }

        await mcpMutation("kb.createLabel", { slug, name, color, description, parentId, isGroup, order });
        return { content: [{ type: "text" as const, text: `# Label Created\n\n**${name}** (\`${slug}\`)` }] };
      }

      if (action === "update") {
        await mcpMutation("kb.updateLabel", { slug, name, color, description, isGroup, order });
        return { content: [{ type: "text" as const, text: `# Label Updated\n\n\`${slug}\` has been updated.` }] };
      }

      if (action === "delete") {
        await mcpMutation("kb.deleteLabel", { slug });
        return { content: [{ type: "text" as const, text: `# Label Deleted\n\n\`${slug}\` removed from all entries and deleted.` }] };
      }

      return { content: [{ type: "text" as const, text: "Unknown action." }] };
    }
  );

  server.registerTool(
    "label-entry",
    {
      title: "Tag Entry with Label",
      description:
        "Apply or remove a label from a knowledge entry. Labels work across all collections for cross-domain filtering. " +
        "Use list-labels to see available label slugs.",
      inputSchema: {
        action: z.enum(["apply", "remove"]).describe("Apply or remove the label"),
        entryId: z.string().describe("Entry ID, e.g. 'T-SUPPLIER', 'EVT-workspace_created'"),
        label: z.string().describe("Label slug to apply/remove"),
      },
    },
    async ({ action, entryId, label }) => {
      if (action === "apply") {
        await mcpMutation("kb.applyLabel", { entryId, labelSlug: label });
        return { content: [{ type: "text" as const, text: `Label \`${label}\` applied to **${entryId}**.` }] };
      }

      await mcpMutation("kb.removeLabel", { entryId, labelSlug: label });
      return { content: [{ type: "text" as const, text: `Label \`${label}\` removed from **${entryId}**.` }] };
    }
  );
}
