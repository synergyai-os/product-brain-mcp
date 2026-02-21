/**
 * Multi-client MCP config detection and writer.
 *
 * Supports:
 *  - Cursor: .cursor/mcp.json in cwd (project-level)
 *  - Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
 *                    %APPDATA%/Claude/claude_desktop_config.json (Windows)
 *
 * The writer reads existing config, merges the new server entry (never
 * overwrites existing entries), and writes back. Falls back to printing
 * a snippet for unsupported OS or unknown formats.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";

export interface McpClientInfo {
  name: string;
  configPath: string;
}

const SERVER_ENTRY_KEY = "productbrain";

function buildServerEntry(apiKey: string) {
  return {
    command: "npx",
    args: ["-y", "@productbrain/mcp"],
    env: { PRODUCTBRAIN_API_KEY: apiKey },
  };
}

// ── Detection ───────────────────────────────────────────────────────────

function getCursorConfigPath(): string {
  return join(process.cwd(), ".cursor", "mcp.json");
}

function getClaudeDesktopConfigPath(): string | null {
  const os = platform();
  if (os === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (os === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  // Linux: no official Claude Desktop location yet
  return null;
}

function isCursorProject(): boolean {
  return existsSync(join(process.cwd(), ".cursor")) || existsSync(join(process.cwd(), ".cursorignore"));
}

function isClaudeDesktopInstalled(): boolean {
  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) return false;
  // Check if the Claude directory exists (config file may not exist yet)
  return existsSync(dirname(configPath));
}

export function detectClients(): McpClientInfo[] {
  const clients: McpClientInfo[] = [];

  if (isCursorProject()) {
    clients.push({ name: "Cursor", configPath: getCursorConfigPath() });
  }

  if (isClaudeDesktopInstalled()) {
    clients.push({
      name: "Claude Desktop",
      configPath: getClaudeDesktopConfigPath()!,
    });
  }

  return clients;
}

// ── Writing ─────────────────────────────────────────────────────────────

function readJsonSafe(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Write or merge the productbrain server entry into a client config file.
 * Returns true if the config was written, false if already present.
 */
export async function writeClientConfig(
  client: McpClientInfo,
  apiKey: string,
): Promise<boolean> {
  const config = readJsonSafe(client.configPath);

  const serversKey = "mcpServers";
  if (!config[serversKey]) config[serversKey] = {};

  // Don't overwrite an existing productbrain entry
  if (config[serversKey][SERVER_ENTRY_KEY]) {
    return false;
  }

  config[serversKey][SERVER_ENTRY_KEY] = buildServerEntry(apiKey);

  const dir = dirname(client.configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(client.configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}
